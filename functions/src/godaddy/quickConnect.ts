/**
 * GoDaddy Quick Domain Connect
 * One-click domain connection using GoDaddy API
 */
import * as functions from 'firebase-functions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Lazy-loaded dependencies
let SecretManagerServiceClient: any = null;

async function getGoDaddyCredentials(): Promise<{ apiKey: string; apiSecret: string }> {
  if (!SecretManagerServiceClient) {
    const { SecretManagerServiceClient: SMSC } = await import('@google-cloud/secret-manager');
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
    apiKey: keyVersion.payload?.data?.toString() || '',
    apiSecret: secretVersion.payload?.data?.toString() || '',
  };
}

// GoDaddy API base URL (OTE = test environment, production = api.godaddy.com)
const GODADDY_API_BASE = 'https://api.ote-godaddy.com/v1'; // Using OTE for testing

/**
 * Quick Connect Domain - Sets up DNS records for Firebase Hosting
 */
export const quickConnectDomain = functions.https.onRequest(async (req, res) => {
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

  } catch (error: any) {
    console.error('[GoDaddy] Quick connect error:', error);
    res.status(500).json({
      error: error.message || 'Failed to connect domain',
    });
  }
});

/**
 * List domains available in GoDaddy account
 */
export const listGoDaddyDomains = functions.https.onRequest(async (req, res) => {
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
      domains: domains.map((d: any) => ({
        domain: d.domain,
        status: d.status,
        expires: d.expires,
        renewable: d.renewable,
      })),
    });

  } catch (error: any) {
    console.error('[GoDaddy] List domains error:', error);
    res.status(500).json({
      error: error.message || 'Failed to list domains',
    });
  }
});

/**
 * Get DNS records for a domain
 */
export const getDomainDNS = functions.https.onRequest(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders).status(204).send('');
    return;
  }

  res.set(corsHeaders);

  try {
    const domain = req.query.domain as string;

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

  } catch (error: any) {
    console.error('[GoDaddy] Get DNS error:', error);
    res.status(500).json({
      error: error.message || 'Failed to get DNS records',
    });
  }
});
