const config = require('../../config');
const logger = require('../../utils/logger');
const { getClient } = require('../../bot/client');

class AuthController {
  discordLogin(req, res) {
    if (!config.discord.clientId || !config.discord.clientSecret) {
      return res.error('Discord OAuth2 credentials not configured on the server.', 500, 'OAUTH_CONFIG_ERROR');
    }

    const redirectUri = encodeURIComponent(config.discordRedirectUri);
    const scope = encodeURIComponent('identify guilds');
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&prompt=consent`;

    return res.redirect(discordAuthUrl);
  }

  async discordCallback(req, res) {
    const code = req.query.code;
    const error = req.query.error;

    if (error || !code) {
      logger.warn(`[OAuth2 Callback Error]: ${error || 'No authorization code returned'}`);
      return res.redirect(`${config.dashboardUrl}?auth_error=${encodeURIComponent(error || 'missing_code')}`);
    }

    try {
      // 1. Exchange code for access token using standard Discord API
      const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: config.discord.clientId,
          client_secret: config.discord.clientSecret,
          grant_type: 'authorization_code',
          code: code.toString(),
          redirect_uri: config.discordRedirectUri
        })
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        logger.error('Failed to exchange OAuth2 code for token:', errorBody);
        return res.redirect(`${config.dashboardUrl}?auth_error=token_exchange_failed`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // 2. Fetch User Profile
      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!userResponse.ok) {
        return res.redirect(`${config.dashboardUrl}?auth_error=fetch_user_failed`);
      }

      const userData = await userResponse.json();

      // 3. Authorization Verification: Server Owner, ADMIN_USER_IDS, or Guild Admin
      const isOwner = userData.id === config.discord.ownerId;
      const isAdminListed = config.discord.adminUserIds.includes(userData.id);

      let isGuildAdmin = false;
      const client = getClient();
      const guild = client.guilds.cache.get(config.discord.guildId);

      if (guild) {
        try {
          const member = await guild.members.fetch(userData.id).catch(() => null);
          if (member) {
            isGuildAdmin = member.permissions.has('Administrator');
          }
        } catch {
          // Non-blocking fetch
        }
      }

      const authorized = isOwner || isAdminListed || isGuildAdmin;

      if (!authorized) {
        logger.warn(`[OAuth2 Access Denied] User ${userData.username} (${userData.id}) is not an authorized administrator.`);
        return res.redirect(`${config.dashboardUrl}?auth_error=unauthorized_user`);
      }

      // 4. Save Session
      const avatarUrl = userData.avatar 
        ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` 
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(userData.discriminator || '0', 10) % 5}.png`;

      req.session.user = {
        id: userData.id,
        username: userData.username,
        discriminator: userData.discriminator,
        global_name: userData.global_name,
        avatar: userData.avatar,
        avatarUrl,
        isOwner,
        isAdmin: isAdminListed || isOwner,
        isGuildAdmin
      };

      req.session.save(err => {
        if (err) {
          logger.error('Failed to save session during OAuth2 login:', err);
          return res.redirect(`${config.dashboardUrl}?auth_error=session_error`);
        }
        logger.success(`[OAuth2 Success] User ${userData.username} (${userData.id}) logged into dashboard.`);
        return res.redirect(`${config.dashboardUrl}/dashboard?auth=success`);
      });
    } catch (err) {
      logger.error('OAuth2 callback exception:', err);
      return res.redirect(`${config.dashboardUrl}?auth_error=server_error`);
    }
  }

  getMe(req, res) {
    if (!req.session || !req.session.user) {
      return res.error('Not authenticated', 401, 'UNAUTHORIZED');
    }

    const client = getClient();
    const guild = client.guilds.cache.get(config.discord.guildId);

    const guildInfo = guild ? {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ dynamic: true }),
      memberCount: guild.memberCount
    } : {
      id: config.discord.guildId,
      name: 'ArcadiaX Server',
      icon: null,
      memberCount: 0
    };

    return res.success({
      user: req.session.user,
      guild: guildInfo
    }, 'User profile retrieved successfully.');
  }

  logout(req, res) {
    if (req.session) {
      req.session.destroy(err => {
        if (err) {
          return res.error('Failed to destroy session', 500, 'LOGOUT_ERROR');
        }
        res.clearCookie('connect.sid');
        return res.success({}, 'Logged out successfully.');
      });
    } else {
      return res.success({}, 'Already logged out.');
    }
  }
}

module.exports = new AuthController();
