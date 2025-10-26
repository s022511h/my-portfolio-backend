// setup_admin_database.mjs
// Run this script to set up admin functionality in your database

import pg from "pg";
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

async function setupAdminDatabase() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected to database\n");

    // 1. Add is_admin column to users table if it doesn't exist
    console.log("📊 Adding is_admin column to users table...");
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false
    `);
    console.log("✅ is_admin column added\n");

    // 2. Create email_logs table
    console.log("📊 Creating email_logs table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        template VARCHAR(100),
        subject TEXT,
        content TEXT,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'sent',
        error_message TEXT
      )
    `);
    console.log("✅ email_logs table created\n");

    // 3. Create index on email_logs for faster queries
    console.log("📊 Creating index on email_logs...");
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_logs_sent_at ON email_logs(sent_at DESC)
    `);
    console.log("✅ Index created\n");

    console.log("🎉 Database setup complete!");
    console.log("\n📝 Next step: Run make_admin.mjs to make yourself an admin");

  } catch (error) {
    console.error("❌ Error setting up database:", error.message);
    throw error;
  } finally {
    await client.end();
  }
}

setupAdminDatabase();
