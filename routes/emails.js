const express = require('express');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');
const emailService = require('../services/emailService');
const { query } = require('../config/database');
const router = express.Router();

const ensureEmailLogExists = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS email_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        type TEXT NOT NULL,
        template TEXT,
        subject TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (error) {
    console.error('Error creating email_log table:', error);
  }
};

router.get('/log', verifyFirebaseToken, async (req, res) => {
  try {
    await ensureEmailLogExists();
    
    const logs = await query(`
      SELECT * FROM email_log 
      ORDER BY sent_at DESC 
      LIMIT 100
    `);
    
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Error getting email logs:', error);
    res.status(500).json({ 
      error: 'Server error getting email logs',
      details: error.message 
    });
  }
});

router.post('/marketing/send', verifyFirebaseToken, async (req, res) => {
  try {
    const { subject, template, recipientType = 'all' } = req.body;
    
    const users = await query('SELECT id FROM users ORDER BY created_at LIMIT 1');
    if (users.length === 0 || users[0].id !== req.user.id) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    let recipients = [];
    if (recipientType === 'all') {
      recipients = await query(`
        SELECT DISTINCT u.email, u.first_name, u.last_name 
        FROM users u
        WHERE u.email NOT IN (SELECT email FROM email_suppression)
          AND EXISTS (
            SELECT 1 FROM consent_ledger cl 
            WHERE cl.user_id = u.id 
              AND cl.consent_type = 'marketing' 
              AND cl.granted = 1
          )
      `);
    }
    
    res.json({
      success: true,
      sent: 0,
      failed: 0,
      total: recipients.length,
      message: `Ready to send to ${recipients.length} recipients`
    });
    
  } catch (error) {
    console.error('Error sending marketing emails:', error);
    res.status(500).json({ 
      error: 'Server error sending emails',
      details: error.message 
    });
  }
});

module.exports = router;