/**
 * Firebase Hosting API Types
 * Types for Firebase Hosting REST API integration
 */

// ==========================================
// FIREBASE HOSTING SITE TYPES
// ==========================================

export interface FirebaseHostingSite {
    name: string;                    // projects/{project}/sites/{siteId}
    defaultUrl: string;              // {siteId}.web.app
    appId?: string;                  // Firebase App ID if linked
    type: 'DEFAULT_SITE' | 'USER_SITE';
    labels?: Record<string, string>;
}

export interface CreateSiteRequest {
    siteId: string;
    labels?: Record<string, string>;
}

export interface CreateSiteResponse {
    success: boolean;
    site?: FirebaseHostingSite;
    defaultUrl?: string;
    error?: string;
}

// ==========================================
// FIREBASE HOSTING VERSION TYPES
// ==========================================

export interface HostingVersion {
    name: string;                    // sites/{siteId}/versions/{versionId}
    status: VersionStatus;
    config?: HostingConfig;
    labels?: Record<string, string>;
    createTime?: string;
    createUser?: ActingUser;
    finalizeTime?: string;
    finalizeUser?: ActingUser;
    deleteTime?: string;
    deleteUser?: ActingUser;
    fileCount?: string;
    versionBytes?: string;
}

export type VersionStatus =
    | 'VERSION_STATUS_UNSPECIFIED'
    | 'CREATED'
    | 'FINALIZED'
    | 'DELETED'
    | 'ABANDONED'
    | 'EXPIRED'
    | 'CLONING';

export interface HostingConfig {
    headers?: HeaderConfig[];
    redirects?: RedirectConfig[];
    rewrites?: RewriteConfig[];
    cleanUrls?: boolean;
    trailingSlashBehavior?: 'TRAILING_SLASH_BEHAVIOR_UNSPECIFIED' | 'ADD' | 'REMOVE';
    appAssociation?: 'AUTO' | 'NONE';
    i18n?: I18nConfig;
}

export interface HeaderConfig {
    glob: string;
    headers: Record<string, string>;
    regex?: string;
}

export interface RedirectConfig {
    glob?: string;
    regex?: string;
    statusCode?: number;
    location: string;
}

export interface RewriteConfig {
    glob?: string;
    regex?: string;
    path?: string;
    function?: string;
    functionRegion?: string;
    run?: CloudRunRewrite;
    dynamicLinks?: boolean;
}

export interface CloudRunRewrite {
    serviceId: string;
    region?: string;
    tag?: string;
}

export interface I18nConfig {
    root: string;
}

export interface ActingUser {
    email: string;
    imageUrl?: string;
}

// ==========================================
// FIREBASE HOSTING RELEASE TYPES
// ==========================================

export interface HostingRelease {
    name: string;                    // sites/{siteId}/releases/{releaseId}
    version?: HostingVersion;
    type: ReleaseType;
    releaseTime?: string;
    releaseUser?: ActingUser;
    message?: string;
}

export type ReleaseType =
    | 'TYPE_UNSPECIFIED'
    | 'DEPLOY'
    | 'ROLLBACK'
    | 'SITE_DISABLE';

// ==========================================
// FIREBASE HOSTING CUSTOM DOMAIN TYPES
// ==========================================

export interface CustomDomain {
    name: string;                    // projects/{project}/sites/{site}/customDomains/{domain}
    domain: string;
    createTime?: string;
    updateTime?: string;
    hostState: HostState;
    ownershipState: OwnershipState;
    certPreference: CertPreference;
    cert?: Certificate;
    requiredDnsUpdates?: DnsUpdates;
    reconciling?: boolean;
    etag?: string;
}

export type HostState =
    | 'HOST_STATE_UNSPECIFIED'
    | 'HOST_UNHOSTED'
    | 'HOST_UNREACHABLE'
    | 'HOST_MISMATCH'
    | 'HOST_CONFLICT'
    | 'HOST_ACTIVE';

export type OwnershipState = {
    status: OwnershipStatus;
    desired?: DnsRecordSet[];
    pendingRecords?: DnsRecordSet[];
};

export type OwnershipStatus =
    | 'OWNERSHIP_STATUS_UNSPECIFIED'
    | 'OWNERSHIP_MISSING'
    | 'OWNERSHIP_UNREACHABLE'
    | 'OWNERSHIP_MISMATCH'
    | 'OWNERSHIP_CONFLICT'
    | 'OWNERSHIP_PENDING'
    | 'OWNERSHIP_ACTIVE';

export type CertPreference =
    | 'CERT_PREFERENCE_UNSPECIFIED'
    | 'GROUPED'
    | 'PROJECT_GROUPED'
    | 'DEDICATED';

export interface Certificate {
    state: CertState;
    type: CertType;
    verification?: CertVerification;
    expireTime?: string;
    createTime?: string;
    issueTime?: string;
}

export type CertState =
    | 'CERT_STATE_UNSPECIFIED'
    | 'CERT_PREPARING'
    | 'CERT_VALIDATING'
    | 'CERT_PROPAGATING'
    | 'CERT_ACTIVE'
    | 'CERT_EXPIRING_SOON'
    | 'CERT_EXPIRED';

export type CertType =
    | 'TYPE_UNSPECIFIED'
    | 'TEMPORARY'
    | 'GROUPED'
    | 'PROJECT_GROUPED'
    | 'DEDICATED';

export interface CertVerification {
    dns?: DnsUpdates;
    http?: HttpUpdate;
}

export interface DnsUpdates {
    discovered?: DnsRecordSet[];
    desired?: DnsRecordSet[];
    checkTime?: string;
}

export interface DnsRecordSet {
    domainName: string;
    records: DnsRecord[];
    checkError?: Status;
}

export interface DnsRecord {
    type: DnsRecordType;
    rrdatas: string[];
    requiredAction?: DnsRecordAction;
}

export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'TXT' | 'MX' | 'NS';
export type DnsRecordAction = 'NONE' | 'ADD' | 'REMOVE';

export interface HttpUpdate {
    path: string;
    desired: string;
    discovered?: string;
    lastCheckTime?: string;
    checkError?: Status;
}

export interface Status {
    code: number;
    message: string;
    details?: any[];
}

// ==========================================
// POPULATE FILES TYPES
// ==========================================

export interface PopulateFilesRequest {
    files: Record<string, string>;   // path -> SHA256 hash
}

export interface PopulateFilesResponse {
    uploadRequiredHashes?: string[];
    uploadUrl?: string;
}

export interface UploadResult {
    success: boolean;
    hash?: string;
    error?: string;
}

// ==========================================
// DEPLOYMENT WORKFLOW TYPES
// ==========================================

export interface DeploymentRequest {
    siteId: string;
    htmlContent: string;
    config?: HostingConfig;
}

export interface DeploymentResponse {
    success: boolean;
    siteUrl?: string;
    versionId?: string;
    releaseId?: string;
    error?: string;
}

// ==========================================
// DOMAIN CONNECTION TYPES
// ==========================================

export interface DomainConnectionRequest {
    domain: string;
    leadId: string;
    agencyId: string;
    userId: string;
    htmlContent: string;
    businessName: string;
    connectionMethod: 'firebase_auto' | 'godaddy_auto' | 'manual';
}

export interface DomainConnectionResponse {
    success: boolean;
    connectionId?: string;
    siteId?: string;
    siteUrl?: string;
    customDomain?: string;
    status?: DomainConnectionStatus;
    dnsRecords?: RequiredDnsRecord[];
    error?: string;
}

export type DomainConnectionStatus =
    | 'creating_site'
    | 'deploying_content'
    | 'adding_domain'
    | 'pending_dns'
    | 'dns_propagating'
    | 'pending_ssl'
    | 'ssl_provisioning'
    | 'connected'
    | 'error'
    | 'rollback';

export interface RequiredDnsRecord {
    type: DnsRecordType;
    name: string;
    value: string;
    ttl: number;
    status: 'pending' | 'configured' | 'propagating' | 'active' | 'error';
}

// ==========================================
// CLIENT SITE TRACKING
// ==========================================

export interface ClientSite {
    id: string;                      // Firebase Hosting site ID
    agencyId: string;
    leadId: string;
    userId: string;
    businessName: string;

    // Site info
    siteType: 'preview' | 'production';
    defaultUrl: string;              // {siteId}.web.app
    customDomain?: string;

    // Status
    status: ClientSiteStatus;
    lastDeployedAt?: string;
    currentVersionId?: string;
    currentReleaseId?: string;

    // Domain connection
    domainConnectionId?: string;
    domainConnectionStatus?: DomainConnectionStatus;
    sslStatus?: CertState;

    // Timestamps
    createdAt: string;
    updatedAt: string;
}

export type ClientSiteStatus =
    | 'creating'
    | 'active'
    | 'deploying'
    | 'domain_pending'
    | 'suspended'
    | 'deleted'
    | 'error';

// ==========================================
// POLLING / RETRY TYPES
// ==========================================

export interface PollDomainStatusRequest {
    connectionId: string;
    siteId: string;
    domain: string;
}

export interface PollDomainStatusResponse {
    connectionId: string;
    domain: string;
    hostState: HostState;
    ownershipStatus: OwnershipStatus;
    certState?: CertState;
    isComplete: boolean;
    requiresRetry: boolean;
    nextCheckDelay?: number;        // milliseconds
    error?: string;
}

export interface RetryTask {
    taskId: string;
    connectionId: string;
    action: 'poll_status' | 'verify_dns' | 'provision_ssl' | 'rollback';
    attemptCount: number;
    maxAttempts: number;
    nextAttemptAt: string;
    lastError?: string;
    createdAt: string;
}

// ==========================================
// CONSTANTS
// ==========================================

export const FIREBASE_HOSTING_IPS = {
    A: ['199.36.158.100', '151.101.1.195'],
    AAAA: ['2600:1901:0:1::']
};

export const FIREBASE_HOSTING_API_BASE = 'https://firebasehosting.googleapis.com/v1beta1';

export const DEFAULT_HOSTING_CONFIG: HostingConfig = {
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

export const SITE_ID_MAX_LENGTH = 30;
export const SITE_ID_PREFIX = 'rms';

export const POLL_INTERVALS = {
    INITIAL: 10000,                  // 10 seconds
    DNS_PROPAGATING: 30000,          // 30 seconds
    SSL_PROVISIONING: 60000,         // 1 minute
    MAX_POLL_DURATION: 3600000       // 1 hour
};

export const MAX_RETRY_ATTEMPTS = {
    SITE_CREATION: 3,
    DEPLOYMENT: 3,
    DOMAIN_ADDITION: 3,
    DNS_VERIFICATION: 20,
    SSL_PROVISIONING: 60
};
