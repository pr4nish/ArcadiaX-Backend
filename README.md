# ArcadiaX — Enterprise Discord Management & Security Bot

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B%20%7C%20v20%2B%20%7C%20v24%2B-green.svg)](https://nodejs.org/)
[![Discord.js](https://img.shields.io/badge/discord.js-v14.17%2B-blue.svg)](https://discord.js.org/)
[![Database](https://img.shields.io/badge/SQLite-better--sqlite3%20%5BWAL%20mode%5D-orange.svg)](https://github.com/WiseLibs/better-sqlite3)
[![License](https://img.shields.io/badge/License-ISC-brightgreen.svg)]()

**ArcadiaX** is a single-server Discord management bot and enterprise REST backend. Built with Node.js, Discord.js v14, Express.js, and SQLite, ArcadiaX combines advanced server security, automated snapshots, support ticketing, welcome mechanics, and an isolated music engine with a secured REST API designed to power custom React dashboards.

---

## 🌟 Key Features

| Module | Core Capabilities |
| :--- | :--- |
| **🛡️ Antinuke** | Real-time sliding window detection against mass channel/role deletion/creation, mass bans/kicks, unauthorized webhooks, and dangerous permissions. Configurable responses (`strip_roles`, `quarantine_role`, `alert_only`) and emergency server lockdown. |
| **⚔️ Antibetray** | Monitors staff privilege escalation: admin perm assignments, dangerous role perm updates, channel overwrites, and hierarchy shifts. Safe automatic rollback support. |
| **💾 Server Backup** | Automated scheduled and manual server snapshots. Backs up roles, categories, text/voice channels, permission overwrites, server settings, and emoji metadata into SQLite. Selective restoration with strict confirmation protection. |
| **🎫 Ticket System** | Ticket Tool-style system. Interactive panel with dropdown categories (*Optimization*, *Clean/Sensitivity*, *Schedule Appointment*, *Technical Support*, *Other*), private channels, support roles, claim/close/reopen/delete buttons, and transcript logging. |
| **👋 Welcome & Goodbye** | Customized welcome and goodbye messages/embeds. Variables replacement (`{user}`, `{username}`, `{server}`, `{memberCount}`, `{userAvatar}`, `{serverIcon}`). Welcome DMs toggle and live preview engine. |
| **🤖 Auto Role** | Separate, isolated auto-role systems for human members and bot integrations with role hierarchy validation. |
| **🖼️ Embed Creator** | Full Discord EmbedBuilder service with preview and dispatch API. |
| **💬 Message Dispatcher** | Safe message sender with sanitized allowed mentions (prevents accidental `@everyone` / `@here` pings) and message history logs. |
| **🎶 Music Module** | Isolated `@discordjs/voice` audio player with stream integration, queue management, volume controls, idle auto-disconnect, and complete slash commands (`/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/queue`, `/nowplaying`, `/volume`, `/leave`). |
| **🔌 REST API** | 100% consistent JSON contract, Discord OAuth2 authentication, session storage, rate-limiting, and comprehensive OpenAPI 3.0 specs. |

---

## 📁 Project Structure

```
ArcadiaX/
├── data/                       # SQLite database files (WAL mode)
├── docs/
│   ├── API.md                  # Comprehensive API documentation
│   └── openapi.yaml            # OpenAPI 3.0 specification
├── logs/                       # Daily rotated activity & security logs
├── src/
│   ├── api/
│   │   ├── controllers/        # Express route controllers
│   │   ├── middleware/         # Auth, CORS, RateLimiter, ResponseFormatter
│   │   └── routes/             # API REST route definitions
│   ├── bot/
│   │   ├── commands/           # 15 Modular slash commands
│   │   ├── events/             # Modular Discord event listeners
│   │   ├── handlers/           # Command & event dynamic loaders
│   │   ├── modules/            # Antinuke, Antibetray, Backup, Tickets, Music, etc.
│   │   └── client.js           # Discord client foundation & lifecycle
│   ├── config/                 # Environment validation & configuration
│   ├── database/               # SQLite connection, schema, and session store
│   ├── utils/                  # Colored logger & formatters
│   ├── app.js                  # Express app setup & security middlewares
│   └── index.js                # Main application bootstrap & graceful shutdown
├── tests/
│   └── api.test.js             # Automated verification test suite (16 tests)
├── .env.example                # Sample environment variables
├── .gitignore
├── FRONTEND_API_GUIDE.md       # Complete guide for Claude/React dashboard development
├── package.json
└── README.md
```

---

## 🚀 Quick Setup & Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ or v24+ recommended).
- **Discord Bot Token & Application**: Created on the [Discord Developer Portal](https://discord.com/developers/applications).
  - Enable **Privileged Gateway Intents**: `Server Members Intent` and `Message Content Intent`.
  - Add OAuth2 Redirect URI: `http://localhost:5000/api/auth/callback` (or your domain).

### 1. Clone & Install Dependencies
```bash
cd ArcadiaX
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate your credentials in `.env`:
```env
NODE_ENV=development
PORT=5000

DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_client_id
DISCORD_CLIENT_SECRET=your_application_client_secret

DISCORD_GUILD_ID=your_target_discord_server_id
DISCORD_OWNER_ID=your_discord_user_id
ADMIN_USER_IDS=123456789012345678,987654321098765432

DASHBOARD_URL=http://localhost:3000
API_URL=http://localhost:5000
DISCORD_REDIRECT_URI=http://localhost:5000/api/auth/callback

SESSION_SECRET=arcadiax_super_secret_session_encryption_key
DATABASE_PATH=./data/arcadiax.db
```

### 3. Run Automated Tests
Verify all API endpoints, database tables, and controllers:
```bash
npm test
```

### 4. Start the Service
- **Development Mode** (auto-reload on code changes):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```

---

## 🖥️ Deployment on Panel.ori / Pterodactyl

ArcadiaX is 100% compatible with Pterodactyl and Panel.ori hosting environments.

1. **Egg Selection**: Select a standard **Node.js** egg (Node.js 18, 20, 22, or 24).
2. **Files Upload**:
   - Upload all project files to the container root (or pull via Git).
   - Ensure `package.json` and `src/index.js` are in place.
3. **Startup Command**:
   ```bash
   node src/index.js
   ```
4. **Environment Variables on Panel**:
   Configure the variables under the panel's **Configuration / Environment Variables** section (or create `.env` in the root).
   - Map `PORT` to the assigned container port (e.g., `PORT=5000`).
5. **Persistence**:
   Ensure the `data/` directory is mapped to persistent storage so your SQLite database (`arcadiax.db`) persists across restarts.

---

## 🐳 Docker Deployment

A `Dockerfile` and `docker-compose.yml` are included for containerized hosting:

```bash
docker compose up -d
```

---

## ⚡ Slash Commands Reference

All slash commands automatically deploy instantly to your target `DISCORD_GUILD_ID` upon startup:

| Command | Subcommands / Options | Permission | Description |
| :--- | :--- | :--- | :--- |
| `/ping` | — | Everyone | Checks bot latency, gateway ping, and uptime. |
| `/antinuke` | `status`, `toggle`, `lockdown`, `trusted` | Administrator | Configures antinuke guards, bypasses, or engages emergency lockdown. |
| `/antibetray` | `status`, `toggle`, `rollback` | Administrator | Configures staff escalation monitoring and automatic rollback. |
| `/backup` | `create [name]`, `list`, `restore <id>` | Administrator | Takes snapshot backups and executes selective server restoration. |
| `/ticket` | `panel [channel]`, `close [reason]`, `add <user>`, `remove <user>` | Administrator | Deploys interactive ticket panel and manages ticket channels. |
| `/play` | `<query>` | Everyone | Plays song or adds audio to the queue. |
| `/pause` | — | Everyone | Pauses current playback. |
| `/resume` | — | Everyone | Resumes paused playback. |
| `/skip` | — | Everyone | Skips the current track. |
| `/stop` | — | Everyone | Stops playback and clears server queue. |
| `/queue` | — | Everyone | Displays server queue and upcoming tracks. |
| `/nowplaying` | — | Everyone | Shows details of currently playing track. |
| `/volume` | `<percent>` (0-100) | Everyone | Adjusts playback volume. |
| `/leave` | — | Everyone | Disconnects bot from voice channel. |
| `/embed` | `<channel>`, `<title>`, `<description>`, ... | Manage Messages | Creates and posts custom rich embeds directly from Discord. |

---

## 🔗 React Frontend Integration

The React dashboard is built separately. For complete integration instructions, schemas, TypeScript types, and mock configurations, refer directly to:
👉 **[FRONTEND_API_GUIDE.md](./FRONTEND_API_GUIDE.md)**

For raw OpenAPI 3.0 specifications:
👉 **[docs/openapi.yaml](./docs/openapi.yaml)**

---

## 📄 License
ISC © ArcadiaX Team. Built for single-server enterprise Discord management.
