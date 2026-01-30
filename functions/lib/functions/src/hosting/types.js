"use strict";
/**
 * Firebase Hosting API Types
 * Types for Firebase Hosting REST API integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RETRY_ATTEMPTS = exports.POLL_INTERVALS = exports.SITE_ID_PREFIX = exports.SITE_ID_MAX_LENGTH = exports.DEFAULT_HOSTING_CONFIG = exports.FIREBASE_HOSTING_API_BASE = exports.FIREBASE_HOSTING_IPS = void 0;
// ==========================================
// CONSTANTS
// ==========================================
exports.FIREBASE_HOSTING_IPS = {
    A: ['199.36.158.100', '151.101.1.195'],
    AAAA: ['2600:1901:0:1::']
};
exports.FIREBASE_HOSTING_API_BASE = 'https://firebasehosting.googleapis.com/v1beta1';
exports.DEFAULT_HOSTING_CONFIG = {
    cleanUrls: true,
    trailingSlashBehavior: 'REMOVE',
    headers: [
        {
            glob: '**/*.@(js|css)',
            headers: {
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        },
        {
            glob: '**/*.@(jpg|jpeg|png|gif|webp|svg|ico)',
            headers: {
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        },
        {
            glob: '**',
            headers: {
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block'
            }
        }
    ]
};
exports.SITE_ID_MAX_LENGTH = 30;
exports.SITE_ID_PREFIX = 'rms';
exports.POLL_INTERVALS = {
    INITIAL: 10000, // 10 seconds
    DNS_PROPAGATING: 30000, // 30 seconds
    SSL_PROVISIONING: 60000, // 1 minute
    MAX_POLL_DURATION: 3600000 // 1 hour
};
exports.MAX_RETRY_ATTEMPTS = {
    SITE_CREATION: 3,
    DEPLOYMENT: 3,
    DOMAIN_ADDITION: 3,
    DNS_VERIFICATION: 20,
    SSL_PROVISIONING: 60
};
//# sourceMappingURL=types.js.map