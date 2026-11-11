const { ChannelType } = require('discord.js');
const { getClient } = require('../../bot/client');
const config = require('../../config');

class GuildController {
  getChannels(req, res) {
    const client = getClient();
    const guild = client.guilds.cache.get(config.discord.guildId);

    if (!guild) {
      return res.error('Guild not accessible by bot.', 503, 'GUILD_UNAVAILABLE');
    }

    const categories = [];
    const textChannels = [];
    const voiceChannels = [];

    guild.channels.cache.forEach(c => {
      const basic = {
        id: c.id,
        name: c.name,
        type: c.type,
        position: c.position,
        parentId: c.parentId
      };

      if (c.type === ChannelType.GuildCategory) {
        categories.push(basic);
      } else if (c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice) {
        voiceChannels.push(basic);
      } else if (c.isTextBased() && !c.isThread()) {
        textChannels.push(basic);
      }
    });

    return res.success({
      categories: categories.sort((a, b) => a.position - b.position),
      textChannels: textChannels.sort((a, b) => a.position - b.position),
      voiceChannels: voiceChannels.sort((a, b) => a.position - b.position)
    }, 'Guild channels retrieved.');
  }

  getRoles(req, res) {
    const client = getClient();
    const guild = client.guilds.cache.get(config.discord.guildId);

    if (!guild) {
      return res.error('Guild not accessible by bot.', 503, 'GUILD_UNAVAILABLE');
    }

    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id) // exclude @everyone
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        position: r.position,
        managed: r.managed,
        permissions: r.permissions.bitfield.toString()
      }))
      .sort((a, b) => b.position - a.position);

    return res.success(roles, 'Guild roles retrieved.');
  }

  async getMembers(req, res) {
    const client = getClient();
    const guild = client.guilds.cache.get(config.discord.guildId);

    if (!guild) {
      return res.error('Guild not accessible by bot.', 503, 'GUILD_UNAVAILABLE');
    }

    const query = req.query.q ? String(req.query.q).toLowerCase() : '';
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));

    let members = Array.from(guild.members.cache.values());

    if (query) {
      members = members.filter(m => 
        m.user.username.toLowerCase().includes(query) ||
        (m.nickname && m.nickname.toLowerCase().includes(query)) ||
        m.id.includes(query)
      );
    }

    const formatted = members.slice(0, limit).map(m => ({
      id: m.id,
      username: m.user.username,
      nickname: m.nickname,
      discriminator: m.user.discriminator,
      tag: m.user.tag,
      avatarUrl: m.user.displayAvatarURL(),
      isBot: m.user.bot,
      roles: m.roles.cache.map(r => r.id)
    }));

    return res.success(formatted, 'Guild members retrieved.');
  }
}

module.exports = new GuildController();
