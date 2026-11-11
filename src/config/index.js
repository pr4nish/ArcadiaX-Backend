require('dotenv').config();
const path = require('path');

const config = {
  // Node Environment
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '5000', 10),

  // URLs
  apiUrl: (process.env.API_URL || 'http://localhost:5000').replace(/\/+$/, ''),
  dashboardUrl: (process.env.DASHBOARD_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  discordRedirectUri: process.env.DISCORD_REDIRECT_URI || `${(process.env.API_URL || 'http://localhost:5000').replace(/\/+$/, '')}/api/auth/callback`,

  // Discord Credentials
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    guildId: process.env.DISCORD_GUILD_ID || '',
    ownerId: process.env.DISCORD_OWNER_ID || '',
    adminUserIds: (process.env.ADMIN_USER_IDS || '')
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0)
  },

  // Security & Sessions
  sessionSecret: process.env.SESSION_SECRET || 'arcadiax_super_secure_session_secret_change_in_production_123',
  sessionMaxAge: 1000 * 60 * 60 * 24 * 7, // 7 days

  // Database
  databasePath: process.env.DATABASE_PATH 
    ? path.resolve(process.env.DATABASE_PATH)
    : path.join(__dirname, '..', '..', 'data', 'arcadiax.db')
};

// Validate critical config warnings
function validateConfig() {
  const missing = [];
  if (!config.discord.token) missing.push('DISCORD_TOKEN');
  if (!config.discord.clientId) missing.push('DISCORD_CLIENT_ID');
  if (!config.discord.guildId) missing.push('DISCORD_GUILD_ID');

  if (missing.length > 0) {
    console.warn(`[Config Warning] Missing environment variables: ${missing.join(', ')}. Bot will run in degraded/mock mode until populated in .env.`);
  }
}

validateConfig();

module.exports = config;
