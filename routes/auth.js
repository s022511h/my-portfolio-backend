const express = require('express');
const { body, validationResult } = require('express-validator');
const admin = require('../config/firebase');
const db = require('../config/database');
const { logConsent } = require('../controllers/consentController');
const emailService = require('../services/emailService'); 
const router = express.Router();

router.post('/complete-registration', [
  body('idToken').exists(),
  body('firstName').trim().isLength({ min: 1 }),
  body('lastName').trim().isLength({ min: 1 }),
  body('marketingConsent').isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { idToken, firstName, lastName, marketingConsent } = req.body;
    
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email } = decodedToken;
    
    const existingUser = await db.query(
      'SELECT id FROM users WHERE firebase_uid = ?',
      [uid]
    );
    
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already registered in system' });
    }
    
    const result = await db.query(
      'INSERT INTO users (firebase_uid, email, first_name, last_name) VALUES (?, ?, ?, ?)',
      [uid, email, firstName, lastName]
    );
    
    const userId = result.insertId;
    
    await logConsent({
      userId,
      consentType: 'necessary',
      granted: true,
      source: 'signup',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    await logConsent({
      userId,
      consentType: 'marketing',
      granted: marketingConsent,
      source: 'signup',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    try {
      await emailService.sendWelcomeEmail(email, firstName);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }
    
    res.status(201).json({
      success: true,
      user: { 
        id: userId, 
        firebaseUid: uid, 
        email, 
        firstName, 
        lastName 
      },
      consents: {
        necessary: true,
        marketing: marketingConsent
      }
    });
    
  } catch (error) {
    console.error('Complete registration error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Registration token expired' });
    }
    
    res.status(500).json({ error: 'Server error during registration completion' });
  }
});

module.exports = router;