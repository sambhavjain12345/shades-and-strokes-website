// utils/initDB.js  — run once: node utils/initDB.js
const fs   = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function init() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
  });

  const schema = fs.readFileSync(path.join(__dirname, '../config/schema.sql'), 'utf8');
  await conn.query(schema);
  console.log('✅  Database & tables created');
  await conn.end();
}

init().catch(err => { console.error(err); process.exit(1); });
