const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState
} = require('@discordjs/voice');
const play = require('play-dl');
const logger = require('../../utils/logger');

class MusicQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.connection = null;
    this.player = createAudioPlayer();
    this.songs = [];
    this.volume = 100; // 0-100
    this.playing = false;
    this.currentResource = null;
    this.currentSong = null;
    this.idleTimer = null;
    this.voiceChannelId = null;

    this.player.on(AudioPlayerStatus.Idle, () => {
      this.playNext();
    });

    this.player.on('error', error => {
      logger.error(`[Music Error - Guild ${this.guildId}]:`, error);
      this.playNext();
    });
  }

  resetIdleTimer(onTimeout) {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    // 3 minutes auto-disconnect on idle
    this.idleTimer = setTimeout(() => {
      if (this.songs.length === 0 && !this.playing) {
        logger.info(`[Music] 3 minutes idle reached in guild ${this.guildId}. Disconnecting voice.`);
        onTimeout();
      }
    }, 3 * 60 * 1000);

    if (this.idleTimer.unref) {
      this.idleTimer.unref();
    }
  }

  async playNext() {
    if (this.songs.length === 0) {
      this.playing = false;
      this.currentSong = null;
      this.currentResource = null;
      return;
    }

    const song = this.songs.shift();
    this.currentSong = song;

    try {
      let stream = null;
      if (song.source === 'youtube' || song.url.includes('youtube.com') || song.url.includes('youtu.be')) {
        const streamInfo = await play.stream(song.url);
        stream = streamInfo.stream;
      } else if (song.url.includes('soundcloud.com')) {
        const streamInfo = await play.stream(song.url);
        stream = streamInfo.stream;
      } else {
        // Fallback or generic stream
        const streamInfo = await play.stream(song.url);
        stream = streamInfo.stream;
      }

      this.currentResource = createAudioResource(stream, {
        inlineVolume: true
      });
      this.currentResource.volume.setVolume(this.volume / 100);

      this.player.play(this.currentResource);
      this.playing = true;
      logger.info(`[Music] Now playing in guild ${this.guildId}: "${song.title}"`);
    } catch (err) {
      logger.error(`[Music] Failed to stream song "${song.title}":`, err);
      // Skip failed song safely
      this.playNext();
    }
  }
}

class MusicService {
  constructor() {
    this.queues = new Map();
  }

  getQueue(guildId) {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = new MusicQueue(guildId);
      this.queues.set(guildId, queue);
    }
    return queue;
  }

  async connect(channel) {
    const queue = this.getQueue(channel.guild.id);
    if (!queue.connection || queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
      queue.connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guild.id,
        adapterCreator: channel.guild.voiceAdapterCreator
      });

      queue.voiceChannelId = channel.id;

      queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(queue.connection, VoiceConnectionStatus.Signalling, 5_000),
            entersState(queue.connection, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          this.destroy(channel.guild.id);
        }
      });

      queue.connection.subscribe(queue.player);
    }
    return queue;
  }

  async searchAndAdd(query, member) {
    if (!member.voice.channel) {
      throw new Error('You must be connected to a voice channel to play music.');
    }

    const queue = await this.connect(member.voice.channel);

    let songInfo = null;

    // Search query using play-dl
    if (query.startsWith('http://') || query.startsWith('https://')) {
      const info = await play.video_basic_info(query).catch(() => null);
      if (info && info.video_details) {
        songInfo = {
          title: info.video_details.title,
          url: info.video_details.url,
          duration: info.video_details.durationRaw || 'Unknown',
          thumbnail: info.video_details.thumbnails ? info.video_details.thumbnails[0].url : null,
          requestedBy: member.user.tag,
          source: 'youtube'
        };
      } else {
        songInfo = {
          title: query,
          url: query,
          duration: 'Live / Unknown',
          requestedBy: member.user.tag,
          source: 'direct'
        };
      }
    } else {
      const searchResults = await play.search(query, { limit: 1 }).catch(() => []);
      if (searchResults && searchResults.length > 0) {
        const item = searchResults[0];
        songInfo = {
          title: item.title,
          url: item.url,
          duration: item.durationRaw || 'Unknown',
          thumbnail: item.thumbnails ? item.thumbnails[0].url : null,
          requestedBy: member.user.tag,
          source: 'youtube'
        };
      } else {
        throw new Error(`No audio results found for search query: "${query}"`);
      }
    }

    queue.songs.push(songInfo);

    if (!queue.playing) {
      await queue.playNext();
      return { addedToQueue: false, song: songInfo };
    }

    return { addedToQueue: true, position: queue.songs.length, song: songInfo };
  }

  pause(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue || !queue.playing) throw new Error('No audio is currently playing.');
    queue.player.pause();
    return true;
  }

  resume(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error('No audio player active in this server.');
    queue.player.unpause();
    return true;
  }

  skip(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue || !queue.playing) throw new Error('Nothing currently playing to skip.');
    const skipped = queue.currentSong;
    queue.player.stop();
    return skipped;
  }

  stop(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue) return;
    queue.songs = [];
    queue.playing = false;
    queue.player.stop();
    return true;
  }

  setVolume(guildId, volumePercent) {
    const queue = this.queues.get(guildId);
    if (!queue) throw new Error('No active music player in this server.');
    const vol = Math.max(0, Math.min(100, volumePercent));
    queue.volume = vol;
    if (queue.currentResource && queue.currentResource.volume) {
      queue.currentResource.volume.setVolume(vol / 100);
    }
    return vol;
  }

  getStatus(guildId) {
    const queue = this.queues.get(guildId);
    if (!queue) {
      return {
        active: false,
        playing: false,
        currentSong: null,
        queue: [],
        volume: 100,
        voiceChannelId: null
      };
    }

    return {
      active: queue.connection && queue.connection.state.status !== VoiceConnectionStatus.Destroyed,
      playing: queue.playing,
      paused: queue.player.state.status === AudioPlayerStatus.Paused,
      currentSong: queue.currentSong,
      queue: queue.songs,
      volume: queue.volume,
      voiceChannelId: queue.voiceChannelId
    };
  }

  destroy(guildId) {
    const queue = this.queues.get(guildId);
    if (queue) {
      if (queue.idleTimer) clearTimeout(queue.idleTimer);
      queue.player.stop();
      if (queue.connection) {
        try {
          queue.connection.destroy();
        } catch {
          // ignore
        }
      }
      this.queues.delete(guildId);
      logger.info(`[Music] Destroyed music queue for guild ${guildId}`);
    }
  }
}

module.exports = new MusicService();
