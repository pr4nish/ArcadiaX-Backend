const config = require('../../config');
const logger = require('../../utils/logger');

function requireAuth(req, res, next) {
  // Support developer testing header in development mode
  if (config.env === 'development' && (req.headers['x-dev-admin'] === 'true' || process.env.DEV_AUTH_BYPASS === 'true')) {
    if (!req.session.user) {
      req.session.user = {
        id: config.discord.ownerId || '999999999999999999',
        username: 'ArcadiaX_Developer',
        discriminator: '0',
        avatar: null,
        avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
        isOwner: true,
        isAdmin: true
      };
    }
    return next();
  }

  if (!req.session || !req.session.user) {
    return res.error('Authentication required. Please log in via Discord OAuth2.', 401, 'UNAUTHORIZED');
  }

  const userId = req.session.user.id;
  const isOwner = userId === config.discord.ownerId;
  const isAdmin = config.discord.adminUserIds.includes(userId);
  const isGuildAdmin = req.session.user.isGuildAdmin === true;

  if (!isOwner && !isAdmin && !isGuildAdmin) {
    logger.warn(`[Auth Warning] Unauthorized dashboard access attempt by user ${userId} (${req.session.user.username})`);
    return res.error('Access denied. Only the server owner and designated administrators can access this dashboard.', 403, 'FORBIDDEN');
  }

  next();
}

module.exports = {
  requireAuth
};
