// utils/seedDB.js — run: node utils/seedDB.js
const bcrypt = require('bcryptjs');
const pool   = require('../config/db');
require('dotenv').config();

async function seed() {
  console.log('🌱  Seeding database...');

  // ── Categories ──────────────────────────────────────────────
  await pool.query(`
    INSERT IGNORE INTO categories (name, slug) VALUES
      ('Paintings',    'paintings'),
      ('Sculptures',   'sculptures'),
      ('Sketches',     'sketches'),
      ('Watercolours', 'watercolours'),
      ('Photography',  'photography'),
      ('Mixed Media',  'mixed-media'),
      ('Prints',       'prints')
  `);
  console.log('   ✓ categories');

  // ── Admin user ──────────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 12);
  await pool.query(`
    INSERT IGNORE INTO users (name, email, password_hash, role) VALUES
      ('Admin User',    'admin@shadesstrokes.com',  '${adminHash}', 'admin'),
      ('Rohan Kapoor',  'rohan@example.com',         '${await bcrypt.hash('test123', 12)}', 'collector'),
      ('Priya Mehta',   'priya@example.com',         '${await bcrypt.hash('test123', 12)}', 'collector'),
      ('Aditi Shah',    'aditi@example.com',         '${await bcrypt.hash('test123', 12)}', 'collector')
  `);
  console.log('   ✓ users');

  // ── Artists ─────────────────────────────────────────────────
  await pool.query(`
    INSERT IGNORE INTO artists (name, bio, location) VALUES
      ('Arjun Sharma',  'Works in the tradition of expressive oil painting, drawing from the landscapes of western India. Exhibited across Mumbai, Delhi, and Berlin.', 'Mumbai, India'),
      ('Kavya Nair',    'Watercolour artist known for botanically inspired works and coastal studies. Based in Kerala, she has shown in Singapore and London.', 'Kerala, India'),
      ('Rohan Das',     'Mixed media practitioner exploring urban memory and cultural identity. MFA from Baroda, now working from Delhi.', 'Delhi, India'),
      ('Meera Pillai',  'Sculptor working primarily in bronze and reclaimed wood. Her work explores feminine power in South Asian mythology.', 'Bangalore, India'),
      ('Vikram Sood',   'Charcoal and graphite artist with a background in architecture. His sketches document disappearing urban fabric across India.', 'Jaipur, India')
  `);
  console.log('   ✓ artists');

  // ── Products ────────────────────────────────────────────────
  await pool.query(`
    INSERT IGNORE INTO products
      (title, slug, description, artist_id, category_id, medium, dimensions, year, price, stock, is_featured, tag)
    VALUES
      ('Molten Hour',      'molten-hour',      'A study in amber and burnt sienna — the painter''s meditation on the hour before dusk.',         1, 1, 'Oil on Canvas',    '90 × 120 cm', 2024, 52000.00, 1, 1, 'Featured'),
      ('Cerulean Deep',    'cerulean-deep',    'Layers of translucent acrylic build a world beneath water — silent and luminous.',               1, 1, 'Acrylic',           '60 × 80 cm',  2023, 28500.00, 1, 0, NULL),
      ('Emerald Hush',     'emerald-hush',     'A watercolour capturing the stillness of a Kerala backwater at first light.',                   2, 4, 'Watercolour',       '40 × 55 cm',  2024, 14000.00, 1, 0, 'New'),
      ('Crimson Quiet',    'crimson-quiet',    'Oil on board — the memory of a room left in a hurry, warmth fading from the walls.',            3, 1, 'Oil on Board',      '50 × 70 cm',  2023, 19000.00, 1, 0, NULL),
      ('Violet Reverie',   'violet-reverie',   'Mixed media on paper — purple pigment, ink wash, and found text from a 1960s Bombay gazette.',  3, 6, 'Mixed Media',       '70 × 90 cm',  2024, 22000.00, 1, 0, NULL),
      ('Amber Dusk',       'amber-dusk',       'The golden hour rendered in oil — a scene from the Thar desert at sunset.',                     1, 1, 'Oil on Canvas',     '75 × 100 cm', 2024, 38000.00, 1, 1, 'Featured'),
      ('Midnight Drift',   'midnight-drift',   'Charcoal on cotton rag — a figure dissolving into the geometry of a sleeping city.',            5, 3, 'Charcoal',          '50 × 65 cm',  2023, 12000.00, 1, 0, NULL),
      ('Dusk Reverie',     'dusk-reverie',     'Wet-on-wet watercolour, the coast of Goa as memory rather than place.',                        2, 4, 'Watercolour',       '35 × 50 cm',  2024, 16500.00, 1, 0, 'New'),
      ('Silent Grove',     'silent-grove',     'Acrylic impasto — dense greens and shadows, a forest interior that breathes.',                  1, 1, 'Acrylic',           '80 × 100 cm', 2023, 31000.00, 1, 0, NULL),
      ('Bronze Ancestor',  'bronze-ancestor',  'Cast bronze sculpture exploring matrilineal memory in South Indian mythology.',                 4, 2, 'Bronze',            '28 × 12 cm',  2022, 65000.00, 1, 1, 'Featured'),
      ('Paper City',       'paper-city',       'Graphite on Fabriano — the skeleton of a city that no longer exists.',                         5, 3, 'Graphite',          '45 × 60 cm',  2024, 9500.00,  2, 0, NULL),
      ('Ochre Plains',     'ochre-plains',     'Large-format oil on linen capturing the chromatic flatness of Rajasthan from above.',           1, 1, 'Oil on Linen',      '120 × 150 cm',2024, 78000.00, 1, 1, 'New')
  `);
  console.log('   ✓ products');

  // ── Sample orders ────────────────────────────────────────────
  await pool.query(`
    INSERT IGNORE INTO orders
      (order_number, user_id, status, total_amount, shipping_name, shipping_addr, shipping_phone)
    VALUES
      ('SS-2024-0042', 2, 'shipped',   52000.00, 'Rohan Kapoor', '14 Marine Drive, Churchgate, Mumbai 400020', '+91 98765 43210'),
      ('SS-2024-0031', 3, 'delivered', 28500.00, 'Priya Mehta',  '22 DLF Phase 2, Gurugram 122002',           '+91 87654 32109'),
      ('SS-2024-0018', 4, 'confirmed', 14000.00, 'Aditi Shah',   '5 Koregaon Park, Pune 411001',              '+91 76543 21098')
  `);

  await pool.query(`
    INSERT IGNORE INTO order_items (order_id, product_id, quantity, unit_price)
    SELECT o.id, 1, 1, 52000.00 FROM orders o WHERE o.order_number = 'SS-2024-0042'
    UNION ALL
    SELECT o.id, 2, 1, 28500.00 FROM orders o WHERE o.order_number = 'SS-2024-0031'
    UNION ALL
    SELECT o.id, 3, 1, 14000.00 FROM orders o WHERE o.order_number = 'SS-2024-0018'
  `);

  // Timeline entries
  await pool.query(`
    INSERT IGNORE INTO order_timeline (order_id, status, description)
    SELECT o.id, 'confirmed',  'Order placed and payment received'  FROM orders o WHERE o.order_number = 'SS-2024-0042'
    UNION ALL
    SELECT o.id, 'packaging',  'Artwork authenticated and packaged'  FROM orders o WHERE o.order_number = 'SS-2024-0042'
    UNION ALL
    SELECT o.id, 'shipped',    'Shipped via white-glove courier'     FROM orders o WHERE o.order_number = 'SS-2024-0042'
    UNION ALL
    SELECT o.id, 'confirmed',  'Order placed and payment received'  FROM orders o WHERE o.order_number = 'SS-2024-0031'
    UNION ALL
    SELECT o.id, 'packaging',  'Artwork authenticated and packaged'  FROM orders o WHERE o.order_number = 'SS-2024-0031'
    UNION ALL
    SELECT o.id, 'shipped',    'Shipped via white-glove courier'     FROM orders o WHERE o.order_number = 'SS-2024-0031'
    UNION ALL
    SELECT o.id, 'delivered',  'Delivered successfully'             FROM orders o WHERE o.order_number = 'SS-2024-0031'
    UNION ALL
    SELECT o.id, 'confirmed',  'Order placed and payment received'  FROM orders o WHERE o.order_number = 'SS-2024-0018'
  `);
  console.log('   ✓ orders + timeline');

  console.log('\n✅  Seed complete!\n');
  console.log('   Admin login → admin@shadesstrokes.com / admin123');
  console.log('   Test user  → rohan@example.com / test123\n');
  process.exit(0);
}

seed().catch(err => { console.error('❌  Seed failed:', err.message); process.exit(1); });
