const { app, sessionStore } = require('./app');
const config = require('./config');
const { getDb, dbManager } = require('./database');
const { botInstance } = require('./bot/client');
const logger = require('./utils/logger');

let server = null;

async function bootstrap() {
  logger.info('==================================================');
  logger.info('     Starting ArcadiaX Bot & Backend Service      ');
  logger.info('==================================================');

  // 1. Initialize SQLite Database
  try {
    getDb();
  } catch (err) {
    logger.error('Critical database initialization error. Aborting start.', err);
    process.exit(1);
  }

  // 2. Start Express API Server
  server = app.listen(config.port, () => {
    logger.success(`ArcadiaX REST API running on port ${config.port} [${config.env}]`);
    logger.info(`API Base URL: ${config.apiUrl}`);
    logger.info(`Dashboard URL: ${config.dashboardUrl}`);
    logger.info(`OAuth2 Redirect: ${config.discordRedirectUri}`);
  });

  server.on('error', err => {
    logger.error('API Server error:', err);
  });

  // 3. Connect Discord Bot Gateway
  try {
    await botInstance.start();
  } catch (err) {
    logger.error('Discord bot startup failed:', err);
  }
}

// Graceful Shutdown Handler
let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.warn(`Received ${signal}. Initiating graceful shutdown...`);

  // Stop accepting new HTTP requests
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed.');
    });
  }

  // Stop session pruning timer
  if (sessionStore) {
    sessionStore.stopCleanup();
  }

  // Disconnect Discord bot
  try {
    await botInstance.stop();
  } catch (err) {
    logger.error('Error stopping Discord bot:', err);
  }

  // Close SQLite connection cleanly
  try {
    dbManager.close();
  } catch (err) {
    logger.error('Error closing SQLite DB:', err);
  }

  logger.success('ArcadiaX shutdown complete. Goodbye.');
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection at:', promise);
  logger.error('Reason:', reason);
});

process.on('uncaughtException', err => {
  logger.error('Uncaught Exception thrown:', err);
});

// Run application
bootstrap();
