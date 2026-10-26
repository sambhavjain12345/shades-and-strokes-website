// config/db.js — MySQL connection pool
const mysql = require('mysql2/promise');

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const connectionUrl = process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL;
const dbConnectTimeout = positiveInteger(process.env.DB_CONNECT_TIMEOUT_MS, 10_000);
const dbHealthTimeout = positiveInteger(process.env.DB_HEALTH_TIMEOUT_MS, 5_000);
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
const pool = mysql.createPool({
  ...connectionConfig,
  waitForConnections:true,
  connectionLimit:positiveInteger(process.env.DB_POOL_SIZE,10),
  queueLimit:0,
  connectTimeout:dbConnectTimeout,
  enableKeepAlive:true,
  keepAliveInitialDelay:0,
});

const databaseState = { available:false, lastSuccessAt:null, lastFailureAt:null };

const withTimeout = (promise, timeoutMs) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    const error = new Error('Database health check timed out');
    error.code = 'DB_HEALTH_TIMEOUT';
    reject(error);
  }, timeoutMs);
  promise.then(value => {
    clearTimeout(timer);
    resolve(value);
  }, error => {
    clearTimeout(timer);
    reject(error);
  });
});

// mysql2 discards dead pooled connections and creates new ones on demand.
// This harmless probe makes that recovery path observable without exposing
// connection details to HTTP clients.
const checkDatabase = async () => {
  try {
    await withTimeout(pool.query('SELECT 1'), dbHealthTimeout);
    databaseState.available = true;
    databaseState.lastSuccessAt = new Date().toISOString();
    return true;
  } catch (error) {
    databaseState.available = false;
    databaseState.lastFailureAt = new Date().toISOString();
    console.warn(`[DB] health probe failed (${error.code || 'UNKNOWN'})`);
    return false;
  }
};

// Test connection on startup (unit tests exercise pure domain logic without a DB).
if (process.env.NODE_ENV !== 'test') checkDatabase().then(available => {
  if (available) console.log('✅  MySQL connected');
  else console.warn('[DB] unavailable at startup; the pool will retry on later requests');
});

pool.checkDatabase = checkDatabase;
pool.databaseState = databaseState;

module.exports = pool;
