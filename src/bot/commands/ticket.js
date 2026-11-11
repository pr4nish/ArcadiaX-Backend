const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const ticketModule = require('../modules/tickets');
const { getDb } = require('../../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ArcadiaX support ticket system')
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Send the interactive ticket panel with dropdown categories')
        .addChannelOption(opt =>
          opt
            .setName('channel')
            .setDescription('Channel where the panel will be posted')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('close')
        .setDescription('Close the current ticket channel')
        .addStringOption(opt =>
          opt
            .setName('reason')
            .setDescription('Reason for closing the ticket')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('add')
        .setDescription('Add a user to this ticket channel')
        .addUserOption(opt =>
          opt
            .setName('user')
            .setDescription('User to add to the ticket')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('remove')
        .setDescription('Remove a user from this ticket channel')
        .addUserOption(opt =>
          opt
            .setName('user')
            .setDescription('User to remove from the ticket')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Only administrators can deploy the ticket panel.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel('channel') || interaction.channel;

      try {
        const res = await ticketModule.sendTicketPanel(guild, channel.id);
        return interaction.editReply({
          content: `✅ Ticket panel successfully deployed to <#${res.channelId}>.`
        });
      } catch (err) {
        return interaction.editReply({
          content: `❌ Failed to send ticket panel: ${err.message}`
        });
      }

    } else if (sub === 'close') {
      const db = getDb();
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);

      if (!ticket) {
        return interaction.reply({ content: '❌ This command can only be used inside a ticket channel.', ephemeral: true });
      }

      if (ticket.status === 'closed') {
        return interaction.reply({ content: '⚠️ This ticket is already closed.', ephemeral: true });
      }

      const reason = interaction.options.getString('reason') || 'No reason provided';
      db.prepare(`
        UPDATE tickets
        SET status = 'closed', closed_by = ?, closed_tag = ?, closed_at = CURRENT_TIMESTAMP, close_reason = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(interaction.user.id, interaction.user.tag, reason, ticket.id);

      await interaction.reply({
        content: `🔒 Ticket closed by <@${interaction.user.id}>. Reason: *${reason}*`
      });

      // Deny creator from sending messages
      await interaction.channel.permissionOverwrites.edit(ticket.creator_id, {
        SendMessages: false
      }).catch(() => {});

      ticketModule.logTicketAction(guild, `Ticket #${ticket.ticket_number} Closed`, `Closed by <@${interaction.user.id}>. Reason: ${reason}`);

    } else if (sub === 'add') {
      const targetUser = interaction.options.getUser('user');
      const db = getDb();
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);

      if (!ticket) {
        return interaction.reply({ content: '❌ This command can only be used inside a ticket channel.', ephemeral: true });
      }

      await interaction.channel.permissionOverwrites.edit(targetUser.id, {
        ViewChannel: true,
        SendMessages: true,
        AttachFiles: true,
        ReadMessageHistory: true
      });

      return interaction.reply({ content: `✅ Added <@${targetUser.id}> to this ticket.` });

    } else if (sub === 'remove') {
      const targetUser = interaction.options.getUser('user');
      const db = getDb();
      const ticket = db.prepare('SELECT * FROM tickets WHERE channel_id = ?').get(interaction.channel.id);

      if (!ticket) {
        return interaction.reply({ content: '❌ This command can only be used inside a ticket channel.', ephemeral: true });
      }

      await interaction.channel.permissionOverwrites.delete(targetUser.id);
      return interaction.reply({ content: `✅ Removed <@${targetUser.id}> from this ticket.` });
    }
  }
};
