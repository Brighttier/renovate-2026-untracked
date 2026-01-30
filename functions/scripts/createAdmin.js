/**
 * Create Admin User Script
 *
 * Creates an admin user in Firebase Authentication
 * Run with: node functions/scripts/createAdmin.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

const createAdminUser = async () => {
  const email = 'admin@renovatemysite.com';
  const password = 'Admin123!@#'; // Change this to a secure password
  const displayName = 'Admin User';

  try {
    // Check if user already exists
    let user;
    try {
      user = await admin.auth().getUserByEmail(email);
      console.log('✅ Admin user already exists:', user.uid);
      console.log('Email:', user.email);
      console.log('Display Name:', user.displayName);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        // Create new user
        user = await admin.auth().createUser({
          email,
          password,
          displayName,
          emailVerified: true,
        });
        console.log('✅ Admin user created successfully!');
        console.log('UID:', user.uid);
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('\n⚠️  IMPORTANT: Change this password after first login!');
      } else {
        throw error;
      }
    }

    // Set custom claims for admin role
    await admin.auth().setCustomUserClaims(user.uid, { admin: true, role: 'admin' });
    console.log('✅ Admin role set successfully');

    // Create admin document in Firestore
    await admin.firestore().collection('users').doc(user.uid).set({
      email,
      displayName,
      role: 'admin',
      isAdmin: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      vibeEditorEnabled: true, // Enable vibe editor for admin
    }, { merge: true });
    console.log('✅ Admin document created in Firestore');

    console.log('\n📋 Login Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🌐 Admin Panel URL:');
    console.log('https://renovatemysite-vibe.web.app/');
    console.log('\n✨ Done!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();
