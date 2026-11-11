const fs = require('fs');
const path = require('path');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '..', '..', 'logs');
    if (!fs.existsSync(this.logsDir)) {
      try {
        fs.mkdirSync(this.logsDir, { recursive: true });
      } catch (e) {
        // Ignore in restricted environments
      }
    }
  }

  _formatTime() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  _writeLogFile(level, message, meta) {
    try {
      const today = new Date().toISOString().substring(0, 10);
      const filePath = path.join(this.logsDir, `arcadiax-${today}.log`);
      const logLine = `[${this._formatTime()}] [${level.toUpperCase()}] ${message} ${meta ? JSON.stringify(meta) : ''}\n`;
      fs.appendFileSync(filePath, logLine, 'utf8');
    } catch {
      // Non-blocking log failure
    }
  }

  info(message, meta) {
    const timestamp = `${COLORS.dim}[${this._formatTime()}]${COLORS.reset}`;
    const tag = `${COLORS.cyan}[INFO]${COLORS.reset}`;
    console.log(`${timestamp} ${tag} ${message}`, meta ? meta : '');
    this._writeLogFile('info', message, meta);
  }

  success(message, meta) {
    const timestamp = `${COLORS.dim}[${this._formatTime()}]${COLORS.reset}`;
    const tag = `${COLORS.green}[SUCCESS]${COLORS.reset}`;
    console.log(`${timestamp} ${tag} ${message}`, meta ? meta : '');
    this._writeLogFile('success', message, meta);
  }

  warn(message, meta) {
    const timestamp = `${COLORS.dim}[${this._formatTime()}]${COLORS.reset}`;
    const tag = `${COLORS.yellow}[WARN]${COLORS.reset}`;
    console.warn(`${timestamp} ${tag} ${message}`, meta ? meta : '');
    this._writeLogFile('warn', message, meta);
  }

  error(message, error) {
    const timestamp = `${COLORS.dim}[${this._formatTime()}]${COLORS.reset}`;
    const tag = `${COLORS.red}[ERROR]${COLORS.reset}`;
    console.error(`${timestamp} ${tag} ${message}`, error ? error : '');
    this._writeLogFile('error', message, error instanceof Error ? error.stack : error);
  }

  security(message, meta) {
    const timestamp = `${COLORS.dim}[${this._formatTime()}]${COLORS.reset}`;
    const tag = `${COLORS.magenta}${COLORS.bright}[SECURITY]${COLORS.reset}`;
    console.log(`${timestamp} ${tag} ${COLORS.bright}${message}${COLORS.reset}`, meta ? meta : '');
    this._writeLogFile('security', message, meta);
  }

  debug(message, meta) {
    if (process.env.NODE_ENV !== 'production') {
      const timestamp = `${COLORS.dim}[${this._formatTime()}]${COLORS.reset}`;
      const tag = `${COLORS.dim}[DEBUG]${COLORS.reset}`;
      console.log(`${timestamp} ${tag} ${message}`, meta ? meta : '');
    }
  }
}

module.exports = new Logger();
