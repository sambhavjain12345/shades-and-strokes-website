const pool             = require('../config/db');
const { asyncHandler } = require('../middleware/error');

// ── Helpers ──────────────────────────────────────────────────
const slugify = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// ── GET /api/products ────────────────────────────────────────
// Query params: category, artist_id, featured, search, sort, page, limit
exports.getProducts = asyncHandler(async (req, res) => {
  const {
    category,
    artist_id,
    featured,
    search,
    sort    = 'created_at_desc',
    page    = 1,
    limit   = 12,
    min_price,
    max_price,
  } = req.query;

  const offset = (Math.max(1, page) - 1) * limit;
  const params = [];
  let   where  = 'WHERE p.is_active = 1';

  if (category)   { where += ' AND c.slug = ?';        params.push(category); }
  if (artist_id)  { where += ' AND p.artist_id = ?';   params.push(artist_id); }
  if (featured)   { where += ' AND p.is_featured = 1'; }
  if (min_price)  { where += ' AND p.price >= ?';       params.push(min_price); }
  if (max_price)  { where += ' AND p.price <= ?';       params.push(max_price); }
  if (search)     {
    where += ' AND (p.title LIKE ? OR p.medium LIKE ? OR a.name LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const sortMap = {
    price_asc:       'p.price ASC',
    price_desc:      'p.price DESC',
    newest:          'p.created_at DESC',
    oldest:          'p.created_at ASC',
    created_at_desc: 'p.created_at DESC',
  };
  const orderBy = sortMap[sort] || 'p.created_at DESC';

  const baseSQL = `
    FROM products p
    JOIN artists    a ON p.artist_id   = a.id
    JOIN categories c ON p.category_id = c.id
    ${where}
  `;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total ${baseSQL}`,
    params
  );

  const [products] = await pool.query(
    `SELECT
       p.id, p.title, p.slug, p.price, p.stock, p.is_featured, p.tag,
       p.image_url, p.medium, p.dimensions, p.year, p.created_at,
       a.id AS artist_id, a.name AS artist_name,
       c.id AS category_id, c.name AS category_name, c.slug AS category_slug
     ${baseSQL}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  res.json({
    success: true,
    total,
    page:    Number(page),
    pages:   Math.ceil(total / limit),
    products,
  });
});

// ── GET /api/products/:id ────────────────────────────────────
exports.getProduct = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT
       p.*,
       a.name AS artist_name, a.bio AS artist_bio,
       a.location AS artist_location, a.avatar_url AS artist_avatar,
       c.name AS category_name, c.slug AS category_slug,
       COALESCE(AVG(r.rating), 0)  AS avg_rating,
       COUNT(r.id)                 AS review_count
     FROM products p
     JOIN artists    a ON p.artist_id   = a.id
     JOIN categories c ON p.category_id = c.id
     LEFT JOIN reviews r ON r.product_id = p.id
     WHERE p.id = ? AND p.is_active = 1
     GROUP BY p.id`,
    [req.params.id]
  );

  if (!rows.length) {
    return res.status(404).json({ success: false, message: 'Artwork not found' });
  }

  // Fetch reviews separately
  const [reviews] = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.created_at,
            u.name AS reviewer_name
     FROM reviews r
     JOIN users u ON r.user_id = u.id
     WHERE r.product_id = ?
     ORDER BY r.created_at DESC LIMIT 20`,
    [req.params.id]
  );

  res.json({ success: true, product: { ...rows[0], reviews } });
});

// ── POST /api/products  (admin / artist) ─────────────────────
exports.createProduct = asyncHandler(async (req, res) => {
  const {
    title, description, artist_id, category_id,
    medium, dimensions, year, edition, price,
    stock = 1, is_featured = false, tag, image_url,
  } = req.body;

  let slug = slugify(title);
  const [[{ cnt }]] = await pool.query(
    'SELECT COUNT(*) AS cnt FROM products WHERE slug LIKE ?', [`${slug}%`]
  );
  if (cnt) slug = `${slug}-${cnt + 1}`;

  const [result] = await pool.query(
    `INSERT INTO products
       (title, slug, description, artist_id, category_id, medium, dimensions,
        year, edition, price, stock, is_featured, tag, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, slug, description, artist_id, category_id,
     medium, dimensions, year, edition, price,
     stock, is_featured ? 1 : 0, tag, image_url]
  );

  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, product: rows[0] });
});

// ── PUT /api/products/:id  (admin / artist) ──────────────────
exports.updateProduct = asyncHandler(async (req, res) => {
  const [exists] = await pool.query(
    'SELECT id FROM products WHERE id = ?', [req.params.id]
  );
  if (!exists.length) {
    return res.status(404).json({ success: false, message: 'Artwork not found' });
  }

  const fields = [
    'title','description','category_id','medium','dimensions',
    'year','edition','price','stock','is_featured','tag','image_url',
  ];
  const updates = [];
  const values  = [];

  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  });

  if (!updates.length) {
    return res.status(400).json({ success: false, message: 'No fields to update' });
  }

  values.push(req.params.id);
  await pool.query(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`, values);

  const [rows] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
  res.json({ success: true, product: rows[0] });
});

// ── DELETE /api/products/:id  (admin) ───────────────────────
exports.deleteProduct = asyncHandler(async (req, res) => {
  const [exists] = await pool.query('SELECT id FROM products WHERE id = ?', [req.params.id]);
  if (!exists.length) {
    return res.status(404).json({ success: false, message: 'Artwork not found' });
  }
  // Soft delete
  await pool.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
  res.json({ success: true, message: 'Artwork removed from gallery' });
});

// ── GET /api/products/:id/reviews ───────────────────────────
exports.getReviews = asyncHandler(async (req, res) => {
  const [reviews] = await pool.query(
    `SELECT r.*, u.name AS reviewer_name
     FROM reviews r JOIN users u ON r.user_id = u.id
     WHERE r.product_id = ? ORDER BY r.created_at DESC`,
    [req.params.id]
  );
  res.json({ success: true, reviews });
});

// ── POST /api/products/:id/reviews ──────────────────────────
exports.addReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  const [result] = await pool.query(
    'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
    [req.params.id, req.user.id, rating, comment]
  );
  const [rows] = await pool.query('SELECT * FROM reviews WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, review: rows[0] });
});

// ── GET /api/products/stats/public ──────────────────────────
exports.getPublicStats = asyncHandler(async (req, res) => {
  const [[{ total_products }]] = await pool.query('SELECT COUNT(*) AS total_products FROM products WHERE is_active=1');
  const [[{ total_artists }]]  = await pool.query('SELECT COUNT(*) AS total_artists FROM artists');
  const [[{ total_orders }]]   = await pool.query("SELECT COUNT(*) AS total_orders FROM orders WHERE status='delivered'");
  res.json({ success: true, stats: { total_products, total_artists, total_orders } });
});

// ── GET /api/categories ──────────────────────────────────────
exports.getCategories = asyncHandler(async (req, res) => {
  const [cats] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json({ success: true, categories: cats });
});
