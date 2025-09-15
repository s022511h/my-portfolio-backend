const admin = require('../config/firebase');
const db = require('../config/database');

const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Firebase ID token required' });
    }
    
    const idToken = authHeader.substring(7);
    
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    const users = await db.query(
      'SELECT * FROM users WHERE firebase_uid = ?',
      [decodedToken.uid]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found in system' });
    }
    
    req.user = {
      id: users[0].id,
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      firstName: users[0].first_name,
      lastName: users[0].last_name,
      createdAt: users[0].created_at
    };
    
    next();
    
  } catch (error) {
    console.error('Firebase auth error:', error);
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    res.status(401).json({ error: 'Invalid Firebase token' });
  }
};

module.exports = { verifyFirebaseToken };