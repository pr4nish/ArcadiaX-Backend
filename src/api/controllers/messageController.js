const messageSenderService = require('../../bot/modules/messageSender');
const { getClient } = require('../../bot/client');
const config = require('../../config');

class MessageController {
  async sendMessage(req, res) {
    const {
      channelId,
      content,
      embed,
      allowEveryone = false,
      allowRoles = false,
      allowUsers = true
    } = req.body;

    if (!channelId) {
      return res.error('channelId is required.');
    }

    if (!content && !embed) {
      return res.error('Either content or embed data must be provided.');
    }

    const client = getClient();
    const sender = req.session && req.session.user ? req.session.user : { id: 'DASHBOARD_ADMIN', username: 'Dashboard Admin' };

    try {
      const result = await messageSenderService.sendMessage(client, {
        channelId,
        content,
        embed,
        allowEveryone: Boolean(allowEveryone),
        allowRoles: Boolean(allowRoles),
        allowUsers: Boolean(allowUsers),
        senderId: sender.id,
        senderTag: sender.username
      });

      return res.success(result, 'Message dispatched successfully.');
    } catch (err) {
      return res.error(`Failed to send message: ${err.message}`);
    }
  }

  getHistory(req, res) {
    const guildId = config.discord.guildId;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

    const history = messageSenderService.getMessageHistory(guildId, limit, offset);
    return res.success(history, 'Message history retrieved.');
  }
}

module.exports = new MessageController();
