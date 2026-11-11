const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicService = require('../modules/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('View detailed information about the currently playing song'),

  async execute(interaction) {
    const status = musicService.getStatus(interaction.guild.id);

    if (!status.currentSong) {
      return interaction.reply({ content: '🔇 Nothing is currently playing.', ephemeral: true });
    }

    const song = status.currentSong;
    const embed = new EmbedBuilder()
      .setTitle('🎶 Now Playing')
      .setColor('#5865F2')
      .setDescription(`[${song.title}](${song.url})`)
      .addFields(
        { name: 'Duration', value: song.duration, inline: true },
        { name: 'Requested By', value: song.requestedBy, inline: true },
        { name: 'Volume', value: `${status.volume}%`, inline: true },
        { name: 'State', value: status.paused ? '⏸️ Paused' : '▶️ Playing', inline: true }
      )
      .setTimestamp();

    if (song.thumbnail) {
      embed.setThumbnail(song.thumbnail);
    }

    return interaction.reply({ embeds: [embed] });
  }
};
