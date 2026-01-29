/**
 * Domain Connect Service
 *
 * Implements the Domain Connect protocol for one-click domain configuration.
 * This is the same method used by Lovable.dev, Replit, Squarespace, and Microsoft 365.
 *
 * How it works:
 * 1. User enters their domain
 * 2. We redirect to GoDaddy's authorization page
 * 3. User clicks "Connect" on GoDaddy (logged into their account)
 * 4. GoDaddy applies our DNS template automatically
 * 5. User is redirected back with success confirmation
 *
 * No API keys needed from users!
 *
 * Documentation: https://www.domainconnect.org/
 */

export interface DomainConnectResult {
    success: boolean;
    message: string;
    redirectUrl?: string;
}

export interface DomainConnectConfig {
    providerId: string;
    providerName: string;
    serviceId: string;
    serviceName: string;
    redirectUri: string;
}

// Configuration for RenovateMySite as a Domain Connect service provider
const DOMAIN_CONNECT_CONFIG: DomainConnectConfig = {
    providerId: 'renovatemysite.app',
    providerName: 'RenovateMySite',
    serviceId: 'firebase-hosting',
    serviceName: 'Firebase Hosting',
    redirectUri: 'https://renovatemysite-app.web.app/domain-callback'
};

// GoDaddy Domain Connect endpoint
const GODADDY_DOMAIN_CONNECT_URL = 'https://dcc.godaddy.com/manage';

/**
 * Generates a random state parameter for OAuth-like security
 */
const generateState = (): string => {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
};

/**
 * Stores state in sessionStorage for verification on callback
 */
const storeState = (state: string, domain: string): void => {
    sessionStorage.setItem('domainConnectState', state);
    sessionStorage.setItem('domainConnectDomain', domain);
};

/**
 * Retrieves and validates stored state
 */
export const verifyState = (returnedState: string): { valid: boolean; domain: string | null } => {
    const storedState = sessionStorage.getItem('domainConnectState');
    const storedDomain = sessionStorage.getItem('domainConnectDomain');

    if (storedState === returnedState) {
        // Clear stored state after verification
        sessionStorage.removeItem('domainConnectState');
        sessionStorage.removeItem('domainConnectDomain');
        return { valid: true, domain: storedDomain };
    }

    return { valid: false, domain: null };
};

/**
 * Checks if a domain supports Domain Connect protocol
 * by querying the _domainconnect TXT record
 *
 * Note: This requires a DNS lookup which browsers can't do directly.
 * For production, you'd use a Cloud Function or external API.
 * For now, we assume GoDaddy domains support Domain Connect.
 */
export const checkDomainConnectSupport = async (domain: string): Promise<boolean> => {
    // GoDaddy supports Domain Connect for all their domains
    // In production, you could verify via DNS lookup through a backend
    // For now, we'll assume support and let GoDaddy handle unsupported cases

    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
};

/**
 * Generates the Domain Connect URL for GoDaddy
 * This URL redirects the user to GoDaddy where they can authorize the DNS changes
 */
export const generateConnectUrl = (domain: string): DomainConnectResult => {
    try {
        // Validate domain
        if (!domain || domain.trim() === '') {
            return {
                success: false,
                message: 'Please enter a domain name'
            };
        }

        // Clean domain (remove protocol, www, trailing slashes)
        const cleanDomain = domain
            .toLowerCase()
            .replace(/^(https?:\/\/)?(www\.)?/, '')
            .replace(/\/.*$/, '')
            .trim();

        // Basic validation
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(cleanDomain)) {
            return {
                success: false,
                message: 'Please enter a valid domain name (e.g., example.com)'
            };
        }

        // Generate state for security
        const state = generateState();
        storeState(state, cleanDomain);

        // Build the Domain Connect URL
        // Format: https://dcc.godaddy.com/manage/{domain}/dns
        const params = new URLSearchParams({
            providerName: DOMAIN_CONNECT_CONFIG.providerName,
            serviceName: DOMAIN_CONNECT_CONFIG.serviceName,
            redirect_uri: DOMAIN_CONNECT_CONFIG.redirectUri,
            state: state
        });

        const redirectUrl = `${GODADDY_DOMAIN_CONNECT_URL}/${cleanDomain}/dns?${params.toString()}`;

        return {
            success: true,
            message: 'Redirecting to GoDaddy...',
            redirectUrl
        };
    } catch (error: any) {
        console.error('Domain Connect URL generation error:', error);
        return {
            success: false,
            message: error.message || 'Failed to generate connect URL'
        };
    }
};

/**
 * Alternative: Direct GoDaddy DNS management URL
 * If Domain Connect template isn't approved yet, we can link directly to GoDaddy DNS
 * with instructions for manual setup
 */
export const generateGoDaddyDNSUrl = (domain: string): string => {
    const cleanDomain = domain
        .toLowerCase()
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/\/.*$/, '')
        .trim();

    return `https://dcc.godaddy.com/manage/${cleanDomain}/dns`;
};

/**
 * Handles the callback from GoDaddy after user authorizes
 */
export const handleCallback = (urlParams: URLSearchParams): DomainConnectResult => {
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    // Check for errors from GoDaddy
    if (error) {
        return {
            success: false,
            message: errorDescription || `Connection failed: ${error}`
        };
    }

    // Verify state parameter
    if (!state) {
        return {
            success: false,
            message: 'Invalid callback: missing state parameter'
        };
    }

    const verification = verifyState(state);
    if (!verification.valid) {
        return {
            success: false,
            message: 'Invalid callback: state mismatch. Please try again.'
        };
    }

    // Success!
    return {
        success: true,
        message: `Successfully connected ${verification.domain} to Firebase Hosting!`
    };
};

/**
 * Get the DNS records that need to be configured for Firebase Hosting
 * Used for showing manual instructions
 */
export const getFirebaseDNSRecords = () => {
    return [
        { type: 'A', name: '@', value: '199.36.158.100', ttl: 600 },
        { type: 'A', name: '@', value: '151.101.1.195', ttl: 600 },
        { type: 'CNAME', name: 'www', value: '@', ttl: 600 }
    ];
};

/**
 * Parse domain from various input formats
 */
export const parseDomain = (input: string): string => {
    return input
        .toLowerCase()
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/\/.*$/, '')
        .trim();
};
