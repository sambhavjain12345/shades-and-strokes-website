const pool             = require('../config/db');
const { asyncHandler } = require('../middleware/error');

// ── GET /api/admin/stats ─────────────────────────────────────
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const [[revenue]]  = await pool.query("SELECT COALESCE(SUM(total_amount),0) AS total FROM orders WHERE status!='cancelled'");
  const [[products]] = await pool.query('SELECT COUNT(*) AS total FROM products WHERE is_active=1');
  const [[users]]    = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role='collector' AND is_active=1");
  const [[orders]]   = await pool.query("SELECT COUNT(*) AS total FROM orders WHERE status NOT IN('delivered','cancelled')");
  const [monthly]    = await pool.query(`SELECT DATE_FORMAT(placed_at,'%Y-%m') AS month,SUM(total_amount) AS revenue,COUNT(*) AS order_count FROM orders WHERE status!='cancelled' AND placed_at>=DATE_SUB(NOW(),INTERVAL 12 MONTH) GROUP BY month ORDER BY month ASC`);
  const [topProducts]= await pool.query(`SELECT p.title,SUM(oi.quantity) AS units_sold,SUM(oi.quantity*oi.unit_price) AS revenue FROM order_items oi JOIN products p ON oi.product_id=p.id GROUP BY p.id ORDER BY revenue DESC LIMIT 5`);
  const [byCategory] = await pool.query(`SELECT c.name,COUNT(p.id) AS count FROM products p JOIN categories c ON p.category_id=c.id WHERE p.is_active=1 GROUP BY c.id`);
  res.json({ success:true, stats:{ total_revenue:parseFloat(revenue.total), active_orders:orders.total, total_products:products.total, total_users:users.total }, monthly_revenue:monthly, top_products:topProducts, by_category:byCategory });
});

// ── GET /api/admin/users/all — for dropdowns ─────────────────
exports.getAllUsers = asyncHandler(async (req, res) => {
  const [users] = await pool.query(
    "SELECT id,name,email,role FROM users WHERE is_active=1 ORDER BY name ASC"
  );
  res.json({ success:true, users });
});

// ── GET /api/admin/users ─────────────────────────────────────
exports.getUsers = asyncHandler(async (req, res) => {
  const { role, search, page=1, limit=20 } = req.query;
  const offset=(Math.max(1,page)-1)*limit; let where='WHERE 1=1'; const params=[];
  if (role)   { where+=' AND role=?'; params.push(role); }
  if (search) { where+=' AND (name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`,`%${search}%`); }
  const [[{total}]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${where}`,params);
  const [users]     = await pool.query(`SELECT id,name,email,role,is_active,created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,[...params,Number(limit),Number(offset)]);
  res.json({ success:true, total, users });
});

// ── PUT /api/admin/users/:id ─────────────────────────────────
exports.updateUser = asyncHandler(async (req, res) => {
  const { role, is_active } = req.body;
  const updates=[]; const values=[];
  if (role      !==undefined){updates.push('role=?');      values.push(role);}
  if (is_active !==undefined){updates.push('is_active=?'); values.push(is_active?1:0);}
  if (!updates.length) return res.status(400).json({success:false,message:'Nothing to update'});
  values.push(req.params.id);
  await pool.query(`UPDATE users SET ${updates.join(',')} WHERE id=?`,values);
  res.json({success:true,message:'User updated'});
});

// ── GET /api/admin/orders ────────────────────────────────────
exports.getAllOrders = asyncHandler(async (req, res) => {
  const { status, page=1, limit=15 } = req.query;
  const offset=(Math.max(1,page)-1)*limit; let where='WHERE 1=1'; const params=[];
  if (status){where+=' AND o.status=?'; params.push(status);}
  const [[{total}]] = await pool.query(`SELECT COUNT(*) AS total FROM orders o ${where}`,params);
  const [orders]    = await pool.query(`SELECT o.*,u.name AS collector_name,u.email AS collector_email FROM orders o JOIN users u ON o.user_id=u.id ${where} ORDER BY o.placed_at DESC LIMIT ? OFFSET ?`,[...params,Number(limit),Number(offset)]);
  res.json({success:true,total,orders});
});

// ── GET /api/admin/products ──────────────────────────────────
exports.getAdminProducts = asyncHandler(async (req, res) => {
  const { search, page=1, limit=15 } = req.query;
  const offset=(Math.max(1,page)-1)*limit; let where='WHERE 1=1'; const params=[];
  if (search){where+=' AND (p.title LIKE ? OR a.name LIKE ? OR p.medium LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`);}
  const [[{total}]] = await pool.query(`SELECT COUNT(*) AS total FROM products p JOIN artists a ON p.artist_id=a.id ${where}`,params);
  const [products]  = await pool.query(
    `SELECT p.id,p.title,p.price,p.stock,p.is_active,p.is_featured,p.medium,p.tag,p.created_at,a.name AS artist_name,c.name AS category_name
     FROM products p JOIN artists a ON p.artist_id=a.id JOIN categories c ON p.category_id=c.id
     ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params,Number(limit),Number(offset)]
  );
  res.json({success:true,total,products});
});

// ── POST /api/admin/products ─────────────────────────────────
exports.createProduct = asyncHandler(async (req, res) => {
  const { title, description, artist_id, category_id, medium, dimensions, year, price, stock=1, is_featured=false, tag, image_url } = req.body;
  if (!title||!artist_id||!category_id||!price) return res.status(400).json({success:false,message:'title, artist_id, category_id and price are required'});
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')+'-'+Date.now();
  const [result] = await pool.query(
    `INSERT INTO products (title,slug,description,artist_id,category_id,medium,dimensions,year,price,stock,is_featured,tag,image_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [title,slug,description||null,artist_id,category_id,medium||null,dimensions||null,year||null,price,stock,is_featured?1:0,tag||null,image_url||null]
  );
  const [rows] = await pool.query('SELECT * FROM products WHERE id=?',[result.insertId]);
  res.status(201).json({success:true,product:rows[0]});
});

// ── PUT /api/admin/products/:id ─────────────────────────────
exports.updateProduct = asyncHandler(async (req, res) => {
  const { title, price, stock, medium, dimensions, year, is_featured, tag, description, image_url } = req.body;
  const updates=[]; const values=[];
  if (title       !==undefined){updates.push('title=?');       values.push(title);}
  if (price       !==undefined){updates.push('price=?');       values.push(price);}
  if (stock       !==undefined){updates.push('stock=?');       values.push(stock);}
  if (medium      !==undefined){updates.push('medium=?');      values.push(medium);}
  if (dimensions  !==undefined){updates.push('dimensions=?');  values.push(dimensions);}
  if (year        !==undefined){updates.push('year=?');        values.push(year);}
  if (is_featured !==undefined){updates.push('is_featured=?'); values.push(is_featured?1:0);}
  if (tag         !==undefined){updates.push('tag=?');         values.push(tag);}
  if (description !==undefined){updates.push('description=?'); values.push(description);}
  // Only update image_url if a non-empty value is provided — never wipe existing image
  // Special value 'CLEAR' explicitly removes the image
  if (image_url !== undefined && image_url !== '') {
    updates.push('image_url=?');
    values.push(image_url === 'CLEAR' ? null : image_url);
  }
  if (!updates.length) return res.status(400).json({success:false,message:'Nothing to update'});
  values.push(req.params.id);
  await pool.query(`UPDATE products SET ${updates.join(',')} WHERE id=?`,values);
  const [rows] = await pool.query('SELECT * FROM products WHERE id=?',[req.params.id]);
  res.json({success:true,product:rows[0]});
});

// ── DELETE /api/admin/products/:id ──────────────────────────
exports.deleteProduct = asyncHandler(async (req, res) => {
  await pool.query('UPDATE products SET is_active=0 WHERE id=?',[req.params.id]);
  res.json({success:true,message:'Artwork removed from gallery'});
});

// ── PUT /api/admin/products/:id/restore ─────────────────────
exports.restoreProduct = asyncHandler(async (req, res) => {
  await pool.query('UPDATE products SET is_active=1 WHERE id=?',[req.params.id]);
  res.json({success:true,message:'Artwork restored'});
});

// ── GET /api/admin/artists ───────────────────────────────────
exports.getArtists = asyncHandler(async (req, res) => {
  const { search } = req.query;
  let where='WHERE 1=1'; const params=[];
  if (search){where+=' AND (a.name LIKE ? OR a.location LIKE ?)'; params.push(`%${search}%`,`%${search}%`);}
  const [artists] = await pool.query(
    `SELECT a.*,COUNT(p.id) AS product_count FROM artists a LEFT JOIN products p ON p.artist_id=a.id AND p.is_active=1 ${where} GROUP BY a.id ORDER BY a.name ASC`,
    params
  );
  res.json({success:true,artists});
});

// ── POST /api/admin/artists ──────────────────────────────────
exports.createArtist = asyncHandler(async (req, res) => {
  const { name, bio, location, website, user_id } = req.body;
  if (!name) return res.status(400).json({success:false,message:'Artist name is required'});

  const [result] = await pool.query(
    'INSERT INTO artists (name,bio,location,website,user_id) VALUES (?,?,?,?,?)',
    [name, bio||null, location||null, website||null, user_id||null]
  );

  // If linked to a user, update their role to 'artist'
  if (user_id) {
    await pool.query("UPDATE users SET role='artist' WHERE id=?", [user_id]);
  }

  const [rows] = await pool.query('SELECT * FROM artists WHERE id=?',[result.insertId]);
  res.status(201).json({success:true,artist:rows[0]});
});

// ── PUT /api/admin/artists/:id ───────────────────────────────
exports.updateArtist = asyncHandler(async (req, res) => {
  const { name, bio, location, website, user_id } = req.body;
  const updates=[]; const values=[];
  if (name     !==undefined){updates.push('name=?');     values.push(name);}
  if (bio      !==undefined){updates.push('bio=?');      values.push(bio);}
  if (location !==undefined){updates.push('location=?'); values.push(location);}
  if (website  !==undefined){updates.push('website=?');  values.push(website);}
  if (user_id  !==undefined){updates.push('user_id=?');  values.push(user_id||null);}
  if (!updates.length) return res.status(400).json({success:false,message:'Nothing to update'});
  values.push(req.params.id);
  await pool.query(`UPDATE artists SET ${updates.join(',')} WHERE id=?`,values);

  // If linking/changing user, update role
  if (user_id !== undefined && user_id) {
    await pool.query("UPDATE users SET role='artist' WHERE id=?", [user_id]);
  }

  const [rows] = await pool.query('SELECT * FROM artists WHERE id=?',[req.params.id]);
  res.json({success:true,artist:rows[0]});
});

// ── DELETE /api/admin/artists/:id ───────────────────────────
exports.deleteArtist = asyncHandler(async (req, res) => {
  const [[{cnt}]] = await pool.query('SELECT COUNT(*) AS cnt FROM products WHERE artist_id=? AND is_active=1',[req.params.id]);
  if (cnt>0) return res.status(400).json({success:false,message:`Cannot delete — artist has ${cnt} active artwork(s). Remove artworks first.`});
  await pool.query('DELETE FROM artists WHERE id=?',[req.params.id]);
  res.json({success:true,message:'Artist deleted'});
});

// ── GET /api/admin/categories ────────────────────────────────
exports.getCategories = asyncHandler(async (req, res) => {
  const [cats] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json({success:true,categories:cats});
});
