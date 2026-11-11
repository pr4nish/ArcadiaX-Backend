const config = require('../../config');
const welcomeModule = require('../modules/welcome');
const antinukeModule = require('../modules/antinuke');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member) {
    if (member.guild.id !== config.discord.guildId) return;

    // 1. Process Goodbye Message
    await welcomeModule.handleMemberRemove(member);

    // 2. Check if member was kicked (Antinuke Mass Kick Protection)
    await antinukeModule.handleMemberKick(member);
  }
};
