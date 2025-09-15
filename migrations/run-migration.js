const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const dbPath = path.join(__dirname, '..', 'database.db');
  
  try {
    console.log('🚀 Running SQLite database migration...');
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    const migrationPath = path.join(__dirname, '001_firebase_schema_sqlite.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');

    await db.exec(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Created tables: users, consent_ledger, email_suppression, unsubscribe_tokens');
    console.log(`📁 Database file created at: ${dbPath}`);
    
    await db.close();
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();