/**
 * Firebase Admin Initialization
 * This MUST be imported first before any other modules
 */
import * as admin from 'firebase-admin';

// Initialize once
if (!admin.apps.length) {
  admin.initializeApp();
}

export default admin;
