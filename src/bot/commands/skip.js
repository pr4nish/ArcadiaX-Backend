const { SlashCommandBuilder } = require('discord.js');
const musicService = require('../modules/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the currently playing track'),

  async execute(interaction) {
    try {
      const skipped = musicService.skip(interaction.guild.id);
      return interaction.reply(`⏭️ Skipped: **${skipped ? skipped.title : 'Current track'}**.`);
    } catch (err) {
      return interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
    }
  }
};
