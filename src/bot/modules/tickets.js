const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const { getDb } = require('../../database');
const logger = require('../../utils/logger');

class TicketModule {
  getConfig(guildId) {
    const db = getDb();
    let row = db.prepare('SELECT * FROM ticket_config WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT INTO ticket_config (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM ticket_config WHERE guild_id = ?').get(guildId);
    }
    return {
      ...row,
      support_role_ids: JSON.parse(row.support_role_ids || '[]'),
      options: JSON.parse(row.options_json || '[]')
    };
  }

  updateConfig(guildId, updates) {
    const db = getDb();
    const fields = [];
    const values = [];

    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.category_id !== undefined) {
      fields.push('category_id = ?');
      values.push(updates.category_id);
    }
    if (updates.log_channel_id !== undefined) {
      fields.push('log_channel_id = ?');
      values.push(updates.log_channel_id);
    }
    if (updates.support_role_ids !== undefined) {
      fields.push('support_role_ids = ?');
      values.push(JSON.stringify(updates.support_role_ids));
    }
    if (updates.panel_channel_id !== undefined) {
      fields.push('panel_channel_id = ?');
      values.push(updates.panel_channel_id);
    }
    if (updates.panel_title !== undefined) {
      fields.push('panel_title = ?');
      values.push(updates.panel_title);
    }
    if (updates.panel_description !== undefined) {
      fields.push('panel_description = ?');
      values.push(updates.panel_description);
    }
    if (updates.panel_color !== undefined) {
      fields.push('panel_color = ?');
      values.push(updates.panel_color);
    }
    if (updates.options !== undefined || updates.options_json !== undefined) {
      const opts = updates.options || JSON.parse(updates.options_json);
      fields.push('options_json = ?');
      values.push(JSON.stringify(opts));
    }

    if (fields.length === 0) return this.getConfig(guildId);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(guildId);

    db.prepare(`UPDATE ticket_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
    return this.getConfig(guildId);
  }

  async sendTicketPanel(guild, channelId = null) {
    const config = this.getConfig(guild.id);
    const targetChannelId = channelId || config.panel_channel_id;

    if (!targetChannelId) {
      throw new Error('No panel channel specified in ticket configuration.');
    }

    const channel = guild.channels.cache.get(targetChannelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Target panel channel ${targetChannelId} not found or not text-based.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(config.panel_title || 'ArcadiaX Support Portal')
      .setDescription(config.panel_description || 'Select a category below to create a private support ticket.')
      .setColor(config.panel_color || '#5865F2')
      .setFooter({ text: 'ArcadiaX Ticket System' })
      .setTimestamp();

    const selectOptions = (config.options || []).map(opt => ({
      label: opt.label.substring(0, 100),
      description: opt.description ? opt.description.substring(0, 100) : undefined,
      value: opt.id,
      emoji: opt.emoji || undefined
    }));

    if (selectOptions.length === 0) {
      throw new Error('Ticket options list cannot be empty.');
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('arcadiax_ticket_create_select')
      .setPlaceholder('Select a ticket category...')
      .addOptions(selectOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const message = await channel.send({
      embeds: [embed],
      components: [row]
    });

    const db = getDb();
    db.prepare(`
      UPDATE ticket_config 
      SET panel_channel_id = ?, panel_message_id = ? 
      WHERE guild_id = ?
    `).run(channel.id, message.id, guild.id);

    return {
      messageId: message.id,
      channelId: channel.id
    };
  }

  async handleTicketCreate(interaction) {
    const guild = interaction.guild;
    const member = interaction.member;
    const selectedOptionValue = interaction.values[0];

    const config = this.getConfig(guild.id);
    if (!config.enabled) {
      return interaction.reply({ content: '❌ The ticket system is currently disabled.', ephemeral: true });
    }

    const db = getDb();

    // Check duplicate open tickets by same user
    const existingTicket = db.prepare(`
      SELECT id, channel_id FROM tickets
      WHERE guild_id = ? AND creator_id = ? AND status != 'closed'
    `).get(guild.id, member.id);

    if (existingTicket) {
      const existingChannel = guild.channels.cache.get(existingTicket.channel_id);
      if (existingChannel) {
        return interaction.reply({
          content: `⚠️ You already have an open ticket in ${existingChannel}. Please use your existing ticket.`,
          ephemeral: true
        });
      }
    }

    await interaction.deferReply({ ephemeral: true });

    // Determine category and option label
    const selectedOption = (config.options || []).find(o => o.id === selectedOptionValue) || {
      id: selectedOptionValue,
      label: selectedOptionValue
    };

    // Calculate ticket number
    const countRow = db.prepare('SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?').get(guild.id);
    const ticketNumber = (countRow.count || 0) + 1;
    const channelName = `ticket-${String(ticketNumber).padStart(4, '0')}`;

    // Overwrites
    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.EmbedLinks
        ]
      },
      {
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.EmbedLinks,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ];

    // Add support roles
    for (const roleId of config.support_role_ids) {
      if (guild.roles.cache.has(roleId)) {
        permissionOverwrites.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.EmbedLinks
          ]
        });
      }
    }

    try {
      const ticketChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: config.category_id || undefined,
        topic: `ArcadiaX Ticket #${ticketNumber} | Creator: ${member.user.tag} (${member.id}) | Type: ${selectedOption.label}`,
        permissionOverwrites
      });

      // Insert record in DB
      const result = db.prepare(`
        INSERT INTO tickets (ticket_number, guild_id, channel_id, creator_id, creator_tag, option_value, status)
        VALUES (?, ?, ?, ?, ?, ?, 'open')
      `).run(ticketNumber, guild.id, ticketChannel.id, member.id, member.user.tag, selectedOption.label);

      const ticketRecordId = result.lastInsertRowid;

      // Send initial ticket message with Action Buttons
      const ticketEmbed = new EmbedBuilder()
        .setTitle(`🎫 Ticket #${ticketNumber} — ${selectedOption.label}`)
        .setColor(config.panel_color || '#5865F2')
        .setDescription(`Hello <@${member.id}>! Support will be with you shortly.\n\nPlease describe your request in detail.`)
        .addFields(
          { name: '👤 Creator', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: '📋 Category', value: selectedOption.label, inline: true },
          { name: 'Status', value: '🟢 Open', inline: true }
        )
        .setFooter({ text: 'ArcadiaX Ticket System' })
        .setTimestamp();

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_claim_${ticketRecordId}`)
          .setLabel('Claim')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🙋‍♂️'),
        new ButtonBuilder()
          .setCustomId(`ticket_close_${ticketRecordId}`)
          .setLabel('Close')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒'),
        new ButtonBuilder()
          .setCustomId(`ticket_transcript_${ticketRecordId}`)
          .setLabel('Transcript')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📜')
      );

      const supportMentions = config.support_role_ids.map(rId => `<@&${rId}>`).join(' ');
      await ticketChannel.send({
        content: `<@${member.id}> ${supportMentions}`,
        embeds: [ticketEmbed],
        components: [actionRow]
      });

      await interaction.editReply({
        content: `✅ Your ticket has been created: ${ticketChannel}`
      });

      // Log ticket creation
      this.logTicketAction(guild, `Ticket #${ticketNumber} Created`, `Created by <@${member.id}> for **${selectedOption.label}** in ${ticketChannel}`);
    } catch (err) {
      logger.error('Failed to create ticket channel:', err);
      await interaction.editReply({
        content: `❌ An error occurred while creating your ticket: ${err.message}`
      });
    }
  }

  async handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    const db = getDb();

    if (customId.startsWith('ticket_claim_')) {
      const ticketId = parseInt(customId.replace('ticket_claim_', ''), 10);
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);

      if (!ticket) return interaction.reply({ content: 'Ticket not found in database.', ephemeral: true });
      if (ticket.status === 'claimed') {
        return interaction.reply({ content: `This ticket is already claimed by <@${ticket.claimed_by}>.`, ephemeral: true });
      }

      db.prepare(`
        UPDATE tickets SET status = 'claimed', claimed_by = ?, claimed_tag = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(interaction.user.id, interaction.user.tag, ticketId);

      await interaction.reply({
        content: `🙋‍♂️ <@${interaction.user.id}> has claimed this ticket and will be handling your request.`
      });

    } else if (customId.startsWith('ticket_close_')) {
      const ticketId = parseInt(customId.replace('ticket_close_', ''), 10);
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);

      if (!ticket) return interaction.reply({ content: 'Ticket record not found.', ephemeral: true });
      if (ticket.status === 'closed') {
        return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });
      }

      // Close ticket: update DB, change channel perms
      db.prepare(`
        UPDATE tickets 
        SET status = 'closed', closed_by = ?, closed_tag = ?, closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(interaction.user.id, interaction.user.tag, ticketId);

      const channel = interaction.channel;
      // Deny creator from sending messages
      await channel.permissionOverwrites.edit(ticket.creator_id, {
        SendMessages: false
      }).catch(() => {});

      const closeEmbed = new EmbedBuilder()
        .setTitle('🔒 Ticket Closed')
        .setColor('#ED4245')
        .setDescription(`Ticket was closed by <@${interaction.user.id}>.\nUse the buttons below to reopen or permanently delete this channel.`)
        .setTimestamp();

      const postCloseRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_reopen_${ticketId}`)
          .setLabel('Reopen')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔓'),
        new ButtonBuilder()
          .setCustomId(`ticket_delete_${ticketId}`)
          .setLabel('Delete Channel')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🗑️'),
        new ButtonBuilder()
          .setCustomId(`ticket_transcript_${ticketId}`)
          .setLabel('Transcript')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📜')
      );

      await interaction.reply({ embeds: [closeEmbed], components: [postCloseRow] });
      this.logTicketAction(interaction.guild, `Ticket #${ticket.ticket_number} Closed`, `Closed by <@${interaction.user.id}> (${interaction.user.tag})`);

    } else if (customId.startsWith('ticket_reopen_')) {
      const ticketId = parseInt(customId.replace('ticket_reopen_', ''), 10);
      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
      if (!ticket) return interaction.reply({ content: 'Ticket not found.', ephemeral: true });

      db.prepare(`
        UPDATE tickets SET status = 'open', closed_by = NULL, closed_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(ticketId);

      await interaction.channel.permissionOverwrites.edit(ticket.creator_id, {
        SendMessages: true
      }).catch(() => {});

      await interaction.reply({ content: `🔓 Ticket #${ticket.ticket_number} has been reopened by <@${interaction.user.id}>.` });

    } else if (customId.startsWith('ticket_delete_')) {
      const ticketId = parseInt(customId.replace('ticket_delete_', ''), 10);
      await interaction.reply({ content: '🗑️ Ticket channel will be deleted in 5 seconds...' });

      // Generate transcript before deletion
      await this.generateTranscript(ticketId, interaction.guild);

      setTimeout(async () => {
        try {
          await interaction.channel.delete('Ticket deleted by staff');
        } catch (e) {
          logger.error('Failed to delete ticket channel:', e);
        }
      }, 5000);

    } else if (customId.startsWith('ticket_transcript_')) {
      const ticketId = parseInt(customId.replace('ticket_transcript_', ''), 10);
      await interaction.deferReply({ ephemeral: true });
      const transcript = await this.generateTranscript(ticketId, interaction.guild);
      await interaction.editReply({
        content: `📜 Transcript compiled successfully (${transcript.messageCount} messages recorded). Logged to support log channel.`
      });
    }
  }

  async recordTicketMessage(message) {
    if (!message.guild || message.author.bot) return;

    const db = getDb();
    const ticket = db.prepare('SELECT id FROM tickets WHERE channel_id = ?').get(message.channel.id);
    if (!ticket) return;

    const attachments = message.attachments.map(a => ({ name: a.name, url: a.url }));

    try {
      db.prepare(`
        INSERT INTO ticket_messages (ticket_id, channel_id, author_id, author_tag, author_avatar, content, attachments_json)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        ticket.id,
        message.channel.id,
        message.author.id,
        message.author.tag,
        message.author.displayAvatarURL(),
        message.content || '',
        JSON.stringify(attachments)
      );
    } catch (err) {
      logger.error('Error logging ticket message:', err);
    }
  }

  async generateTranscript(ticketId, guild) {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) return { messageCount: 0, text: '' };

    const messages = db.prepare(`
      SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC
    `).all(ticketId);

    let transcriptText = `==================================================\n`;
    transcriptText += `ARCADIAX TICKET TRANSCRIPT #${ticket.ticket_number}\n`;
    transcriptText += `Category: ${ticket.option_value}\n`;
    transcriptText += `Creator: ${ticket.creator_tag} (${ticket.creator_id})\n`;
    transcriptText += `Created At: ${ticket.created_at}\n`;
    transcriptText += `Closed At: ${ticket.closed_at || 'Still Open'}\n`;
    transcriptText += `Total Messages: ${messages.length}\n`;
    transcriptText += `==================================================\n\n`;

    for (const msg of messages) {
      transcriptText += `[${msg.created_at}] ${msg.author_tag} (${msg.author_id}):\n${msg.content}\n`;
      const attachments = JSON.parse(msg.attachments_json || '[]');
      if (attachments.length > 0) {
        transcriptText += `  Attachments: ${attachments.map(a => a.url).join(', ')}\n`;
      }
      transcriptText += `\n`;
    }

    db.prepare('UPDATE tickets SET transcript_text = ? WHERE id = ?').run(transcriptText, ticketId);

    // Send to log channel
    const config = this.getConfig(guild.id);
    if (config.log_channel_id) {
      const logChannel = guild.channels.cache.get(config.log_channel_id);
      if (logChannel && logChannel.isTextBased()) {
        const fileBuffer = Buffer.from(transcriptText, 'utf-8');
        await logChannel.send({
          content: `📜 Transcript for Ticket #${ticket.ticket_number} (${ticket.option_value}) created by <@${ticket.creator_id}>`,
          files: [{
            attachment: fileBuffer,
            name: `transcript-ticket-${ticket.ticket_number}.txt`
          }]
        }).catch(() => {});
      }
    }

    return {
      messageCount: messages.length,
      text: transcriptText
    };
  }

  async logTicketAction(guild, title, description) {
    const config = this.getConfig(guild.id);
    if (!config.log_channel_id) return;

    const channel = guild.channels.cache.get(config.log_channel_id);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(`🎫 ${title}`)
      .setColor('#5865F2')
      .setDescription(description)
      .setFooter({ text: 'ArcadiaX Ticket Audit' })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
  }

  getTickets(guildId, status = null, limit = 50, offset = 0) {
    const db = getDb();
    let query = 'SELECT * FROM tickets WHERE guild_id = ?';
    const params = [guildId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.prepare(query).all(...params);
    const countQuery = status 
      ? 'SELECT COUNT(*) as count FROM tickets WHERE guild_id = ? AND status = ?'
      : 'SELECT COUNT(*) as count FROM tickets WHERE guild_id = ?';
    const countParams = status ? [guildId, status] : [guildId];
    const total = db.prepare(countQuery).get(...countParams).count;

    return {
      total,
      limit,
      offset,
      tickets: rows
    };
  }

  getTicketById(ticketId) {
    const db = getDb();
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (!ticket) return null;

    const messages = db.prepare('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC').all(ticketId);
    return {
      ...ticket,
      messages: messages.map(m => ({
        ...m,
        attachments: JSON.parse(m.attachments_json || '[]')
      }))
    };
  }
}

module.exports = new TicketModule();
