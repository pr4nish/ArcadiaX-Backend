const { AuditLogEvent, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getDb } = require('../../database');
const config = require('../../config');
const logger = require('../../utils/logger');

class AntinukeModule {
  constructor() {
    // Sliding window action tracker: key `${actionType}:${userId}` => array of timestamps [ms]
    this.actionTracker = new Map();
    // Cache to prevent duplicate triggers from simultaneous events
    this.processedEvents = new Set();
  }

  getConfig(guildId) {
    const db = getDb();
    let row = db.prepare('SELECT * FROM antinuke_config WHERE guild_id = ?').get(guildId);
    if (!row) {
      db.prepare('INSERT INTO antinuke_config (guild_id) VALUES (?)').run(guildId);
      row = db.prepare('SELECT * FROM antinuke_config WHERE guild_id = ?').get(guildId);
    }
    return row;
  }

  updateConfig(guildId, updates) {
    const db = getDb();
    const allowed = [
      'enabled',
      'mass_channel_delete_threshold', 'mass_channel_delete_window',
      'mass_channel_create_threshold', 'mass_channel_create_window',
      'mass_role_delete_threshold', 'mass_role_delete_window',
      'mass_role_create_threshold', 'mass_role_create_window',
      'mass_ban_threshold', 'mass_ban_window',
      'mass_kick_threshold', 'mass_kick_window',
      'webhook_creation_protection', 'dangerous_perm_protection',
      'response_action', 'quarantine_role_id', 'alert_channel_id',
      'emergency_lockdown_enabled'
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

    db.prepare(`UPDATE antinuke_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
    return this.getConfig(guildId);
  }

  isTrusted(guildId, userId) {
    // 1. Never punish server owner
    if (userId === config.discord.ownerId) return true;

    // 2. Never punish administrators listed in env
    if (config.discord.adminUserIds.includes(userId)) return true;

    // 3. Database trusted users
    const db = getDb();
    const row = db.prepare(`
      SELECT id FROM trusted_users 
      WHERE guild_id = ? AND user_id = ? AND (type = 'antinuke' OR type = 'both')
    `).get(guildId, userId);

    return Boolean(row);
  }

  trackAction(actionType, userId, windowSeconds) {
    const key = `${actionType}:${userId}`;
    const now = Date.now();
    const windowMs = (windowSeconds || 10) * 1000;

    let timestamps = this.actionTracker.get(key) || [];
    // Filter out actions outside the window
    timestamps = timestamps.filter(t => (now - t) < windowMs);
    timestamps.push(now);
    this.actionTracker.set(key, timestamps);

    return timestamps.length;
  }

  async getAuditLogExecutor(guild, auditLogType, targetId = null, waitMs = 300) {
    if (waitMs > 0) {
      await new Promise(r => setTimeout(r, waitMs));
    }

    try {
      if (!guild.members.me.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
        logger.warn(`[Antinuke] Missing VIEW_AUDIT_LOG permission in guild ${guild.id}`);
        return null;
      }

      const logs = await guild.fetchAuditLogs({
        limit: 5,
        type: auditLogType
      });

      const entry = logs.entries.find(e => {
        // If targetId is provided, match target
        if (targetId && e.targetId && e.targetId !== targetId) return false;
        // Verify entry happened recently (within 5 seconds)
        return (Date.now() - e.createdTimestamp) < 5000;
      }) || logs.entries.first();

      if (!entry || (Date.now() - entry.createdTimestamp) > 7000) {
        return null;
      }

      return entry.executor;
    } catch (err) {
      logger.error('[Antinuke] Failed to fetch audit logs:', err);
      return null;
    }
  }

  async applyPunishment(guild, executor, actionName, count, threshold) {
    const cfg = this.getConfig(guild.id);
    const botMember = guild.members.me;

    let mitigated = 0;
    const details = {
      action: actionName,
      triggeredCount: count,
      threshold,
      appliedAction: cfg.response_action,
      timestamp: new Date().toISOString()
    };

    logger.security(`[Antinuke Triggered] User ${executor.tag} (${executor.id}) exceeded threshold for ${actionName}. Action: ${cfg.response_action}`);

    try {
      const member = await guild.members.fetch(executor.id).catch(() => null);

      if (member) {
        // Check hierarchy: cannot punish members higher or equal to bot
        if (botMember.roles.highest.position <= member.roles.highest.position) {
          logger.warn(`[Antinuke] Cannot punish ${executor.tag}: role hierarchy prevents action.`);
          details.hierarchyBlocked = true;
        } else {
          if (cfg.response_action === 'strip_roles') {
            // Strip all roles with administrative/moderation permissions
            const dangerousPerms = [
              PermissionFlagsBits.Administrator,
              PermissionFlagsBits.ManageGuild,
              PermissionFlagsBits.ManageRoles,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.BanMembers,
              PermissionFlagsBits.KickMembers,
              PermissionFlagsBits.ManageWebhooks
            ];

            const rolesToRemove = member.roles.cache.filter(role => {
              if (role.id === guild.id) return false; // @everyone
              return dangerousPerms.some(perm => role.permissions.has(perm));
            });

            if (rolesToRemove.size > 0) {
              await member.roles.remove(rolesToRemove, `ArcadiaX Antinuke: Exceeded ${actionName} threshold`);
              mitigated = 1;
              details.strippedRoles = rolesToRemove.map(r => ({ id: r.id, name: r.name }));
            }
          } else if (cfg.response_action === 'quarantine_role' && cfg.quarantine_role_id) {
            const quarantineRole = guild.roles.cache.get(cfg.quarantine_role_id);
            if (quarantineRole) {
              // Strip non-managed roles and assign quarantine role
              const rolesToRemove = member.roles.cache.filter(r => r.id !== guild.id && !r.managed);
              await member.roles.remove(rolesToRemove, 'ArcadiaX Antinuke Quarantine');
              await member.roles.add(quarantineRole, 'ArcadiaX Antinuke Quarantine Role');
              mitigated = 1;
              details.quarantined = true;
            }
          }
        }
      }
    } catch (err) {
      logger.error(`[Antinuke] Failed to execute punishment on ${executor.id}:`, err);
    }

    // Record to database security_logs
    this.logSecurityEvent(guild.id, 'antinuke', actionName, executor, details, 'critical', mitigated);

    // Send alert notification to configured alert channel
    await this.sendAlertNotification(guild, executor, actionName, count, threshold, cfg.response_action, details);
  }

  logSecurityEvent(guildId, module, actionType, user, details, severity = 'high', mitigated = 0) {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO security_logs (guild_id, module, action_type, user_id, user_tag, details_json, severity, mitigated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        guildId,
        module,
        actionType,
        user ? user.id : 'UNKNOWN',
        user ? (user.tag || user.username) : 'UNKNOWN',
        JSON.stringify(details),
        severity,
        mitigated
      );
    } catch (err) {
      logger.error('[Antinuke] Failed to insert security log:', err);
    }
  }

  async sendAlertNotification(guild, executor, actionName, count, threshold, responseAction, details) {
    const cfg = this.getConfig(guild.id);
    const alertChannelId = cfg.alert_channel_id;
    if (!alertChannelId) return;

    const channel = guild.channels.cache.get(alertChannelId);
    if (!channel || !channel.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setTitle('🚨 ArcadiaX Antinuke Alert')
      .setColor('#ED4245')
      .setDescription(`A suspicious action threshold was triggered in **${guild.name}**!`)
      .addFields(
        { name: '👤 Offending User', value: `${executor ? `<@${executor.id}> (${executor.tag})` : 'Unknown'}\nID: \`${executor ? executor.id : 'N/A'}\``, inline: true },
        { name: '⚡ Action Triggered', value: `\`${actionName}\``, inline: true },
        { name: '📊 Frequency', value: `${count} actions (Limit: ${threshold})`, inline: true },
        { name: '🛡️ Mitigation Action', value: `\`${responseAction}\``, inline: true },
        { name: '⏰ Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      )
      .setFooter({ text: 'ArcadiaX Advanced Antinuke Protection' })
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(err => logger.error('[Antinuke] Failed to send alert message:', err));
  }

  // --- Handlers for Individual Antinuke Triggers ---

  async handleChannelDelete(channel) {
    const guild = channel.guild;
    const cfg = this.getConfig(guild.id);
    if (!cfg.enabled) return;

    const executor = await this.getAuditLogExecutor(guild, AuditLogEvent.ChannelDelete, channel.id);
    if (!executor || executor.id === guild.client.user.id) return;
    if (this.isTrusted(guild.id, executor.id)) return;

    const count = this.trackAction('channel_delete', executor.id, cfg.mass_channel_delete_window);
    if (count >= cfg.mass_channel_delete_threshold) {
      await this.applyPunishment(guild, executor, 'Mass Channel Deletion', count, cfg.mass_channel_delete_threshold);
    }
  }

  async handleChannelCreate(channel) {
    const guild = channel.guild;
    const cfg = this.getConfig(guild.id);
    if (!cfg.enabled) return;

    const executor = await this.getAuditLogExecutor(guild, AuditLogEvent.ChannelCreate, channel.id);
    if (!executor || executor.id === guild.client.user.id) return;
    if (this.isTrusted(guild.id, executor.id)) return;

    const count = this.trackAction('channel_create', executor.id, cfg.mass_channel_create_window);
    if (count >= cfg.mass_channel_create_threshold) {
      await this.applyPunishment(guild, executor, 'Mass Channel Creation', count, cfg.mass_channel_create_threshold);
    }
  }

  async handleRoleDelete(role) {
    const guild = role.guild;
    const cfg = this.getConfig(guild.id);
    if (!cfg.enabled) return;

    const executor = await this.getAuditLogExecutor(guild, AuditLogEvent.RoleDelete, role.id);
    if (!executor || executor.id === guild.client.user.id) return;
    if (this.isTrusted(guild.id, executor.id)) return;

    const count = this.trackAction('role_delete', executor.id, cfg.mass_role_delete_window);
    if (count >= cfg.mass_role_delete_threshold) {
      await this.applyPunishment(guild, executor, 'Mass Role Deletion', count, cfg.mass_role_delete_threshold);
    }
  }

  async handleRoleCreate(role) {
    const guild = role.guild;
    const cfg = this.getConfig(guild.id);
    if (!cfg.enabled) return;

    const executor = await this.getAuditLogExecutor(guild, AuditLogEvent.RoleCreate, role.id);
    if (!executor || executor.id === guild.client.user.id) return;
    if (this.isTrusted(guild.id, executor.id)) return;

    const count = this.trackAction('role_create', executor.id, cfg.mass_role_create_window);
    if (count >= cfg.mass_role_create_threshold) {
      await this.applyPunishment(guild, executor, 'Mass Role Creation', count, cfg.mass_role_create_threshold);
    }
  }

  async handleGuildBanAdd(ban) {
    const guild = ban.guild;
    const cfg = this.getConfig(guild.id);
    if (!cfg.enabled) return;

    const executor = await this.getAuditLogExecutor(guild, AuditLogEvent.MemberBanAdd, ban.user.id);
    if (!executor || executor.id === guild.client.user.id) return;
    if (this.isTrusted(guild.id, executor.id)) return;

    const count = this.trackAction('mass_ban', executor.id, cfg.mass_ban_window);
    if (count >= cfg.mass_ban_threshold) {
      await this.applyPunishment(guild, executor, 'Mass Member Ban', count, cfg.mass_ban_threshold);
    }
  }

  async handleMemberKick(member) {
    const guild = member.guild;
    const cfg = this.getConfig(guild.id);
    if (!cfg.enabled) return;

    const executor = await this.getAuditLogExecutor(guild, AuditLogEvent.MemberKick, member.id);
    if (!executor || executor.id === guild.client.user.id) return;
    if (this.isTrusted(guild.id, executor.id)) return;

    const count = this.trackAction('mass_kick', executor.id, cfg.mass_kick_window);
    if (count >= cfg.mass_kick_threshold) {
      await this.applyPunishment(guild, executor, 'Mass Member Kick', count, cfg.mass_kick_threshold);
    }
  }

  async handleWebhookCreate(channel) {
    const guild = channel.guild;
    const cfg = this.getConfig(guild.id);
    if (!cfg.enabled || !cfg.webhook_creation_protection) return;

    const executor = await this.getAuditLogExecutor(guild, AuditLogEvent.WebhookCreate);
    if (!executor || executor.id === guild.client.user.id) return;
    if (this.isTrusted(guild.id, executor.id)) return;

    // Direct trigger for unauthorized webhook
    await this.applyPunishment(guild, executor, 'Unauthorized Webhook Creation', 1, 1);
  }

  // Emergency Server Lockdown
  async toggleEmergencyLockdown(guild, enable = true, actorTag = 'Dashboard Admin') {
    const botMember = guild.members.me;
    if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
      throw new Error('Bot lacks MANAGE_CHANNELS permission to execute server lockdown.');
    }

    const everyoneRole = guild.roles.everyone;
    const channels = guild.channels.cache.filter(c => c.isTextBased() && !c.isThread());

    let altered = 0;
    for (const [, channel] of channels) {
      try {
        await channel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: enable ? false : null,
          AddReactions: enable ? false : null,
          CreatePublicThreads: enable ? false : null,
          CreatePrivateThreads: enable ? false : null
        }, { reason: `ArcadiaX Emergency Lockdown ${enable ? 'ENGAGED' : 'RELEASED'} by ${actorTag}` });
        altered++;
      } catch (e) {
        // Continue for other channels
      }
    }

    this.updateConfig(guild.id, { emergency_lockdown_enabled: enable ? 1 : 0 });
    this.logSecurityEvent(guild.id, 'antinuke', enable ? 'LOCKDOWN_ENGAGED' : 'LOCKDOWN_RELEASED', null, {
      actorTag,
      channelsAffected: altered
    }, 'critical', enable ? 1 : 0);

    return { success: true, lockdown: enable, channelsAffected: altered };
  }

  getSecurityLogs(guildId, limit = 50, offset = 0) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM security_logs
      WHERE guild_id = ? AND module = 'antinuke'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(guildId, limit, offset);

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM security_logs
      WHERE guild_id = ? AND module = 'antinuke'
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

module.exports = new AntinukeModule();
