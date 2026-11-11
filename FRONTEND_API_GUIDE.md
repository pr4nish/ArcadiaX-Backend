# ArcadiaX Frontend Integration Guide for React & Claude

> **Target Audience**: AI Engineer (Claude) or React Developer building the client dashboard for **ArcadiaX**.  
> **Backend Status**: Fully implemented, tested (16/16 tests passing), running Express.js + SQLite (`better-sqlite3` in WAL mode) + Discord.js v14.

---

## 1. Quick Start & Connection Protocol

### 1.1 Base URL & Environment Configuration
In your React application (Vite, Next.js, or Create React App), define your environment variable:

```env
# .env.local (React Frontend)
VITE_API_URL=http://localhost:5000
# or for Next.js:
# NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 1.2 Authentication & Cookie Credentials
The backend uses **Discord OAuth2** and stores sessions in SQLite via an HTTP-only cookie (`arcadiax.sid`).
**Crucial Requirement**: Every HTTP request made by your frontend MUST include credentials!

- **Axios Configuration**:
  ```ts
  import axios from 'axios';

  export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
    withCredentials: true, // MANDATORY for session cookie
    headers: {
      'Content-Type': 'application/json'
    }
  });
  ```

- **Fetch API Configuration**:
  ```ts
  fetch(`${API_URL}/api/...`, {
    credentials: 'include', // MANDATORY
    headers: { 'Content-Type': 'application/json' }
  });
  ```

### 1.3 Local Development Testing Bypass Header (`x-dev-admin`)
When developing the React dashboard locally, you **do not** need to authenticate through Discord OAuth2 every time!
Simply include the header:
```http
x-dev-admin: true
```
in your Axios or Fetch requests. The backend will automatically inject a full administrator session:
```json
{
  "id": "999999999999999999",
  "username": "ArcadiaX_Developer",
  "discriminator": "0",
  "avatarUrl": "https://cdn.discordapp.com/embed/avatars/0.png",
  "isOwner": true,
  "isAdmin": true
}
```

---

## 2. Standard Response Envelope

Every single API endpoint returns this exact envelope:

### Success Pattern (`200 OK`, `201 Created`):
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully."
}
```

### Error Pattern (`400`, `401`, `403`, `404`, `429`, `500`):
```json
{
  "success": false,
  "error": "Error description string",
  "code": "ERROR_CODE",
  "details": null
}
```

**Axios Interceptor for Clean React Code**:
```ts
api.interceptors.response.use(
  (response) => response.data, // Unwraps outer Axios envelope so you get { success, data, message }
  (error) => {
    const errorData = error.response?.data || {
      success: false,
      error: error.message || 'Network error',
      code: 'NETWORK_ERROR'
    };
    return Promise.reject(errorData);
  }
);
```

---

## 3. TypeScript Interfaces for React

Paste these into your frontend `types/api.ts`:

```ts
// Standard API Envelope
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
  details?: any;
}

// User & Auth
export interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar: string | null;
  avatarUrl: string;
  isOwner: boolean;
  isAdmin: boolean;
  isGuildAdmin?: boolean;
}

export interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  memberCount: number;
}

export interface AuthMeResponse {
  user: UserProfile;
  guild: GuildInfo;
}

// Overview & Diagnostics
export interface DashboardOverview {
  guild: {
    id: string;
    name: string;
    icon: string | null;
    memberCount: number;
    rolesCount: number;
    channelsCount: number;
  };
  stats: {
    tickets: { total: number; open: number; claimed: number; closed: number };
    backups: { total: number };
    security: { totalIncidents: number; antinuke: number; antibetray: number; mitigated: number };
  };
  recentIncidents: SecurityLog[];
}

export interface SystemStatus {
  bot: {
    online: boolean;
    tag: string;
    id: string;
    ping: number;
    guildId: string;
  };
  system: {
    uptimeSeconds: number;
    uptimeFormatted: string;
    memoryUsageMb: { heapUsed: string; heapTotal: string; rss: string };
    nodeVersion: string;
    platform: string;
    environment: string;
  };
  database: {
    type: string;
    mode: string;
    status: string;
  };
}

// Antinuke
export interface AntinukeConfig {
  guild_id: string;
  enabled: number; // 1 or 0
  mass_channel_delete_threshold: number;
  mass_channel_delete_window: number;
  mass_channel_create_threshold: number;
  mass_channel_create_window: number;
  mass_role_delete_threshold: number;
  mass_role_delete_window: number;
  mass_role_create_threshold: number;
  mass_role_create_window: number;
  mass_ban_threshold: number;
  mass_ban_window: number;
  mass_kick_threshold: number;
  mass_kick_window: number;
  webhook_creation_protection: number;
  dangerous_perm_protection: number;
  response_action: 'strip_roles' | 'quarantine_role' | 'alert_only';
  quarantine_role_id: string | null;
  alert_channel_id: string | null;
  emergency_lockdown_enabled: number;
  updated_at: string;
}

export interface TrustedUser {
  id: number;
  guild_id: string;
  user_id: string;
  user_tag: string | null;
  type: 'antinuke' | 'antibetray' | 'both';
  added_by: string;
  notes: string | null;
  created_at: string;
}

// Antibetray
export interface AntibetrayConfig {
  guild_id: string;
  enabled: number;
  admin_perm_monitoring: number;
  role_hierarchy_monitoring: number;
  channel_perm_monitoring: number;
  webhook_monitoring: number;
  auto_rollback: number;
  alert_channel_id: string | null;
  updated_at: string;
}

// Backups
export interface BackupItem {
  id: string;
  guild_id: string;
  name: string;
  created_by: string;
  type: 'manual' | 'scheduled';
  size_bytes: number;
  created_at: string;
}

export interface BackupPreview {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
  sizeKb: string;
  serverName: string;
  roles: Array<{ name: string; color: string; managed: boolean }>;
  categories: Array<{ name: string }>;
  channels: Array<{ name: string; type: number; parent: string | null }>;
  emojisCount: number;
  stickersCount: number;
}

// Welcome & Autorole
export interface WelcomeConfig {
  guild_id: string;
  enabled: number;
  channel_id: string | null;
  message_type: 'text' | 'embed';
  text_content: string;
  embed_json: string;
  dm_enabled: number;
  dm_content: string;
  goodbye_enabled: number;
  goodbye_channel_id: string | null;
  goodbye_content: string;
  goodbye_embed_json: string;
  updated_at: string;
}

export interface AutoroleConfig {
  guild_id: string;
  human_enabled: number;
  human_role_id: string | null;
  bot_enabled: number;
  bot_role_id: string | null;
  updated_at: string;
}

// Tickets
export interface TicketOption {
  id: string;
  label: string;
  description: string;
  emoji: string;
}

export interface TicketConfig {
  guild_id: string;
  enabled: number;
  category_id: string | null;
  log_channel_id: string | null;
  support_role_ids: string[];
  panel_channel_id: string | null;
  panel_message_id: string | null;
  panel_title: string;
  panel_description: string;
  panel_color: string;
  options: TicketOption[];
  updated_at: string;
}

export interface Ticket {
  id: number;
  ticket_number: number;
  guild_id: string;
  channel_id: string;
  creator_id: string;
  creator_tag: string;
  option_value: string;
  status: 'open' | 'claimed' | 'closed';
  claimed_by: string | null;
  claimed_tag: string | null;
  closed_by: string | null;
  closed_tag: string | null;
  closed_at: string | null;
  close_reason: string | null;
  created_at: string;
  updated_at: string;
}

// Music
export interface Song {
  title: string;
  url: string;
  duration: string;
  thumbnail?: string | null;
  requestedBy: string;
  source: string;
}

export interface MusicStatus {
  active: boolean;
  playing: boolean;
  paused: boolean;
  currentSong: Song | null;
  queue: Song[];
  volume: number;
  voiceChannelId: string | null;
}

// Discord Guild Entities (for selectors)
export interface DiscordChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parentId?: string | null;
}

export interface GuildChannelsResponse {
  categories: DiscordChannel[];
  textChannels: DiscordChannel[];
  voiceChannels: DiscordChannel[];
}

export interface DiscordRole {
  id: string;
  name: string;
  color: string;
  position: number;
  managed: boolean;
  permissions: string;
}

export interface SecurityLog {
  id: number;
  guild_id: string;
  module: 'antinuke' | 'antibetray';
  action_type: string;
  user_id: string;
  user_tag: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigated: number;
  created_at: string;
}
```

---

## 4. Complete Page-by-Page Screen Architecture

Below is the exact integration blueprint for every screen in the React dashboard:

### Screen 1: Dashboard Overview (`/dashboard`)
- **API Call**: `GET /api/dashboard/overview` and `GET /api/dashboard/status`
- **UI Elements**:
  - **Server Header**: Server name, icon, member count badge, bot online indicator with gateway latency (e.g., `24ms`).
  - **4 Stat Cards**:
    1. Active Tickets (open vs claimed)
    2. Total Stored Backups
    3. Security Incidents Mitigated (Antinuke + Antibetray)
    4. Memory Usage & Uptime (`3h 58m`, `48 MB`)
  - **Recent Incidents Table**: Displaying the last 5 security incidents with severity badge (`critical`, `high`, `medium`), timestamp, and mitigation status.

### Screen 2: Antinuke Engine (`/dashboard/antinuke`)
- **API Calls**:
  - Fetch: `GET /api/antinuke`
  - Save: `PUT /api/antinuke`
  - Lockdown: `POST /api/antinuke/lockdown` `{ enable: true | false }`
  - Add Whitelist: `POST /api/antinuke/trusted` `{ userId, userTag, notes }`
  - Remove Whitelist: `DELETE /api/antinuke/trusted/:id`
- **UI Controls**:
  - **Master Enable Switch**: Toggles `enabled` (1 or 0).
  - **Threshold Sliders & Input Fields**:
    - Channel Deletion Limit (Threshold + Window Seconds)
    - Channel Creation Limit (Threshold + Window Seconds)
    - Role Deletion Limit (Threshold + Window Seconds)
    - Role Creation Limit (Threshold + Window Seconds)
    - Mass Ban Limit (Threshold + Window Seconds)
    - Mass Kick Limit (Threshold + Window Seconds)
  - **Mitigation Action Dropdown**: Select between `strip_roles`, `quarantine_role`, `alert_only`.
  - **Quarantine Role Selector**: Role picker populated from `GET /api/guild/roles`.
  - **Security Alert Channel Selector**: Channel picker from `GET /api/guild/channels`.
  - **Emergency Lockdown Button**: Prominent red toggle button to immediately lock down all server channels in an active attack.
  - **Trusted Users / Whitelist Table**: List of whitelisted admins with an "Add User" modal and "Remove" button.

### Screen 3: Antibetray Staff Monitor (`/dashboard/antibetray`)
- **API Calls**:
  - Fetch: `GET /api/antibetray`
  - Save: `PUT /api/antibetray`
  - Logs: `GET /api/antibetray/logs`
- **UI Controls**:
  - **Master Enable Switch**: Toggles `enabled`.
  - **Feature Toggles (Switches)**:
    - Administrator Permission Monitoring
    - Role Hierarchy Shift Monitoring
    - Channel Permission Overwrite Monitoring
    - Webhook Creation Monitoring
    - Safe Automatic Rollback (`auto_rollback`)
  - **Alert Channel Selector**: Channel picker from `GET /api/guild/channels`.
  - **Audit Logs Table**: Real-time staff violation logs with audit attribution.

### Screen 4: Server Backups (`/dashboard/backups`)
- **API Calls**:
  - Fetch Backups: `GET /api/backups`
  - Create Backup: `POST /api/backups` `{ name: "Snapshot Name" }`
  - View Preview: `GET /api/backups/:id`
  - Export/Download: `GET /api/backups/:id/export` (direct download link)
  - Restore: `POST /api/backups/:id/restore` `{ roles: boolean, channels: boolean, settings: boolean, confirmation: true }`
  - Delete: `DELETE /api/backups/:id`
- **UI Controls**:
  - **"Create Snapshot" Button**: Opens modal to enter backup name, displays spinning loader during generation.
  - **Backups Table**: Columns for Backup ID, Name, Created By, Date, Size (KB), Type (manual vs scheduled).
  - **Actions on each row**:
    - *Preview Modal*: Shows exact count of roles, channels, categories, emojis.
    - *Download Button*: Triggers direct JSON download.
    - *Restore Modal*: Allows checkboxes to select what to restore (Roles, Channels, Server Settings) + mandatory "I Confirm Restoration" checkbox before enabling the red "Restore Server" button.
    - *Delete Button*: Deletes the snapshot record.

### Screen 5: Welcome & Goodbye Portal (`/dashboard/welcome`)
- **API Calls**:
  - Fetch: `GET /api/welcome`
  - Save: `PUT /api/welcome`
  - Live Preview: `POST /api/welcome/preview`
- **UI Controls**:
  - **Welcome Toggle**: Enable/disable welcome messages.
  - **Welcome Channel Picker**: Channel dropdown from `GET /api/guild/channels`.
  - **Message Type Switcher**: Segmented button for `Text Message` vs `Rich Embed`.
  - **Variable Insertion Chips**: Clickable buttons for `{user}`, `{username}`, `{server}`, `{memberCount}`, `{userAvatar}`, `{serverIcon}` that insert the token into the active input.
  - **Live Preview Box**: Shows the rendered Discord message in real-time as the user types.
  - **DM Toggle**: Enable direct message welcome + textarea.
  - **Goodbye Section**: Enable/disable goodbye message, goodbye channel picker, goodbye text/embed editor.

### Screen 6: Auto Role System (`/dashboard/autorole`)
- **API Calls**:
  - Fetch: `GET /api/autorole`
  - Save: `PUT /api/autorole`
- **UI Controls**:
  - **Human Member Card**:
    - Switch: Enable/disable human auto-role.
    - Dropdown: Role picker populated from `GET /api/guild/roles`.
  - **Bot Member Card**:
    - Switch: Enable/disable bot auto-role.
    - Dropdown: Role picker for incoming Discord bot integrations.

### Screen 7: Embed Creator & Sender (`/dashboard/embeds`)
- **API Calls**:
  - Preview: `POST /api/embeds/preview`
  - Send: `POST /api/embeds/send` `{ channelId, embed, content }`
- **UI Controls**:
  - **Split View Layout**: Left side is the builder form; right side is the interactive Discord Dark Theme preview.
  - **Builder Inputs**:
    - Target Channel Picker
    - Message Content (optional text above embed)
    - Title & URL
    - Description (supports markdown)
    - Color Picker (HEX code)
    - Author (Name, Icon URL, URL)
    - Footer (Text, Icon URL)
    - Thumbnail URL & Image URL
    - Timestamp Toggle
    - Dynamic Fields Array: "Add Field" button with Name, Value, and "Inline" toggle.
  - **Send Button**: Sends embed to Discord with instant success toast.

### Screen 8: Message Dispatcher (`/dashboard/messages`)
- **API Calls**:
  - Send: `POST /api/messages/send`
  - History: `GET /api/messages/history`
- **UI Controls**:
  - Channel Picker
  - Textarea for message content
  - **Mention Safety Toggles**:
    - `@everyone / @here` (Disabled by default to prevent accidental server pings)
    - `@roles`
    - `@users`
  - **Sent Messages History Log**: Shows who sent what message, to which channel, and when.

### Screen 9: Ticket System Manager (`/dashboard/tickets`)
- **API Calls**:
  - Config: `GET /api/tickets/config` and `PUT /api/tickets/config`
  - Tickets List: `GET /api/tickets?status=open|claimed|closed`
  - Ticket Details: `GET /api/tickets/:id`
  - Close Ticket: `POST /api/tickets/:id/close` `{ reason }`
  - Deploy Panel: `POST /api/tickets/panel` `{ channelId }`
- **UI Controls**:
  - **Tabs**: `Open Tickets`, `Claimed Tickets`, `Closed Tickets`, `Settings & Panel`.
  - **Tickets Table**: Ticket #, Creator, Category (Optimization, Sensitivity, Tech Support, etc.), Claimed By, Created Date.
  - **Ticket Conversation Drawer**: Clicking a ticket shows all recorded messages and attachments + a button to download the formatted text transcript.
  - **Settings Tab**:
    - Ticket Category Picker (Discord Category Channel where private tickets spawn)
    - Log Channel Picker
    - Support Roles Multi-Select (Roles that can view and answer tickets)
    - "Deploy Ticket Panel to Discord" button.

### Screen 10: Music Player (`/dashboard/music`)
- **API Calls**:
  - Status: `GET /api/music/status` (Poll every 3-5 seconds or on user action)
  - Control: `POST /api/music/control` `{ action, value, query, channelId }`
- **UI Controls**:
  - **Now Playing Banner**: Track thumbnail, song title, requester, live playback state.
  - **Playback Control Buttons**: Play/Pause, Skip, Stop.
  - **Volume Slider**: 0% to 100%.
  - **Add Song Input**: Search box to input YouTube/SoundCloud search or link.
  - **Upcoming Queue List**: Numbered list of queued songs with durations.

### Screen 11: Security & Audit Logs (`/dashboard/logs`)
- **API Calls**: `GET /api/logs/security`, `GET /api/logs/messages`, `GET /api/logs/activity`
- **UI Controls**:
  - Filter tabs: `All Logs`, `Security (Antinuke & Antibetray)`, `Dispatched Messages`, `Admin Activity`.
  - Search bar & pagination controls.
  - Badges for critical severity events.

### Screen 12: General Settings (`/dashboard/settings`)
- **API Calls**: `GET /api/settings` and `PUT /api/settings`
- **UI Controls**:
  - Bot Command Prefix input.
  - Audit Log Channel selector.
  - Security Alert Channel selector.
  - Single-server information display.

---

## 5. Mock Mode for Standalone Frontend Development

If Claude is building the frontend in an environment where the backend is not actively running:
1. Every mock request can return the exact JSON schemas shown in Section 3 and Section 4.
2. The endpoint paths in the frontend API service should match Section 4 exactly so flipping `VITE_API_URL` connects immediately with zero code changes!

---

## 6. Summary Checklist for Frontend Developer (Claude)
- [ ] Set `withCredentials: true` on Axios or `credentials: 'include'` on fetch.
- [ ] Send `x-dev-admin: true` header during development to test without Discord OAuth2.
- [ ] Read `data` from `{ success: true, data: ... }`.
- [ ] Use `/api/guild/channels` and `/api/guild/roles` to populate all channel and role pickers.
- [ ] Use `POST /api/backups/:id/restore` with `{ confirmation: true }` for snapshot restore.
- [ ] Use `/api/tickets/config` to configure support categories and deploy the ticket panel.
