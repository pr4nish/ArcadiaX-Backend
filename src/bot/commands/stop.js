const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../modules/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop music playback and clear the queue'),

  async execute(interaction) {
    try {
      musicService.stop(interaction.guild.id);
      return interaction.reply('⏹️ Music playback stopped and queue cleared.');
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }
};
