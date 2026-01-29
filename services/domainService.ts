/**
 * GoDaddy API Service
 *
 * This service handles real interactions with the GoDaddy Domains API.
 * Users connect their own GoDaddy accounts by providing their API credentials.
 * Documentation: https://developer.godaddy.com/doc/endpoint/domains
 */

export interface DNSResult {
    success: boolean;
    message: string;
}

export interface GoDaddyDomain {
    domain: string;
    status: string;
}

export interface DNSRecord {
    type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS';
    name: string;
    data: string;
    ttl?: number;
}

const GODADDY_API_BASE = 'https://api.godaddy.com/v1';

/**
 * Fetches a list of domains from user's GoDaddy account
 */
export const fetchGoDaddyDomains = async (apiKey: string, apiSecret: string): Promise<GoDaddyDomain[]> => {
    try {
        const response = await fetch(`${GODADDY_API_BASE}/domains?statuses=ACTIVE`, {
            headers: {
                'Authorization': `sso-key ${apiKey}:${apiSecret}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to fetch domains from GoDaddy');
        }

        return await response.json();
    } catch (error: any) {
        console.error('GoDaddy Fetch Domains Error:', error);
        throw error;
    }
};

/**
 * Updates DNS records for a GoDaddy domain to point to Firebase Hosting
 */
export const propogateFirebaseDNSFoundations = async (
    domain: string,
    apiKey: string,
    apiSecret: string,
    firebaseIps: string[] = ['199.36.158.100', '151.101.1.195']
): Promise<DNSResult> => {
    try {
        // 1. Prepare the A records
        const records: DNSRecord[] = firebaseIps.map(ip => ({
            type: 'A',
            name: '@',
            data: ip,
            ttl: 600
        }));

        // 2. Add a CNAME for www if desired (optional but good practice)
        records.push({
            type: 'CNAME',
            name: 'www',
            data: '@',
            ttl: 600
        });

        // 3. Send the PATCH request to GoDaddy to update only these records
        // Note: PATCH is better than PUT as it doesn't overwrite all records
        const response = await fetch(`${GODADDY_API_BASE}/domains/${domain}/records`, {
            method: 'PATCH',
            headers: {
                'Authorization': `sso-key ${apiKey}:${apiSecret}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(records)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to update DNS records on GoDaddy');
        }

        return {
            success: true,
            message: `Successfully connected ${domain} to Firebase Hosting via GoDaddy API.`
        };
    } catch (error: any) {
        console.error('GoDaddy DNS Update Error:', error);
        return {
            success: false,
            message: error.message || 'An unexpected error occurred during DNS propagation.'
        };
    }
};

/**
 * Helper to get recommended DNS records for manual setup
 */
export const getManualDNSRecords = (subdomain: string) => {
    return [
        { type: 'A', host: '@', value: '199.36.158.100', ttl: '3600' },
        { type: 'A', host: '@', value: '151.101.1.195', ttl: '3600' },
        { type: 'CNAME', host: 'www', value: `${subdomain}.web.app`, ttl: '3600' }
    ];
};
