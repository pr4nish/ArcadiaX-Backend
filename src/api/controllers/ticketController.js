const ticketModule = require('../../bot/modules/tickets');
const { getClient } = require('../../bot/client');
const config = require('../../config');

class TicketController {
  getTickets(req, res) {
    const guildId = config.discord.guildId;
    const status = req.query.status || null;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

    const result = ticketModule.getTickets(guildId, status, limit, offset);
    return res.success(result, 'Tickets retrieved.');
  }

  getConfig(req, res) {
    const guildId = config.discord.guildId;
    const cfg = ticketModule.getConfig(guildId);
    return res.success(cfg, 'Ticket configuration retrieved.');
  }

  updateConfig(req, res) {
    const guildId = config.discord.guildId;
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.error('Request body must be an object.');
    }

    try {
      const updated = ticketModule.updateConfig(guildId, updates);
      return res.success(updated, 'Ticket configuration updated.');
    } catch (err) {
      return res.error(`Failed to update ticket configuration: ${err.message}`);
    }
  }

  async sendPanel(req, res) {
    const guildId = config.discord.guildId;
    const { channelId } = req.body;
    const client = getClient();
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.error('Guild not reachable by bot.', 503, 'GUILD_UNAVAILABLE');
    }

    try {
      const result = await ticketModule.sendTicketPanel(guild, channelId);
      return res.success(result, 'Ticket portal panel deployed successfully.');
    } catch (err) {
      return res.error(`Failed to deploy ticket panel: ${err.message}`);
    }
  }

  getTicket(req, res) {
    const { id } = req.params;
    const ticket = ticketModule.getTicketById(parseInt(id, 10));

    if (!ticket) {
      return res.error('Ticket not found.', 404, 'NOT_FOUND');
    }

    return res.success(ticket, 'Ticket details retrieved.');
  }

  async closeTicket(req, res) {
    const { id } = req.params;
    const { reason = 'Closed from dashboard' } = req.body;
    const client = getClient();
    const guild = client.guilds.cache.get(config.discord.guildId);

    const ticket = ticketModule.getTicketById(parseInt(id, 10));
    if (!ticket) {
      return res.error('Ticket not found.', 404, 'NOT_FOUND');
    }

    if (ticket.status === 'closed') {
      return res.error('Ticket is already closed.', 400, 'ALREADY_CLOSED');
    }

    try {
      const closer = req.session && req.session.user ? req.session.user : { id: 'DASHBOARD_ADMIN', username: 'Dashboard Admin' };
      const { getDb } = require('../../database');
      const db = getDb();

      db.prepare(`
        UPDATE tickets
        SET status = 'closed', closed_by = ?, closed_tag = ?, closed_at = CURRENT_TIMESTAMP, close_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(closer.id, closer.username, reason, id);

      if (guild) {
        const channel = guild.channels.cache.get(ticket.channel_id);
        if (channel) {
          await channel.permissionOverwrites.edit(ticket.creator_id, {
            SendMessages: false
          }).catch(() => {});

          await channel.send(`🔒 Ticket closed from Dashboard by **${closer.username}**. Reason: *${reason}*`).catch(() => {});
        }
      }

      return res.success({ id, status: 'closed' }, 'Ticket closed successfully.');
    } catch (err) {
      return res.error(`Failed to close ticket: ${err.message}`);
    }
  }
}

module.exports = new TicketController();
