"use strict";
/**
 * Setup Function - Create Admin User
 *
 * One-time function to create admin credentials
 * Call via: https://us-central1-renovatemysite-vibe.cloudfunctions.net/setupAdmin?secret=YOUR_SECRET
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAdmin = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// SECRET KEY - must match when calling the function
const SETUP_SECRET = 'setup-admin-vibe-2024';
exports.setupAdmin = (0, https_1.onRequest)(async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    // Check secret key
    const secret = req.query.secret;
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
        }
        catch (error) {
            if (error.code === 'auth/user-not-found') {
                // Create new user
                user = await admin.auth().createUser({
                    email,
                    password,
                    displayName,
                    emailVerified: true,
                });
                console.log('Admin user created:', user.uid);
            }
            else {
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
    }
    catch (error) {
        console.error('Error creating admin:', error);
        res.status(500).json({
            error: 'Failed to create admin user',
            details: error.message
        });
    }
});
//# sourceMappingURL=createAdmin.js.map