const pool             = require('../config/db');
const { asyncHandler } = require('../middleware/error');
const { configureAuction } = require('../utils/auctionService');

// ── GET /api/admin/stats ─────────────────────────────────────
exports.getDashboardStats = asyncHandler(async (req, res) => {
  const [[revenue]]  = await pool.query("SELECT COALESCE(SUM(total_amount),0) AS total FROM orders WHERE status NOT IN ('cancelled','returned')");
  const [[products]] = await pool.query('SELECT COUNT(*) AS total FROM products WHERE is_active=1');
  const [[users]]    = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role='collector' AND is_active=1");
  const [[orders]]   = await pool.query("SELECT COUNT(*) AS total FROM orders WHERE status NOT IN('delivered','cancelled')");
  const [monthly]    = await pool.query(`SELECT DATE_FORMAT(placed_at,'%Y-%m') AS month,SUM(total_amount) AS revenue,COUNT(*) AS order_count FROM orders WHERE status NOT IN ('cancelled','returned') AND placed_at>=DATE_SUB(NOW(),INTERVAL 12 MONTH) GROUP BY month ORDER BY month ASC`);
  const [topProducts]= await pool.query(`SELECT p.title,SUM(oi.quantity) AS units_sold,SUM(oi.quantity*oi.unit_price) AS revenue FROM order_items oi JOIN products p ON oi.product_id=p.id JOIN orders o ON oi.order_id=o.id WHERE o.status NOT IN ('cancelled','returned') GROUP BY p.id ORDER BY revenue DESC LIMIT 5`);
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
  const pageNumber=Math.max(1,Number.parseInt(page,10)||1); const limitNumber=Math.min(100,Math.max(1,Number.parseInt(limit,10)||20));
  const offset=(pageNumber-1)*limitNumber; let where='WHERE 1=1'; const params=[];
  if (role)   { where+=' AND role=?'; params.push(role); }
  if (search) { where+=' AND (name LIKE ? OR email LIKE ?)'; params.push(`%${search}%`,`%${search}%`); }
  const [[{total}]] = await pool.query(`SELECT COUNT(*) AS total FROM users ${where}`,params);
  const [users]     = await pool.query(`SELECT id,name,email,role,is_active,created_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,[...params,limitNumber,offset]);
  res.json({ success:true, total, users });
});

// ── PUT /api/admin/users/:id ─────────────────────────────────
exports.updateUser = asyncHandler(async (req, res) => {
  const { role, is_active } = req.body;
  const updates=[]; const values=[];
  if (role      !==undefined){updates.push('role=?');      values.push(role);}
  if (is_active !==undefined){updates.push('is_active=?'); values.push(is_active?1:0);}
  if (!updates.length) return res.status(400).json({success:false,message:'Nothing to update'});
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[user]] = await conn.query('SELECT id,name,role FROM users WHERE id=? FOR UPDATE',[req.params.id]);
    if (!user) {
      await conn.rollback();
      return res.status(404).json({success:false,message:'User not found'});
    }
    values.push(req.params.id);
    await conn.query(`UPDATE users SET ${updates.join(',')} WHERE id=?`,values);

    let artistProfileCreated = false;
    if (role === 'artist') {
      const [[profile]] = await conn.query('SELECT id FROM artists WHERE user_id=? FOR UPDATE',[user.id]);
      if (!profile) {
        await conn.query('INSERT INTO artists (user_id,name) VALUES (?,?)',[user.id,user.name]);
        artistProfileCreated = true;
      }
    }
    await conn.commit();
    res.json({success:true,message:'User updated',artist_profile_created:artistProfileCreated});
  } catch (error) {
    await conn.rollback(); throw error;
  } finally { conn.release(); }
});

// ── GET /api/admin/orders ────────────────────────────────────
exports.getAllOrders = asyncHandler(async (req, res) => {
  const { status, page=1, limit=15 } = req.query;
  const pageNumber=Math.max(1,Number.parseInt(page,10)||1); const limitNumber=Math.min(100,Math.max(1,Number.parseInt(limit,10)||15));
  const offset=(pageNumber-1)*limitNumber; let where='WHERE 1=1'; const params=[];
  if (status){where+=' AND o.status=?'; params.push(status);}
  const [[{total}]] = await pool.query(`SELECT COUNT(*) AS total FROM orders o ${where}`,params);
  const [orders]    = await pool.query(`SELECT o.*,u.name AS collector_name,u.email AS collector_email FROM orders o JOIN users u ON o.user_id=u.id ${where} ORDER BY o.placed_at DESC LIMIT ? OFFSET ?`,[...params,limitNumber,offset]);
  res.json({success:true,total,orders});
});

// ── GET /api/admin/products ──────────────────────────────────
exports.getAdminProducts = asyncHandler(async (req, res) => {
  const { search, page=1, limit=15 } = req.query;
  const pageNumber=Math.max(1,Number.parseInt(page,10)||1); const limitNumber=Math.min(100,Math.max(1,Number.parseInt(limit,10)||15));
  const offset=(pageNumber-1)*limitNumber; let where='WHERE 1=1'; const params=[];
  if (search){where+=' AND (p.title LIKE ? OR a.name LIKE ? OR p.medium LIKE ?)'; params.push(`%${search}%`,`%${search}%`,`%${search}%`);}
  const [[{total}]] = await pool.query(`SELECT COUNT(*) AS total FROM products p JOIN artists a ON p.artist_id=a.id ${where}`,params);
  const [products]  = await pool.query(
    `SELECT p.*,a.name AS artist_name,c.name AS category_name,
            au.starting_price AS auction_starting_price,au.reserve_price,au.deposit_amount,au.payment_window_hours,
            au.second_chance_window_hours,au.current_bid,au.minimum_increment,
            au.starts_at,au.ends_at,au.status AS auction_status
     FROM products p JOIN artists a ON p.artist_id=a.id JOIN categories c ON p.category_id=c.id
     LEFT JOIN auctions au ON au.product_id=p.id
     ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params,limitNumber,offset]
  );
  res.json({success:true,total,products});
});

// ── POST /api/admin/products ─────────────────────────────────
exports.createProduct = asyncHandler(async (req, res) => {
  const { title, description, artist_id, category_id, medium, dimensions, year, price, stock=1, is_featured=false, tag, image_url, sale_type='fixed' } = req.body;
  if (!title||!artist_id||!category_id||!price) return res.status(400).json({success:false,message:'title, artist_id, category_id and price are required'});
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')+'-'+Date.now();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO products (title,slug,description,artist_id,category_id,medium,dimensions,year,price,stock,is_featured,tag,image_url,sale_type) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'fixed')`,
      [title,slug,description||null,artist_id,category_id,medium||null,dimensions||null,year||null,price,stock,is_featured?1:0,tag||null,image_url||null]
    );
    await configureAuction(conn, result.insertId, sale_type, req.body);
    const [rows] = await conn.query('SELECT * FROM products WHERE id=?',[result.insertId]);
    await conn.commit();
    res.status(201).json({success:true,product:rows[0]});
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

// ── PUT /api/admin/products/:id ─────────────────────────────
exports.updateProduct = asyncHandler(async (req, res) => {
  const { title, price, stock, artist_id, category_id, medium, dimensions, year, is_featured, tag, description, image_url } = req.body;
  const updates=[]; const values=[];
  if (title       !==undefined){updates.push('title=?');       values.push(title);}
  if (price       !==undefined){updates.push('price=?');       values.push(price);}
  if (stock       !==undefined){updates.push('stock=?');       values.push(stock);}
  if (artist_id   !==undefined){updates.push('artist_id=?');   values.push(artist_id);}
  if (category_id !==undefined){updates.push('category_id=?'); values.push(category_id);}
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
  const hasAuctionChanges = ['sale_type','auction_starting_price','reserve_price','deposit_amount','payment_window_hours','second_chance_window_hours','minimum_increment','starts_at','ends_at']
    .some((field) => req.body[field] !== undefined);
  if (!updates.length && !hasAuctionChanges) return res.status(400).json({success:false,message:'Nothing to update'});
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[product]] = await conn.query('SELECT id,sale_type FROM products WHERE id=? FOR UPDATE',[req.params.id]);
    if (!product) {
      await conn.rollback();
      return res.status(404).json({success:false,message:'Artwork not found'});
    }
    if (updates.length) {
      values.push(req.params.id);
      await conn.query(`UPDATE products SET ${updates.join(',')} WHERE id=?`,values);
    }
    if (hasAuctionChanges) await configureAuction(conn, req.params.id, req.body.sale_type || product.sale_type, req.body);
    const [rows] = await conn.query('SELECT * FROM products WHERE id=?',[req.params.id]);
    await conn.commit();
    res.json({success:true,product:rows[0]});
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

// ── DELETE /api/admin/products/:id ──────────────────────────
exports.deleteProduct = asyncHandler(async (req, res) => {
  const [[auction]] = await pool.query(
    `SELECT au.status,au.current_bid FROM auctions au WHERE au.product_id=?`,
    [req.params.id]
  );
  if (auction?.current_bid != null && ['scheduled','active'].includes(auction.status)) {
    return res.status(409).json({success:false,message:'An auction with bids cannot be removed while active'});
  }
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
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (user_id) {
      const [[linked]] = await conn.query('SELECT id FROM artists WHERE user_id=? FOR UPDATE',[user_id]);
      if (linked) {
        await conn.rollback();
        return res.status(409).json({success:false,message:'That user is already linked to an artist profile'});
      }
    }
    const [result] = await conn.query(
      'INSERT INTO artists (name,bio,location,website,user_id) VALUES (?,?,?,?,?)',
      [name, bio||null, location||null, website||null, user_id||null]
    );
    if (user_id) await conn.query("UPDATE users SET role='artist' WHERE id=? AND role<>'admin'", [user_id]);
    const [rows] = await conn.query('SELECT * FROM artists WHERE id=?',[result.insertId]);
    await conn.commit();
    res.status(201).json({success:true,artist:rows[0]});
  } catch (error) {
    await conn.rollback(); throw error;
  } finally { conn.release(); }
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
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[current]] = await conn.query('SELECT id,user_id FROM artists WHERE id=? FOR UPDATE',[req.params.id]);
    if (!current) {
      await conn.rollback();
      return res.status(404).json({success:false,message:'Artist not found'});
    }
    if (user_id) {
      const [[linked]] = await conn.query('SELECT id FROM artists WHERE user_id=? AND id<>? FOR UPDATE',[user_id,req.params.id]);
      if (linked) {
        await conn.rollback();
        return res.status(409).json({success:false,message:'That user is already linked to another artist profile'});
      }
    }
    values.push(req.params.id);
    await conn.query(`UPDATE artists SET ${updates.join(',')} WHERE id=?`,values);
    if (user_id) await conn.query("UPDATE users SET role='artist' WHERE id=? AND role<>'admin'", [user_id]);
    if (user_id !== undefined && current.user_id && String(current.user_id) !== String(user_id || '')) {
      const [[{ linked_count }]] = await conn.query('SELECT COUNT(*) AS linked_count FROM artists WHERE user_id=?',[current.user_id]);
      if (!linked_count) await conn.query("UPDATE users SET role='collector' WHERE id=? AND role='artist'",[current.user_id]);
    }
    const [rows] = await conn.query('SELECT * FROM artists WHERE id=?',[req.params.id]);
    await conn.commit();
    res.json({success:true,artist:rows[0]});
  } catch (error) {
    await conn.rollback(); throw error;
  } finally { conn.release(); }
});

// ── DELETE /api/admin/artists/:id ───────────────────────────
exports.deleteArtist = asyncHandler(async (req, res) => {
  const [[{cnt}]] = await pool.query('SELECT COUNT(*) AS cnt FROM products WHERE artist_id=?',[req.params.id]);
  if (cnt>0) return res.status(400).json({success:false,message:`Cannot delete — artist is referenced by ${cnt} artwork(s).`});
  const [result] = await pool.query('DELETE FROM artists WHERE id=?',[req.params.id]);
  if (!result.affectedRows) return res.status(404).json({success:false,message:'Artist not found'});
  res.json({success:true,message:'Artist deleted'});
});

// ── GET /api/admin/categories ────────────────────────────────
exports.getCategories = asyncHandler(async (req, res) => {
  const [cats] = await pool.query('SELECT * FROM categories ORDER BY name');
  res.json({success:true,categories:cats});
});
