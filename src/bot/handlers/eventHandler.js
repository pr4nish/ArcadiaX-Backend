const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);
      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
      } else {
        client.on(event.name, (...args) => event.execute(...args));
      }
    } catch (err) {
      logger.error(`[Event Loader] Failed to load event ${file}:`, err);
    }
  }

  // Client connection and error listeners
  client.on('error', error => {
    logger.error('[Discord Client Error]:', error);
  });

  client.on('warn', warning => {
    logger.warn('[Discord Client Warning]:', warning);
  });

  client.on('shardDisconnect', (event, id) => {
    logger.warn(`[Discord Shard ${id}] Disconnected. Reconnecting automatically...`);
  });

  client.on('shardReconnecting', id => {
    logger.info(`[Discord Shard ${id}] Reconnecting to Gateway...`);
  });

  logger.info(`Loaded ${eventFiles.length} modular bot events.`);
}

module.exports = {
  loadEvents
};
