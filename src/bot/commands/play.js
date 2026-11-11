const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicService = require('../modules/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song or add it to the audio queue')
    .addStringOption(opt =>
      opt
        .setName('query')
        .setDescription('Song title, artist, or direct audio link')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.member.voice.channel) {
      return interaction.reply({
        content: '❌ You must be connected to a voice channel to use music commands.',
        ephemeral: true
      });
    }

    await interaction.deferReply();
    const query = interaction.options.getString('query');

    try {
      const result = await musicService.searchAndAdd(query, interaction.member);
      const song = result.song;

      const embed = new EmbedBuilder()
        .setTitle(result.addedToQueue ? '🎵 Added to Queue' : '🎶 Now Playing')
        .setColor('#5865F2')
        .setDescription(`[${song.title}](${song.url})`)
        .addFields(
          { name: 'Duration', value: song.duration, inline: true },
          { name: 'Requested By', value: song.requestedBy, inline: true }
        );

      if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
      }

      if (result.addedToQueue) {
        embed.addFields({ name: 'Queue Position', value: `#${result.position}`, inline: true });
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({
        content: `❌ Could not play track: ${err.message}`
      });
    }
  }
};
