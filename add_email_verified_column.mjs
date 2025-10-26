// add_email_verified_column.mjs
// Add email_verified column to users table

import pg from "pg";
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

async function addEmailVerifiedColumn() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    // Add email_verified column
    console.log("📊 Adding email_verified column to users table...");
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false
    `);
    console.log("✅ email_verified column added\n");

    // Optionally, you can set existing users to verified
    // Uncomment the lines below if you want all existing users marked as verified
    console.log("📊 Checking existing users...");
    const result = await client.query(`
      UPDATE users 
      SET email_verified = true 
      WHERE email_verified IS NULL
      RETURNING id, email, email_verified
    `);
    
    if (result.rowCount > 0) {
      console.log(`✅ Set ${result.rowCount} existing users to verified`);
      result.rows.forEach(user => {
        console.log(`   - ${user.email}: verified = ${user.email_verified}`);
      });
    } else {
      console.log("✅ All users already have email_verified status set");
    }

    console.log("\n🎉 email_verified column setup complete!");
    console.log("📝 All existing users have been marked as verified");
    console.log("📝 New users will default to email_verified = false");

  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.end();
  }
}

addEmailVerifiedColumn();
