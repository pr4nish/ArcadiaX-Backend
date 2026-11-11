const config = require('../../config');
const antinukeModule = require('../modules/antinuke');

module.exports = {
  name: 'guildBanAdd',
  async execute(ban) {
    if (ban.guild.id !== config.discord.guildId) return;
    await antinukeModule.handleGuildBanAdd(ban);
  }
};
