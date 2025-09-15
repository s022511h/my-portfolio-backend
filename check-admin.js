const { query } = require('./config/database');

async function checkAdmin() {
  try {
    const users = await query('SELECT id, email, first_name, last_name, created_at FROM users ORDER BY created_at LIMIT 5');
    
    if (users.length === 0) {
      console.log('No users found in database');
      return;
    }
    
    console.log('\nFirst 5 users (admin is #1):');
    console.log('====================================');
    users.forEach(user => {
      const isAdmin = user.id === 1 ? ' [ADMIN]' : '';
      console.log(`ID: ${user.id} | Email: ${user.email} | Name: ${user.first_name} ${user.last_name}${isAdmin}`);
      console.log(`Created: ${user.created_at}`);
      console.log('---');
    });
    
    console.log(`\nAdmin user: ${users[0].email} (ID: ${users[0].id})`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkAdmin();