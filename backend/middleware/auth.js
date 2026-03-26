const jwt  = require('jsonwebtoken');
const pool = require('../config/db');

// ── Verify JWT ────────────────────────────────────────────────
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorised — no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows]  = await pool.query(
      'SELECT id, name, email, role, avatar_url FROM users WHERE id = ? AND is_active = 1',
      [decoded.id]
    );

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ── Role Guard ────────────────────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Role '${req.user.role}' is not permitted to access this route`,
    });
  }
  next();
};

// ── Optional auth (attach user if token exists, never block) ──
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const [rows]  = await pool.query(
        'SELECT id, name, email, role FROM users WHERE id = ? AND is_active = 1',
        [decoded.id]
      );
      if (rows.length) req.user = rows[0];
    } catch (_) { /* silent */ }
  }
  next();
};

module.exports = { protect, authorize, optionalAuth };
