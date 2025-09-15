const express = require('express');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');
const { query } = require('../config/database');
const router = express.Router();

const requireAdmin = async (req, res, next) => {
  try {
    const firstUser = await query('SELECT id FROM users ORDER BY created_at LIMIT 1');
    if (firstUser.length === 0 || firstUser[0].id !== req.user.id) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Server error checking admin status' });
  }
};

const ensureTablesExist = async () => {
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
    console.error('Error creating tables:', error);
  }
};

router.get('/stats', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    await ensureTablesExist();
    
    const totalUsers = await query('SELECT COUNT(*) as count FROM users');
    
    const marketingConsentUsers = await query(`
      SELECT COUNT(*) as count FROM (
        SELECT DISTINCT user_id 
        FROM consent_ledger 
        WHERE consent_type = 'marketing' AND granted = 1
      ) 
    `);
    
    let emailsSent = [{ count: 0 }];
    try {
      emailsSent = await query('SELECT COUNT(*) as count FROM email_log');
    } catch (error) {
      console.log('email_log table not accessible, defaulting to 0');
    }
    
    const suppressedEmails = await query('SELECT COUNT(*) as count FROM email_suppression');
    
    const recentUsers = await query(`
      SELECT COUNT(*) as count FROM users 
      WHERE created_at >= datetime('now', '-7 days')
    `);
    
    let totalAudits = [{ count: 0 }];
    let auditCaptures = [{ count: 0 }];
    try {
      totalAudits = await query('SELECT COUNT(*) as count FROM audits');
      auditCaptures = await query('SELECT COUNT(*) as count FROM audits WHERE email_captured = 1');
    } catch (error) {
      console.log('audit tables not accessible, defaulting to 0');
    }

    res.json({
      success: true,
      stats: {
        totalUsers: totalUsers[0]?.count || 0,
        marketingConsent: marketingConsentUsers[0]?.count || 0,
        emailsSent: emailsSent[0]?.count || 0,
        suppressedEmails: suppressedEmails[0]?.count || 0,
        recentUsers: recentUsers[0]?.count || 0,
        totalAudits: totalAudits[0]?.count || 0,  
        auditCaptures: auditCaptures[0]?.count || 0 
      }
    });
    
  } catch (error) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({ 
      error: 'Server error getting stats',
      details: error.message 
    });
  }
});

router.get('/users', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const users = await query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.created_at,
        COALESCE(
          (SELECT granted 
           FROM consent_ledger cl 
           WHERE cl.user_id = u.id 
             AND cl.consent_type = 'marketing' 
           ORDER BY cl.created_at DESC 
           LIMIT 1), 
          0
        ) as marketing_consent
      FROM users u
      ORDER BY u.created_at DESC
      LIMIT 50
    `);
    
    res.json({ success: true, users });
    
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ 
      error: 'Server error getting users',
      details: error.message 
    });
  }
});

module.exports = router;