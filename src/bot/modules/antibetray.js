const { AuditLogEvent, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../database');
const config = require('../../config');
const logger = require('../../utils/logger');

class AntibetrayModule {
  getConfig(guildId) {
    const db = getDb();
    let row = db.prepare('SELECT * FROM antibetray_config WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT INTO antibetray_config (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM antibetray_config WHERE guild_id = ?').get(guildId);
    }
    return row;
  }

  updateConfig(guildId, updates) {
    const db = getDb();
    const allowed = [
      'enabled',
      'admin_perm_monitoring',
      'role_hierarchy_monitoring',
      'channel_perm_monitoring',
      'webhook_monitoring',
      'auto_rollback',
      'alert_channel_id'
    ];

    const fields = [];
    const values = [];

    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }

    if (fields.length === 0) return this.getConfig(guildId);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(guildId);

    db.prepare(`UPDATE antibetray_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
    return this.getConfig(guildId);
  }

  isTrustedAdmin(guildId, userId) {
    // 1. Owner always trusted
    if (userId === config.discord.ownerId) return true;

    // 2. Pre-configured admin user IDs
    if (config.discord.adminUserIds.includes(userId)) return true;

    // 3. Database trusted admins
    const db = getDb();
    const row = db.prepare(`
      SELECT id FROM trusted_users 
      WHERE guild_id = ? AND user_id = ? AND (type = 'antibetray' OR type = 'both')
    `).get(guildId, userId);

    return Boolean(row);
  }

  async getAuditLogExecutor(guild, auditLogType, waitMs = 300) {
    if (waitMs > 0) {
      await new Promise(r => setTimeout(r, waitMs));
    }

    try {
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
        return null;
      }

      const logs = await guild.fetchAuditLogs({
        limit: 1,
        type: auditLogType
      });

      const entry = logs.entries.first();
      if (!entry || (Date.now() - entry.createdTimestamp) > 7000) {
        return null;
      }

      return {
        executor: entry.executor,
        target: entry.target,
        changes: entry.changes
      };
    } catch (err) {
      logger.error('[Antibetray] Failed to fetch audit logs:', err);
      return null;
    }
  }

  logSecurityEvent(guildId, actionType, user, details, severity = 'high', mitigated = 0) {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO security_logs (guild_id, module, action_type, user_id, user_tag, details_json, severity, mitigated)
        VALUES (?, 'antibetray', ?, ?, ?, ?, ?, ?)
      `).run(
        guildId,
        actionType,
        user ? user.id : 'UNKNOWN',
        user ? (user.tag || user.username) : 'UNKNOWN',
        JSON.stringify(details),
        severity,
        mitigated
      );
    } catch (err) {
      logger.error('[Antibetray] Failed to insert security log:', err);
    }
  }

  async sendAlert(guild, title, description, fields = [], severity = 'critical') {
    const cfg = this.getConfig(guild.id);
    const alertChannelId = cfg.alert_channel_id;
    if (!alertChannelId) return;

    const channel = guild.channels.cache.get(alertChannelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle(`🛡️ Antibetray Alert: ${title}`)
      .setColor(severity === 'critical' ? '#ED4245' : '#FEE75C')
      .setDescription(description)
      .addFields(fields)
      .setFooter({ text: 'ArcadiaX Staff Betrayal & Privilege Escalation Monitor' })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
  }

  // --- Antibetray Detection Handlers ---

  async handleRoleUpdate(oldRole, newRole) {
    const guild = newRole.guild;
    const cfg = this.getConfig(guild.id);
    if (!cfg.enabled) return;

    // Check permission changes
    const dangerousPerms = [
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ManageWebhooks
    ];

    const gainedDangerousPerm = dangerousPerms.some(perm => 
      !oldRole.permissions.has(perm) && newRole.permissions.has(perm)
    );

    const auditData = await this.getAuditLogExecutor(guild, AuditLogEvent.RoleUpdate);
    const executor = auditData ? auditData.executor : null;

    if (!executor || executor.id === guild.client.user.id) return;
    if (this.isTrustedAdmin(guild.id, executor.id)) return;

    if (gainedDangerousPerm && cfg.admin_perm_monitoring) {
      logger.security(`[Antibetray] Unauthorized staff ${executor.tag} granted dangerous permissions to role ${newRole.name}`);
      let rolledBack = 0;

      if (cfg.auto_rollback && guild.members.me.permissions.has(PermissionFlagsBits.ManageRoles)) {
        try {
          if (guild.members.me.roles.highest.position > newRole.position) {
            await newRole.setPermissions(oldRole.permissions, 'ArcadiaX Antibetray: Automatic Rollback of Unauthorized Permissions');
            rolledBack = 1;
            logger.info(`[Antibetray] Successfully rolled back permissions for role ${newRole.name}`);
          }
        } catch (e) {
          logger.error('[Antibetray] Failed to rollback role permissions:', e);
        }
      }

      const details = {
        roleId: newRole.id,
        roleName: newRole.name,
        oldPermissions: oldRole.permissions.bitfield.toString(),
        newPermissions: newRole.permissions.bitfield.toString(),
        rolledBack: Boolean(rolledBack)
      };

      this.logSecurityEvent(guild.id, 'UNAUTHORIZED_ROLE_PERM_ESCALATION', executor, details, 'critical', rolledBack);
      await this.sendAlert(
        guild,
        'Dangerous Role Permission Escalation',
        `Staff member <@${executor.id}> (\`${executor.tag}\`) elevated permissions for role **${newRole.name}** without authorization.`,
        [
          { name: 'Role', value: `<@&${newRole.id}> (\`${newRole.id}\`)`, inline: true },
          { name: 'Executor', value: `<@${executor.id}> (\`${executor.id}\`)`, inline: true },
          { name: 'Safe Rollback', value: rolledBack ? '✅ Restored original permissions' : '⚠️ Rollback disabled/failed', inline: true }
        ]
      );
    }

    // Role Hierarchy Modification
    if (oldRole.rawPosition !== newRole.rawPosition && cfg.role_hierarchy_monitoring) {
      logger.security(`[Antibetray] Role hierarchy change on ${newRole.name} from position ${oldRole.rawPosition} to ${newRole.rawPosition} by ${executor.tag}`);
      this.logSecurityEvent(guild.id, 'ROLE_HIERARCHY_MODIFIED', executor, {
        roleId: newRole.id,
        roleName: newRole.name,
        oldPosition: oldRole.rawPosition,
        newPosition: newRole.rawPosition
      }, 'high', 0);

      await this.sendAlert(
        guild,
        'Role Hierarchy Modified',
        `Staff member <@${executor.id}> adjusted the position of role **${newRole.name}**.`,
        [
          { name: 'Role', value: `${newRole.name} (\`${newRole.id}\`)`, inline: true },
          { name: 'Old Position', value: `${oldRole.rawPosition}`, inline: true },
          { name: 'New Position', value: `${newRole.rawPosition}`, inline: true }
        ],
        'medium'
      );
    }
  }

  async handleChannelUpdate(oldChannel, newChannel) {
    const guild = newChannel.guild;
    const cfg = this.getConfig(guild.id);
    if (!cfg.enabled || !cfg.channel_perm_monitoring) return;

    const auditData = await this.getAuditLogExecutor(guild, AuditLogEvent.ChannelOverwriteUpdate);
    const executor = auditData ? auditData.executor : null;

    if (!executor || executor.id === guild.client.user.id) return;
    if (this.isTrustedAdmin(guild.id, executor.id)) return;

    this.logSecurityEvent(guild.id, 'CHANNEL_PERMS_MODIFIED', executor, {
      channelId: newChannel.id,
      channelName: newChannel.name
    }, 'medium', 0);

    await this.sendAlert(
      guild,
      'Channel Permissions Overwritten',
      `Staff member <@${executor.id}> updated permission overwrites for channel <#${newChannel.id}>.`,
      [
        { name: 'Channel', value: `<#${newChannel.id}> (\`${newChannel.id}\`)`, inline: true },
        { name: 'Executor', value: `<@${executor.id}> (\`${executor.tag}\`)`, inline: true }
      ],
      'medium'
    );
  }

  async handleGuildUpdate(oldGuild, newGuild) {
    const cfg = this.getConfig(newGuild.id);
    if (!cfg.enabled) return;

    const auditData = await this.getAuditLogExecutor(newGuild, AuditLogEvent.GuildUpdate);
    const executor = auditData ? auditData.executor : null;

    if (!executor || executor.id === newGuild.client.user.id) return;
    if (this.isTrustedAdmin(newGuild.id, executor.id)) return;

    const details = {
      oldName: oldGuild.name,
      newName: newGuild.name,
      oldVerification: oldGuild.verificationLevel,
      newVerification: newGuild.verificationLevel
    };

    this.logSecurityEvent(newGuild.id, 'DANGEROUS_GUILD_SETTINGS_CHANGE', executor, details, 'high', 0);
    await this.sendAlert(
      newGuild,
      'Server Configuration Modified',
      `Staff member <@${executor.id}> modified core server configuration.`,
      [
        { name: 'Executor', value: `<@${executor.id}> (\`${executor.tag}\`)`, inline: true },
        { name: 'Details', value: `Name: ${oldGuild.name} ➔ ${newGuild.name}`, inline: false }
      ],
      'high'
    );
  }

  getSecurityLogs(guildId, limit = 50, offset = 0) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM security_logs
      WHERE guild_id = ? AND module = 'antibetray'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(guildId, limit, offset);

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM security_logs
      WHERE guild_id = ? AND module = 'antibetray'
    `).get(guildId).count;

    return {
      total,
      limit,
      offset,
      logs: rows.map(r => ({
        ...r,
        details: r.details_json ? JSON.parse(r.details_json) : null
      }))
    };
  }
}

module.exports = new AntibetrayModule();
