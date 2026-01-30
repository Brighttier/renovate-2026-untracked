"use strict";
/**
 * Firebase Hosting Module
 * Exports all hosting-related Cloud Functions
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
exports.pollDomainStatusOnce = exports.getDomainConnectionStatusHTTP = exports.getDomainConnectionStatus = exports.scheduledDomainPolling = exports.pollDomainStatusHTTP = exports.pollDomainStatus = exports.oneClickLaunchHTTP = exports.oneClickLaunch = exports.disconnectCustomDomain = exports.connectCustomDomainHTTP = exports.connectCustomDomain = exports.deployToSite = exports.deployToFirebaseHostingSiteHTTP = exports.deployToFirebaseHostingSite = exports.updateClientSiteStatus = exports.getClientSite = exports.generateSiteId = exports.createFirebaseHostingSiteHTTP = exports.createFirebaseHostingSite = void 0;
// Site Creation
var createSite_1 = require("./createSite");
Object.defineProperty(exports, "createFirebaseHostingSite", { enumerable: true, get: function () { return createSite_1.createFirebaseHostingSite; } });
Object.defineProperty(exports, "createFirebaseHostingSiteHTTP", { enumerable: true, get: function () { return createSite_1.createFirebaseHostingSiteHTTP; } });
Object.defineProperty(exports, "generateSiteId", { enumerable: true, get: function () { return createSite_1.generateSiteId; } });
Object.defineProperty(exports, "getClientSite", { enumerable: true, get: function () { return createSite_1.getClientSite; } });
Object.defineProperty(exports, "updateClientSiteStatus", { enumerable: true, get: function () { return createSite_1.updateClientSiteStatus; } });
// Site Deployment
var deploySite_1 = require("./deploySite");
Object.defineProperty(exports, "deployToFirebaseHostingSite", { enumerable: true, get: function () { return deploySite_1.deployToFirebaseHostingSite; } });
Object.defineProperty(exports, "deployToFirebaseHostingSiteHTTP", { enumerable: true, get: function () { return deploySite_1.deployToFirebaseHostingSiteHTTP; } });
Object.defineProperty(exports, "deployToSite", { enumerable: true, get: function () { return deploySite_1.deployToSite; } });
// Domain Connection
var connectDomain_1 = require("./connectDomain");
Object.defineProperty(exports, "connectCustomDomain", { enumerable: true, get: function () { return connectDomain_1.connectCustomDomain; } });
Object.defineProperty(exports, "connectCustomDomainHTTP", { enumerable: true, get: function () { return connectDomain_1.connectCustomDomainHTTP; } });
Object.defineProperty(exports, "disconnectCustomDomain", { enumerable: true, get: function () { return connectDomain_1.disconnectCustomDomain; } });
// 1-Click Launch (no domain required)
Object.defineProperty(exports, "oneClickLaunch", { enumerable: true, get: function () { return connectDomain_1.oneClickLaunch; } });
Object.defineProperty(exports, "oneClickLaunchHTTP", { enumerable: true, get: function () { return connectDomain_1.oneClickLaunchHTTP; } });
// Domain Status Polling
var pollDomainStatus_1 = require("./pollDomainStatus");
Object.defineProperty(exports, "pollDomainStatus", { enumerable: true, get: function () { return pollDomainStatus_1.pollDomainStatus; } });
Object.defineProperty(exports, "pollDomainStatusHTTP", { enumerable: true, get: function () { return pollDomainStatus_1.pollDomainStatusHTTP; } });
Object.defineProperty(exports, "scheduledDomainPolling", { enumerable: true, get: function () { return pollDomainStatus_1.scheduledDomainPolling; } });
Object.defineProperty(exports, "getDomainConnectionStatus", { enumerable: true, get: function () { return pollDomainStatus_1.getDomainConnectionStatus; } });
Object.defineProperty(exports, "getDomainConnectionStatusHTTP", { enumerable: true, get: function () { return pollDomainStatus_1.getDomainConnectionStatusHTTP; } });
Object.defineProperty(exports, "pollDomainStatusOnce", { enumerable: true, get: function () { return pollDomainStatus_1.pollDomainStatusOnce; } });
// Types (re-export for convenience)
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map