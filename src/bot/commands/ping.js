const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency, gateway ping and system health status'),

  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsPing = interaction.client.ws.ping;
    const uptime = Math.floor(process.uptime());

    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;
    const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

    const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

    const embed = new EmbedBuilder()
      .setTitle('⚡ ArcadiaX Status & Latency')
      .setColor('#5865F2')
      .addFields(
        { name: '🏓 Roundtrip Latency', value: `\`${roundtrip}ms\``, inline: true },
        { name: '🌐 Discord Gateway', value: `\`${wsPing}ms\``, inline: true },
        { name: '⏱️ Process Uptime', value: `\`${uptimeStr}\``, inline: true },
        { name: '💾 Memory Usage', value: `\`${memUsage} MB\``, inline: true },
        { name: '🟢 Bot Version', value: '`v1.0.0 (Enterprise)`', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ content: null, embeds: [embed] });
  }
};
