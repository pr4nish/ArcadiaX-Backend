const { Client, GatewayIntentBits, Partials } = require('discord.js');
const config = require('../config');
const logger = require('../utils/logger');
const { loadCommands, registerCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

class BotClient {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
        Partials.GuildMember,
        Partials.Reaction
      ]
    });

    this.isReady = false;
  }

  async start() {
    loadCommands(this.client);
    loadEvents(this.client);

    this.client.once('ready', async () => {
      this.isReady = true;
      await registerCommands(this.client);
    });

    if (!config.discord.token) {
      logger.warn('[Bot Startup] DISCORD_TOKEN is not configured in .env. Discord bot Gateway connection skipped.');
      return;
    }

    try {
      await this.client.login(config.discord.token);
    } catch (err) {
      logger.error('Failed to log in to Discord Gateway:', err);
    }
  }

  async stop() {
    if (this.client) {
      logger.info('Gracefully shutting down Discord bot client...');
      this.client.destroy();
      this.isReady = false;
      logger.success('Discord bot disconnected gracefully.');
    }
  }

  getClient() {
    return this.client;
  }
}

const botInstance = new BotClient();

module.exports = {
  botInstance,
  getClient: () => botInstance.getClient()
};
