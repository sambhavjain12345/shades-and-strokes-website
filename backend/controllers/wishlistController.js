const pool             = require('../config/db');
const { asyncHandler } = require('../middleware/error');

// ── GET /api/wishlist ────────────────────────────────────────
exports.getWishlist = asyncHandler(async (req, res) => {
  const [items] = await pool.query(
    `SELECT
       w.id, w.created_at,
       p.id AS product_id, p.title, p.price, p.image_url, p.medium,
       a.name AS artist_name
     FROM wishlists w
     JOIN products p ON w.product_id = p.id
     JOIN artists  a ON p.artist_id  = a.id
     WHERE w.user_id = ? AND p.is_active = 1
     ORDER BY w.created_at DESC`,
    [req.user.id]
  );
  res.json({ success: true, items });
});

// ── POST /api/wishlist ───────────────────────────────────────
exports.addToWishlist = asyncHandler(async (req, res) => {
  const { product_id } = req.body;

  const [prod] = await pool.query(
    'SELECT id FROM products WHERE id = ? AND is_active = 1', [product_id]
  );
  if (!prod.length) {
    return res.status(404).json({ success: false, message: 'Artwork not found' });
  }

  await pool.query(
    'INSERT IGNORE INTO wishlists (user_id, product_id) VALUES (?, ?)',
    [req.user.id, product_id]
  );
  res.status(201).json({ success: true, message: 'Added to wishlist' });
});

// ── DELETE /api/wishlist/:productId ─────────────────────────
exports.removeFromWishlist = asyncHandler(async (req, res) => {
  await pool.query(
    'DELETE FROM wishlists WHERE user_id = ? AND product_id = ?',
    [req.user.id, req.params.productId]
  );
  res.json({ success: true, message: 'Removed from wishlist' });
});

// ── GET /api/wishlist/check/:productId ──────────────────────
exports.checkWishlist = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id FROM wishlists WHERE user_id = ? AND product_id = ?',
    [req.user.id, req.params.productId]
  );
  res.json({ success: true, inWishlist: rows.length > 0 });
});
