const config = require('../../config');
const antibetrayModule = require('../modules/antibetray');

module.exports = {
  name: 'guildUpdate',
  async execute(oldGuild, newGuild) {
    if (newGuild.id !== config.discord.guildId) return;
    await antibetrayModule.handleGuildUpdate(oldGuild, newGuild);
  }
};
