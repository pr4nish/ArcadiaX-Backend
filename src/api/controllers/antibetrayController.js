const antibetrayModule = require('../../bot/modules/antibetray');
const config = require('../../config');

class AntibetrayController {
  getConfig(req, res) {
    const guildId = config.discord.guildId;
    const cfg = antibetrayModule.getConfig(guildId);
    return res.success(cfg, 'Antibetray configuration retrieved.');
  }

  updateConfig(req, res) {
    const guildId = config.discord.guildId;
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.error('Request body must be an object with configuration updates.');
    }

    try {
      const updated = antibetrayModule.updateConfig(guildId, updates);
      return res.success(updated, 'Antibetray configuration updated successfully.');
    } catch (err) {
      return res.error(`Failed to update antibetray config: ${err.message}`);
    }
  }

  getLogs(req, res) {
    const guildId = config.discord.guildId;
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = Math.max(0, parseInt(req.query.offset || '0', 10));

    const result = antibetrayModule.getSecurityLogs(guildId, limit, offset);
    return res.success(result, 'Antibetray logs retrieved.');
  }
}

module.exports = new AntibetrayController();
