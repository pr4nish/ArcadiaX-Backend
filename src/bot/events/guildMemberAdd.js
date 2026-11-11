const config = require('../../config');
const welcomeModule = require('../modules/welcome');
const autoroleModule = require('../modules/autorole');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    if (member.guild.id !== config.discord.guildId) return;

    // 1. Process Welcome message & DM
    await welcomeModule.handleMemberAdd(member);

    // 2. Process Auto-role assignment (Human or Bot)
    await autoroleModule.handleMemberAdd(member);
  }
};
