const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const antibetrayModule = require('../modules/antibetray');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antibetray')
    .setDescription('Manage ArcadiaX Antibetray rogue staff & permission escalation monitoring')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('View active antibetray settings and escalation guards')
    )
    .addSubcommand(sub =>
      sub
        .setName('toggle')
        .setDescription('Enable or disable antibetray monitoring')
        .addBooleanOption(opt =>
          opt
            .setName('enabled')
            .setDescription('Whether antibetray is enabled')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('rollback')
        .setDescription('Enable or disable automatic permission rollback on betrayal')
        .addBooleanOption(opt =>
          opt
            .setName('auto_rollback')
            .setDescription('Enable automatic safe rollback')
            .setRequired(true)
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
        content: '❌ You do not have permission to execute ArcadiaX Antibetray commands.',
        ephemeral: true
      });
    }

    if (sub === 'status') {
      const cfg = antibetrayModule.getConfig(guild.id);
      const embed = new EmbedBuilder()
        .setTitle('🛡️ ArcadiaX Antibetray Configuration')
        .setColor(cfg.enabled ? '#57F287' : '#ED4245')
        .addFields(
          { name: 'Status', value: cfg.enabled ? '🟢 **ENABLED**' : '🔴 **DISABLED**', inline: true },
          { name: 'Auto-Rollback', value: cfg.auto_rollback ? '✅ Active' : '❌ Disabled', inline: true },
          { name: 'Admin Perm Monitoring', value: cfg.admin_perm_monitoring ? '✅ Active' : '❌ Disabled', inline: true },
          { name: 'Role Hierarchy Monitoring', value: cfg.role_hierarchy_monitoring ? '✅ Active' : '❌ Disabled', inline: true },
          { name: 'Channel Perms Monitoring', value: cfg.channel_perm_monitoring ? '✅ Active' : '❌ Disabled', inline: true },
          { name: 'Webhook Monitoring', value: cfg.webhook_monitoring ? '✅ Active' : '❌ Disabled', inline: true },
          { name: 'Alert Channel', value: cfg.alert_channel_id ? `<#${cfg.alert_channel_id}>` : '`Not Configured`', inline: true }
        )
        .setFooter({ text: 'Protects against rogue staff members and privilege escalations' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } else if (sub === 'toggle') {
      const enabled = interaction.options.getBoolean('enabled');
      antibetrayModule.updateConfig(guild.id, { enabled: enabled ? 1 : 0 });
      return interaction.reply({
        content: `🛡️ Antibetray monitoring is now **${enabled ? 'ENABLED' : 'DISABLED'}** for ${guild.name}.`
      });

    } else if (sub === 'rollback') {
      const autoRollback = interaction.options.getBoolean('auto_rollback');
      antibetrayModule.updateConfig(guild.id, { auto_rollback: autoRollback ? 1 : 0 });
      return interaction.reply({
        content: `🛡️ Antibetray automatic rollback is now **${autoRollback ? 'ENABLED' : 'DISABLED'}**.`
      });
    }
  }
};
