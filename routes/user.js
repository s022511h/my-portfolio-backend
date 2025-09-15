const express = require('express');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');
const { getCurrentConsents } = require('../controllers/consentController');
const router = express.Router();

router.get('/profile', verifyFirebaseToken, async (req, res) => {
  try {
    const user = req.user;
    const consents = await getCurrentConsents(user.id);
    
    res.json({
      success: true,
      user: {
        id: user.id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt
      },
      consents
    });
    
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Server error getting profile' });
  }
});

module.exports = router;