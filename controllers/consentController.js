const db = require('../config/database');

const logConsent = async ({ userId, consentType, granted, source, ipAddress, userAgent }) => {
  try {
    await db.query(
      `INSERT INTO consent_ledger 
       (user_id, consent_type, granted, source, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, consentType, granted, source, ipAddress, userAgent]
    );
  } catch (error) {
    console.error('Error logging consent:', error);
    throw error;
  }
};

const getCurrentConsents = async (userId) => {
  try {
    const consents = await db.query(
      `SELECT DISTINCT 
         consent_type,
         granted,
         created_at
       FROM consent_ledger c1
       WHERE user_id = ? 
         AND created_at = (
           SELECT MAX(created_at) 
           FROM consent_ledger c2 
           WHERE c2.user_id = c1.user_id 
             AND c2.consent_type = c1.consent_type
         )
       ORDER BY consent_type`,
      [userId]
    );
    
    const result = {};
    consents.forEach(consent => {
      result[consent.consent_type] = consent.granted;
    });
    
    return result;
  } catch (error) {
    console.error('Error getting current consents:', error);
    throw error;
  }
};

const updateConsent = async (req, res) => {
  try {
    const { consentType, granted } = req.body;
    const userId = req.user.id;
    
    const validTypes = ['marketing', 'analytics'];
    if (!validTypes.includes(consentType)) {
      return res.status(400).json({ error: 'Invalid consent type' });
    }
    
    await logConsent({
      userId,
      consentType,
      granted,
      source: 'profile',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    if (consentType === 'marketing' && !granted) {
      const user = await db.query('SELECT email FROM users WHERE id = ?', [userId]);
      if (user.length > 0) {
        await addToSuppressionList(user[0].email, 'unsubscribe');
      }
    }
    
    res.json({ success: true, message: 'Consent updated successfully' });
    
  } catch (error) {
    console.error('Error updating consent:', error);
    res.status(500).json({ error: 'Server error updating consent' });
  }
};

const getConsentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const history = await db.query(
      `SELECT consent_type, granted, source, created_at 
       FROM consent_ledger 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );
    
    res.json({ success: true, history });
    
  } catch (error) {
    console.error('Error getting consent history:', error);
    res.status(500).json({ error: 'Server error getting consent history' });
  }
};

const addToSuppressionList = async (email, reason) => {
  try {
    await db.query(
      `INSERT OR IGNORE INTO email_suppression (email, reason) VALUES (?, ?)`,
      [email, reason]
    );
  } catch (error) {
    console.error('Error adding to suppression list:', error);
    throw error;
  }
};
const logAuditConsent = async ({ email, firstName, lastName, auditId, ipAddress, userAgent }) => {
  try {
    let user = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    let userId;
    
    if (user.length === 0) {
      const result = await db.query(
        'INSERT INTO users (email, first_name, last_name, firebase_uid) VALUES (?, ?, ?, ?)',
        [email, firstName, lastName, `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`]
      );
      userId = result.insertId;
    } else {
      userId = user[0].id;
    }
    
    await logConsent({
      userId,
      consentType: 'marketing',
      granted: true,
      source: 'audit_capture',
      ipAddress,
      userAgent
    });
    
    await db.query(
      'UPDATE audits SET user_id = ?, email_captured = 1 WHERE id = ?',
      [userId, auditId]
    );
    
    return userId;
    
  } catch (error) {
    console.error('Error logging audit consent:', error);
    throw error;
  }
};

module.exports = {
  logConsent,
  getCurrentConsents,
  updateConsent,
  getConsentHistory,
  addToSuppressionList,
  logAuditConsent
};