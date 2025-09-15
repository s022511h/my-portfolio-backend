const { Pool } = require('pg');

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

// Connection event listeners
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// Query function that matches your existing interface
async function query(sql, params = []) {
  try {
    const result = await pool.query(sql, params);
    
    // Handle INSERT/UPDATE/DELETE operations
    if (sql.trim().toUpperCase().startsWith('INSERT') || 
        sql.trim().toUpperCase().startsWith('UPDATE') || 
        sql.trim().toUpperCase().startsWith('DELETE')) {
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        insertId: result.rows[0]?.id, // If using RETURNING id
        changes: result.rowCount
      };
    }
    
    // Handle SELECT operations
    return result.rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Get pool instance (equivalent to your getDatabase function)
function getPool() {
  return pool;
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Closing database pool...');
  await pool.end();
  process.exit(0);
});

module.exports = {
  query,
  getPool,
  pool
};