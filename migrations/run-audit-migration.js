const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const fs = require('fs').promises;
const path = require('path');

async function runAuditMigration() {
  const dbPath = path.join(__dirname, '..', 'database.db');
  
  try {
    console.log('🚀 Running audit schema migration...');
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
    
    const migrationPath = path.join(__dirname, '003_audit_schema.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    await db.exec(migrationSQL);
    
    console.log('✅ Audit migration completed!');
    await db.close();
    
  } catch (error) {
    console.error('❌ Audit migration failed:', error.message);
    process.exit(1);
  }
}

runAuditMigration();