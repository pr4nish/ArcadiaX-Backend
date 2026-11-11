const { getDb } = require('../../database');
const embedService = require('./embeds');
const logger = require('../../utils/logger');

class MessageSenderService {
  async sendMessage(client, options) {
    const {
      channelId,
      content,
      embed,
      allowEveryone = false,
      allowRoles = false,
      allowUsers = true,
      senderId = 'SYSTEM',
      senderTag = 'ArcadiaX Dashboard'
    } = options;

    if (!channelId) {
      throw new Error('channelId is required.');
    }

    if (!content && !embed) {
      throw new Error('Either message content or embed data must be provided.');
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Text channel ${channelId} not found or not writable.`);
    }

    // Strict allowed mentions construction
    const allowedMentions = {
      parse: [],
      users: allowUsers ? undefined : [],
      roles: allowRoles ? undefined : [],
      repliedUser: false
    };

    if (allowEveryone) {
      allowedMentions.parse.push('everyone');
    }
    if (allowRoles) {
      allowedMentions.parse.push('roles');
    }
    if (allowUsers) {
      allowedMentions.parse.push('users');
    }

    const payload = {
      allowedMentions
    };

    if (content) {
      payload.content = String(content).substring(0, 2000);
    }

    if (embed) {
      const builtEmbed = embedService.buildEmbed(embed);
      payload.embeds = [builtEmbed];
    }

    const sentMessage = await channel.send(payload);

    // Record into message_logs
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO message_logs (guild_id, sender_id, sender_tag, channel_id, channel_name, message_id, content, embed_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        channel.guild.id,
        senderId,
        senderTag,
        channel.id,
        channel.name,
        sentMessage.id,
        content || null,
        embed ? JSON.stringify(embed) : null
      );
    } catch (err) {
      logger.error('Failed to log sent message in message_logs:', err);
    }

    return {
      messageId: sentMessage.id,
      channelId: channel.id,
      channelName: channel.name,
      timestamp: sentMessage.createdAt
    };
  }

  previewMessage(options) {
    const { content, embed, allowEveryone, allowRoles, allowUsers } = options;

    let parsedEmbed = null;
    if (embed) {
      parsedEmbed = embedService.buildEmbed(embed).toJSON();
    }

    return {
      content: content || null,
      embed: parsedEmbed,
      allowedMentions: {
        parse: [
          ...(allowEveryone ? ['everyone'] : []),
          ...(allowRoles ? ['roles'] : []),
          ...(allowUsers ? ['users'] : [])
        ]
      }
    };
  }

  getMessageHistory(guildId, limit = 50, offset = 0) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM message_logs
      WHERE guild_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(guildId, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM message_logs WHERE guild_id = ?').get(guildId).count;

    return {
      total,
      limit,
      offset,
      messages: rows.map(r => ({
        ...r,
        embed: r.embed_json ? JSON.parse(r.embed_json) : null
      }))
    };
  }
}

module.exports = new MessageSenderService();
