const config = require('../../config');
const antinukeModule = require('../modules/antinuke');

module.exports = {
  name: 'channelCreate',
  async execute(channel) {
    if (!channel.guild || channel.guild.id !== config.discord.guildId) return;
    await antinukeModule.handleChannelCreate(channel);
  }
};
