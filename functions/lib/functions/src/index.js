"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAdmin = exports.findLeadsWithMaps = exports.generateModernizedSite = exports.editSiteHTML = void 0;
// CRITICAL: Import Firebase initialization FIRST
require("./firebaseInit");
// ============================================================================
// OPTIMIZED EXPORTS - Lazy loading to prevent deployment timeouts
// ============================================================================
var minimalExports_1 = require("./minimalExports");
Object.defineProperty(exports, "editSiteHTML", { enumerable: true, get: function () { return minimalExports_1.editSiteHTML; } });
Object.defineProperty(exports, "generateModernizedSite", { enumerable: true, get: function () { return minimalExports_1.generateModernizedSite; } });
Object.defineProperty(exports, "findLeadsWithMaps", { enumerable: true, get: function () { return minimalExports_1.findLeadsWithMaps; } });
// ============================================================================
// SETUP FUNCTIONS (One-time use)
// ============================================================================
var createAdmin_1 = require("./setup/createAdmin");
Object.defineProperty(exports, "setupAdmin", { enumerable: true, get: function () { return createAdmin_1.setupAdmin; } });
//# sourceMappingURL=index.js.map