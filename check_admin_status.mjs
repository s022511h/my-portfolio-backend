// check_admin_status.mjs
// Quick script to check if you're an admin in the database

import pg from "pg";
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

async function checkAdminStatus() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    // Check if is_admin column exists
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'is_admin'
    `);

    if (columnCheck.rows.length === 0) {
      console.log("❌ ERROR: is_admin column does NOT exist in users table!");
      console.log("📝 Solution: Run 'node setup_admin_database.mjs'\n");
      return;
    }

    console.log("✅ is_admin column exists\n");

    // Check your admin status
    const result = await client.query(
      `SELECT id, email, first_name, last_name, is_admin, is_beta_user 
       FROM users 
       WHERE email = $1`,
      ['n15productions@hotmail.co.uk']
    );

    if (result.rows.length === 0) {
      console.log("❌ ERROR: User n15productions@hotmail.co.uk NOT FOUND!");
      console.log("📝 Make sure you've logged in at least once\n");
      return;
    }

    const user = result.rows[0];
    console.log("👤 USER DETAILS:");
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.first_name} ${user.last_name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Beta User: ${user.is_beta_user ? '✅' : '❌'}`);
    console.log(`   Admin Status: ${user.is_admin ? '✅ YES - YOU ARE ADMIN' : '❌ NO - NOT ADMIN'}`);
    
    if (!user.is_admin) {
      console.log("\n📝 Solution: Run 'node make_admin.mjs' to become admin");
    } else {
      console.log("\n🎉 You're all set! You have admin privileges!");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.end();
  }
}

checkAdminStatus();
