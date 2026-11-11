const config = require('../../config');
const antinukeModule = require('../modules/antinuke');

module.exports = {
  name: 'roleCreate',
  async execute(role) {
    if (role.guild.id !== config.discord.guildId) return;
    await antinukeModule.handleRoleCreate(role);
  }
};
