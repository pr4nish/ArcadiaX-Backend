const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const config = require('./config');
const SQLiteSessionStore = require('./database/sessionStore');
const responseFormatter = require('./api/middleware/responseFormatter');
const errorHandler = require('./api/middleware/errorHandler');
const { apiLimiter } = require('./api/middleware/rateLimiter');

// Import routes
const authRoutes = require('./api/routes/authRoutes');
const dashboardRoutes = require('./api/routes/dashboardRoutes');
const antinukeRoutes = require('./api/routes/antinukeRoutes');
const antibetrayRoutes = require('./api/routes/antibetrayRoutes');
const backupRoutes = require('./api/routes/backupRoutes');
const welcomeRoutes = require('./api/routes/welcomeRoutes');
const autoroleRoutes = require('./api/routes/autoroleRoutes');
const embedRoutes = require('./api/routes/embedRoutes');
const messageRoutes = require('./api/routes/messageRoutes');
const ticketRoutes = require('./api/routes/ticketRoutes');
const musicRoutes = require('./api/routes/musicRoutes');
const logsRoutes = require('./api/routes/logsRoutes');
const settingsRoutes = require('./api/routes/settingsRoutes');
const guildRoutes = require('./api/routes/guildRoutes');

const app = express();

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS Configuration
const allowedOrigins = [
  config.dashboardUrl,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow dashboard origin
    return callback(null, true); // Permissive in local dev, matches credentials
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-dev-admin', 'X-Requested-With']
}));

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(config.sessionSecret));

// Session Store backed by SQLite
const sessionStore = new SQLiteSessionStore();
app.use(session({
  name: 'arcadiax.sid',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: config.isProduction ? 'none' : 'lax',
    maxAge: config.sessionMaxAge
  }
}));

// Standard Response Formatter Middleware
app.use(responseFormatter);

// General API rate limiter
app.use('/api', apiLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'ArcadiaX Backend',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/antinuke', antinukeRoutes);
app.use('/api/antibetray', antibetrayRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/welcome', welcomeRoutes);
app.use('/api/autorole', autoroleRoutes);
app.use('/api/embeds', embedRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/guild', guildRoutes);

// 404 Route Handler
app.use((req, res) => {
  return res.error(`Route ${req.method} ${req.originalUrl} not found.`, 404, 'NOT_FOUND');
});

// Global Error Handler
app.use(errorHandler);

module.exports = { app, sessionStore };
