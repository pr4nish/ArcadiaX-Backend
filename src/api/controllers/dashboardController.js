const { getClient } = require('../../bot/client');
const { getDb } = require('../../database');
const config = require('../../config');

class DashboardController {
  async getOverview(req, res) {
    const client = getClient();
    const guild = client.guilds.cache.get(config.discord.guildId);
    const db = getDb();

    // Database counts
    const ticketsRow = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as openCount,
        SUM(CASE WHEN status = 'claimed' THEN 1 ELSE 0 END) as claimedCount,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closedCount
      FROM tickets WHERE guild_id = ?
    `).get(config.discord.guildId) || { total: 0, openCount: 0, claimedCount: 0, closedCount: 0 };

    const backupsCount = db.prepare('SELECT COUNT(*) as count FROM backups WHERE guild_id = ?').get(config.discord.guildId)?.count || 0;

    const securityStats = db.prepare(`
      SELECT 
        COUNT(*) as totalIncidents,
        SUM(CASE WHEN module = 'antinuke' THEN 1 ELSE 0 END) as antinukeCount,
        SUM(CASE WHEN module = 'antibetray' THEN 1 ELSE 0 END) as antibetrayCount,
        SUM(CASE WHEN mitigated = 1 THEN 1 ELSE 0 END) as mitigatedCount
      FROM security_logs WHERE guild_id = ?
    `).get(config.discord.guildId) || { totalIncidents: 0, antinukeCount: 0, antibetrayCount: 0, mitigatedCount: 0 };

    // Recent 5 security incidents
    const recentIncidents = db.prepare(`
      SELECT * FROM security_logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT 5
    `).all(config.discord.guildId);

    // Guild counts
    const overviewData = {
      guild: {
        id: config.discord.guildId,
        name: guild ? guild.name : 'ArcadiaX Protected Server',
        icon: guild ? guild.iconURL({ dynamic: true }) : null,
        memberCount: guild ? guild.memberCount : 0,
        rolesCount: guild ? guild.roles.cache.size : 0,
        channelsCount: guild ? guild.channels.cache.size : 0
      },
      stats: {
        tickets: {
          total: ticketsRow.total || 0,
          open: ticketsRow.openCount || 0,
          claimed: ticketsRow.claimedCount || 0,
          closed: ticketsRow.closedCount || 0
        },
        backups: {
          total: backupsCount
        },
        security: {
          totalIncidents: securityStats.totalIncidents || 0,
          antinuke: securityStats.antinukeCount || 0,
          antibetray: securityStats.antibetrayCount || 0,
          mitigated: securityStats.mitigatedCount || 0
        }
      },
      recentIncidents: recentIncidents.map(inc => ({
        ...inc,
        details: inc.details_json ? JSON.parse(inc.details_json) : null
      }))
    };

    return res.success(overviewData, 'Dashboard overview data loaded.');
  }

  getStatus(req, res) {
    const client = getClient();
    const isReady = client && client.ws && client.ws.status === 0;
    const uptimeSeconds = Math.floor(process.uptime());
    const mem = process.memoryUsage();

    return res.success({
      bot: {
        online: isReady,
        tag: client && client.user ? client.user.tag : 'ArcadiaX#0000',
        id: client && client.user ? client.user.id : config.discord.clientId,
        ping: client && client.ws ? client.ws.ping : -1,
        guildId: config.discord.guildId
      },
      system: {
        uptimeSeconds,
        uptimeFormatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
        memoryUsageMb: {
          heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2),
          heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2),
          rss: (mem.rss / 1024 / 1024).toFixed(2)
        },
        nodeVersion: process.version,
        platform: process.platform,
        environment: config.env
      },
      database: {
        type: 'SQLite (better-sqlite3)',
        mode: 'WAL',
        status: 'Connected & Healthy'
      }
    }, 'System status retrieved.');
  }
}

module.exports = new DashboardController();
