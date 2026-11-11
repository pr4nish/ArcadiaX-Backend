const { getDb } = require('../../database');
const config = require('../../config');
const { getClient } = require('../../bot/client');

class SettingsController {
  getSettings(req, res) {
    const guildId = config.discord.guildId;
    const db = getDb();

    let serverCfg = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(guildId);
    if (!serverCfg) {
      db.prepare('INSERT INTO server_config (guild_id) VALUES (?)').run(guildId);
      serverCfg = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(guildId);
    }

    const client = getClient();
    const guild = client.guilds.cache.get(guildId);

    return res.success({
      server: serverCfg,
      bot: {
        guildId,
        guildName: guild ? guild.name : 'Unknown Server',
        ownerId: config.discord.ownerId,
        adminUserIds: config.discord.adminUserIds,
        dashboardUrl: config.dashboardUrl,
        apiUrl: config.apiUrl
      }
    }, 'Server settings retrieved.');
  }

  updateSettings(req, res) {
    const guildId = config.discord.guildId;
    const { prefix, log_channel_id, security_alert_channel_id } = req.body;
    const db = getDb();

    const fields = [];
    const values = [];

    if (prefix !== undefined) {
      fields.push('prefix = ?');
      values.push(prefix);
    }
    if (log_channel_id !== undefined) {
      fields.push('log_channel_id = ?');
      values.push(log_channel_id);
    }
    if (security_alert_channel_id !== undefined) {
      fields.push('security_alert_channel_id = ?');
      values.push(security_alert_channel_id);
    }

    if (fields.length === 0) {
      return res.error('No valid settings fields provided for update.');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(guildId);

    db.prepare(`UPDATE server_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
    const updated = db.prepare('SELECT * FROM server_config WHERE guild_id = ?').get(guildId);

    return res.success(updated, 'Settings updated successfully.');
  }
}

module.exports = new SettingsController();
