const config = require('../../config');
const ticketModule = require('../modules/tickets');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.guild.id !== config.discord.guildId) return;
    if (message.author.bot) return;

    // Record ticket message if inside ticket channel
    await ticketModule.recordTicketMessage(message);
  }
};
