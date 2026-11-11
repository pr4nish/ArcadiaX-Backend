const config = require('../../config');
const ticketModule = require('../modules/tickets');
const logger = require('../../utils/logger');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // 1. Single-guild restriction: reject interactions from unauthorized guilds
    if (!interaction.guild || interaction.guild.id !== config.discord.guildId) {
      if (interaction.isRepliable()) {
        return interaction.reply({
          content: '❌ ArcadiaX is configured as a single-server management bot. Interactions from unauthorized guilds are disallowed.',
          ephemeral: true
        });
      }
      return;
    }

    // 2. Chat Input (Slash) Commands
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({
          content: `❌ Unknown command \`/${interaction.commandName}\`.`,
          ephemeral: true
        });
      }

      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error(`Error executing slash command /${interaction.commandName}:`, err);
        const replyPayload = {
          content: `❌ An unexpected error occurred while running this command: ${err.message}`,
          ephemeral: true
        };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(replyPayload).catch(() => {});
        } else {
          await interaction.reply(replyPayload).catch(() => {});
        }
      }
      return;
    }

    // 3. String Select Menus (Ticket Dropdown)
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'arcadiax_ticket_create_select') {
        try {
          await ticketModule.handleTicketCreate(interaction);
        } catch (err) {
          logger.error('Error handling ticket select menu:', err);
        }
      }
      return;
    }

    // 4. Button Interactions (Ticket buttons: claim, close, reopen, delete, transcript)
    if (interaction.isButton()) {
      if (interaction.customId.startsWith('ticket_')) {
        try {
          await ticketModule.handleButtonInteraction(interaction);
        } catch (err) {
          logger.error('Error handling ticket button interaction:', err);
        }
      }
      return;
    }
  }
};
