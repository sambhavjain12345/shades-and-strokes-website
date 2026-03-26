// controllers/artistController.js
const pool             = require('../config/db');
const { asyncHandler } = require('../middleware/error');

// ── Helper: get artist row for logged-in user ─────────────────
const getArtistForUser = async (userId) => {
  const [rows] = await pool.query('SELECT * FROM artists WHERE user_id = ?', [userId]);
  return rows[0] || null;
};

// ── GET /api/artist/me ────────────────────────────────────────
// Returns the artist profile linked to the logged-in user
exports.getMe = asyncHandler(async (req, res) => {
  const artist = await getArtistForUser(req.user.id);
  if (!artist) {
    return res.status(404).json({
      success: false,
      message: 'No artist profile linked to your account. Contact admin.'
    });
  }
  res.json({ success: true, artist });
});

// ── GET /api/artist/stats ─────────────────────────────────────
exports.getStats = asyncHandler(async (req, res) => {
  const artist = await getArtistForUser(req.user.id);
  if (!artist) return res.status(404).json({ success: false, message: 'Artist profile not found' });

  const [[{ total_artworks }]] = await pool.query(
    'SELECT COUNT(*) AS total_artworks FROM products WHERE artist_id = ? AND is_active = 1',
    [artist.id]
  );
  const [[{ total_sold }]] = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity), 0) AS total_sold
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE p.artist_id = ?`,
    [artist.id]
  );
  const [[{ total_revenue }]] = await pool.query(
    `SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS total_revenue
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     JOIN orders o ON oi.order_id = o.id
     WHERE p.artist_id = ? AND o.status != 'cancelled'`,
    [artist.id]
  );
  const [monthly] = await pool.query(
    `SELECT DATE_FORMAT(o.placed_at, '%Y-%m') AS month,
            SUM(oi.quantity * oi.unit_price) AS revenue,
            COUNT(DISTINCT o.id) AS orders
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     JOIN orders o ON oi.order_id = o.id
     WHERE p.artist_id = ?
       AND o.status != 'cancelled'
       AND o.placed_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
     GROUP BY month ORDER BY month ASC`,
    [artist.id]
  );

  res.json({
    success: true,
    stats: {
      total_artworks,
      total_sold:    Number(total_sold),
      total_revenue: Number(total_revenue),
    },
    monthly,
    artist,
  });
});

// ── GET /api/artist/artworks ──────────────────────────────────
exports.getArtworks = asyncHandler(async (req, res) => {
  const artist = await getArtistForUser(req.user.id);
  if (!artist) return res.status(404).json({ success: false, message: 'Artist profile not found' });

  const { search, page = 1, limit = 20 } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;
  let where = 'WHERE p.artist_id = ?';
  const params = [artist.id];

  if (search) {
    where += ' AND (p.title LIKE ? OR p.medium LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM products p ${where}`, params
  );
  const [artworks] = await pool.query(
    `SELECT p.*, c.name AS category_name,
            (SELECT COALESCE(SUM(oi.quantity),0) FROM order_items oi WHERE oi.product_id = p.id) AS units_sold,
            (SELECT COALESCE(SUM(oi.quantity * oi.unit_price),0) FROM order_items oi JOIN orders o ON oi.order_id=o.id WHERE oi.product_id=p.id AND o.status!='cancelled') AS revenue
     FROM products p
     JOIN categories c ON p.category_id = c.id
     ${where}
     ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  res.json({ success: true, total, artworks });
});

// ── POST /api/artist/artworks ─────────────────────────────────
exports.createArtwork = asyncHandler(async (req, res) => {
  const artist = await getArtistForUser(req.user.id);
  if (!artist) return res.status(404).json({ success: false, message: 'Artist profile not found' });

  const { title, description, category_id, medium, dimensions, year, price, stock = 1, tag, image_url } = req.body;
  if (!title || !category_id || !price) {
    return res.status(400).json({ success: false, message: 'Title, category and price are required' });
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
  const [result] = await pool.query(
    `INSERT INTO products (title, slug, description, artist_id, category_id, medium, dimensions, year, price, stock, tag, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, slug, description || null, artist.id, category_id, medium || null, dimensions || null, year || null, price, stock, tag || null, image_url || null]
  );

  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, product: rows[0] });
});

// ── PUT /api/artist/artworks/:id ──────────────────────────────
exports.updateArtwork = asyncHandler(async (req, res) => {
  const artist = await getArtistForUser(req.user.id);
  if (!artist) return res.status(404).json({ success: false, message: 'Artist profile not found' });

  // Verify ownership
  const [[prod]] = await pool.query(
    'SELECT id FROM products WHERE id = ? AND artist_id = ?',
    [req.params.id, artist.id]
  );
  if (!prod) return res.status(403).json({ success: false, message: 'You can only edit your own artworks' });

  const { title, description, category_id, medium, dimensions, year, price, stock, tag, image_url } = req.body;
  const updates = []; const values = [];

  if (title       !== undefined) { updates.push('title=?');       values.push(title); }
  if (description !== undefined) { updates.push('description=?'); values.push(description); }
  if (category_id !== undefined) { updates.push('category_id=?'); values.push(category_id); }
  if (medium      !== undefined) { updates.push('medium=?');      values.push(medium); }
  if (dimensions  !== undefined) { updates.push('dimensions=?');  values.push(dimensions); }
  if (year        !== undefined) { updates.push('year=?');        values.push(year); }
  if (price       !== undefined) { updates.push('price=?');       values.push(price); }
  if (stock       !== undefined) { updates.push('stock=?');       values.push(stock); }
  if (tag         !== undefined) { updates.push('tag=?');         values.push(tag); }
  if (image_url !== undefined && image_url !== '') {
    updates.push('image_url=?');
    values.push(image_url === 'CLEAR' ? null : image_url);
  }

  if (!updates.length) return res.status(400).json({ success: false, message: 'Nothing to update' });

  values.push(req.params.id);
  await pool.query(`UPDATE products SET ${updates.join(',')} WHERE id = ?`, values);
  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json({ success: true, product: rows[0] });
});

// ── DELETE /api/artist/artworks/:id ──────────────────────────
exports.deleteArtwork = asyncHandler(async (req, res) => {
  const artist = await getArtistForUser(req.user.id);
  if (!artist) return res.status(404).json({ success: false, message: 'Artist profile not found' });

  // Verify ownership
  const [[prod]] = await pool.query(
    'SELECT id FROM products WHERE id = ? AND artist_id = ?',
    [req.params.id, artist.id]
  );
  if (!prod) return res.status(403).json({ success: false, message: 'You can only remove your own artworks' });

  // Soft delete
  await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Artwork removed from gallery' });
});

// ── GET /api/artist/sales ─────────────────────────────────────
exports.getSales = asyncHandler(async (req, res) => {
  const artist = await getArtistForUser(req.user.id);
  if (!artist) return res.status(404).json({ success: false, message: 'Artist profile not found' });

  const { page = 1, limit = 15 } = req.query;
  const offset = (Math.max(1, page) - 1) * limit;

  // Get orders that contain this artist's artworks
  const [sales] = await pool.query(
    `SELECT
       o.id, o.order_number, o.status, o.placed_at,
       u.name AS collector_name,
       p.title AS artwork_title,
       p.id AS product_id,
       oi.quantity, oi.unit_price,
       (oi.quantity * oi.unit_price) AS earned
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     JOIN orders o ON oi.order_id = o.id
     JOIN users u ON o.user_id = u.id
     WHERE p.artist_id = ?
     ORDER BY o.placed_at DESC
     LIMIT ? OFFSET ?`,
    [artist.id, Number(limit), Number(offset)]
  );

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE p.artist_id = ?`,
    [artist.id]
  );

  res.json({ success: true, total, sales });
});
