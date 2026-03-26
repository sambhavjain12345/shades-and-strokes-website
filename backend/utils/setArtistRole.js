// Quick utility — run once to set arjun as artist
require('dotenv').config();
const pool = require('../config/db');

async function fix() {
  try {
    // Find arjun's user
    const [users] = await pool.query("SELECT id, name, email, role FROM users WHERE email LIKE '%arjun%' OR name LIKE '%arjun%'");
    console.log('Found users:', users);

    if (!users.length) {
      console.log('No arjun user found. All users:');
      const [all] = await pool.query('SELECT id, name, email, role FROM users');
      console.table(all);
      process.exit(0);
    }

    for (const u of users) {
      await pool.query("UPDATE users SET role='artist' WHERE id=?", [u.id]);
      // Find or create artist profile
      const [existing] = await pool.query('SELECT id FROM artists WHERE user_id=?', [u.id]);
      if (!existing.length) {
        // Link to existing artist named arjun if exists
        const [artistRow] = await pool.query("SELECT id FROM artists WHERE name LIKE '%arjun%' OR name LIKE '%Arjun%'");
        if (artistRow.length) {
          await pool.query('UPDATE artists SET user_id=? WHERE id=?', [u.id, artistRow[0].id]);
          console.log(`✅ Linked user ${u.name} (${u.email}) to existing artist profile`);
        }
      }
      console.log(`✅ Set ${u.name} (${u.email}) role to artist`);
    }

    // Verify
    const [verify] = await pool.query('SELECT id, name, email, role FROM users WHERE role="artist"');
    console.log('\nAll artists:', verify);
    process.exit(0);
  } catch(e) {
    console.error(e.message);
    process.exit(1);
  }
}

fix();
