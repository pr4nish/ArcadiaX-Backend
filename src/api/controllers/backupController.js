const backupModule = require('../../bot/modules/backup');
const { getClient } = require('../../bot/client');
const config = require('../../config');

class BackupController {
  getBackups(req, res) {
    const guildId = config.discord.guildId;
    const backups = backupModule.getBackups(guildId);
    return res.success(backups, 'Backups list retrieved.');
  }

  async createBackup(req, res) {
    const guildId = config.discord.guildId;
    const { name } = req.body;
    const client = getClient();
    const guild = client.guilds.cache.get(guildId);

    if (!guild) {
      return res.error('Target Discord guild not reachable by bot.', 503, 'GUILD_UNAVAILABLE');
    }

    try {
      const creatorTag = req.session && req.session.user ? req.session.user.username : 'API Admin';
      const backup = await backupModule.createBackup(guild, creatorTag, name, 'manual');
      return res.success(backup, 'Backup snapshot created successfully.', 201);
    } catch (err) {
      return res.error(`Failed to create backup: ${err.message}`);
    }
  }

  getBackup(req, res) {
    const { id } = req.params;
    const preview = backupModule.getBackupPreview(id);

    if (!preview) {
      return res.error('Backup not found.', 404, 'NOT_FOUND');
    }

    return res.success(preview, 'Backup details retrieved.');
  }

  exportBackup(req, res) {
    const { id } = req.params;
    const backup = backupModule.getBackup(id);

    if (!backup) {
      return res.error('Backup not found.', 404, 'NOT_FOUND');
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="arcadiax-backup-${id}.json"`);
    return res.send(JSON.stringify(backup.data, null, 2));
  }

  async restoreBackup(req, res) {
    const { id } = req.params;
    const { roles = true, channels = true, settings = false, confirmation = false } = req.body;

    if (!confirmation) {
      return res.error('Confirmation required. Set "confirmation": true in request body to proceed with restore.', 400, 'CONFIRMATION_REQUIRED');
    }

    const client = getClient();
    const guild = client.guilds.cache.get(config.discord.guildId);

    if (!guild) {
      return res.error('Target Discord guild not reachable by bot.', 503, 'GUILD_UNAVAILABLE');
    }

    try {
      const executorTag = req.session && req.session.user ? req.session.user.username : 'API Admin';
      const result = await backupModule.restoreBackup(guild, id, {
        roles: Boolean(roles),
        channels: Boolean(channels),
        settings: Boolean(settings),
        confirmation: true
      }, executorTag);

      return res.success(result, 'Backup restoration executed successfully.');
    } catch (err) {
      return res.error(`Restoration failed: ${err.message}`);
    }
  }

  deleteBackup(req, res) {
    const { id } = req.params;
    const deleted = backupModule.deleteBackup(id);

    if (!deleted) {
      return res.error('Backup not found or already deleted.', 404, 'NOT_FOUND');
    }

    return res.success({ id }, 'Backup deleted successfully.');
  }
}

module.exports = new BackupController();
