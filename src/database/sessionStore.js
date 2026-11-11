const session = require('express-session');
const { getDb } = require('./index');
const logger = require('../utils/logger');

class SQLiteSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.cleanupIntervalMs = options.cleanupIntervalMs || 15 * 60 * 1000; // 15 mins
    this.timer = null;
    this._startCleanup();
  }

  _startCleanup() {
    this.timer = setInterval(() => {
      try {
        const db = getDb();
        const now = Math.floor(Date.now() / 1000);
        db.prepare('DELETE FROM dashboard_sessions WHERE expire < ?').run(now);
      } catch (err) {
        logger.error('Failed to prune expired sessions:', err);
      }
    }, this.cleanupIntervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  get(sid, callback) {
    try {
      const db = getDb();
      const row = db.prepare('SELECT sess, expire FROM dashboard_sessions WHERE sid = ?').get(sid);
      if (!row) {
        return callback(null, null);
      }

      const now = Math.floor(Date.now() / 1000);
      if (row.expire < now) {
        this.destroy(sid, () => {});
        return callback(null, null);
      }

      const sessionData = JSON.parse(row.sess);
      return callback(null, sessionData);
    } catch (err) {
      return callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const db = getDb();
      let maxAge = 1000 * 60 * 60 * 24 * 7; // 7 days fallback
      if (sess && sess.cookie && typeof sess.cookie.maxAge === 'number') {
        maxAge = sess.cookie.maxAge;
      }
      const expire = Math.floor((Date.now() + maxAge) / 1000);
      const sessString = JSON.stringify(sess);

      db.prepare(`
        INSERT INTO dashboard_sessions (sid, sess, expire)
        VALUES (?, ?, ?)
        ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire
      `).run(sid, sessString, expire);

      return callback(null);
    } catch (err) {
      return callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      const db = getDb();
      db.prepare('DELETE FROM dashboard_sessions WHERE sid = ?').run(sid);
      if (callback) return callback(null);
    } catch (err) {
      if (callback) return callback(err);
    }
  }

  touch(sid, sess, callback) {
    try {
      const db = getDb();
      let maxAge = 1000 * 60 * 60 * 24 * 7;
      if (sess && sess.cookie && typeof sess.cookie.maxAge === 'number') {
        maxAge = sess.cookie.maxAge;
      }
      const expire = Math.floor((Date.now() + maxAge) / 1000);

      db.prepare('UPDATE dashboard_sessions SET expire = ? WHERE sid = ?').run(expire, sid);
      if (callback) return callback(null);
    } catch (err) {
      if (callback) return callback(err);
    }
  }

  stopCleanup() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}

module.exports = SQLiteSessionStore;
