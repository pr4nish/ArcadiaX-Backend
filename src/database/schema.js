const logger = require('../utils/logger');

const SCHEMA_SQL = `
-- Server Configuration
CREATE TABLE IF NOT EXISTS server_config (
  guild_id TEXT PRIMARY KEY,
  prefix TEXT DEFAULT '!',
  log_channel_id TEXT,
  security_alert_channel_id TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Antinuke Configuration
CREATE TABLE IF NOT EXISTS antinuke_config (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  mass_channel_delete_threshold INTEGER DEFAULT 3,
  mass_channel_delete_window INTEGER DEFAULT 10,
  mass_channel_create_threshold INTEGER DEFAULT 3,
  mass_channel_create_window INTEGER DEFAULT 10,
  mass_role_delete_threshold INTEGER DEFAULT 3,
  mass_role_delete_window INTEGER DEFAULT 10,
  mass_role_create_threshold INTEGER DEFAULT 3,
  mass_role_create_window INTEGER DEFAULT 10,
  mass_ban_threshold INTEGER DEFAULT 3,
  mass_ban_window INTEGER DEFAULT 10,
  mass_kick_threshold INTEGER DEFAULT 3,
  mass_kick_window INTEGER DEFAULT 10,
  webhook_creation_protection INTEGER DEFAULT 1,
  dangerous_perm_protection INTEGER DEFAULT 1,
  response_action TEXT DEFAULT 'strip_roles', -- 'strip_roles', 'quarantine_role', 'alert_only'
  quarantine_role_id TEXT,
  alert_channel_id TEXT,
  emergency_lockdown_enabled INTEGER DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Antibetray Configuration
CREATE TABLE IF NOT EXISTS antibetray_config (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  admin_perm_monitoring INTEGER DEFAULT 1,
  role_hierarchy_monitoring INTEGER DEFAULT 1,
  channel_perm_monitoring INTEGER DEFAULT 1,
  webhook_monitoring INTEGER DEFAULT 1,
  auto_rollback INTEGER DEFAULT 0,
  alert_channel_id TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Trusted Users / Roles
CREATE TABLE IF NOT EXISTS trusted_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_tag TEXT,
  type TEXT DEFAULT 'both', -- 'antinuke', 'antibetray', 'both'
  added_by TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(guild_id, user_id, type)
);

-- Welcome & Goodbye Configuration
CREATE TABLE IF NOT EXISTS welcome_config (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  channel_id TEXT,
  message_type TEXT DEFAULT 'embed', -- 'text' or 'embed'
  text_content TEXT DEFAULT 'Welcome to {server}, {user}! We now have {memberCount} members.',
  embed_json TEXT DEFAULT '{"title":"Welcome to {server}!","description":"Hello {user}, welcome to the server!\\n\\nYou are member #{memberCount}.\\nPlease make sure to read the rules!","color":"#5865F2","thumbnailUrl":"{userAvatar}","footerText":"Enjoy your stay!"}',
  dm_enabled INTEGER DEFAULT 0,
  dm_content TEXT DEFAULT 'Welcome to {server}! Thank you for joining.',
  goodbye_enabled INTEGER DEFAULT 1,
  goodbye_channel_id TEXT,
  goodbye_content TEXT DEFAULT 'Goodbye **{username}**, they left the server. Member count: {memberCount}',
  goodbye_embed_json TEXT DEFAULT '{"title":"Member Left","description":"**{username}** has left the server.\\nRemaining members: {memberCount}","color":"#ED4245"}',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Autorole Configuration
CREATE TABLE IF NOT EXISTS autorole_config (
  guild_id TEXT PRIMARY KEY,
  human_enabled INTEGER DEFAULT 0,
  human_role_id TEXT,
  bot_enabled INTEGER DEFAULT 0,
  bot_role_id TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Configuration
CREATE TABLE IF NOT EXISTS ticket_config (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER DEFAULT 1,
  category_id TEXT,
  log_channel_id TEXT,
  support_role_ids TEXT DEFAULT '[]', -- JSON array of role IDs
  panel_channel_id TEXT,
  panel_message_id TEXT,
  panel_title TEXT DEFAULT 'ArcadiaX Support Portal',
  panel_description TEXT DEFAULT 'Select a category below to create a private support ticket with our team.',
  panel_color TEXT DEFAULT '#5865F2',
  options_json TEXT DEFAULT '[{"id":"opt_optimization","label":"Optimization","description":"System & latency tuning assistance","emoji":"⚡"},{"id":"opt_clean_sens","label":"Clean / Sensitivity","description":"Clean install or mouse sensitivity calibration","emoji":"🎯"},{"id":"opt_schedule","label":"Schedule Appointment","description":"Book a 1-on-1 session with a specialist","emoji":"📅"},{"id":"opt_tech_support","label":"Technical Support","description":"Hardware, software or discord support","emoji":"🛠️"},{"id":"opt_other","label":"Other Inquiry","description":"General questions or partnership","emoji":"📩"}]',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tickets Record
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number INTEGER NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  creator_id TEXT NOT NULL,
  creator_tag TEXT,
  option_value TEXT NOT NULL,
  status TEXT DEFAULT 'open', -- 'open', 'claimed', 'closed'
  claimed_by TEXT,
  claimed_tag TEXT,
  closed_by TEXT,
  closed_tag TEXT,
  closed_at DATETIME,
  close_reason TEXT,
  transcript_text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ticket Messages (for rich transcripts)
CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL,
  channel_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_tag TEXT,
  author_avatar TEXT,
  content TEXT,
  attachments_json TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

-- Backups Record
CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  type TEXT DEFAULT 'manual', -- 'manual' or 'scheduled'
  data_json TEXT NOT NULL,
  size_bytes INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Security Logs (Antinuke & Antibetray events)
CREATE TABLE IF NOT EXISTS security_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  module TEXT NOT NULL, -- 'antinuke' or 'antibetray'
  action_type TEXT NOT NULL,
  user_id TEXT,
  user_tag TEXT,
  details_json TEXT,
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  mitigated INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sent Message Logs
CREATE TABLE IF NOT EXISTS message_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_tag TEXT,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  message_id TEXT,
  content TEXT,
  embed_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard Sessions (SQLite session store)
CREATE TABLE IF NOT EXISTS dashboard_sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expire INTEGER NOT NULL
);

-- Activity Logs (Audit trail of dashboard & admin actions)
CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT,
  user_tag TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_tickets_guild ON tickets(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_channel ON tickets(channel_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_security_logs_guild ON security_logs(guild_id, module, created_at);
CREATE INDEX IF NOT EXISTS idx_backups_guild ON backups(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_guild ON activity_logs(guild_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expire ON dashboard_sessions(expire);
`;

function initializeDatabase(db, targetGuildId) {
  logger.info('Initializing SQLite database schema...');
  db.exec(SCHEMA_SQL);

  // If target guild ID is provided, seed initial default records if not present
  if (targetGuildId) {
    const seedGuild = db.transaction(() => {
      // server_config
      const hasServerConfig = db.prepare('SELECT guild_id FROM server_config WHERE guild_id = ?').get(targetGuildId);
      if (!hasServerConfig) {
        db.prepare('INSERT INTO server_config (guild_id) VALUES (?)').run(targetGuildId);
      }

      // antinuke_config
      const hasAntinukeConfig = db.prepare('SELECT guild_id FROM antinuke_config WHERE guild_id = ?').get(targetGuildId);
      if (!hasAntinukeConfig) {
        db.prepare('INSERT INTO antinuke_config (guild_id) VALUES (?)').run(targetGuildId);
      }

      // antibetray_config
      const hasAntibetrayConfig = db.prepare('SELECT guild_id FROM antibetray_config WHERE guild_id = ?').get(targetGuildId);
      if (!hasAntibetrayConfig) {
        db.prepare('INSERT INTO antibetray_config (guild_id) VALUES (?)').run(targetGuildId);
      }

      // welcome_config
      const hasWelcomeConfig = db.prepare('SELECT guild_id FROM welcome_config WHERE guild_id = ?').get(targetGuildId);
      if (!hasWelcomeConfig) {
        db.prepare('INSERT INTO welcome_config (guild_id) VALUES (?)').run(targetGuildId);
      }

      // autorole_config
      const hasAutoroleConfig = db.prepare('SELECT guild_id FROM autorole_config WHERE guild_id = ?').get(targetGuildId);
      if (!hasAutoroleConfig) {
        db.prepare('INSERT INTO autorole_config (guild_id) VALUES (?)').run(targetGuildId);
      }

      // ticket_config
      const hasTicketConfig = db.prepare('SELECT guild_id FROM ticket_config WHERE guild_id = ?').get(targetGuildId);
      if (!hasTicketConfig) {
        db.prepare('INSERT INTO ticket_config (guild_id) VALUES (?)').run(targetGuildId);
      }
    });

    seedGuild();
    logger.success(`Database schema verified and default seed ready for Guild: ${targetGuildId}`);
  }
}

module.exports = {
  SCHEMA_SQL,
  initializeDatabase
};
