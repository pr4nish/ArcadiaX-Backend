const config = require('../../config');
const antinukeModule = require('../modules/antinuke');

module.exports = {
  name: 'channelDelete',
  async execute(channel) {
    if (!channel.guild || channel.guild.id !== config.discord.guildId) return;
    await antinukeModule.handleChannelDelete(channel);
  }
};
