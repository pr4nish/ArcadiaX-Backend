const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const embedService = require('../modules/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create and post a custom rich embed to a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(opt =>
      opt
        .setName('channel')
        .setDescription('Target channel to send the embed')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('title')
        .setDescription('Embed title')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('description')
        .setDescription('Embed description')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt
        .setName('color')
        .setDescription('Hex color code (e.g. #5865F2, #ED4245)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('footer')
        .setDescription('Footer text')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt
        .setName('image')
        .setDescription('Image URL')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const color = interaction.options.getString('color') || '#5865F2';
    const footer = interaction.options.getString('footer');
    const image = interaction.options.getString('image');

    try {
      await embedService.sendEmbed(interaction.client, channel.id, {
        title,
        description,
        color,
        footer: footer ? { text: footer } : null,
        image
      });

      return interaction.reply({
        content: `✅ Embed successfully delivered to ${channel}.`,
        ephemeral: true
      });
    } catch (err) {
      return interaction.reply({
        content: `❌ Failed to send embed: ${err.message}`,
        ephemeral: true
      });
    }
  }
};
