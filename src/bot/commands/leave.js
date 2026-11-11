const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../modules/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leave')
    .setDescription('Disconnect the bot from the voice channel'),

  async execute(interaction) {
    try {
      musicService.destroy(interaction.guild.id);
      return interaction.reply('👋 Left the voice channel and cleared queue.');
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }
};
