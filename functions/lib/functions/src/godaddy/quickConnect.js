"use strict";
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
exports.getDomainDNS = exports.listGoDaddyDomains = exports.quickConnectDomain = void 0;
/**
 * GoDaddy Quick Domain Connect
 * One-click domain connection using GoDaddy API
 */
const functions = __importStar(require("firebase-functions"));
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
// Lazy-loaded dependencies
let SecretManagerServiceClient = null;
async function getGoDaddyCredentials() {
    var _a, _b, _c, _d;
    if (!SecretManagerServiceClient) {
        const { SecretManagerServiceClient: SMSC } = await Promise.resolve().then(() => __importStar(require('@google-cloud/secret-manager')));
        SecretManagerServiceClient = SMSC;
    }
    const client = new SecretManagerServiceClient();
    const [keyVersion] = await client.accessSecretVersion({
        name: 'projects/renovatemysite-vibe/secrets/godaddy-api-key/versions/latest',
    });
    const [secretVersion] = await client.accessSecretVersion({
        name: 'projects/renovatemysite-vibe/secrets/godaddy-api-secret/versions/latest',
    });
    return {
        apiKey: ((_b = (_a = keyVersion.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString()) || '',
        apiSecret: ((_d = (_c = secretVersion.payload) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.toString()) || '',
    };
}
// GoDaddy API base URL (OTE = test environment, production = api.godaddy.com)
const GODADDY_API_BASE = 'https://api.ote-godaddy.com/v1'; // Using OTE for testing
/**
 * Quick Connect Domain - Sets up DNS records for Firebase Hosting
 */
exports.quickConnectDomain = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { domain, siteId } = req.body;
        if (!domain) {
            res.status(400).json({ error: 'domain is required' });
            return;
        }
        console.log(`[GoDaddy] Quick connecting domain: ${domain}`);
        // Get GoDaddy credentials from Secret Manager
        const { apiKey, apiSecret } = await getGoDaddyCredentials();
        // Firebase Hosting IP addresses for A records
        const firebaseIPs = ['151.101.1.195', '151.101.65.195'];
        // DNS records to set up
        const dnsRecords = [
            // A records for root domain
            ...firebaseIPs.map(ip => ({
                type: 'A',
                name: '@',
                data: ip,
                ttl: 600,
            })),
            // CNAME for www subdomain
            {
                type: 'CNAME',
                name: 'www',
                data: `${siteId || 'renovatemysite-vibe'}.web.app`,
                ttl: 600,
            },
        ];
        // Update DNS records via GoDaddy API
        const response = await fetch(`${GODADDY_API_BASE}/domains/${domain}/records`, {
            method: 'PATCH',
            headers: {
                'Authorization': `sso-key ${apiKey}:${apiSecret}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dnsRecords),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[GoDaddy] API error: ${response.status} - ${errorText}`);
            throw new Error(`GoDaddy API error: ${response.status}`);
        }
        console.log(`[GoDaddy] DNS records updated for ${domain}`);
        // Verify the records were set
        const verifyResponse = await fetch(`${GODADDY_API_BASE}/domains/${domain}/records`, {
            headers: {
                'Authorization': `sso-key ${apiKey}:${apiSecret}`,
            },
        });
        const currentRecords = await verifyResponse.json();
        res.json({
            success: true,
            domain,
            message: `Domain ${domain} connected successfully!`,
            dnsRecords: currentRecords,
            nextSteps: [
                'DNS propagation may take up to 48 hours',
                'SSL certificate will be provisioned automatically',
                `Your site will be available at https://${domain}`,
            ],
        });
    }
    catch (error) {
        console.error('[GoDaddy] Quick connect error:', error);
        res.status(500).json({
            error: error.message || 'Failed to connect domain',
        });
    }
});
/**
 * List domains available in GoDaddy account
 */
exports.listGoDaddyDomains = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    try {
        const { apiKey, apiSecret } = await getGoDaddyCredentials();
        const response = await fetch(`${GODADDY_API_BASE}/domains`, {
            headers: {
                'Authorization': `sso-key ${apiKey}:${apiSecret}`,
            },
        });
        if (!response.ok) {
            throw new Error(`GoDaddy API error: ${response.status}`);
        }
        const domains = await response.json();
        res.json({
            success: true,
            domains: domains.map((d) => ({
                domain: d.domain,
                status: d.status,
                expires: d.expires,
                renewable: d.renewable,
            })),
        });
    }
    catch (error) {
        console.error('[GoDaddy] List domains error:', error);
        res.status(500).json({
            error: error.message || 'Failed to list domains',
        });
    }
});
/**
 * Get DNS records for a domain
 */
exports.getDomainDNS = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    try {
        const domain = req.query.domain;
        if (!domain) {
            res.status(400).json({ error: 'domain query parameter is required' });
            return;
        }
        const { apiKey, apiSecret } = await getGoDaddyCredentials();
        const response = await fetch(`${GODADDY_API_BASE}/domains/${domain}/records`, {
            headers: {
                'Authorization': `sso-key ${apiKey}:${apiSecret}`,
            },
        });
        if (!response.ok) {
            throw new Error(`GoDaddy API error: ${response.status}`);
        }
        const records = await response.json();
        res.json({
            success: true,
            domain,
            records,
        });
    }
    catch (error) {
        console.error('[GoDaddy] Get DNS error:', error);
        res.status(500).json({
            error: error.message || 'Failed to get DNS records',
        });
    }
});
//# sourceMappingURL=quickConnect.js.map