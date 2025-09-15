const express = require('express');
const { body, validationResult } = require('express-validator');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');
const auditController = require('../controllers/auditController');
const router = express.Router();

const rateLimit = require('express-rate-limit');

const auditLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3, 
  message: { error: 'Too many audit requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const validateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { error: 'Too many validation requests.' }
});

router.post('/track-visit', async (req, res) => {
  try {
    await auditController.trackPageVisit(req, res);
  } catch (error) {
    console.error('Error tracking visit:', error);
    res.status(500).json({ error: 'Failed to track visit' });
  }
});

router.post('/validate-url', validateLimiter, [
  body('url').isURL().withMessage('Invalid URL format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    await auditController.validateUrl(req, res);
  } catch (error) {
    console.error('Error validating URL:', error);
    res.status(500).json({ 
      success: false, 
      error: 'URL validation failed' 
    });
  }
});

router.post('/final-eligibility', [
  body('websiteUrl').isURL().withMessage('Invalid website URL'),
  body('businessType').trim().isLength({ min: 1 }).withMessage('Business type required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        eligible: false,
        reason: 'Invalid submission data'
      });
    }
    
    await auditController.checkFinalEligibility(req, res);
  } catch (error) {
    console.error('Error checking final eligibility:', error);
    res.status(500).json({ 
      eligible: true 
    });
  }
});

router.post('/analyze', auditLimiter, [
  body('websiteUrl').isURL().withMessage('Invalid website URL'),
  body('businessType').trim().isLength({ min: 1 }).withMessage('Business type required'),
  body('websiteGoals').isArray({ min: 1 }).withMessage('At least one goal required'),
  body('trafficVolume').trim().isLength({ min: 1 }).withMessage('Traffic volume required'),
  body('technicalLevel').trim().isLength({ min: 1 }).withMessage('Technical level required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid form data',
        details: errors.array()
      });
    }
    
    await auditController.runAudit(req, res);
  } catch (error) {
    console.error('Error running audit:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Audit analysis failed' 
    });
  }
});

router.post('/capture-existing-user', verifyFirebaseToken, [
  body('auditId').isInt({ min: 1 }).withMessage('Valid audit ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    await auditController.captureExistingUser(req, res);
  } catch (error) {
    console.error('Error capturing existing user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update preferences' 
    });
  }
});

router.post('/capture-anonymous', [
  body('firstName').trim().isLength({ min: 1 }).withMessage('First name required'),
  body('lastName').trim().isLength({ min: 1 }).withMessage('Last name required'),
  body('email').isEmail().withMessage('Valid email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    await auditController.captureAnonymousUser(req, res);
  } catch (error) {
    console.error('Error capturing anonymous user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to capture email' 
    });
  }
});

router.post('/capture-ineligible', [
  body('firstName').trim().isLength({ min: 1 }).withMessage('First name required'),
  body('lastName').trim().isLength({ min: 1 }).withMessage('Last name required'),
  body('email').isEmail().withMessage('Valid email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    await auditController.captureIneligibleUser(req, res);
  } catch (error) {
    console.error('Error capturing ineligible user:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to subscribe' 
    });
  }
});

router.post('/check-email', [
  body('email').isEmail().withMessage('Valid email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }
    
    await auditController.checkEmailAvailability(req, res);
  } catch (error) {
    console.error('Error checking email:', error);
    res.status(200).json({ success: true }); 
  }
});

router.post('/track-capture-view', async (req, res) => {
  try {
    await auditController.trackCaptureView(req, res);
  } catch (error) {
    console.error('Error tracking capture view:', error);
    res.status(200).json({ success: true }); 
  }
});

router.post('/download-report', [
  body('auditId').isInt({ min: 1 }).withMessage('Valid audit ID required'),
  body('format').isIn(['pdf', 'html']).withMessage('Format must be pdf or html')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    await auditController.downloadReport(req, res);
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate report' 
    });
  }
});

router.get('/stats', verifyFirebaseToken, async (req, res) => {
  try {
    const admin = require('../config/database');
    const firstUser = await admin.query('SELECT id FROM users ORDER BY created_at LIMIT 1');
    
    if (firstUser.length === 0 || firstUser[0].id !== req.user.id) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await auditController.getAuditStats(req, res);
  } catch (error) {
    console.error('Error getting audit stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get statistics' 
    });
  }
});

router.get('/recent', verifyFirebaseToken, async (req, res) => {
  try {
    const admin = require('../config/database');
    const firstUser = await admin.query('SELECT id FROM users ORDER BY created_at LIMIT 1');
    
    if (firstUser.length === 0 || firstUser[0].id !== req.user.id) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await auditController.getRecentAudits(req, res);
  } catch (error) {
    console.error('Error getting recent audits:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get recent audits' 
    });
  }
});

router.use((error, req, res, next) => {
  console.error('Audit route error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

module.exports = router;