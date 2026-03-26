const pool             = require('../config/db');
const { asyncHandler } = require('../middleware/error');

// ── GET /api/cart ────────────────────────────────────────────
exports.getCart = asyncHandler(async (req, res) => {
  const [items] = await pool.query(
    `SELECT
       ci.id, ci.quantity,
       p.id AS product_id, p.title, p.price, p.image_url, p.stock,
       a.name AS artist_name
     FROM cart_items ci
     JOIN products p ON ci.product_id = p.id
     JOIN artists  a ON p.artist_id   = a.id
     WHERE ci.user_id = ? AND p.is_active = 1`,
    [req.user.id]
  );

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  res.json({ success: true, items, subtotal, total: subtotal });
});

// ── POST /api/cart ───────────────────────────────────────────
exports.addToCart = asyncHandler(async (req, res) => {
  const { product_id, quantity = 1 } = req.body;

  // Check product exists and has stock
  const [prod] = await pool.query(
    'SELECT id, stock FROM products WHERE id = ? AND is_active = 1',
    [product_id]
  );
  if (!prod.length) {
    return res.status(404).json({ success: false, message: 'Artwork not found' });
  }
  if (prod[0].stock < quantity) {
    return res.status(400).json({ success: false, message: 'Insufficient stock' });
  }

  // Upsert cart item
  await pool.query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
    [req.user.id, product_id, quantity]
  );

  // Return updated cart
  const [items] = await pool.query(
    `SELECT ci.id, ci.quantity,
            p.id AS product_id, p.title, p.price, p.image_url
     FROM cart_items ci JOIN products p ON ci.product_id = p.id
     WHERE ci.user_id = ?`,
    [req.user.id]
  );
  res.status(201).json({ success: true, items });
});

// ── PUT /api/cart/:id ────────────────────────────────────────
exports.updateCartItem = asyncHandler(async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) {
    return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
  }

  const [item] = await pool.query(
    'SELECT id FROM cart_items WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  if (!item.length) {
    return res.status(404).json({ success: false, message: 'Cart item not found' });
  }

  await pool.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, req.params.id]);
  res.json({ success: true, message: 'Cart updated' });
});

// ── DELETE /api/cart/:id ─────────────────────────────────────
exports.removeCartItem = asyncHandler(async (req, res) => {
  await pool.query(
    'DELETE FROM cart_items WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );
  res.json({ success: true, message: 'Item removed from cart' });
});

// ── DELETE /api/cart ─────────────────────────────────────────
exports.clearCart = asyncHandler(async (req, res) => {
  await pool.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
  res.json({ success: true, message: 'Cart cleared' });
});
