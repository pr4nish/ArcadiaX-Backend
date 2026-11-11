const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../modules/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Resume the paused music playback'),

  async execute(interaction) {
    try {
      musicService.resume(interaction.guild.id);
      return interaction.reply('▶️ Audio playback resumed.');
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }
};
