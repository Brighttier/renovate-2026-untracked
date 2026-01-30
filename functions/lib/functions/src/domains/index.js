"use strict";
/**
 * Domain Management Cloud Functions
 *
 * Export all domain-related functions for the 1-click custom domain connection microservice.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeDomain = exports.verifyDomainOwnership = exports.getDomainStatus = exports.configureGoDaddyDNS = exports.addCustomDomain = void 0;
// Core domain operations
var addCustomDomain_1 = require("./addCustomDomain");
Object.defineProperty(exports, "addCustomDomain", { enumerable: true, get: function () { return addCustomDomain_1.addCustomDomain; } });
var configureGoDaddyDNS_1 = require("./configureGoDaddyDNS");
Object.defineProperty(exports, "configureGoDaddyDNS", { enumerable: true, get: function () { return configureGoDaddyDNS_1.configureGoDaddyDNS; } });
var getDomainStatus_1 = require("./getDomainStatus");
Object.defineProperty(exports, "getDomainStatus", { enumerable: true, get: function () { return getDomainStatus_1.getDomainStatus; } });
var verifyDomainOwnership_1 = require("./verifyDomainOwnership");
Object.defineProperty(exports, "verifyDomainOwnership", { enumerable: true, get: function () { return verifyDomainOwnership_1.verifyDomainOwnership; } });
var removeDomain_1 = require("./removeDomain");
Object.defineProperty(exports, "removeDomain", { enumerable: true, get: function () { return removeDomain_1.removeDomain; } });
// Re-export types for consumers
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map