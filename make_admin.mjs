// make_admin.mjs
// Run this script to make yourself an admin

import pg from "pg";
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
const ADMIN_EMAIL = "n15productions@hotmail.co.uk"; // Andre's email

async function makeAdmin() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    // Update user to admin
    const result = await client.query(
      `UPDATE users 
       SET is_admin = true, updated_at = NOW() 
       WHERE email = $1 
       RETURNING id, email, first_name, last_name, is_admin`,
      [ADMIN_EMAIL]
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      console.log("✅ SUCCESS! Admin privileges granted!");
      console.log("\n👤 User Details:");
      console.log(`   Name: ${user.first_name} ${user.last_name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Admin Status: ${user.is_admin ? '✅ ADMIN' : '❌ Not Admin'}`);
      console.log("\n🎉 You now have full admin access!");
      console.log("🚀 Next step: Update your backend code with the admin endpoints");
    } else {
      console.log(`❌ User not found: ${ADMIN_EMAIL}`);
      console.log("Make sure you've logged in at least once so your user exists in the database");
    }

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.end();
  }
}

makeAdmin();
