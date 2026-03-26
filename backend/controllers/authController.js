const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const pool         = require('../config/db');
const { asyncHandler } = require('../middleware/error');

// ── Token helper ─────────────────────────────────────────────
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user.id);
  const { password_hash, ...safeUser } = user;

  res.status(statusCode).json({
    success: true,
    token,
    user: safeUser,
  });
};

// ── POST /api/auth/register ──────────────────────────────────
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role = 'collector', phone } = req.body;

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing.length) {
    return res.status(409).json({ success: false, message: 'Email already registered' });
  }

  const password_hash = await bcrypt.hash(password, 12);
  const safeRole      = ['collector', 'artist'].includes(role) ? role : 'collector';

  const [result] = await pool.query(
    'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
    [name, email, password_hash, safeRole, phone || null]
  );

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
  sendToken(rows[0], 201, res);
});

// ── POST /api/auth/login ─────────────────────────────────────
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const [rows] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
  if (!rows.length) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  const user     = rows[0];
  const isMatch  = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

  sendToken(user, 200, res);
});

// ── GET /api/auth/me ─────────────────────────────────────────
exports.getMe = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, email, role, avatar_url, phone, address, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  res.json({ success: true, user: rows[0] });
});

// ── PUT /api/auth/update-profile ────────────────────────────
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address } = req.body;
  await pool.query(
    'UPDATE users SET name = ?, phone = ?, address = ? WHERE id = ?',
    [name, phone, address, req.user.id]
  );
  const [rows] = await pool.query(
    'SELECT id, name, email, role, avatar_url, phone, address FROM users WHERE id = ?',
    [req.user.id]
  );
  res.json({ success: true, user: rows[0] });
});

// ── PUT /api/auth/change-password ───────────────────────────
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  const isMatch = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!isMatch) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect' });
  }

  const password_hash = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash, req.user.id]);

  res.json({ success: true, message: 'Password updated successfully' });
});
