const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../../database');
const logger = require('../../utils/logger');
const cron = require('node-cron');

class BackupModule {
  constructor() {
    this.cronTask = null;
  }

  initScheduledBackups(client, guildId) {
    if (this.cronTask) {
      this.cronTask.stop();
    }

    // Run scheduled backup daily at 00:00 UTC
    this.cronTask = cron.schedule('0 0 * * *', async () => {
      logger.info(`[Backup] Running daily automated scheduled backup for guild: ${guildId}`);
      try {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          await this.createBackup(guild, 'SYSTEM_SCHEDULER', 'Daily Automated Backup', 'scheduled');
        }
      } catch (err) {
        logger.error('[Backup] Scheduled backup failed:', err);
      }
    });

    logger.info(`[Backup] Automated scheduled backup runner initialized for guild ${guildId} (Daily 00:00 UTC).`);
  }

  async createBackup(guild, createdBy = 'ADMIN', backupName = '', type = 'manual') {
    logger.info(`[Backup] Initiating server backup for ${guild.name} (${guild.id})...`);

    // 1. Fetch all guild structures
    await guild.roles.fetch();
    await guild.channels.fetch();
    await guild.emojis.fetch();
    await guild.stickers.fetch();

    // 2. Roles (excluding @everyone and managed bot integration roles)
    const roles = guild.roles.cache
      .filter(r => r.id !== guild.id)
      .sort((a, b) => a.position - b.position)
      .map(r => ({
        id: r.id,
        name: r.name,
        color: r.hexColor,
        hoist: r.hoist,
        position: r.position,
        permissions: r.permissions.bitfield.toString(),
        mentionable: r.mentionable,
        managed: r.managed
      }));

    // 3. Channels (Categories, Text, Voice, Announcement)
    const channels = [];
    const categories = guild.channels.cache
      .filter(c => c.type === ChannelType.GuildCategory)
      .sort((a, b) => a.position - b.position)
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        position: cat.position,
        permissionOverwrites: cat.permissionOverwrites.cache.map(ow => ({
          id: ow.id,
          type: ow.type,
          allow: ow.allow.bitfield.toString(),
          deny: ow.deny.bitfield.toString()
        }))
      }));

    const nonCategories = guild.channels.cache
      .filter(c => c.type !== ChannelType.GuildCategory && !c.isThread())
      .sort((a, b) => a.position - b.position)
      .map(ch => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        parentCategoryName: ch.parent ? ch.parent.name : null,
        position: ch.position,
        topic: ch.topic || null,
        nsfw: Boolean(ch.nsfw),
        rateLimitPerUser: ch.rateLimitPerUser || 0,
        bitrate: ch.bitrate || null,
        userLimit: ch.userLimit || null,
        permissionOverwrites: ch.permissionOverwrites.cache.map(ow => ({
          id: ow.id,
          type: ow.type,
          allow: ow.allow.bitfield.toString(),
          deny: ow.deny.bitfield.toString()
        }))
      }));

    // 4. Server General Config
    const serverConfig = {
      name: guild.name,
      iconURL: guild.iconURL({ dynamic: true }),
      bannerURL: guild.bannerURL({ dynamic: true }),
      verificationLevel: guild.verificationLevel,
      explicitContentFilter: guild.explicitContentFilter,
      defaultMessageNotifications: guild.defaultMessageNotifications,
      systemChannelId: guild.systemChannelId,
      afkChannelId: guild.afkChannelId,
      afkTimeout: guild.afkTimeout
    };

    // 5. Supported Emoji & Sticker Metadata
    const emojis = guild.emojis.cache.map(e => ({
      name: e.name,
      animated: Boolean(e.animated),
      url: e.imageURL()
    }));

    const stickers = guild.stickers.cache.map(s => ({
      name: s.name,
      description: s.description,
      tags: s.tags,
      url: s.url
    }));

    const backupPayload = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      guildId: guild.id,
      serverConfig,
      roles,
      categories,
      channels: nonCategories,
      emojis,
      stickers
    };

    const dataJson = JSON.stringify(backupPayload);
    const backupId = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const finalName = backupName || `Backup-${new Date().toISOString().substring(0, 16).replace('T', '_')}`;
    const sizeBytes = Buffer.byteLength(dataJson, 'utf8');

    const db = getDb();
    db.prepare(`
      INSERT INTO backups (id, guild_id, name, created_by, type, data_json, size_bytes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(backupId, guild.id, finalName, createdBy, type, dataJson, sizeBytes);

    logger.success(`[Backup] Server backup created: ${backupId} (${(sizeBytes / 1024).toFixed(2)} KB)`);

    return {
      id: backupId,
      name: finalName,
      type,
      sizeBytes,
      createdAt: backupPayload.timestamp,
      summary: {
        rolesCount: roles.length,
        categoriesCount: categories.length,
        channelsCount: nonCategories.length,
        emojisCount: emojis.length
      }
    };
  }

  getBackups(guildId) {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, guild_id, name, created_by, type, size_bytes, created_at
      FROM backups
      WHERE guild_id = ?
      ORDER BY created_at DESC
    `).all(guildId);
    return rows;
  }

  getBackup(backupId) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM backups WHERE id = ?').get(backupId);
    if (!row) return null;
    return {
      ...row,
      data: JSON.parse(row.data_json)
    };
  }

  deleteBackup(backupId) {
    const db = getDb();
    const result = db.prepare('DELETE FROM backups WHERE id = ?').run(backupId);
    return result.changes > 0;
  }

  getBackupPreview(backupId) {
    const item = this.getBackup(backupId);
    if (!item) return null;

    const data = item.data;
    return {
      id: item.id,
      name: item.name,
      createdAt: item.created_at,
      createdBy: item.created_by,
      sizeKb: (item.size_bytes / 1024).toFixed(2),
      serverName: data.serverConfig ? data.serverConfig.name : 'Unknown',
      roles: (data.roles || []).map(r => ({ name: r.name, color: r.color, managed: r.managed })),
      categories: (data.categories || []).map(c => ({ name: c.name })),
      channels: (data.channels || []).map(c => ({ name: c.name, type: c.type, parent: c.parentCategoryName })),
      emojisCount: (data.emojis || []).length,
      stickersCount: (data.stickers || []).length
    };
  }

  async restoreBackup(guild, backupId, options = {}, executorTag = 'Dashboard Admin') {
    const {
      roles = true,
      channels = true,
      settings = false,
      confirmation = false
    } = options;

    if (!confirmation) {
      throw new Error('Restore confirmation flag required: confirmation must be explicitly true.');
    }

    const backupRecord = this.getBackup(backupId);
    if (!backupRecord) {
      throw new Error(`Backup with ID ${backupId} not found.`);
    }

    const backupData = backupRecord.data;
    const botMember = guild.members.me;

    if (!botMember.permissions.has(PermissionFlagsBits.Administrator)) {
      throw new Error('Bot requires ADMINISTRATOR permission in the server to execute restoration.');
    }

    const restorationLogs = [];
    logger.info(`[Backup] Starting restoration of backup ${backupId} for guild ${guild.name}...`);

    // Map old role IDs in backup to new created role IDs in guild
    const roleIdMap = new Map();

    // 1. Restore Server Settings if selected
    if (settings && backupData.serverConfig) {
      try {
        if (backupData.serverConfig.name) {
          await guild.setName(backupData.serverConfig.name, 'ArcadiaX Backup Restore');
          restorationLogs.push('Restored server name.');
        }
      } catch (err) {
        restorationLogs.push(`Failed to restore server name: ${err.message}`);
      }
    }

    // 2. Restore Roles if selected
    if (roles && Array.isArray(backupData.roles)) {
      for (const roleDef of backupData.roles) {
        if (roleDef.managed) continue; // Skip bot integration roles
        try {
          // Check if role with same name already exists
          let targetRole = guild.roles.cache.find(r => r.name === roleDef.name && !r.managed);
          if (!targetRole) {
            targetRole = await guild.roles.create({
              name: roleDef.name,
              color: roleDef.color,
              hoist: roleDef.hoist,
              permissions: BigInt(roleDef.permissions || '0'),
              mentionable: roleDef.mentionable,
              reason: 'ArcadiaX Backup Restore'
            });
          }
          roleIdMap.set(roleDef.id, targetRole.id);
        } catch (err) {
          restorationLogs.push(`Could not restore role ${roleDef.name}: ${err.message}`);
        }
      }
      restorationLogs.push(`Processed ${backupData.roles.length} roles.`);
    }

    // 3. Restore Categories and Channels if selected
    if (channels) {
      const categoryMap = new Map();

      // Create Categories
      if (Array.isArray(backupData.categories)) {
        for (const catDef of backupData.categories) {
          try {
            let catChannel = guild.channels.cache.find(c => c.name === catDef.name && c.type === ChannelType.GuildCategory);
            if (!catChannel) {
              catChannel = await guild.channels.create({
                name: catDef.name,
                type: ChannelType.GuildCategory,
                reason: 'ArcadiaX Backup Restore'
              });
            }
            categoryMap.set(catDef.name, catChannel.id);
          } catch (err) {
            restorationLogs.push(`Could not restore category ${catDef.name}: ${err.message}`);
          }
        }
      }

      // Create Channels
      if (Array.isArray(backupData.channels)) {
        for (const chDef of backupData.channels) {
          try {
            let existing = guild.channels.cache.find(c => c.name === chDef.name && c.type === chDef.type);
            if (!existing) {
              const parentId = chDef.parentCategoryName ? categoryMap.get(chDef.parentCategoryName) : null;
              await guild.channels.create({
                name: chDef.name,
                type: chDef.type,
                parent: parentId || undefined,
                topic: chDef.topic || undefined,
                nsfw: chDef.nsfw || false,
                rateLimitPerUser: chDef.rateLimitPerUser || 0,
                bitrate: chDef.bitrate || undefined,
                userLimit: chDef.userLimit || undefined,
                reason: 'ArcadiaX Backup Restore'
              });
            }
          } catch (err) {
            restorationLogs.push(`Could not restore channel ${chDef.name}: ${err.message}`);
          }
        }
        restorationLogs.push(`Processed ${backupData.channels.length} channels.`);
      }
    }

    // Record activity log
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO activity_logs (guild_id, user_tag, action, target_type, target_id, details)
        VALUES (?, ?, 'RESTORE_BACKUP', 'backup', ?, ?)
      `).run(guild.id, executorTag, backupId, JSON.stringify({ options, logs: restorationLogs }));
    } catch {
      // Non-blocking log
    }

    logger.success(`[Backup] Completed restore for backup ${backupId}`);
    return {
      success: true,
      backupId,
      logs: restorationLogs
    };
  }
}

module.exports = new BackupModule();
