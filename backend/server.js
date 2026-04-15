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
app.listen(PORT, () => {
  console.log('\n══════════════════════════════════════════════');
  console.log(`  🎨  Shades & Strokes API`);
  console.log(`  🚀  Running on  http://localhost:${PORT}`);
  console.log(`  🌿  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  📡  API base:    http://localhost:${PORT}/api`);
  console.log('══════════════════════════════════════════════\n');
});

module.exports = app;
