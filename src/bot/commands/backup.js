const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const backupModule = require('../modules/backup');
const config = require('../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Create, list, and restore ArcadiaX server backups')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a comprehensive snapshot backup of server roles and channels')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('Optional custom identifier name for the backup')
            .setRequired(false)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('List all existing backups stored for this server')
    )
    .addSubcommand(sub =>
      sub
        .setName('restore')
        .setDescription('Restore a server snapshot from a backup ID')
        .addStringOption(opt =>
          opt
            .setName('id')
            .setDescription('Backup ID to restore')
            .setRequired(true)
        )
        .addBooleanOption(opt =>
          opt
            .setName('roles')
            .setDescription('Restore roles (default: true)')
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName('channels')
            .setDescription('Restore channels & categories (default: true)')
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName('settings')
            .setDescription('Restore server name & settings (default: false)')
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt
            .setName('confirm')
            .setDescription('You must set this to true to confirm execution')
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
        content: '❌ Only administrators can manage server backups.',
        ephemeral: true
      });
    }

    if (sub === 'create') {
      await interaction.deferReply();
      const customName = interaction.options.getString('name');

      try {
        const backup = await backupModule.createBackup(guild, interaction.user.tag, customName, 'manual');
        const embed = new EmbedBuilder()
          .setTitle('💾 Server Backup Created Successfully')
          .setColor('#57F287')
          .addFields(
            { name: 'Backup ID', value: `\`${backup.id}\``, inline: true },
            { name: 'Name', value: backup.name, inline: true },
            { name: 'Size', value: `${(backup.sizeBytes / 1024).toFixed(2)} KB`, inline: true },
            { name: 'Roles Captured', value: `${backup.summary.rolesCount}`, inline: true },
            { name: 'Categories', value: `${backup.summary.categoriesCount}`, inline: true },
            { name: 'Channels', value: `${backup.summary.channelsCount}`, inline: true }
          )
          .setFooter({ text: 'Snapshot stored in SQLite database. Manageable via React Dashboard.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Backup creation failed: ${err.message}` });
      }

    } else if (sub === 'list') {
      const backups = backupModule.getBackups(guild.id);
      if (backups.length === 0) {
        return interaction.reply({ content: '📂 No backups found for this server. Use `/backup create` to take your first snapshot.' });
      }

      const description = backups.slice(0, 10).map(b => 
        `• **${b.name}** (\`${b.id}\`)\n  📅 ${b.created_at} | Size: ${(b.size_bytes / 1024).toFixed(2)} KB | Type: \`${b.type}\` | By: ${b.created_by}`
      ).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`📂 Server Backups (${backups.length} Total)`)
        .setColor('#5865F2')
        .setDescription(description)
        .setFooter({ text: 'Restoration can be triggered via /backup restore or React Dashboard' });

      return interaction.reply({ embeds: [embed] });

    } else if (sub === 'restore') {
      const backupId = interaction.options.getString('id');
      const confirm = interaction.options.getBoolean('confirm');
      const restoreRoles = interaction.options.getBoolean('roles') ?? true;
      const restoreChannels = interaction.options.getBoolean('channels') ?? true;
      const restoreSettings = interaction.options.getBoolean('settings') ?? false;

      if (!confirm) {
        return interaction.reply({
          content: '❌ Confirmation was not granted. Restoration aborted.',
          ephemeral: true
        });
      }

      await interaction.deferReply();

      try {
        const result = await backupModule.restoreBackup(guild, backupId, {
          roles: restoreRoles,
          channels: restoreChannels,
          settings: restoreSettings,
          confirmation: true
        }, interaction.user.tag);

        const embed = new EmbedBuilder()
          .setTitle('✅ Backup Restored Successfully')
          .setColor('#57F287')
          .setDescription(`Restoration of snapshot \`${backupId}\` completed.\n\n` + result.logs.map(l => `• ${l}`).join('\n'))
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `❌ Restoration failed: ${err.message}` });
      }
    }
  }
};
