// ============================================================
//  Shades & Strokes 2.0 — Express Server
//  Start: npm run dev  |  Production: npm start
// ============================================================
require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const authRoutes    = require('./routes/auth');
const productRoutes = require('./routes/products');
const artistRoutes  = require('./routes/artist');
const { cartRouter, wishRouter, orderRouter, adminRouter } = require('./routes/index');
const { errorHandler } = require('./middleware/error');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security ──────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return cb(null, true);
    // Allow exact matches
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Allow any Vercel deployment URL for this project
    if (origin.includes('vercel.app')) return cb(null, true);
    // Allow localhost in any form
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────
// Disabled in development — only active in production
const isDev = process.env.NODE_ENV === 'development';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 100,   // basically unlimited in dev
  skip: () => isDev,           // skip entirely in development
  message: { success:false, message:'Too many requests — please try again shortly' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 10000 : 10,    // basically unlimited in dev
  skip: () => isDev,           // skip entirely in development
  message: { success:false, message:'Too many login attempts — please wait 15 minutes' }
});

app.use('/api/', limiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Static uploads ────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Shades & Strokes API is running', version: '2.0.0', env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
});

// ── Auto DB init on first start ───────────────────────────────
async function autoInitDB() {
  try {
    const pool = require('./config/db');

    // Check if tables already exist
    const [tables] = await pool.query(`
      SELECT COUNT(*) AS count FROM information_schema.tables
      WHERE table_schema = DATABASE()
    `);

    if (tables[0].count >= 8) {
      console.log(`✅  DB already initialized (${tables[0].count} tables found)`);

      // Still run migration to add image_url if missing
      try {
        await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000) DEFAULT NULL`);
        console.log('✅  image_url column verified');
      } catch (e) { /* already exists */ }
      return;
    }

    console.log('🔧  No tables found — running auto-init...');

    // Create all tables
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('collector','artist','admin') DEFAULT 'collector',
      phone VARCHAR(20), address TEXT, avatar_url VARCHAR(500),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS artists (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED DEFAULT NULL,
      name VARCHAR(100) NOT NULL,
      bio TEXT, location VARCHAR(100), avatar_url VARCHAR(500), website VARCHAR(300),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS categories (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(80) NOT NULL UNIQUE,
      slug VARCHAR(80) NOT NULL UNIQUE
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS products (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      slug VARCHAR(220) NOT NULL UNIQUE,
      description TEXT,
      artist_id INT UNSIGNED NOT NULL,
      category_id INT UNSIGNED NOT NULL,
      medium VARCHAR(100), dimensions VARCHAR(100),
      year YEAR, edition VARCHAR(100),
      price DECIMAL(12,2) NOT NULL,
      stock INT UNSIGNED DEFAULT 1,
      is_featured BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      tag VARCHAR(50), image_url VARCHAR(1000),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE RESTRICT,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS wishlists (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      product_id INT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_wish (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS cart_items (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      product_id INT UNSIGNED NOT NULL,
      quantity INT UNSIGNED DEFAULT 1,
      UNIQUE KEY unique_cart (user_id, product_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS orders (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_number VARCHAR(30) NOT NULL UNIQUE,
      user_id INT UNSIGNED NOT NULL,
      status ENUM('pending','confirmed','packaging','shipped','delivered','cancelled') DEFAULT 'pending',
      total_amount DECIMAL(12,2) NOT NULL,
      shipping_name VARCHAR(100), shipping_addr TEXT, shipping_phone VARCHAR(20), notes TEXT,
      placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id INT UNSIGNED NOT NULL,
      product_id INT UNSIGNED NOT NULL,
      quantity INT UNSIGNED NOT NULL,
      unit_price DECIMAL(12,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS order_timeline (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      order_id INT UNSIGNED NOT NULL,
      status VARCHAR(80) NOT NULL,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS reviews (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      product_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED NOT NULL,
      rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_review (user_id, product_id),
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);

    console.log('✅  All tables created!');

    // Seed initial data
    const bcrypt = require('bcryptjs');

    // Categories
    const cats = [
      ['Paintings','paintings'],['Sculptures','sculptures'],
      ['Sketches','sketches'],['Watercolours','watercolours'],['Mixed Media','mixed-media'],
    ];
    for (const [name, slug] of cats) {
      await pool.query('INSERT IGNORE INTO categories (name,slug) VALUES (?,?)', [name, slug]);
    }

    // Admin user
    const adminHash = await bcrypt.hash('admin123', 12);
    await pool.query(
      'INSERT IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      ['Admin User','admin@shadesstrokes.com', adminHash,'admin']
    );

    // Sample artist + user
    const userHash = await bcrypt.hash('test123', 12);
    const [u1] = await pool.query(
      'INSERT IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      ['Rohan Das','rohan@example.com', userHash,'collector']
    );
    await pool.query(
      'INSERT IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',
      ['Priya Mehta','priya@example.com', userHash,'collector']
    );

    // Artists
    const artists = [
      ['Arjun Sharma','Works in the tradition of expressive oil painting.','Mumbai, India'],
      ['Kavya Nair','Watercolour artist known for botanical works.','Kerala, India'],
      ['Rohan Das','Mixed media practitioner.','Delhi, India'],
      ['Meera Pillai','Sculptor working in bronze.','Bangalore, India'],
      ['Vikram Sood','Charcoal and graphite artist.','Jaipur, India'],
    ];
    const artistIds = [];
    for (const [name, bio, location] of artists) {
      const [r] = await pool.query(
        'INSERT IGNORE INTO artists (name,bio,location) VALUES (?,?,?)',
        [name, bio, location]
      );
      artistIds.push(r.insertId || 1);
    }

    // Get real artist IDs
    const [aRows] = await pool.query('SELECT id FROM artists ORDER BY id LIMIT 5');
    const [cRows] = await pool.query('SELECT id FROM categories ORDER BY id LIMIT 5');

    // Sample products
    const products = [
      ['Molten Hour','oil on canvas, with warm amber tones',aRows[0]?.id,cRows[0]?.id,'Oil on Canvas','90 × 120 cm',2024,52000,1,true,'Featured'],
      ['Cerulean Deep','deep blue acrylic work',aRows[0]?.id,cRows[0]?.id,'Acrylic','60 × 80 cm',2023,28500,1,false,''],
      ['Emerald Hush','soft watercolour greens',aRows[1]?.id,cRows[3]?.id,'Watercolour','45 × 60 cm',2024,14000,1,false,'New'],
      ['Crimson Quiet','oil on board, intimate scale',aRows[2]?.id,cRows[0]?.id,'Oil on Board','30 × 40 cm',2023,19000,1,false,''],
      ['Violet Reverie','mixed media exploration',aRows[2]?.id,cRows[4]?.id,'Mixed Media','50 × 70 cm',2024,22000,1,false,''],
      ['Amber Dusk','golden hour oil painting',aRows[0]?.id,cRows[0]?.id,'Oil on Canvas','80 × 100 cm',2024,38000,1,true,'Featured'],
      ['Midnight Drift','charcoal sketch',aRows[4]?.id,cRows[2]?.id,'Charcoal','40 × 55 cm',2023,12000,1,false,''],
      ['Dusk Reverie','watercolour sunset',aRows[1]?.id,cRows[3]?.id,'Watercolour','50 × 65 cm',2024,16500,1,false,'New'],
      ['Silent Grove','acrylic forest scene',aRows[0]?.id,cRows[0]?.id,'Acrylic','70 × 90 cm',2023,31000,1,false,''],
      ['Bronze Ancestor','bronze sculpture',aRows[3]?.id,cRows[1]?.id,'Bronze','30 × 20 × 15 cm',2024,65000,1,true,'Featured'],
      ['Paper City','graphite cityscape',aRows[4]?.id,cRows[2]?.id,'Graphite','50 × 70 cm',2023,9500,1,false,''],
      ['Ochre Plains','oil on linen landscape',aRows[0]?.id,cRows[0]?.id,'Oil on Linen','100 × 130 cm',2024,78000,1,false,'New'],
    ];

    for (const [title, desc, artistId, catId, medium, dims, year, price, stock, featured, tag] of products) {
      if (!artistId || !catId) continue;
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-') + '-' + Date.now() + Math.random().toString(36).slice(2,5);
      await pool.query(
        `INSERT IGNORE INTO products (title,slug,description,artist_id,category_id,medium,dimensions,year,price,stock,is_featured,tag)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [title, slug, desc, artistId, catId, medium, dims, year, price, stock, featured?1:0, tag||null]
      );
    }

    console.log('✅  Seed data inserted!');
    console.log('   Admin login → admin@shadesstrokes.com / admin123');
    console.log('   Test user  → rohan@example.com / test123');

  } catch (err) {
    console.error('❌  Auto-init error:', err.message);
    // Don't crash the server — just log the error
  }
}

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/artist',   artistRoutes);
app.use('/api/cart',     cartRouter);
app.use('/api/wishlist', wishRouter);
app.use('/api/orders',   orderRouter);
app.use('/api/admin',    adminRouter);

// ── Serve React build in production ───────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── 404 ───────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('\n══════════════════════════════════════════════');
  console.log(`  🎨  Shades & Strokes API`);
  console.log(`  🚀  Running on  http://localhost:${PORT}`);
  console.log(`  🌿  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  📡  API base:    http://localhost:${PORT}/api`);
  console.log('══════════════════════════════════════════════\n');

  // Auto-initialize DB tables if they don't exist
  await autoInitDB();
});

module.exports = app;
