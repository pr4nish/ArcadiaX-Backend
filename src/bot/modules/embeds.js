const { EmbedBuilder } = require('discord.js');
const logger = require('../../utils/logger');

class EmbedService {
  buildEmbed(data = {}) {
    const embed = new EmbedBuilder();

    if (data.title) embed.setTitle(String(data.title).substring(0, 256));
    if (data.description) embed.setDescription(String(data.description).substring(0, 4096));
    if (data.url && typeof data.url === 'string' && data.url.startsWith('http')) {
      embed.setURL(data.url);
    }

    if (data.color) {
      try {
        embed.setColor(data.color);
      } catch {
        embed.setColor('#5865F2');
      }
    } else {
      embed.setColor('#5865F2');
    }

    if (data.author) {
      if (typeof data.author === 'string') {
        embed.setAuthor({ name: data.author.substring(0, 256) });
      } else if (data.author.name) {
        embed.setAuthor({
          name: String(data.author.name).substring(0, 256),
          iconURL: data.author.iconURL && data.author.iconURL.startsWith('http') ? data.author.iconURL : undefined,
          url: data.author.url && data.author.url.startsWith('http') ? data.author.url : undefined
        });
      }
    }

    if (data.footer) {
      if (typeof data.footer === 'string') {
        embed.setFooter({ text: data.footer.substring(0, 2048) });
      } else if (data.footer.text) {
        embed.setFooter({
          text: String(data.footer.text).substring(0, 2048),
          iconURL: data.footer.iconURL && data.footer.iconURL.startsWith('http') ? data.footer.iconURL : undefined
        });
      }
    }

    if (data.thumbnail && typeof data.thumbnail === 'string' && data.thumbnail.startsWith('http')) {
      embed.setThumbnail(data.thumbnail);
    } else if (data.thumbnailUrl && typeof data.thumbnailUrl === 'string' && data.thumbnailUrl.startsWith('http')) {
      embed.setThumbnail(data.thumbnailUrl);
    }

    if (data.image && typeof data.image === 'string' && data.image.startsWith('http')) {
      embed.setImage(data.image);
    } else if (data.imageUrl && typeof data.imageUrl === 'string' && data.imageUrl.startsWith('http')) {
      embed.setImage(data.imageUrl);
    }

    if (data.timestamp) {
      if (typeof data.timestamp === 'string' || typeof data.timestamp === 'number') {
        embed.setTimestamp(new Date(data.timestamp));
      } else {
        embed.setTimestamp();
      }
    }

    if (Array.isArray(data.fields)) {
      for (const field of data.fields.slice(0, 25)) {
        if (field && field.name && field.value) {
          embed.addFields({
            name: String(field.name).substring(0, 256),
            value: String(field.value).substring(0, 1024),
            inline: Boolean(field.inline)
          });
        }
      }
    }

    return embed;
  }

  async sendEmbed(client, channelId, embedPayload, content = '', allowedMentions = null) {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Text channel with ID ${channelId} not found or inaccessible.`);
    }

    const embed = this.buildEmbed(embedPayload);
    const options = {
      embeds: [embed],
      allowedMentions: allowedMentions || { parse: [] } // Default: no mentions to prevent mass pings
    };

    if (content && typeof content === 'string') {
      options.content = content.substring(0, 2000);
    }

    const message = await channel.send(options);
    return message;
  }
}

module.exports = new EmbedService();
