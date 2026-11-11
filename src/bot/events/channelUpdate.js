const config = require('../../config');
const antibetrayModule = require('../modules/antibetray');

module.exports = {
  name: 'channelUpdate',
  async execute(oldChannel, newChannel) {
    if (!newChannel.guild || newChannel.guild.id !== config.discord.guildId) return;
    await antibetrayModule.handleChannelUpdate(oldChannel, newChannel);
  }
};
