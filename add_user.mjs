// add_user.mjs
import pg from "pg";
const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

// ✅ YOUR INFORMATION (Already filled in!)
const FIREBASE_UID = "9q9J6bRExBZiqfXIIwLxLyQJWBy2";
const EMAIL = "n15productions@hotmail.co.uk";
const FIRST_NAME = "Andre";
const LAST_NAME = "Simpson";

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("✅ Connected to database");

    // Insert user
    console.log("\n📦 Adding user to database...");
    const userResult = await client.query(
      `INSERT INTO users (firebase_uid, email, first_name, last_name, is_beta_user, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id, email, first_name, last_name`,
      [FIREBASE_UID, EMAIL, FIRST_NAME, LAST_NAME]
    );

    const userId = userResult.rows[0].id;
    const user = userResult.rows[0];
    console.log(`\n✅ User created with ID: ${userId}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.first_name} ${user.last_name}`);

    // Insert consents
    console.log("\n📦 Adding consent preferences...");
    await client.query(
      `INSERT INTO user_consents (user_id, consent_type, is_granted, granted_at)
       VALUES 
         ($1, 'necessary', true, NOW()),
         ($1, 'analytics', true, NOW()),
         ($1, 'marketing', false, NOW())`,
      [userId]
    );

    console.log("\n✅ Consent preferences added:");
    console.log("   - Necessary: true ✓");
    console.log("   - Analytics: true ✓");
    console.log("   - Marketing: false ✗");

    console.log("\n🎉 SUCCESS! Andre Simpson can now login!");
    console.log("\n👉 Next steps:");
    console.log("   1. Make sure backend is running (npm run dev)");
    console.log("   2. Go to: http://localhost:8080/login");
    console.log("   3. Login with: n15productions@hotmail.co.uk");
    console.log("   4. Enjoy! 🚀");

  } catch (err) {
    console.error("\n❌ Error:", err.message);
    if (err.code === '23505') {
      console.error("   User already exists in database!");
      console.log("\n💡 Good news - you can already login!");
      console.log("   Go to: http://localhost:8080/login");
    }
  } finally {
    await client.end();
  }
}

main();