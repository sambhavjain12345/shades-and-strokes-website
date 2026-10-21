-- ============================================================
--  Shades & Strokes 2.0 — MySQL Schema
--  Run: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS shades_strokes
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE shades_strokes;

-- ─── USERS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100)    NOT NULL,
  email         VARCHAR(150)    NOT NULL UNIQUE,
  password_hash VARCHAR(255)    DEFAULT NULL,
  google_sub    VARCHAR(255)    DEFAULT NULL UNIQUE,
  auth_provider ENUM('local','google') NOT NULL DEFAULT 'local',
  role          ENUM('collector','artist','admin') NOT NULL DEFAULT 'collector',
  avatar_url    VARCHAR(500)    DEFAULT NULL,
  phone         VARCHAR(20)     DEFAULT NULL,
  address       TEXT            DEFAULT NULL,
  is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_role  (role)
);

-- ─── ARTISTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS artists (
  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED    DEFAULT NULL,
  name          VARCHAR(100)    NOT NULL,
  bio           TEXT            DEFAULT NULL,
  location      VARCHAR(100)    DEFAULT NULL,
  avatar_url    VARCHAR(500)    DEFAULT NULL,
  website       VARCHAR(300)    DEFAULT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_name (name)
);

-- ─── CATEGORIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id    INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  name  VARCHAR(80)   NOT NULL UNIQUE,
  slug  VARCHAR(80)   NOT NULL UNIQUE
);

-- ─── PRODUCTS (Artworks) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(200)    NOT NULL,
  slug            VARCHAR(220)    NOT NULL UNIQUE,
  description     TEXT            DEFAULT NULL,
  artist_id       INT UNSIGNED    NOT NULL,
  category_id     INT UNSIGNED    NOT NULL,
  medium          VARCHAR(100)    DEFAULT NULL,
  dimensions      VARCHAR(100)    DEFAULT NULL,
  year            YEAR            DEFAULT NULL,
  edition         VARCHAR(80)     DEFAULT '1 of 1 (Original)',
  price           DECIMAL(12,2)   NOT NULL,
  stock           INT UNSIGNED    NOT NULL DEFAULT 1,
  is_featured     BOOLEAN         NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
  tag             VARCHAR(50)     DEFAULT NULL,
  image_url       VARCHAR(500)    DEFAULT NULL,
  sale_type       ENUM('fixed','auction') NOT NULL DEFAULT 'fixed',
  created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id)   REFERENCES artists(id)    ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  INDEX idx_slug      (slug),
  INDEX idx_featured  (is_featured),
  INDEX idx_category  (category_id),
  INDEX idx_artist    (artist_id),
  INDEX idx_price     (price)
);

-- ─── AUCTIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auctions (
  id                 INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  product_id         INT UNSIGNED    NOT NULL UNIQUE,
  starting_price     DECIMAL(12,2)   NOT NULL,
  reserve_price      DECIMAL(12,2)   NOT NULL,
  deposit_amount     DECIMAL(12,2)   NOT NULL DEFAULT 500.00,
  payment_window_hours INT UNSIGNED  NOT NULL DEFAULT 48,
  second_chance_window_hours INT UNSIGNED NOT NULL DEFAULT 24,
  current_bid        DECIMAL(12,2)   DEFAULT NULL,
  minimum_increment  DECIMAL(12,2)   NOT NULL DEFAULT 100.00,
  starts_at          DATETIME        NOT NULL,
  ends_at            DATETIME        NOT NULL,
  status             ENUM('scheduled','active','payment_pending','sold','unsold','cancelled') NOT NULL DEFAULT 'scheduled',
  current_bidder_id  INT UNSIGNED    DEFAULT NULL,
  winner_user_id     INT UNSIGNED    DEFAULT NULL,
  winning_bid        DECIMAL(12,2)   DEFAULT NULL,
  settlement_status  ENUM('AWAITING_PAYMENT','SECOND_CHANCE','COMPLETED','UNSOLD') DEFAULT NULL,
  active_buyer_user_id INT UNSIGNED  DEFAULT NULL,
  active_bid_amount  DECIMAL(12,2)   DEFAULT NULL,
  active_bidder_rank TINYINT UNSIGNED DEFAULT NULL,
  payment_due_at     DATETIME        DEFAULT NULL,
  settled_user_id    INT UNSIGNED    DEFAULT NULL,
  ended_at           DATETIME        DEFAULT NULL,
  created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id)        REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (current_bidder_id) REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (winner_user_id)    REFERENCES users(id)    ON DELETE SET NULL,
  FOREIGN KEY (active_buyer_user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (settled_user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_auction_status_dates (status, starts_at, ends_at),
  CHECK (starting_price > 0),
  CHECK (minimum_increment > 0),
  CHECK (ends_at > starts_at)
);

-- ─── BIDS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bids (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  auction_id  INT UNSIGNED    NOT NULL,
  user_id     INT UNSIGNED    NOT NULL,
  amount      DECIMAL(12,2)   NOT NULL,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE RESTRICT,
  INDEX idx_bid_auction_amount (auction_id, amount DESC, created_at ASC),
  INDEX idx_bid_user (user_id),
  CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS auction_deposits (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  auction_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  status      ENUM('PAYMENT_PENDING','HELD','REFUND_PENDING','REFUNDED','APPLIED','FORFEITED') NOT NULL DEFAULT 'PAYMENT_PENDING',
  payment_status ENUM('CREATED','PENDING','SUCCESS','FAILED') NOT NULL DEFAULT 'CREATED',
  cashfree_order_id VARCHAR(100) DEFAULT NULL UNIQUE,
  cashfree_payment_id VARCHAR(100) DEFAULT NULL,
  payment_session_id VARCHAR(255) DEFAULT NULL,
  refund_id VARCHAR(100) DEFAULT NULL UNIQUE,
  cashfree_refund_id VARCHAR(100) DEFAULT NULL,
  refund_status VARCHAR(40) DEFAULT NULL,
  payment_attempt SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  held_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auction_deposit_user (auction_id, user_id),
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_deposit_status (status)
);

CREATE TABLE IF NOT EXISTS auction_settlement_candidates (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  auction_id  INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  bidder_rank TINYINT UNSIGNED NOT NULL,
  final_bid   DECIMAL(12,2) NOT NULL,
  status      ENUM('WAITING','AWAITING_PAYMENT','SECOND_CHANCE','DECLINED','DEFAULTED','COMPLETED') NOT NULL DEFAULT 'WAITING',
  offered_at  DATETIME DEFAULT NULL,
  payment_due_at DATETIME DEFAULT NULL,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auction_candidate_rank (auction_id, bidder_rank),
  UNIQUE KEY uq_auction_candidate_user (auction_id, user_id),
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- ─── WISHLISTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED  NOT NULL,
  product_id  INT UNSIGNED  NOT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_product (user_id, product_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ─── CARTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cart_items (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED  NOT NULL,
  product_id  INT UNSIGNED  NOT NULL,
  quantity    INT UNSIGNED  NOT NULL DEFAULT 1,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_product (user_id, product_id),
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ─── ORDERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  order_number    VARCHAR(30)     NOT NULL UNIQUE,
  user_id         INT UNSIGNED    NOT NULL,
  status          ENUM('pending','confirmed','packaging','shipped','delivered','cancelled','return_requested','returned')
                                  NOT NULL DEFAULT 'pending',
  total_amount    DECIMAL(12,2)   NOT NULL,
  order_type      ENUM('fixed','auction') NOT NULL DEFAULT 'fixed',
  payment_status  ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'paid',
  auction_id      INT UNSIGNED    DEFAULT NULL UNIQUE,
  deposit_applied DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  amount_charged  DECIMAL(12,2)   DEFAULT NULL,
  shipping_name   VARCHAR(100)    DEFAULT NULL,
  shipping_addr   TEXT            DEFAULT NULL,
  shipping_phone  VARCHAR(20)     DEFAULT NULL,
  notes           TEXT            DEFAULT NULL,
  placed_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE RESTRICT,
  INDEX idx_user      (user_id),
  INDEX idx_status    (status),
  INDEX idx_placed_at (placed_at)
);

-- ─── ORDER ITEMS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED    NOT NULL,
  product_id  INT UNSIGNED    NOT NULL,
  quantity    INT UNSIGNED    NOT NULL DEFAULT 1,
  unit_price  DECIMAL(12,2)   NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS payment_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  auction_id INT UNSIGNED DEFAULT NULL,
  kind ENUM('fixed','auction') NOT NULL,
  cashfree_order_id VARCHAR(100) NOT NULL UNIQUE,
  cashfree_payment_id VARCHAR(100) DEFAULT NULL,
  payment_session_id VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  status ENUM('CREATED','PENDING','SUCCESS','FAILED','CONSUMED') NOT NULL DEFAULT 'CREATED',
  checkout_payload JSON NOT NULL,
  order_id INT UNSIGNED DEFAULT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE RESTRICT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  INDEX idx_payment_user_status (user_id,status)
);

-- ─── ORDER TIMELINE ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_timeline (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED  NOT NULL,
  status      VARCHAR(80)   NOT NULL,
  description TEXT          DEFAULT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order (order_id)
);

-- ─── REVIEWS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED  NOT NULL,
  user_id     INT UNSIGNED  NOT NULL,
  order_id    INT UNSIGNED  NOT NULL,
  rating      TINYINT       NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT          DEFAULT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_product (user_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE RESTRICT
);
