const express = require('express');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');
const { updateConsent, getConsentHistory } = require('../controllers/consentController');
const router = express.Router();

router.post('/update', verifyFirebaseToken, updateConsent);
router.get('/history', verifyFirebaseToken, getConsentHistory);

module.exports = router;