const pool             = require('../config/db');
const { asyncHandler } = require('../middleware/error');
const { sendOrderConfirmation, sendStatusUpdate } = require('../utils/emailService');

// ── Order number generator ───────────────────────────────────
const genOrderNumber = () => {
  const year = new Date().getFullYear();
  const rand = String(Math.floor(Math.random() * 90000) + 10000);
  return `SS-${year}-${rand}`;
};

const STATUS_TRANSITIONS = {
  pending:          ['confirmed', 'packaging', 'shipped', 'delivered', 'cancelled'],
  confirmed:        ['packaging', 'shipped', 'delivered', 'cancelled'],
  packaging:        ['shipped', 'delivered', 'cancelled'],
  shipped:          ['delivered'],
  delivered:        ['return_requested'],
  return_requested: ['delivered', 'returned'],
  cancelled:        [],
  returned:         [],
};

// ── GET /api/orders ──────────────────────────────────────────
exports.getOrders = asyncHandler(async (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const { status, page = 1, limit = 10 } = req.query;
  const pageNumber  = Math.max(1, Number.parseInt(page, 10) || 1);
  const limitNumber = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 10));
  const offset = (pageNumber - 1) * limitNumber;

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
    [...params, limitNumber, offset]
  );

  res.json({ success: true, total, page: pageNumber, pages: Math.ceil(total / limitNumber), orders });
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
    const requestedItems = new Map();

    // Collapse duplicate product rows so one request cannot bypass stock checks.
    for (const item of items) {
      requestedItems.set(
        Number(item.product_id),
        (requestedItems.get(Number(item.product_id)) || 0) + Number(item.quantity)
      );
    }

    for (const [product_id, quantity] of requestedItems) {
      const [[prod]] = await conn.query(
        "SELECT id, price, stock, title, sale_type FROM products WHERE id = ? AND is_active = 1 FOR UPDATE",
        [product_id]
      );
      if (!prod) throw Object.assign(new Error(`Artwork ${product_id} not found`), { statusCode: 404 });
      if (prod.sale_type === 'auction') throw Object.assign(new Error(`"${prod.title}" is only available by auction`), { statusCode: 400 });
      if (prod.stock < quantity) throw Object.assign(new Error(`Not enough stock is available for "${prod.title}"`), { statusCode: 400 });

      total += Number(prod.price) * quantity;
      enriched.push({ product_id, quantity, unit_price: prod.price });
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
      const [stockUpdate] = await conn.query(
        'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
        [item.quantity, item.product_id, item.quantity]
      );
      if (stockUpdate.affectedRows !== 1) {
        throw Object.assign(new Error('Stock changed while placing the order. Please review your cart.'), { statusCode: 409 });
      }
      await conn.query(
        'DELETE FROM cart_items WHERE user_id = ? AND product_id = ?',
        [req.user.id, item.product_id]
      );
    }

    await conn.query(
      `INSERT INTO order_timeline (order_id, status, description) VALUES (?, 'confirmed', 'Order placed and payment received')`,
      [orderId]
    );
    await conn.query("UPDATE orders SET status = 'confirmed' WHERE id = ?", [orderId]);
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
  const validStatuses = Object.keys(STATUS_TRANSITIONS);

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[order]] = await conn.query(
      'SELECT id, status, order_type FROM orders WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status === status) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Order is already '${status}'` });
    }

    if (order.order_type === 'auction' && status === 'cancelled') {
      await conn.rollback();
      return res.status(409).json({ success:false, message:'Completed auction purchases cannot be cancelled through the standard order flow' });
    }

    if (!STATUS_TRANSITIONS[order.status]?.includes(status)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: `Cannot change order status from '${order.status}' to '${status}'`,
      });
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
    }

    await conn.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    await conn.query(
      'INSERT INTO order_timeline (order_id, status, description) VALUES (?, ?, ?)',
      [req.params.id, status, description || `Order status updated to ${status}`]
    );

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
    sendStatusUpdate(o, { name: o.name, email: o.email }, status).catch(err => console.error('Status email failed:', err.message));
  }

  res.json({ success: true, message: `Order status updated to '${status}'` });
});

// ── POST /api/orders/:id/return  (collector) ─────────────────
exports.requestReturn = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const [[order]] = await conn.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (order.user_id !== req.user.id) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }
    if (order.status !== 'delivered') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
    }

    await conn.query("UPDATE orders SET status = 'return_requested' WHERE id = ?", [req.params.id]);
    await conn.query(
      "INSERT INTO order_timeline (order_id, status, description) VALUES (?, 'return_requested', ?)",
      [req.params.id, reason ? `Return requested: ${reason}` : 'Return requested by customer']
    );
    await conn.commit();
    res.json({ success: true, message: 'Return request submitted successfully' });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
});

// ── DELETE /api/orders/:id  (cancel) ────────────────────────
exports.cancelOrder = asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[order]] = await conn.query(
      'SELECT * FROM orders WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!order) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    if (req.user.role !== 'admin' && order.user_id !== req.user.id) {
      await conn.rollback();
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }
    if (!['pending', 'confirmed', 'packaging'].includes(order.status)) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: order.status === 'cancelled'
          ? 'Order is already cancelled'
          : 'This order can no longer be cancelled',
      });
    }
    if (order.order_type === 'auction') {
      await conn.rollback();
      return res.status(409).json({ success:false, message:'Completed auction purchases cannot be cancelled through the standard order flow' });
    }

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

    await conn.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [req.params.id]);
    await conn.query(
      "INSERT INTO order_timeline (order_id, status, description) VALUES (?, 'cancelled', 'Order cancelled — stock restored')",
      [req.params.id]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const [[cancelled]] = await pool.query(`SELECT o.*,u.name,u.email FROM orders o JOIN users u ON u.id=o.user_id WHERE o.id=?`,[req.params.id]);
  if(cancelled)sendStatusUpdate(cancelled,{name:cancelled.name,email:cancelled.email},'cancelled').catch(err=>console.error('Cancellation email failed:',err.message));

  res.json({ success: true, message: 'Order cancelled and stock restored' });
});
