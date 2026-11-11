const config = require('../../config');
const antibetrayModule = require('../modules/antibetray');

module.exports = {
  name: 'roleUpdate',
  async execute(oldRole, newRole) {
    if (newRole.guild.id !== config.discord.guildId) return;
    await antibetrayModule.handleRoleUpdate(oldRole, newRole);
  }
};
