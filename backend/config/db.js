// config/db.js — MySQL connection pool
const mysql = require('mysql2/promise');

const connectionUrl = process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL;
const sslEnabled = String(process.env.DB_SSL || process.env.NODE_ENV === 'production').toLowerCase() === 'true';
const ssl = sslEnabled ? {
  rejectUnauthorized: String(process.env.DB_SSL_REJECT_UNAUTHORIZED || 'true').toLowerCase() !== 'false',
  ...(process.env.DB_SSL_CA_BASE64 ? { ca:Buffer.from(process.env.DB_SSL_CA_BASE64,'base64').toString('utf8') } : {}),
} : undefined;
let connectionConfig;
if (connectionUrl) {
  const parsed = new URL(connectionUrl);
  connectionConfig = {
    host:parsed.hostname, port:Number(parsed.port || 3306),
    user:decodeURIComponent(parsed.username), password:decodeURIComponent(parsed.password),
    database:decodeURIComponent(parsed.pathname.replace(/^\//,'')), ssl,
  };
} else {
  connectionConfig = {
    host:     process.env.DB_HOST     || process.env.MYSQLHOST     || 'localhost',
    port:     process.env.DB_PORT     || process.env.MYSQLPORT     || 3306,
    user:     process.env.DB_USER     || process.env.MYSQLUSER     || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME     || process.env.MYSQLDATABASE || 'shades_strokes',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl,
  };
}
const pool = mysql.createPool({...connectionConfig,waitForConnections:true,connectionLimit:Number(process.env.DB_POOL_SIZE||10),queueLimit:0});

// Test connection on startup (unit tests exercise pure domain logic without a DB).
if (process.env.NODE_ENV !== 'test') pool.getConnection()
  .then(conn => {
    console.log(`✅  MySQL connected: ${process.env.DB_NAME || process.env.MYSQLDATABASE || 'shades_strokes'}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌  MySQL connection failed:', err.message);
    console.error('    Check your DB_HOST, DB_USER, DB_PASSWORD, DB_NAME variables');
  });

module.exports = pool;
