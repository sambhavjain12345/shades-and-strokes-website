// config/db.js — MySQL connection pool
const mysql = require('mysql2/promise');

// Railway provides MYSQL_URL or individual variables
// Support both formats
const pool = mysql.createPool(
  process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL || {
    host:     process.env.DB_HOST     || process.env.MYSQLHOST     || 'localhost',
    port:     process.env.DB_PORT     || process.env.MYSQLPORT     || 3306,
    user:     process.env.DB_USER     || process.env.MYSQLUSER     || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME     || process.env.MYSQLDATABASE || 'shades_strokes',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  }
);

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log(`✅  MySQL connected: ${process.env.DB_NAME || process.env.MYSQLDATABASE || 'shades_strokes'}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌  MySQL connection failed:', err.message);
    console.error('    Check your DB_HOST, DB_USER, DB_PASSWORD, DB_NAME variables');
  });

module.exports = pool;
