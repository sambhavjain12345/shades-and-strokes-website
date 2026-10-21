// utils/migrate.js — apply safe schema updates to an existing database
require('dotenv').config();
const pool = require('../config/db');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`✓ Added ${table}.${column}`);
  }
}

async function constraintExists(table, constraint) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=? AND CONSTRAINT_NAME=? LIMIT 1`,
    [table, constraint]
  );
  return rows.length > 0;
}

async function addConstraintIfMissing(table, constraint, definition) {
  if (!(await constraintExists(table, constraint))) {
    await pool.query(`ALTER TABLE ${table} ADD CONSTRAINT ${constraint} ${definition}`);
    console.log(`✓ Added ${table}.${constraint}`);
  }
}

async function migrate() {
  console.log('Running migrations...');

  if (!(await columnExists('products', 'image_url'))) {
    await pool.query('ALTER TABLE products ADD COLUMN image_url VARCHAR(1000) DEFAULT NULL');
    console.log('✓ Added products.image_url');
  } else {
    console.log('✓ products.image_url already exists');
  }

  if (!(await columnExists('users', 'google_sub'))) {
    await pool.query('ALTER TABLE users ADD COLUMN google_sub VARCHAR(255) DEFAULT NULL UNIQUE AFTER password_hash');
    console.log('✓ Added users.google_sub');
  }
  if (!(await columnExists('users', 'auth_provider'))) {
    await pool.query("ALTER TABLE users ADD COLUMN auth_provider ENUM('local','google') NOT NULL DEFAULT 'local' AFTER google_sub");
    console.log('✓ Added users.auth_provider');
  }
  await pool.query('ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) DEFAULT NULL');
  console.log('✓ Enabled Google-only user accounts');

  if (!(await columnExists('products', 'sale_type'))) {
    await pool.query("ALTER TABLE products ADD COLUMN sale_type ENUM('fixed','auction') NOT NULL DEFAULT 'fixed' AFTER image_url");
    console.log('✓ Added products.sale_type');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auctions (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      product_id INT UNSIGNED NOT NULL UNIQUE,
      starting_price DECIMAL(12,2) NOT NULL,
      current_bid DECIMAL(12,2) DEFAULT NULL,
      minimum_increment DECIMAL(12,2) NOT NULL DEFAULT 100.00,
      starts_at DATETIME NOT NULL,
      ends_at DATETIME NOT NULL,
      status ENUM('scheduled','active','ended','cancelled') NOT NULL DEFAULT 'scheduled',
      current_bidder_id INT UNSIGNED DEFAULT NULL,
      winner_user_id INT UNSIGNED DEFAULT NULL,
      winning_bid DECIMAL(12,2) DEFAULT NULL,
      ended_at DATETIME DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (current_bidder_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (winner_user_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_auction_status_dates (status, starts_at, ends_at)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bids (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      auction_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_bid_auction_amount (auction_id, amount DESC, created_at ASC),
      INDEX idx_bid_user (user_id)
    )
  `);
  console.log('✓ Created auction and bid tables');

  await addColumnIfMissing('auctions', 'reserve_price', 'DECIMAL(12,2) NULL AFTER starting_price');
  await pool.query('UPDATE auctions SET reserve_price=starting_price WHERE reserve_price IS NULL');
  await pool.query('ALTER TABLE auctions MODIFY reserve_price DECIMAL(12,2) NOT NULL');
  await pool.query("ALTER TABLE auctions MODIFY status ENUM('scheduled','active','ended','payment_pending','sold','unsold','cancelled') NOT NULL DEFAULT 'scheduled'");
  await pool.query("UPDATE auctions SET status=IF(winner_user_id IS NULL,'unsold','payment_pending') WHERE status='ended'");
  await pool.query("ALTER TABLE auctions MODIFY status ENUM('scheduled','active','payment_pending','sold','unsold','cancelled') NOT NULL DEFAULT 'scheduled'");

  await addColumnIfMissing('auctions', 'deposit_amount', 'DECIMAL(12,2) NOT NULL DEFAULT 500.00 AFTER reserve_price');
  await addColumnIfMissing('auctions', 'payment_window_hours', 'INT UNSIGNED NOT NULL DEFAULT 48 AFTER deposit_amount');
  await addColumnIfMissing('auctions', 'second_chance_window_hours', 'INT UNSIGNED NOT NULL DEFAULT 24 AFTER payment_window_hours');
  await addColumnIfMissing('auctions', 'settlement_status', "ENUM('AWAITING_PAYMENT','SECOND_CHANCE','COMPLETED','UNSOLD') NULL AFTER winning_bid");
  await addColumnIfMissing('auctions', 'active_buyer_user_id', 'INT UNSIGNED NULL AFTER settlement_status');
  await addColumnIfMissing('auctions', 'active_bid_amount', 'DECIMAL(12,2) NULL AFTER active_buyer_user_id');
  await addColumnIfMissing('auctions', 'active_bidder_rank', 'TINYINT UNSIGNED NULL AFTER active_bid_amount');
  await addColumnIfMissing('auctions', 'payment_due_at', 'DATETIME NULL AFTER active_bidder_rank');
  await addColumnIfMissing('auctions', 'settled_user_id', 'INT UNSIGNED NULL AFTER payment_due_at');
  await addConstraintIfMissing('auctions','fk_auction_active_buyer','FOREIGN KEY (active_buyer_user_id) REFERENCES users(id) ON DELETE SET NULL');
  await addConstraintIfMissing('auctions','fk_auction_settled_user','FOREIGN KEY (settled_user_id) REFERENCES users(id) ON DELETE SET NULL');
  await pool.query(`UPDATE auctions SET
    settlement_status=CASE status WHEN 'payment_pending' THEN 'AWAITING_PAYMENT' WHEN 'sold' THEN 'COMPLETED' WHEN 'unsold' THEN 'UNSOLD' ELSE settlement_status END,
    active_buyer_user_id=IF(status='payment_pending',winner_user_id,active_buyer_user_id),
    active_bid_amount=IF(status='payment_pending',winning_bid,active_bid_amount),
    active_bidder_rank=IF(status='payment_pending',1,active_bidder_rank),
    payment_due_at=IF(status='payment_pending' AND payment_due_at IS NULL,DATE_ADD(NOW(),INTERVAL payment_window_hours HOUR),payment_due_at),
    settled_user_id=IF(status='sold',winner_user_id,settled_user_id)
    WHERE status IN ('payment_pending','sold','unsold')`);

  await pool.query(`CREATE TABLE IF NOT EXISTS auction_deposits (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    auction_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    status ENUM('HELD','REFUND_PENDING','REFUNDED','APPLIED','FORFEITED') NOT NULL DEFAULT 'HELD',
    held_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_auction_deposit_user (auction_id,user_id),
    FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_deposit_status (status)
  )`);
  await pool.query("ALTER TABLE auction_deposits MODIFY status ENUM('PAYMENT_PENDING','HELD','REFUND_PENDING','REFUNDED','APPLIED','FORFEITED') NOT NULL DEFAULT 'PAYMENT_PENDING'");
  await addColumnIfMissing('auction_deposits','payment_status',"ENUM('CREATED','PENDING','SUCCESS','FAILED') NOT NULL DEFAULT 'CREATED' AFTER status");
  await addColumnIfMissing('auction_deposits','cashfree_order_id','VARCHAR(100) NULL UNIQUE AFTER payment_status');
  await addColumnIfMissing('auction_deposits','cashfree_payment_id','VARCHAR(100) NULL AFTER cashfree_order_id');
  await addColumnIfMissing('auction_deposits','payment_session_id','VARCHAR(255) NULL AFTER cashfree_payment_id');
  await addColumnIfMissing('auction_deposits','refund_id','VARCHAR(100) NULL UNIQUE AFTER payment_session_id');
  await addColumnIfMissing('auction_deposits','cashfree_refund_id','VARCHAR(100) NULL AFTER refund_id');
  await addColumnIfMissing('auction_deposits','refund_status','VARCHAR(40) NULL AFTER cashfree_refund_id');
  await addColumnIfMissing('auction_deposits','payment_attempt','SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER refund_status');
  await pool.query("UPDATE auction_deposits SET payment_status='SUCCESS' WHERE status IN ('HELD','REFUND_PENDING','REFUNDED','APPLIED','FORFEITED') AND payment_status='CREATED'");
  await pool.query(`CREATE TABLE IF NOT EXISTS auction_settlement_candidates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    auction_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    bidder_rank TINYINT UNSIGNED NOT NULL,
    final_bid DECIMAL(12,2) NOT NULL,
    status ENUM('WAITING','AWAITING_PAYMENT','SECOND_CHANCE','DECLINED','DEFAULTED','COMPLETED') NOT NULL DEFAULT 'WAITING',
    offered_at DATETIME DEFAULT NULL,
    payment_due_at DATETIME DEFAULT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_auction_candidate_rank (auction_id,bidder_rank),
    UNIQUE KEY uq_auction_candidate_user (auction_id,user_id),
    FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
  )`);
  // Preserve auctions that ended before deposits existed. They remain payable
  // at the original winning bid, but receive no deposit credit.
  await pool.query(`INSERT IGNORE INTO auction_settlement_candidates
    (auction_id,user_id,bidder_rank,final_bid,status,offered_at,payment_due_at)
    SELECT id,winner_user_id,1,winning_bid,'AWAITING_PAYMENT',COALESCE(ended_at,NOW()),payment_due_at
    FROM auctions WHERE status='payment_pending' AND winner_user_id IS NOT NULL AND winning_bid IS NOT NULL`);

  await addColumnIfMissing('orders', 'order_type', "ENUM('fixed','auction') NOT NULL DEFAULT 'fixed' AFTER total_amount");
  await addColumnIfMissing('orders', 'payment_status', "ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'paid' AFTER order_type");
  await addColumnIfMissing('orders', 'auction_id', 'INT UNSIGNED NULL UNIQUE AFTER payment_status');
  await addColumnIfMissing('orders', 'deposit_applied', 'DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER auction_id');
  await addColumnIfMissing('orders', 'amount_charged', 'DECIMAL(12,2) NULL AFTER deposit_applied');
  await pool.query(`CREATE TABLE IF NOT EXISTS payment_attempts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL, auction_id INT UNSIGNED NULL,
    kind ENUM('fixed','auction') NOT NULL,
    cashfree_order_id VARCHAR(100) NOT NULL UNIQUE,
    cashfree_payment_id VARCHAR(100) NULL, payment_session_id VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL, currency CHAR(3) NOT NULL DEFAULT 'INR',
    status ENUM('CREATED','PENDING','SUCCESS','FAILED','CONSUMED') NOT NULL DEFAULT 'CREATED',
    checkout_payload JSON NOT NULL, order_id INT UNSIGNED NULL UNIQUE,
    expires_at DATETIME NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE RESTRICT,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    INDEX idx_payment_user_status (user_id,status)
  )`);
  await addConstraintIfMissing('payment_attempts','uq_open_auction_payment','UNIQUE (auction_id,status)');
  await addColumnIfMissing('reviews','order_id','INT UNSIGNED NULL AFTER user_id');
  await addConstraintIfMissing('reviews','fk_review_order','FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT');
  console.log('✓ Added auction settlement and unique checkout fields');

  // A role alone is not enough for Studio ownership. Backfill a minimal artist
  // profile for accounts promoted through older versions of the admin panel.
  const [artistBackfill] = await pool.query(`
    INSERT INTO artists (user_id, name)
    SELECT u.id, u.name
    FROM users u
    LEFT JOIN artists a ON a.user_id = u.id
    WHERE u.role = 'artist' AND a.id IS NULL
  `);
  console.log(`✓ Linked ${artistBackfill.affectedRows} existing artist account(s)`);

  await pool.query(`
    ALTER TABLE orders
    MODIFY COLUMN status ENUM(
      'pending','confirmed','packaging','shipped','delivered',
      'cancelled','return_requested','returned'
    ) NOT NULL DEFAULT 'pending'
  `);
  console.log('✓ Updated order status values');
}

migrate()
  .then(async () => {
    console.log('Migrations complete');
    await pool.end();
  })
  .catch(async (err) => {
    console.error('Migration error:', err.message);
    await pool.end();
    process.exitCode = 1;
  });
