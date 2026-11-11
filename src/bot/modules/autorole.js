const { PermissionFlagsBits } = require('discord.js');
const { getDb } = require('../../database');
const logger = require('../../utils/logger');

class AutoRoleModule {
  getConfig(guildId) {
    const db = getDb();
    let config = db.prepare('SELECT * FROM autorole_config WHERE guild_id = ?').get(guildId);
    if (!config) {
      db.prepare('INSERT INTO autorole_config (guild_id) VALUES (?)').run(guildId);
      config = db.prepare('SELECT * FROM autorole_config WHERE guild_id = ?').get(guildId);
    }
    return config;
  }

  updateConfig(guildId, updates) {
    const db = getDb();
    const fields = [];
    const values = [];

    const allowed = ['human_enabled', 'human_role_id', 'bot_enabled', 'bot_role_id'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }

    if (fields.length === 0) return this.getConfig(guildId);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(guildId);

    db.prepare(`UPDATE autorole_config SET ${fields.join(', ')} WHERE guild_id = ?`).run(...values);
    return this.getConfig(guildId);
  }

  async handleMemberAdd(member) {
    try {
      const config = this.getConfig(member.guild.id);
      const isBot = member.user.bot;

      const targetRoleId = isBot ? (config.bot_enabled ? config.bot_role_id : null) : (config.human_enabled ? config.human_role_id : null);
      if (!targetRoleId) return;

      const role = member.guild.roles.cache.get(targetRoleId);
      if (!role) {
        logger.warn(`[AutoRole] Target role ID ${targetRoleId} not found in guild ${member.guild.id}.`);
        return;
      }

      // Check bot permissions
      const botMember = member.guild.members.me;
      if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
        logger.warn(`[AutoRole] Bot lacks MANAGE_ROLES permission in guild ${member.guild.id}.`);
        return;
      }

      // Role hierarchy check: bot's highest role must be above the role to assign
      if (botMember.roles.highest.position <= role.position) {
        logger.warn(`[AutoRole] Bot highest role position (${botMember.roles.highest.position}) is lower than or equal to target role position (${role.position}). Cannot assign role.`);
        return;
      }

      await member.roles.add(role, `ArcadiaX AutoRole: ${isBot ? 'Bot' : 'Human'} Member Joined`);
      logger.info(`[AutoRole] Assigned role "${role.name}" to member ${member.user.tag} (${member.id})`);
    } catch (err) {
      logger.error('[AutoRole] Error assigning auto-role:', err);
    }
  }
}

module.exports = new AutoRoleModule();
