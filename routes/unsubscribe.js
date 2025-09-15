const express = require('express');
const { query } = require('../config/database');
const { addToSuppressionList, logConsent } = require('../controllers/consentController');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({ error: 'Unsubscribe token required' });
    }
    
    const tokenData = await query(
      `SELECT email, expires_at FROM unsubscribe_tokens 
       WHERE token = ? AND datetime(expires_at) > datetime('now')`,
      [token]
    );
    
    if (tokenData.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired unsubscribe token' });
    }
    
    const email = tokenData[0].email;
    
    const users = await query('SELECT id FROM users WHERE email = ?', [email]);
    
    if (users.length > 0) {
      const userId = users[0].id;
      
      await logConsent({
        userId,
        consentType: 'marketing',
        granted: false,
        source: 'unsubscribe',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    await addToSuppressionList(email, 'unsubscribe');
    
    await query('DELETE FROM unsubscribe_tokens WHERE token = ?', [token]);
    
    res.json({ 
      success: true, 
      message: 'Successfully unsubscribed from marketing emails',
      email: email
    });
    
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ error: 'Server error processing unsubscribe' });
  }
});

module.exports = router;