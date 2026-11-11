const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const musicService = require('../modules/music');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Display the server music queue'),

  async execute(interaction) {
    const status = musicService.getStatus(interaction.guild.id);

    if (!status.currentSong && status.queue.length === 0) {
      return interaction.reply({ content: '📭 The music queue is currently empty.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎶 ArcadiaX Music Queue')
      .setColor('#5865F2')
      .setTimestamp();

    if (status.currentSong) {
      embed.addFields({
        name: '▶️ Currently Playing',
        value: `[${status.currentSong.title}](${status.currentSong.url}) | \`${status.currentSong.duration}\`\nRequested by: ${status.currentSong.requestedBy}`
      });
    }

    if (status.queue.length > 0) {
      const queueList = status.queue.slice(0, 10).map((s, idx) => 
        `**#${idx + 1}** [${s.title}](${s.url}) | \`${s.duration}\``
      ).join('\n');

      const remaining = status.queue.length > 10 ? `\n...and ${status.queue.length - 10} more songs.` : '';
      embed.addFields({ name: `📋 Upcoming (${status.queue.length})`, value: queueList + remaining });
    } else {
      embed.addFields({ name: '📋 Upcoming', value: 'No songs queued after this one.' });
    }

    return interaction.reply({ embeds: [embed] });
  }
};
