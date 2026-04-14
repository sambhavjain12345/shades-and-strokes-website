const pool             = require('../config/db');
const { asyncHandler } = require('../middleware/error');
const { sendOrderConfirmation, sendStatusUpdate } = require('../utils/emailService');

// ── Order number generator ───────────────────────────────────
const genOrderNumber = () => {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `SS-${year}-${rand}`;
};

// ── Helper: sync product is_active based on current stock ────
// If stock = 0  → hide from gallery (is_active = 0)
// If stock > 0  → show in gallery  (is_active = 1)
const syncProductStatus = async (conn, orderId) => {
  const [items] = await conn.query(
    'SELECT product_id FROM order_items WHERE order_id = ?',
    [orderId]
  );
  for (const item of items) {
    const [[prod]] = await conn.query(
      'SELECT stock FROM products WHERE id = ?',
      [item.product_id]
    );
    if (prod) {
      const shouldBeActive = prod.stock > 0 ? 1 : 0;
      await conn.query(
        'UPDATE products SET is_active = ? WHERE id = ?',
        [shouldBeActive, item.product_id]
      );
    }
  }
};

// ── GET /api/orders ──────────────────────────────────────────
exports.getOrders = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;

  let where  = isAdmin ? 'WHERE 1=1' : 'WHERE o.user_id = ?';
  const params = isAdmin ? [] : [req.user.id];

  if (status) { where += ' AND o.status = ?'; params.push(status); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM orders o ${where}`, params
  );

  const [orders] = await pool.query(
    `SELECT
       o.id, o.order_number, o.status, o.total_amount, o.placed_at,
       u.name AS collector_name, u.email AS collector_email,
       (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
     FROM orders o
     JOIN users u ON o.user_id = u.id
     ${where}
     ORDER BY o.placed_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), orders });
});

// ── GET /api/orders/:id ──────────────────────────────────────
exports.getOrder = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT o.*, u.name AS collector_name, u.email AS collector_email
     FROM orders o JOIN users u ON o.user_id = u.id
     WHERE o.id = ?`,
    [req.params.id]
  );
  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const order = rows[0];

  if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorised' });
  }

  const [items] = await pool.query(
    `SELECT oi.*, p.title, p.image_url, a.name AS artist_name
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     JOIN artists  a ON p.artist_id   = a.id
     WHERE oi.order_id = ?`,
    [req.params.id]
  );

  const [timeline] = await pool.query(
    'SELECT * FROM order_timeline WHERE order_id = ? ORDER BY created_at ASC',
    [req.params.id]
  );

  res.json({ success: true, order: { ...order, items, timeline } });
});

// ── POST /api/orders ─────────────────────────────────────────
exports.placeOrder = asyncHandler(async (req, res) => {
  const { items, shipping_name, shipping_addr, shipping_phone, notes } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    let total = 0;
    const enriched = [];

    for (const item of items) {
      const [[prod]] = await conn.query(
        'SELECT id, price, stock, title FROM products WHERE id = ? AND is_active = 1',
        [item.product_id]
      );
      if (!prod) throw Object.assign(new Error(`Artwork ${item.product_id} not found`), { statusCode: 404 });
      if (prod.stock < item.quantity) throw Object.assign(new Error(`"${prod.title}" is out of stock`), { statusCode: 400 });

      total += prod.price * item.quantity;
      enriched.push({ ...item, unit_price: prod.price });
    }

    let orderNumber = genOrderNumber();
    const [orderRes] = await conn.query(
      `INSERT INTO orders (order_number, user_id, status, total_amount,
         shipping_name, shipping_addr, shipping_phone, notes)
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [orderNumber, req.user.id, total, shipping_name, shipping_addr, shipping_phone, notes]
    );
    const orderId = orderRes.insertId;

    for (const item of enriched) {
      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.unit_price]
      );
      await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await conn.query(
      `INSERT INTO order_timeline (order_id, status, description) VALUES (?, 'confirmed', 'Order placed and payment received')`,
      [orderId]
    );
    await conn.query("UPDATE orders SET status = 'confirmed' WHERE id = ?", [orderId]);
    await conn.query('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);

    await conn.commit();

    const [newOrder] = await pool.query('SELECT * FROM orders WHERE id = ?', [orderId]);
    const [emailItems] = await pool.query(
      `SELECT oi.*, p.title, a.name AS artist_name
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       JOIN artists  a ON p.artist_id   = a.id
       WHERE oi.order_id = ?`,
      [orderId]
    );

    sendOrderConfirmation(newOrder[0], emailItems, req.user);
    res.status(201).json({ success: true, order: newOrder[0] });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ── PUT /api/orders/:id/status  (admin) ─────────────────────
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, description } = req.body;
  const validStatuses = ['pending','confirmed','packaging','shipped','delivered','cancelled','return_requested','returned'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const [[order]] = await pool.query('SELECT id FROM orders WHERE id = ?', [req.params.id]);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
  await pool.query(
    'INSERT INTO order_timeline (order_id, status, description) VALUES (?, ?, ?)',
    [req.params.id, status, description || `Order status updated to ${status}`]
  );

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (status === 'delivered') {
      // Stock was already deducted when order was placed.
      // Now check if stock hit 0 → hide product from gallery
      await syncProductStatus(conn, req.params.id);
    }

    if (status === 'cancelled' || status === 'returned') {
      // Restore stock for each item
      const [items] = await conn.query(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
        [req.params.id]
      );
      for (const item of items) {
        await conn.query(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.quantity, item.product_id]
        );
      }
      // Re-activate products now that stock is restored
      await syncProductStatus(conn, req.params.id);
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // Send status update email
  const [orderRows] = await pool.query(
    `SELECT o.*, u.name, u.email FROM orders o JOIN users u ON o.user_id=u.id WHERE o.id=?`,
    [req.params.id]
  );
  if (orderRows.length) {
    const o = orderRows[0];
    sendStatusUpdate(o, { name: o.name, email: o.email }, status);
  }

  res.json({ success: true, message: `Order status updated to '${status}'` });
});

// ── POST /api/orders/:id/return  (collector) ─────────────────
exports.requestReturn = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (order.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorised' });
  }
  if (order.status !== 'delivered') {
    return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
  }

  await pool.query("UPDATE orders SET status = 'return_requested' WHERE id = ?", [req.params.id]);
  await pool.query(
    "INSERT INTO order_timeline (order_id, status, description) VALUES (?, 'return_requested', ?)",
    [req.params.id, reason ? `Return requested: ${reason}` : 'Return requested by customer']
  );

  res.json({ success: true, message: 'Return request submitted successfully' });
});

// ── DELETE /api/orders/:id  (cancel) ────────────────────────
exports.cancelOrder = asyncHandler(async (req, res) => {
  const [[order]] = await pool.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }
  if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
    return res.status(403).json({ success: false, message: 'Not authorised' });
  }
  if (['shipped','delivered'].includes(order.status)) {
    return res.status(400).json({ success: false, message: 'Cannot cancel an order that has already shipped' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Restore stock
    const [items] = await conn.query(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ?',
      [req.params.id]
    );
    for (const item of items) {
      await conn.query(
        'UPDATE products SET stock = stock + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // Re-activate products that were sold out
    await syncProductStatus(conn, req.params.id);

    await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    await conn.query(
      "INSERT INTO order_timeline (order_id, status, description) VALUES (?, 'cancelled', 'Order cancelled — stock restored and listing re-activated')",
      [req.params.id]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  res.json({ success: true, message: 'Order cancelled and artwork relisted in gallery' });
});
