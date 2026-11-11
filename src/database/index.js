const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const logger = require('../utils/logger');
const { initializeDatabase } = require('./schema');

class DatabaseManager {
  constructor() {
    this.db = null;
  }

  connect() {
    if (this.db) return this.db;

    const dbDir = path.dirname(config.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    try {
      this.db = new Database(config.databasePath, {
        verbose: config.env === 'development' ? null : null
      });

      // Performance and integrity PRAGMAs
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('foreign_keys = ON');

      logger.success(`SQLite database connected at ${config.databasePath} [WAL mode]`);
      
      // Initialize schemas & seeds
      initializeDatabase(this.db, config.discord.guildId);

      return this.db;
    } catch (err) {
      logger.error('Failed to initialize SQLite database:', err);
      throw err;
    }
  }

  getDb() {
    if (!this.db) {
      return this.connect();
    }
    return this.db;
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
        logger.info('SQLite database connection closed cleanly.');
      } catch (err) {
        logger.error('Error closing SQLite database:', err);
      }
      this.db = null;
    }
  }
}

const dbManager = new DatabaseManager();

module.exports = {
  dbManager,
  getDb: () => dbManager.getDb()
};
