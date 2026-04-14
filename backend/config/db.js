const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               process.env.DB_PORT     || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'shades_strokes',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  charset:            'utf8mb4',

  // ── Keep connections alive ────────────────────────────────
  enableKeepAlive:    true,
  keepAliveInitialDelay: 0,

  // ── Reconnect on idle timeout ─────────────────────────────
  connectTimeout:     60000,       // 60s to establish connection
  idleTimeout:        1800000,     // remove idle connections after 30 min (mysql2 v3.5+)
});

// ── Test connection on startup ────────────────────────────────
pool.getConnection()
  .then(conn => {
    console.log('✅  MySQL connected:', process.env.DB_NAME);
    conn.release();
  })
  .catch(err => {
    // Log but do NOT exit — nodemon/Railway will keep server alive
    // and the pool will retry on next request
    console.error('❌  MySQL connection failed:', err.message);
  });

// ── Keep-alive ping every 5 minutes ──────────────────────────
// Prevents MySQL from dropping idle connections (default 8hr timeout,
// but cheap hosts often set it much lower ~5 min)
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    console.warn('⚠️  DB keep-alive ping failed:', err.message);
  }
}, 5 * 60 * 1000); // every 5 minutes

module.exports = pool;
