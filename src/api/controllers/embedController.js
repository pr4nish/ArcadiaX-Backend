const embedService = require('../../bot/modules/embeds');
const { getClient } = require('../../bot/client');

class EmbedController {
  preview(req, res) {
    const embedPayload = req.body;

    if (!embedPayload || typeof embedPayload !== 'object') {
      return res.error('Embed configuration object is required.');
    }

    try {
      const builtEmbed = embedService.buildEmbed(embedPayload);
      return res.success({ embed: builtEmbed.toJSON() }, 'Embed preview built successfully.');
    } catch (err) {
      return res.error(`Failed to construct embed: ${err.message}`);
    }
  }

  async send(req, res) {
    const { channelId, embed, content, allowedMentions } = req.body;

    if (!channelId) {
      return res.error('channelId is required.');
    }

    if (!embed) {
      return res.error('embed data is required.');
    }

    const client = getClient();
    try {
      const message = await embedService.sendEmbed(client, channelId, embed, content, allowedMentions);
      return res.success({
        messageId: message.id,
        channelId: message.channelId,
        timestamp: message.createdAt
      }, 'Embed sent successfully.');
    } catch (err) {
      return res.error(`Failed to send embed: ${err.message}`);
    }
  }
}

module.exports = new EmbedController();
