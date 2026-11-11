const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../modules/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Adjust music playback volume (0-100%)')
    .addIntegerOption(opt =>
      opt
        .setName('percent')
        .setDescription('Volume level percentage (0 to 100)')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction) {
    const percent = interaction.options.getInteger('percent');
    try {
      const vol = musicService.setVolume(interaction.guild.id, percent);
      return interaction.reply(`🔊 Music volume adjusted to **${vol}%**.`);
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }
};
