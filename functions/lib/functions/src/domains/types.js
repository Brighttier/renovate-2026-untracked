"use strict";
/**
 * Domain Connection Types
 *
 * TypeScript interfaces for the 1-click custom domain connection microservice.
 * These types are used across Cloud Functions for domain management.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_DOMAIN_LIMITS = exports.FIREBASE_HOSTING_IPS = void 0;
// Firebase Hosting IP addresses
exports.FIREBASE_HOSTING_IPS = ['199.36.158.100', '151.101.1.195'];
exports.PLAN_DOMAIN_LIMITS = {
    free: 1,
    starter: 3,
    growth: 15,
    enterprise: 999 // Effectively unlimited
};
//# sourceMappingURL=types.js.map