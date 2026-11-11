const { ActivityType } = require('discord.js');
const logger = require('../../utils/logger');
const config = require('../../config');
const backupModule = require('../modules/backup');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    logger.success(`ArcadiaX Discord Bot is online as ${client.user.tag} (ID: ${client.user.id})`);

    // Verify guild access
    const targetGuild = client.guilds.cache.get(config.discord.guildId);
    if (!targetGuild) {
      logger.warn(`[Guild Notice] Configured DISCORD_GUILD_ID (${config.discord.guildId}) is not in bot cache yet. Ensure bot is invited to this server.`);
    } else {
      logger.info(`Single-server lock active on: ${targetGuild.name} (${targetGuild.id}) with ${targetGuild.memberCount} members.`);
    }

    // Set bot presence
    client.user.setPresence({
      activities: [
        {
          name: 'ArcadiaX Enterprise Security',
          type: ActivityType.Watching
        }
      ],
      status: 'online'
    });

    // Initialize scheduled automated backups
    if (config.discord.guildId) {
      backupModule.initScheduledBackups(client, config.discord.guildId);
    }
  }
};
