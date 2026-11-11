const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../modules/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Pause the current music playback'),

  async execute(interaction) {
    try {
      musicService.pause(interaction.guild.id);
      return interaction.reply('⏸️ Audio playback paused.');
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }
};
