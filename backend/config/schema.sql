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
  password_hash VARCHAR(255)    NOT NULL,
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
  status          ENUM('pending','confirmed','packaging','shipped','delivered','cancelled')
                                  NOT NULL DEFAULT 'pending',
  total_amount    DECIMAL(12,2)   NOT NULL,
  shipping_name   VARCHAR(100)    DEFAULT NULL,
  shipping_addr   TEXT            DEFAULT NULL,
  shipping_phone  VARCHAR(20)     DEFAULT NULL,
  notes           TEXT            DEFAULT NULL,
  placed_at       TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
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
  rating      TINYINT       NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT          DEFAULT NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_product (user_id, product_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);
