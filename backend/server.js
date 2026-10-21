// ============================================================
//  Shades & Strokes 2.0 — Express Server
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
const uploadRoutes  = require('./routes/upload');
const auctionRoutes = require('./routes/auctions');
const { cartRouter, wishRouter, orderRouter, adminRouter } = require('./routes/index');
const { errorHandler } = require('./middleware/error');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Global error handlers ─────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err.message);
  console.error(err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Promise Rejection:', reason);
});

// ── Trust proxy — REQUIRED for Railway ───────────────────────
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  // The Vite frontend runs on :3000 while uploaded assets are served by the
  // API on :5000 in development. Permit those public artwork files to render.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || '').split(',').map(value=>value.trim()),
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ── Rate limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 200,
  message: { success: false, message: 'Too many requests' },
  standardHeaders: true, legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  message: { success: false, message: 'Too many login attempts' },
  standardHeaders: true, legacyHeaders: false,
});
app.use('/api/', limiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/google',   authLimiter);

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '10kb', verify:(req,res,buffer)=>{ req.rawBody=buffer.toString('utf8'); } }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ── Static uploads ────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true, message: 'Shades & Strokes API is running',
    version: '2.0.0', env: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/artist',   artistRoutes);
app.use('/api/upload',   uploadRoutes);   // ← Cloudinary image upload
app.use('/api/auctions', auctionRoutes);
app.use('/api/cart',     cartRouter);
app.use('/api/wishlist', wishRouter);
app.use('/api/orders',   orderRouter);
app.use('/api/admin',    adminRouter);

// ── Serve React build in production ───────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../mern/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

// ── 404 ───────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.originalUrl} not found` });
});

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log('\n══════════════════════════════════════════════');
  console.log(`  🎨  Shades & Strokes API`);
  console.log(`  🚀  Running on  http://localhost:${PORT}`);
  console.log(`  🌿  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`  📡  API base:    http://localhost:${PORT}/api`);
  console.log('══════════════════════════════════════════════\n');
});

// Lazy endpoint finalization is backed by a lightweight sweep so auctions are
// marked ended even when no collector has the page open at the deadline.
const auctionSweep = setInterval(() => {
  require('./utils/auctionService').finalizeExpiredAuctions().catch(err => {
    if (process.env.NODE_ENV === 'development') {
      console.error('Auction finalization sweep failed:', err.message);
    }
  });
}, 30_000);
auctionSweep.unref();

module.exports = app;
