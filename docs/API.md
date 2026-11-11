# ArcadiaX REST API Reference Manual

Welcome to the ArcadiaX Backend API documentation. This document details all available HTTP routes, authentication mechanisms, data structures, and status codes.

---

## 1. Global API Conventions

### Base URL
- **Local Development**: `http://localhost:5000`
- **Production**: Configured via `API_URL` environment variable (e.g. `https://api.yourdomain.com`)

### Standard JSON Response Format

All responses from ArcadiaX follow a strict, predictable JSON format:

#### Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully."
}
```

#### Error Response (`400`, `401`, `403`, `404`, `429`, `500`)
```json
{
  "success": false,
  "error": "Descriptive human-readable error message.",
  "code": "ERROR_CODE_IDENTIFIER",
  "details": null
}
```

---

## 2. Authentication & Authorization

ArcadiaX utilizes **Discord OAuth2 session-based authentication**. Only the configured Server Owner (`DISCORD_OWNER_ID`), listed Administrators (`ADMIN_USER_IDS`), and members with Discord `Administrator` permissions can access protected API endpoints.

### Authentication Endpoints

#### `GET /api/auth/discord`
Redirects the client's browser to Discord's OAuth2 authorization page with `identify` and `guilds` scopes.

#### `GET /api/auth/callback`
Handles OAuth2 token exchange with Discord, checks administrator permissions, sets the `arcadiax.sid` HTTP-only session cookie, and redirects to `${DASHBOARD_URL}/dashboard?auth=success`.

#### `GET /api/auth/me`
Retrieves the logged-in administrator's profile and target guild metadata.
- **Headers**: Cookie `arcadiax.sid` (or `x-dev-admin: true` during local frontend development).
- **Response**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "123456789012345678",
      "username": "ServerOwner",
      "discriminator": "0",
      "avatar": "abcdef123456",
      "avatarUrl": "https://cdn.discordapp.com/avatars/123456789012345678/abcdef123456.png",
      "isOwner": true,
      "isAdmin": true
    },
    "guild": {
      "id": "987654321098765432",
      "name": "ArcadiaX Community",
      "icon": "https://cdn.discordapp.com/icons/987654321098765432/icon.png",
      "memberCount": 1420
    }
  },
  "message": "User profile retrieved successfully."
}
```

#### `POST /api/auth/logout`
Destroys the session and clears the cookie.
- **Response**:
```json
{
  "success": true,
  "data": {},
  "message": "Logged out successfully."
}
```

---

## 3. Overview & Status Endpoints

#### `GET /api/dashboard/overview`
Provides high-level metric summaries for dashboard overview cards and analytics charts.
- **Response**:
```json
{
  "success": true,
  "data": {
    "guild": {
      "id": "987654321098765432",
      "name": "ArcadiaX Community",
      "icon": "https://cdn.discordapp.com/icons/...",
      "memberCount": 1420,
      "rolesCount": 24,
      "channelsCount": 38
    },
    "stats": {
      "tickets": { "total": 142, "open": 5, "claimed": 2, "closed": 135 },
      "backups": { "total": 12 },
      "security": { "totalIncidents": 8, "antinuke": 5, "antibetray": 3, "mitigated": 8 }
    },
    "recentIncidents": [
      {
        "id": 1,
        "module": "antinuke",
        "action_type": "Mass Channel Deletion",
        "user_id": "456789012345678901",
        "user_tag": "RogueStaff#1234",
        "severity": "critical",
        "mitigated": 1,
        "created_at": "2026-11-10 14:00:00",
        "details": { "triggeredCount": 4, "appliedAction": "strip_roles" }
      }
    ]
  },
  "message": "Dashboard overview data loaded."
}
```

#### `GET /api/dashboard/status`
Returns live bot runtime diagnostics, Discord gateway latency, and memory metrics.
- **Response**:
```json
{
  "success": true,
  "data": {
    "bot": {
      "online": true,
      "tag": "ArcadiaX#1337",
      "id": "111222333444555666",
      "ping": 24,
      "guildId": "987654321098765432"
    },
    "system": {
      "uptimeSeconds": 14280,
      "uptimeFormatted": "3h 58m 0s",
      "memoryUsageMb": { "heapUsed": "48.21", "heapTotal": "72.50", "rss": "95.12" },
      "nodeVersion": "v24.22.2",
      "platform": "win32",
      "environment": "production"
    },
    "database": {
      "type": "SQLite (better-sqlite3)",
      "mode": "WAL",
      "status": "Connected & Healthy"
    }
  },
  "message": "System status retrieved."
}
```

---

## 4. Antinuke Endpoints

#### `GET /api/antinuke`
Returns current antinuke thresholds and trusted users.
- **Response**:
```json
{
  "success": true,
  "data": {
    "config": {
      "guild_id": "987654321098765432",
      "enabled": 1,
      "mass_channel_delete_threshold": 3,
      "mass_channel_delete_window": 10,
      "mass_channel_create_threshold": 3,
      "mass_channel_create_window": 10,
      "mass_role_delete_threshold": 3,
      "mass_role_delete_window": 10,
      "mass_role_create_threshold": 3,
      "mass_role_create_window": 10,
      "mass_ban_threshold": 3,
      "mass_ban_window": 10,
      "mass_kick_threshold": 3,
      "mass_kick_window": 10,
      "webhook_creation_protection": 1,
      "dangerous_perm_protection": 1,
      "response_action": "strip_roles",
      "quarantine_role_id": "999888777666555444",
      "alert_channel_id": "111222333444555666",
      "emergency_lockdown_enabled": 0,
      "updated_at": "2026-11-10 14:00:00"
    },
    "trustedUsers": [
      {
        "id": 1,
        "user_id": "123456789012345678",
        "user_tag": "CoOwner#0001",
        "type": "antinuke",
        "added_by": "ServerOwner",
        "notes": "Co-owner"
      }
    ]
  },
  "message": "Antinuke configuration retrieved."
}
```

#### `PUT /api/antinuke`
Updates antinuke configuration settings.
- **Request Body**:
```json
{
  "enabled": 1,
  "mass_channel_delete_threshold": 4,
  "mass_channel_delete_window": 15,
  "response_action": "strip_roles",
  "alert_channel_id": "111222333444555666"
}
```

#### `GET /api/antinuke/logs?limit=50&offset=0`
Retrieves paginated antinuke security event logs.

#### `POST /api/antinuke/lockdown`
Toggles emergency lockdown across all guild text channels.
- **Request Body**:
```json
{
  "enable": true
}
```

#### `POST /api/antinuke/trusted`
Adds a user to the antinuke bypass whitelist.
- **Request Body**:
```json
{
  "userId": "123456789012345678",
  "userTag": "TrustedAdmin",
  "notes": "Head Moderator"
}
```

#### `DELETE /api/antinuke/trusted/:id`
Removes a user from the whitelist by database entry ID.

---

## 5. Antibetray Endpoints

#### `GET /api/antibetray`
Returns antibetray configuration.

#### `PUT /api/antibetray`
Updates antibetray monitoring parameters.
- **Request Body**:
```json
{
  "enabled": 1,
  "admin_perm_monitoring": 1,
  "role_hierarchy_monitoring": 1,
  "channel_perm_monitoring": 1,
  "webhook_monitoring": 1,
  "auto_rollback": 1,
  "alert_channel_id": "111222333444555666"
}
```

#### `GET /api/antibetray/logs?limit=50&offset=0`
Retrieves paginated antibetray security event logs.

---

## 6. Server Backup Endpoints

#### `GET /api/backups`
Returns list of all stored server backups.
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "bk_1731250000_abc12",
      "name": "Pre-Rebrand Snapshot",
      "created_by": "ServerOwner",
      "type": "manual",
      "size_bytes": 48200,
      "created_at": "2026-11-10 12:00:00"
    }
  ]
}
```

#### `POST /api/backups`
Takes an immediate full snapshot of server roles, channels, categories, permissions, and server settings.
- **Request Body**:
```json
{
  "name": "Weekly Full Snapshot"
}
```

#### `GET /api/backups/:id`
Retrieves backup preview and structural breakdown.

#### `GET /api/backups/:id/export`
Exports raw JSON backup file as a download (`arcadiax-backup-:id.json`).

#### `POST /api/backups/:id/restore`
Restores server configuration from backup snapshot.
- **Request Body**:
```json
{
  "roles": true,
  "channels": true,
  "settings": false,
  "confirmation": true
}
```

#### `DELETE /api/backups/:id`
Deletes a backup snapshot.

---

## 7. Welcome Module Endpoints

#### `GET /api/welcome`
Retrieves welcome and goodbye messages and embed configurations.

#### `PUT /api/welcome`
Updates welcome and goodbye settings.
- **Request Body**:
```json
{
  "enabled": 1,
  "channel_id": "111222333444555666",
  "message_type": "embed",
  "embed_json": "{\"title\":\"Welcome to {server}!\",\"description\":\"Hello {user}, welcome! You are member #{memberCount}.\",\"color\":\"#5865F2\",\"thumbnailUrl\":\"{userAvatar}\"}",
  "dm_enabled": 0,
  "goodbye_enabled": 1,
  "goodbye_channel_id": "222333444555666777",
  "goodbye_content": "**{username}** has departed from {server}. Remaining: {memberCount}"
}
```

#### `POST /api/welcome/preview`
Renders message text or embed with sample variables replaced.
- **Request Body**:
```json
{
  "message_type": "text",
  "text_content": "Welcome {user} to {server}! We now have {memberCount} members!"
}
```

---

## 8. Autorole Endpoints

#### `GET /api/autorole`
Returns autorole configurations for humans and bots.

#### `PUT /api/autorole`
Updates autorole configurations.
- **Request Body**:
```json
{
  "human_enabled": 1,
  "human_role_id": "123456789012345678",
  "bot_enabled": 1,
  "bot_role_id": "876543210987654321"
}
```

---

## 9. Embed Module Endpoints

#### `POST /api/embeds/preview`
Validates embed fields and returns the rendered Discord embed object.
- **Request Body**:
```json
{
  "title": "ArcadiaX Rules & Guidelines",
  "description": "Please review our server guidelines below.",
  "color": "#5865F2",
  "author": { "name": "ArcadiaX Staff", "iconURL": "https://..." },
  "footer": { "text": "ArcadiaX Enterprise", "iconURL": "https://..." },
  "thumbnailUrl": "https://...",
  "imageUrl": "https://...",
  "timestamp": true,
  "fields": [
    { "name": "Rule 1", "value": "Be respectful.", "inline": false }
  ]
}
```

#### `POST /api/embeds/send`
Dispatches an embed to a target Discord channel.
- **Request Body**:
```json
{
  "channelId": "111222333444555666",
  "content": "Attention @here:",
  "embed": { ... }
}
```

---

## 10. Message Sender Endpoints

#### `POST /api/messages/send`
Sends normal text messages or rich embeds with controlled mentions.
- **Request Body**:
```json
{
  "channelId": "111222333444555666",
  "content": "Official announcement message.",
  "allowEveryone": false,
  "allowRoles": true,
  "allowUsers": true
}
```

#### `GET /api/messages/history?limit=50&offset=0`
Retrieves paginated logs of messages sent through the dashboard.

---

## 11. Ticket System Endpoints

#### `GET /api/tickets?status=open&limit=50&offset=0`
Lists tickets with optional status filtering (`open`, `claimed`, `closed`).

#### `GET /api/tickets/config`
Retrieves ticket system settings and category dropdown options.

#### `PUT /api/tickets/config`
Updates ticket system settings and options.
- **Request Body**:
```json
{
  "enabled": 1,
  "category_id": "111222333444555666",
  "log_channel_id": "222333444555666777",
  "support_role_ids": ["333444555666777888"],
  "panel_title": "ArcadiaX Support Portal",
  "panel_description": "Select a category below to open a private ticket.",
  "options": [
    { "id": "opt_optimization", "label": "Optimization", "description": "System tuning", "emoji": "⚡" },
    { "id": "opt_clean_sens", "label": "Clean / Sensitivity", "description": "Sens calibration", "emoji": "🎯" },
    { "id": "opt_schedule", "label": "Schedule Appointment", "description": "1-on-1 session", "emoji": "📅" },
    { "id": "opt_tech_support", "label": "Technical Support", "description": "Hardware/software help", "emoji": "🛠️" },
    { "id": "opt_other", "label": "Other Inquiry", "description": "General questions", "emoji": "📩" }
  ]
}
```

#### `POST /api/tickets/panel`
Sends or updates the interactive ticket creation panel in the configured channel.

#### `GET /api/tickets/:id`
Retrieves ticket record, full conversation messages, and generated transcript.

#### `POST /api/tickets/:id/close`
Closes a ticket channel and updates status.
- **Request Body**:
```json
{
  "reason": "Resolved by support staff"
}
```

---

## 12. Music Playback Endpoints

#### `GET /api/music/status`
Returns live playback status, current song, queue, and volume.

#### `POST /api/music/control`
Controls music playback.
- **Request Body**:
```json
{
  "action": "volume",
  "value": 75
}
```
Supported `action` values:
- `play` (requires `query` string, optional `channelId`)
- `pause`
- `resume`
- `skip`
- `stop`
- `volume` (requires `value` integer 0-100)

---

## 13. Guild Metadata Endpoints (For UI Select Dropdowns)

#### `GET /api/guild/channels`
Returns categorized server channels: `{ categories, textChannels, voiceChannels }`.

#### `GET /api/guild/roles`
Returns server roles sorted by hierarchy with colors and permissions.

#### `GET /api/guild/members?q=searchterm&limit=50`
Searches server members for whitelisting or ticket staff assignments.

---

## 14. Activity & Security Logs Endpoints

#### `GET /api/logs?limit=50&offset=0`
Returns general dashboard administrative activity logs.

#### `GET /api/logs/:type?limit=50&offset=0`
Returns filtered logs for:
- `security`: Antinuke and Antibetray incident records.
- `messages`: Sent message history.
- `activity`: Dashboard staff activity logs.
