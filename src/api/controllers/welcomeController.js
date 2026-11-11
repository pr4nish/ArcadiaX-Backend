const welcomeModule = require('../../bot/modules/welcome');
const config = require('../../config');

class WelcomeController {
  getConfig(req, res) {
    const guildId = config.discord.guildId;
    const cfg = welcomeModule.getConfig(guildId);
    return res.success(cfg, 'Welcome configuration retrieved.');
  }

  updateConfig(req, res) {
    const guildId = config.discord.guildId;
    const updates = req.body;

    if (!updates || typeof updates !== 'object') {
      return res.error('Request body must be an object with configuration updates.');
    }

    try {
      const updated = welcomeModule.updateConfig(guildId, updates);
      return res.success(updated, 'Welcome configuration updated successfully.');
    } catch (err) {
      return res.error(`Failed to update welcome config: ${err.message}`);
    }
  }

  preview(req, res) {
    const sampleData = req.body;
    const type = req.query.type || 'welcome';

    try {
      const previewResult = welcomeModule.preview(sampleData, type);
      return res.success(previewResult, 'Preview generated successfully.');
    } catch (err) {
      return res.error(`Failed to generate preview: ${err.message}`);
    }
  }
}

module.exports = new WelcomeController();
