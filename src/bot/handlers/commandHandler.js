const fs = require('fs');
const path = require('path');
const { Collection, REST, Routes } = require('discord.js');
const logger = require('../../utils/logger');
const config = require('../../config');

function loadCommands(client) {
  client.commands = new Collection();
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
      const command = require(filePath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        logger.warn(`[Command Loader] The command at ${filePath} is missing required "data" or "execute" property.`);
      }
    } catch (err) {
      logger.error(`[Command Loader] Error loading command ${file}:`, err);
    }
  }

  logger.info(`Loaded ${client.commands.size} Discord slash commands.`);
}

async function registerCommands(client) {
  if (!config.discord.token || !config.discord.clientId || !config.discord.guildId) {
    logger.warn('[Command Registration] Missing Discord token, clientId, or guildId. Skipping slash command registration.');
    return;
  }

  try {
    const commandsData = client.commands.map(cmd => cmd.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(config.discord.token);

    logger.info(`Started refreshing ${commandsData.length} application (/) commands for guild: ${config.discord.guildId}...`);

    await rest.put(
      Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
      { body: commandsData }
    );

    logger.success(`Successfully reloaded and registered ${commandsData.length} application (/) commands instantly to guild.`);
  } catch (err) {
    logger.error('Failed to register application slash commands:', err);
  }
}

module.exports = {
  loadCommands,
  registerCommands
};
