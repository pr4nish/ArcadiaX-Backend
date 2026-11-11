const musicService = require('../../bot/modules/music');
const config = require('../../config');
const { getClient } = require('../../bot/client');

class MusicController {
  getStatus(req, res) {
    const guildId = config.discord.guildId;
    const status = musicService.getStatus(guildId);
    return res.success(status, 'Music playback status retrieved.');
  }

  async control(req, res) {
    const guildId = config.discord.guildId;
    const { action, value, query, channelId } = req.body;

    if (!action) {
      return res.error('Action is required ("play", "pause", "resume", "skip", "stop", "volume").');
    }

    try {
      let result = null;

      switch (action.toLowerCase()) {
        case 'pause':
          musicService.pause(guildId);
          result = { paused: true };
          break;

        case 'resume':
          musicService.resume(guildId);
          result = { playing: true };
          break;

        case 'skip':
          const skipped = musicService.skip(guildId);
          result = { skipped };
          break;

        case 'stop':
          musicService.stop(guildId);
          result = { stopped: true };
          break;

        case 'volume':
          if (value === undefined || isNaN(value)) {
            return res.error('A numeric "value" (0-100) is required for volume adjustment.');
          }
          const vol = musicService.setVolume(guildId, parseInt(value, 10));
          result = { volume: vol };
          break;

        case 'play':
          if (!query) {
            return res.error('A "query" string is required for play action.');
          }
          const client = getClient();
          const guild = client.guilds.cache.get(guildId);
          if (!guild) return res.error('Guild not accessible.', 503);

          const targetVoiceChannel = channelId 
            ? guild.channels.cache.get(channelId)
            : guild.channels.cache.find(c => c.isVoiceBased());

          if (!targetVoiceChannel) {
            return res.error('No voice channel available or specified to connect to.');
          }

          const fakeMember = {
            voice: { channel: targetVoiceChannel },
            user: { tag: req.session.user ? req.session.user.username : 'Dashboard Admin' }
          };

          const addRes = await musicService.searchAndAdd(query, fakeMember);
          result = addRes;
          break;

        default:
          return res.error(`Unsupported music action: ${action}`);
      }

      return res.success(result, `Music action "${action}" executed.`);
    } catch (err) {
      return res.error(`Music control error: ${err.message}`);
    }
  }
}

module.exports = new MusicController();
