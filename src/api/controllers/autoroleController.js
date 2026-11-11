const autoroleModule = require('../../bot/modules/autorole');
const config = require('../../config');

class AutoRoleController {
  getConfig(req, res) {
    const guildId = config.discord.guildId;
    const cfg = autoroleModule.getConfig(guildId);
    return res.success(cfg, 'Auto-role configuration retrieved.');
  }

  updateConfig(req, res) {
    const guildId = config.discord.guildId;
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.error('Request body must be an object with configuration updates.');
    }

    try {
      const updated = autoroleModule.updateConfig(guildId, updates);
      return res.success(updated, 'Auto-role configuration updated successfully.');
    } catch (err) {
      return res.error(`Failed to update autorole config: ${err.message}`);
    }
  }
}

module.exports = new AutoRoleController();
