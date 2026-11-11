const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const antinukeModule = require('../modules/antinuke');
const { getDb } = require('../../database');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antinuke')
    .setDescription('Manage ArcadiaX Antinuke enterprise security protection')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('View active antinuke thresholds and security configurations')
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable antinuke protection')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('Whether antinuke is enabled')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('lockdown')
        .setDescription('Engage or release emergency server lockdown')
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('Lockdown action')
            .setRequired(true)
            .addChoices(
              { name: 'Engage Lockdown (Deny @everyone send messages)', value: 'engage' },
              { name: 'Release Lockdown (Restore normal permissions)', value: 'release' }
            )
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('trusted')
        .setDescription('Manage trusted users for antinuke bypass')
        .addStringOption(opt =>
          opt
            .setName('action')
            .setDescription('Action to perform')
            .setRequired(true)
            .addChoices(
              { name: 'List Trusted Users', value: 'list' },
              { name: 'Add Trusted User', value: 'add' },
              { name: 'Remove Trusted User', value: 'remove' }
            )
        )
        .addUserOption(opt =>
          opt
            .setName('user')
            .setDescription('User to add or remove (not required for list)')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    const sub = interaction.options.getSubcommand();
    const isOwnerOrAdmin = interaction.user.id === config.discord.ownerId ||
      config.discord.adminUserIds.includes(interaction.user.id) ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (!isOwnerOrAdmin) {
      return interaction.reply({
        content: '❌ You do not have permission to execute ArcadiaX Antinuke administrative commands.',
        ephemeral: true
      });
    }

    if (sub === 'status') {
      const cfg = antinukeModule.getConfig(guild.id);
      const embed = new EmbedBuilder()
        .setTitle('🛡️ ArcadiaX Antinuke Configuration')
        .setColor(cfg.enabled ? '#57F287' : '#ED4245')
        .addFields(
          { name: 'Status', value: cfg.enabled ? '🟢 **ENABLED**' : '🔴 **DISABLED**', inline: true },
          { name: 'Response Action', value: `\`${cfg.response_action}\``, inline: true },
          { name: 'Emergency Lockdown', value: cfg.emergency_lockdown_enabled ? '⚠️ ACTIVE' : 'Inactive', inline: true },
          { name: 'Channel Deletion Limit', value: `${cfg.mass_channel_delete_threshold} / ${cfg.mass_channel_delete_window}s`, inline: true },
          { name: 'Channel Creation Limit', value: `${cfg.mass_channel_create_threshold} / ${cfg.mass_channel_create_window}s`, inline: true },
          { name: 'Role Deletion Limit', value: `${cfg.mass_role_delete_threshold} / ${cfg.mass_role_delete_window}s`, inline: true },
          { name: 'Role Creation Limit', value: `${cfg.mass_role_create_threshold} / ${cfg.mass_role_create_window}s`, inline: true },
          { name: 'Mass Ban Limit', value: `${cfg.mass_ban_threshold} / ${cfg.mass_ban_window}s`, inline: true },
          { name: 'Mass Kick Limit', value: `${cfg.mass_kick_threshold} / ${cfg.mass_kick_window}s`, inline: true },
          { name: 'Webhook Protection', value: cfg.webhook_creation_protection ? '✅ Active' : '❌ Disabled', inline: true },
          { name: 'Dangerous Perms Protection', value: cfg.dangerous_perm_protection ? '✅ Active' : '❌ Disabled', inline: true },
          { name: 'Alert Channel', value: cfg.alert_channel_id ? `<#${cfg.alert_channel_id}>` : '`Not Configured`', inline: true }
        )
        .setFooter({ text: 'All settings fully editable via React Dashboard API' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } else if (sub === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled');
      antinukeModule.updateConfig(guild.id, { enabled: enabled ? 1 : 0 });
      return interaction.reply({
        content: `🛡️ Antinuke protection is now **${enabled ? 'ENABLED' : 'DISABLED'}** for ${guild.name}.`
      });

    } else if (sub === 'lockdown') {
      await interaction.deferReply();
      const action = interaction.options.getString('action');
      const enableLockdown = action === 'engage';

      try {
        const res = await antinukeModule.toggleEmergencyLockdown(guild, enableLockdown, interaction.user.tag);
        return interaction.editReply({
          content: `🚨 Emergency Lockdown **${enableLockdown ? 'ENGAGED' : 'RELEASED'}**! Affected ${res.channelsAffected} text channels.`
        });
      } catch (err) {
        return interaction.editReply({
          content: `❌ Lockdown operation failed: ${err.message}`
        });
      }

    } else if (sub === 'trusted') {
      const action = interaction.options.getString('action');
      const targetUser = interaction.options.getUser('user');
      const db = getDb();

      if (action === 'list') {
        const rows = db.prepare(`SELECT * FROM trusted_users WHERE guild_id = ? AND (type = 'antinuke' OR type = 'both')`).all(guild.id);
        const embed = new EmbedBuilder()
          .setTitle('🛡️ Antinuke Trusted Users')
          .setColor('#5865F2')
          .setDescription(rows.length > 0 
            ? rows.map(r => `• <@${r.user_id}> (\`${r.user_id}\`) - Added by: ${r.added_by || 'Admin'}`).join('\n')
            : 'No trusted users registered in database.')
          .setTimestamp();
        return interaction.reply({ embeds: [embed] });

      } else if (action === 'add') {
        if (!targetUser) return interaction.reply({ content: '❌ You must specify a user to trust.', ephemeral: true });
        db.prepare(`
          INSERT INTO trusted_users (guild_id, user_id, user_tag, type, added_by)
          VALUES (?, ?, ?, 'both', ?)
          ON CONFLICT(guild_id, user_id, type) DO NOTHING
        `).run(guild.id, targetUser.id, targetUser.tag, interaction.user.tag);

        return interaction.reply({ content: `✅ Added <@${targetUser.id}> (\`${targetUser.tag}\`) to trusted antinuke whitelist.` });

      } else if (action === 'remove') {
        if (!targetUser) return interaction.reply({ content: '❌ You must specify a user to untrust.', ephemeral: true });
        db.prepare(`
          DELETE FROM trusted_users 
          WHERE guild_id = ? AND user_id = ?
        `).run(guild.id, targetUser.id);

        return interaction.reply({ content: `✅ Removed <@${targetUser.id}> from trusted whitelist.` });
      }
    }
  }
};
