const antinukeModule = require('../../bot/modules/antinuke');
const { getClient } = require('../../bot/client');
const { getDb } = require('../../database');
const config = require('../../config');

class AntinukeController {
  getConfig(req, res) {
    const guildId = config.discord.guildId;
    const cfg = antinukeModule.getConfig(guildId);
    const db = getDb();

    const trustedUsers = db.prepare(`
      SELECT * FROM trusted_users 
      WHERE guild_id = ? AND (type = 'antinuke' OR type = 'both')
      ORDER BY created_at DESC
    `).all(guildId);

    return res.success({
      config: cfg,
      trustedUsers
    }, 'Antinuke configuration retrieved.');
  }

  updateConfig(req, res) {
    const guildId = config.discord.guildId;
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.error('Request body must be an object with configuration updates.');
    }

    try {
      const updated = antinukeModule.updateConfig(guildId, updates);
      return res.success(updated, 'Antinuke configuration updated successfully.');
    } catch (err) {
      return res.error(`Failed to update antinuke config: ${err.message}`);
    }
  }

  getLogs(req, res) {
    const guildId = config.discord.guildId;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

    const result = antinukeModule.getSecurityLogs(guildId, limit, offset);
    return res.success(result, 'Antinuke logs retrieved.');
  }

  async toggleLockdown(req, res) {
    const guildId = config.discord.guildId;
    const { enable = true } = req.body;
    const client = getClient();
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.error('Target Discord guild not reachable by bot.', 503, 'GUILD_UNAVAILABLE');
    }

    try {
      const result = await antinukeModule.toggleEmergencyLockdown(guild, Boolean(enable), req.session.user ? req.session.user.username : 'API Admin');
      return res.success(result, `Emergency lockdown ${enable ? 'ENGAGED' : 'RELEASED'}.`);
    } catch (err) {
      return res.error(`Failed to execute lockdown: ${err.message}`);
    }
  }

  addTrustedUser(req, res) {
    const guildId = config.discord.guildId;
    const { userId, userTag, notes } = req.body;

    if (!userId) {
      return res.error('userId is required.');
    }

    const db = getDb();
    try {
      db.prepare(`
        INSERT INTO trusted_users (guild_id, user_id, user_tag, type, added_by, notes)
        VALUES (?, ?, ?, 'antinuke', ?, ?)
        ON CONFLICT(guild_id, user_id, type) DO UPDATE SET notes = excluded.notes
      `).run(
        guildId,
        userId,
        userTag || null,
        req.session.user ? req.session.user.username : 'API Admin',
        notes || null
      );

      return res.success({ userId, userTag }, 'User added to antinuke trusted list.');
    } catch (err) {
      return res.error(`Failed to add trusted user: ${err.message}`);
    }
  }

  removeTrustedUser(req, res) {
    const guildId = config.discord.guildId;
    const { id } = req.params;

    const db = getDb();
    const result = db.prepare('DELETE FROM trusted_users WHERE id = ? AND guild_id = ?').run(id, guildId);

    if (result.changes === 0) {
      return res.error('Trusted user entry not found.', 404, 'NOT_FOUND');
    }

    return res.success({ id }, 'User removed from trusted list.');
  }
}

module.exports = new AntinukeController();
