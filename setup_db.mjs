// setup_db.mjs
import pg from "pg";
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected to database");

    // Create users table
    console.log("📦 Creating users table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        firebase_uid VARCHAR(128) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        is_beta_user BOOLEAN DEFAULT TRUE,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);
    console.log("✅ Users table created");

    // Create indexes
    console.log("📦 Creating indexes...");
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    console.log("✅ Indexes created");

    // Create user_consents table
    console.log("📦 Creating user_consents table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_consents (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        consent_type VARCHAR(20) NOT NULL CHECK (consent_type IN ('necessary', 'analytics', 'marketing')),
        is_granted BOOLEAN DEFAULT FALSE,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, consent_type)
      )
    `);
    console.log("✅ User_consents table created");

    // Create index
    await client.query(`CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id)`);
    console.log("✅ All indexes created");

    // Verify tables
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("\n📋 Tables in database:");
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));

    console.log("\n🎉 Database setup complete!");

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    await client.end();
  }
}

main();