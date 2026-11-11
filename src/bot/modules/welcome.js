const { EmbedBuilder } = require('discord.js');
const { getDb } = require('../../database');
const logger = require('../../utils/logger');

class WelcomeModule {
  getConfig(guildId) {
    const db = getDb();
    let config = db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?').get(guildId);
    if (!config) {
      db.prepare('INSERT INTO welcome_config (guild_id) VALUES (?)').run(guildId);
      config = db.prepare('SELECT * FROM welcome_config WHERE guild_id = ?').get(guildId);
    }
    return config;
  }

  updateConfig(guildId, updates) {
    const db = getDb();
    const fields = [];
    const values = [];

    const allowed = [
      'enabled', 'channel_id', 'message_type', 'text_content',
      'embed_json', 'dm_enabled', 'dm_content', 'goodbye_enabled',
      'goodbye_channel_id', 'goodbye_content', 'goodbye_embed_json'
    ];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }

    if (fields.length === 0) return this.getConfig(guildId);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(guildId);

    db.prepare(`UPDATE welcome_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
    return this.getConfig(guildId);
  }

  formatVariables(text, member, guild) {
    if (!text) return '';
    const memberCount = guild.memberCount || 0;
    const userAvatar = member.user ? member.user.displayAvatarURL({ dynamic: true, size: 512 }) : '';
    const serverIcon = guild.iconURL({ dynamic: true, size: 512 }) || '';
    const username = member.user ? member.user.username : 'User';
    const userMention = member.user ? `<@${member.user.id}>` : username;
    const serverName = guild.name || 'Server';

    return text
      .replace(/{user}/g, userMention)
      .replace(/{username}/g, username)
      .replace(/{server}/g, serverName)
      .replace(/{memberCount}/g, memberCount.toString())
      .replace(/{userAvatar}/g, userAvatar)
      .replace(/{serverIcon}/g, serverIcon);
  }

  createWelcomeEmbed(embedConfigJson, member, guild) {
    try {
      let parsed = typeof embedConfigJson === 'string' ? JSON.parse(embedConfigJson) : embedConfigJson;
      const embed = new EmbedBuilder();

      if (parsed.title) {
        embed.setTitle(this.formatVariables(parsed.title, member, guild));
      }
      if (parsed.description) {
        embed.setDescription(this.formatVariables(parsed.description, member, guild));
      }
      if (parsed.color) {
        embed.setColor(parsed.color);
      } else {
        embed.setColor('#5865F2');
      }
      if (parsed.thumbnailUrl) {
        const formattedThumb = this.formatVariables(parsed.thumbnailUrl, member, guild);
        if (formattedThumb && formattedThumb.startsWith('http')) {
          embed.setThumbnail(formattedThumb);
        }
      }
      if (parsed.imageUrl) {
        const formattedImg = this.formatVariables(parsed.imageUrl, member, guild);
        if (formattedImg && formattedImg.startsWith('http')) {
          embed.setImage(formattedImg);
        }
      }
      if (parsed.footerText) {
        embed.setFooter({
          text: this.formatVariables(parsed.footerText, member, guild),
          iconURL: parsed.footerIconUrl ? this.formatVariables(parsed.footerIconUrl, member, guild) : undefined
        });
      }
      if (parsed.timestamp) {
        embed.setTimestamp();
      }

      if (Array.isArray(parsed.fields)) {
        for (const field of parsed.fields) {
          if (field.name && field.value) {
            embed.addFields({
              name: this.formatVariables(field.name, member, guild),
              value: this.formatVariables(field.value, member, guild),
              inline: !!field.inline
            });
          }
        }
      }

      return embed;
    } catch (err) {
      logger.error('Failed to parse welcome embed JSON:', err);
      return new EmbedBuilder()
        .setTitle('Welcome!')
        .setDescription(`Welcome to the server, ${member}!`)
        .setColor('#5865F2');
    }
  }

  async handleMemberAdd(member) {
    try {
      const config = this.getConfig(member.guild.id);
      if (!config.enabled) return;

      // 1. Channel Welcome
      if (config.channel_id) {
        const channel = member.guild.channels.cache.get(config.channel_id);
        if (channel && channel.isTextBased()) {
          if (config.message_type === 'embed') {
            const embed = this.createWelcomeEmbed(config.embed_json, member, member.guild);
            await channel.send({ embeds: [embed] }).catch(err => logger.error('Failed to send welcome embed:', err));
          } else {
            const content = this.formatVariables(config.text_content, member, member.guild);
            await channel.send({ content }).catch(err => logger.error('Failed to send welcome text:', err));
          }
        }
      }

      // 2. Direct Message Welcome
      if (config.dm_enabled && config.dm_content) {
        const dmContent = this.formatVariables(config.dm_content, member, member.guild);
        await member.send({ content: dmContent }).catch(() => {
          // Member DMs might be closed, perfectly normal
        });
      }
    } catch (err) {
      logger.error('Error handling guildMemberAdd in WelcomeModule:', err);
    }
  }

  async handleMemberRemove(member) {
    try {
      const config = this.getConfig(member.guild.id);
      if (!config.goodbye_enabled || !config.goodbye_channel_id) return;

      const channel = member.guild.channels.cache.get(config.goodbye_channel_id);
      if (channel && channel.isTextBased()) {
        if (config.goodbye_embed_json) {
          const embed = this.createWelcomeEmbed(config.goodbye_embed_json, member, member.guild);
          await channel.send({ embeds: [embed] }).catch(err => logger.error('Failed to send goodbye embed:', err));
        } else if (config.goodbye_content) {
          const content = this.formatVariables(config.goodbye_content, member, member.guild);
          await channel.send({ content }).catch(err => logger.error('Failed to send goodbye text:', err));
        }
      }
    } catch (err) {
      logger.error('Error handling guildMemberRemove in WelcomeModule:', err);
    }
  }

  preview(sampleData, type = 'welcome') {
    const fakeMember = {
      user: {
        id: '123456789012345678',
        username: 'SampleUser',
        displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/0.png'
      }
    };
    const fakeGuild = {
      name: 'ArcadiaX Community',
      memberCount: 1337,
      iconURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png'
    };

    if (sampleData.message_type === 'text' || type === 'text') {
      const text = sampleData.text_content || sampleData.content || '';
      return {
        formattedText: this.formatVariables(text, fakeMember, fakeGuild)
      };
    } else {
      const embedJson = sampleData.embed_json || sampleData.embed || {};
      const embed = this.createWelcomeEmbed(embedJson, fakeMember, fakeGuild);
      return {
        embed: embed.toJSON()
      };
    }
  }
}

module.exports = new WelcomeModule();
