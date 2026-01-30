/**
 * Setup Function - Create Admin User
 *
 * One-time function to create admin credentials
 * Call via: https://us-central1-renovatemysite-vibe.cloudfunctions.net/setupAdmin?secret=YOUR_SECRET
 */

import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// SECRET KEY - must match when calling the function
const SETUP_SECRET = 'setup-admin-vibe-2024';

export const setupAdmin = onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST');

  // Check secret key
  const secret = req.query.secret as string;
  if (secret !== SETUP_SECRET) {
    res.status(403).json({ error: 'Invalid secret key' });
    return;
  }

  const email = 'admin@renovatemysite.com';
  const password = 'Admin123!@#';
  const displayName = 'Admin User';

  try {
    // Check if user already exists
    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
      console.log('Admin user already exists:', user.uid);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        user = await admin.auth().createUser({
          email,
          password,
          displayName,
          emailVerified: true,
        });
        console.log('Admin user created:', user.uid);
      } else {
        throw error;
      }
    }

    // Set custom claims for admin role
    await admin.auth().setCustomUserClaims(user.uid, {
      admin: true,
      role: 'admin'
    });

    // Create admin document in Firestore
    await admin.firestore().collection('users').doc(user.uid).set({
      email,
      displayName,
      role: 'admin',
      isAdmin: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      vibeEditorEnabled: true,
    }, { merge: true });

    res.json({
      success: true,
      message: 'Admin user created successfully',
      credentials: {
        email,
        password,
        note: 'Change password after first login'
      },
      loginUrl: 'https://renovatemysite-vibe.web.app/'
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({
      error: 'Failed to create admin user',
      details: (error as Error).message
    });
  }
});
