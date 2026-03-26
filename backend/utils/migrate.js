// utils/migrate.js — Run once to add image_url column
require('dotenv').config();
const pool = require('../config/db');

async function migrate() {
  try {
    console.log('Running migration...');

    // Add image_url to products if it doesn't exist
    await pool.query(`
      ALTER TABLE products
      ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000) DEFAULT NULL
    `);
    console.log('✅ image_url column added to products');

    process.exit(0);
  } catch (err) {
    // Column might already exist — that's fine
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('✅ image_url column already exists — skipping');
      process.exit(0);
    }
    console.error('Migration error:', err.message);
    process.exit(1);
  }
}

migrate();
