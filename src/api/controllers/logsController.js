const { getDb } = require('../../database');
const config = require('../../config');

class LogsController {
  getLogs(req, res) {
    const guildId = config.discord.guildId;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM activity_logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(guildId, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM activity_logs WHERE guild_id = ?').get(guildId).count;

    return res.success({
      total,
      limit,
      offset,
      logs: rows
    }, 'Activity logs retrieved.');
  }

  getLogsByType(req, res) {
    const guildId = config.discord.guildId;
    const { type } = req.params;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));
    const db = getDb();

    if (type === 'security') {
      const rows = db.prepare(`
        SELECT * FROM security_logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(guildId, limit, offset);
      const total = db.prepare('SELECT COUNT(*) as count FROM security_logs WHERE guild_id = ?').get(guildId).count;

      return res.success({
        type: 'security',
        total,
        limit,
        offset,
        logs: rows.map(r => ({
          ...r,
          details: r.details_json ? JSON.parse(r.details_json) : null
        }))
      }, 'Security logs retrieved.');

    } else if (type === 'messages') {
      const rows = db.prepare(`
        SELECT * FROM message_logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(guildId, limit, offset);
      const total = db.prepare('SELECT COUNT(*) as count FROM message_logs WHERE guild_id = ?').get(guildId).count;

      return res.success({
        type: 'messages',
        total,
        limit,
        offset,
        logs: rows.map(r => ({
          ...r,
          embed: r.embed_json ? JSON.parse(r.embed_json) : null
        }))
      }, 'Sent message logs retrieved.');

    } else if (type === 'activity') {
      const rows = db.prepare(`
        SELECT * FROM activity_logs WHERE guild_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(guildId, limit, offset);
      const total = db.prepare('SELECT COUNT(*) as count FROM activity_logs WHERE guild_id = ?').get(guildId).count;

      return res.success({
        type: 'activity',
        total,
        limit,
        offset,
        logs: rows
      }, 'Dashboard activity logs retrieved.');

    } else {
      return res.error(`Invalid log type "${type}". Allowed types: security, messages, activity.`, 400);
    }
  }
}

module.exports = new LogsController();
