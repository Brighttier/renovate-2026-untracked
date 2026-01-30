import * as functions from 'firebase-functions';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';

const secretClient = new SecretManagerServiceClient();
let genAI: GoogleGenerativeAI | null = null;
let placesApiKey: string | null = null;

// Get API key from Secret Manager
async function getGeminiApiKey(): Promise<string> {
    const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';
    const secretName = `projects/${projectId}/secrets/gemini-api-key/versions/latest`;

    const [version] = await secretClient.accessSecretVersion({ name: secretName });
    const apiKey = version.payload?.data?.toString();

    if (!apiKey) {
        throw new Error('Failed to retrieve Gemini API key from Secret Manager');
    }

    return apiKey;
}

// Get Google Places API key from Secret Manager or environment
async function getPlacesApiKey(): Promise<string> {
    if (placesApiKey) return placesApiKey;

    // Try environment variable first (for quick testing)
    if (process.env.GOOGLE_PLACES_API_KEY) {
        placesApiKey = process.env.GOOGLE_PLACES_API_KEY;
        return placesApiKey;
    }

    // Fall back to Secret Manager
    try {
        const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-vibe';
        const secretName = `projects/${projectId}/secrets/google-places-api-key/versions/latest`;

        const [version] = await secretClient.accessSecretVersion({ name: secretName });
        const apiKey = version.payload?.data?.toString();

        if (!apiKey) {
            throw new Error('Failed to retrieve Google Places API key from Secret Manager');
        }

        placesApiKey = apiKey;
        return apiKey;
    } catch (error) {
        throw new Error('Google Places API key not found. Set GOOGLE_PLACES_API_KEY environment variable or create google-places-api-key secret in Secret Manager');
    }
}

// Initialize Gemini AI client
async function getGenAI(): Promise<GoogleGenerativeAI> {
    if (!genAI) {
        const apiKey = await getGeminiApiKey();
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
}

// CORS configuration
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// ==========================================
// GOOGLE PLACES API TYPES
// ==========================================

interface GooglePlaceResult {
    displayName: { text: string };
    formattedAddress: string;
    websiteUri?: string;
    nationalPhoneNumber?: string;
    types: string[];
    id: string;
}

interface FinalLead {
    id: string;
    businessName: string;
    location: string;
    phone: string | null;
    email: string | null;  // Scraped from website
    websiteUrl: string | null;
    websiteStatus: 'None' | 'Outdated' | 'Modern';
    pitchAngle: string;
    mapsUrl: string;
}

interface WebsiteAnalysis {
    placeId: string;
    websiteStatus: 'None' | 'Outdated' | 'Modern';
    pitchAngle: string;
}

// ==========================================
// GOOGLE PLACES API HELPER FUNCTIONS
// ==========================================

// Search Google Places API (New)
async function searchPlaces(query: string, location: string): Promise<GooglePlaceResult[]> {
    const apiKey = await getPlacesApiKey();

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.types'
        },
        body: JSON.stringify({
            textQuery: `${query} in ${location}`,
            maxResultCount: 15
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Places API error:', response.status, errorText);
        throw new Error(`Places API request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.places || [];
}

// Filter results by location - only filter by STATE or ZIP to catch obvious mismatches
// Trust Google Places API's geo-relevance for city/neighborhood matching
// When you search "dentists in Brookhaven GA", Places API already returns nearby results
function filterByLocation(places: GooglePlaceResult[], location: string): GooglePlaceResult[] {
    const locationLower = location.toLowerCase().trim();

    // Check if location is a ZIP code (5 digits, optionally with +4)
    const zipMatch = locationLower.match(/^(\d{5})(-\d{4})?$/);
    if (zipMatch) {
        const zipCode = zipMatch[1];
        // Filter by ZIP code prefix (first 3 digits define the region)
        const zipPrefix = zipCode.substring(0, 3);
        return places.filter(place => {
            const addressZipMatch = place.formattedAddress.match(/\b(\d{5})(-\d{4})?\b/);
            if (addressZipMatch) {
                const addressZipPrefix = addressZipMatch[1].substring(0, 3);
                // Match if same ZIP or nearby (same prefix = same region)
                return addressZipMatch[1] === zipCode || addressZipPrefix === zipPrefix;
            }
            // If no ZIP in address, trust the API's geo-relevance
            return true;
        });
    }

    // Split by comma to get city and state parts
    const locationParts = locationLower.split(',').map(p => p.trim()).filter(p => p.length > 0);

    // Extract state abbreviation (last part if 2 chars) or state name
    const statePart = locationParts.length > 1 ? locationParts[locationParts.length - 1] : null;

    // If no state specified, trust the API completely
    if (!statePart) {
        return places;
    }

    // Only filter by state - trust Places API for city/neighborhood geo-relevance
    return places.filter(place => {
        const addressLower = place.formattedAddress.toLowerCase();
        return addressLower.includes(statePart);
    });
}

// ==========================================
// EMAIL SCRAPING FROM WEBSITES
// ==========================================

/**
 * Scrape email address from a website
 * Fetches the homepage and contact page, extracts emails via regex
 */
async function scrapeEmailFromWebsite(websiteUrl: string): Promise<string | null> {
    if (!websiteUrl) return null;

    try {
        // Normalize URL
        let url = websiteUrl;
        if (!url.startsWith('http')) {
            url = `https://${url}`;
        }

        // Common patterns for excluding non-business emails
        const excludePatterns = [
            'example.com', 'email.com', 'domain.com', 'test.com',
            'sentry.io', 'wixpress.com', 'wordpress.com', 'squarespace.com',
            'mailchimp.com', 'constantcontact.com', 'hubspot.com',
            'google.com', 'googleapis.com', 'gstatic.com',
            'facebook.com', 'twitter.com', 'instagram.com',
            '@2x.', '@3x.', // Image naming patterns
            'noreply', 'no-reply', 'donotreply'
        ];

        // Email regex pattern
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

        // Pages to check for email
        const pagesToCheck = [
            url,
            `${url.replace(/\/$/, '')}/contact`,
            `${url.replace(/\/$/, '')}/contact-us`,
            `${url.replace(/\/$/, '')}/about`,
            `${url.replace(/\/$/, '')}/about-us`
        ];

        const allEmails: string[] = [];

        // Fetch pages with timeout
        for (const pageUrl of pagesToCheck.slice(0, 3)) { // Limit to 3 pages to save time
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

                const response = await fetch(pageUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; RenovateMySite/1.0; +https://renovatemysite.com)',
                        'Accept': 'text/html,application/xhtml+xml'
                    }
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const html = await response.text();
                    const matches = html.match(emailRegex) || [];
                    allEmails.push(...matches);
                }
            } catch (e) {
                // Page fetch failed, continue to next
                continue;
            }
        }

        // Filter and dedupe emails
        const validEmails = [...new Set(allEmails)]
            .map(email => email.toLowerCase())
            .filter(email => {
                // Must have valid TLD
                const tldMatch = email.match(/\.([a-z]{2,})$/);
                if (!tldMatch) return false;

                // Exclude common non-business patterns
                for (const pattern of excludePatterns) {
                    if (email.includes(pattern.toLowerCase())) return false;
                }

                // Exclude if looks like image filename
                if (email.includes('.png') || email.includes('.jpg') || email.includes('.gif')) {
                    return false;
                }

                return true;
            });

        // Return the first valid email found
        return validEmails.length > 0 ? validEmails[0] : null;

    } catch (error) {
        console.log(`[scrapeEmail] Failed for ${websiteUrl}:`, error);
        return null;
    }
}

/**
 * Batch scrape emails from multiple websites
 * Runs in parallel with concurrency limit
 */
async function batchScrapeEmails(places: GooglePlaceResult[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();

    // Filter places that have websites
    const placesWithWebsites = places.filter(p => p.websiteUri);

    if (placesWithWebsites.length === 0) {
        return results;
    }

    console.log(`[batchScrapeEmails] Scraping emails from ${placesWithWebsites.length} websites`);

    // Run in parallel with concurrency limit of 5
    const batchSize = 5;
    for (let i = 0; i < placesWithWebsites.length; i += batchSize) {
        const batch = placesWithWebsites.slice(i, i + batchSize);
        const promises = batch.map(async (place) => {
            const email = await scrapeEmailFromWebsite(place.websiteUri!);
            results.set(place.id, email);
            if (email) {
                console.log(`[batchScrapeEmails] Found email for ${place.displayName.text}: ${email}`);
            }
        });
        await Promise.all(promises);
    }

    const foundCount = Array.from(results.values()).filter(e => e !== null).length;
    console.log(`[batchScrapeEmails] Found ${foundCount} emails from ${placesWithWebsites.length} websites`);

    return results;
}

// Analyze websites with Gemini to determine quality and generate pitch
async function analyzeWebsites(places: GooglePlaceResult[]): Promise<WebsiteAnalysis[]> {
    if (places.length === 0) return [];

    const ai = await getGenAI();
    const model = ai.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: { temperature: 0.3 }
    });

    const businessList = places.map(p => ({
        placeId: p.id,
        name: p.displayName.text,
        address: p.formattedAddress,
        website: p.websiteUri || 'NONE',
        types: p.types?.slice(0, 3) || []
    }));

    const prompt = `Analyze these businesses for website quality and sales opportunity.

BUSINESSES:
${JSON.stringify(businessList, null, 2)}

For each business, evaluate:
1. websiteStatus:
   - "None" if website is "NONE"
   - "Outdated" if website exists but appears old (indicators: old copyright dates, non-responsive design, flash, outdated styling, missing HTTPS, generic templates)
   - "Modern" if website appears professional and current

2. pitchAngle: A compelling 1-2 sentence reason why they need a new/better website. Be specific to their business type. Examples:
   - For a dentist with no website: "New patients search online first - a professional website could help you capture the 77% of patients who research dentists online."
   - For a restaurant with outdated site: "Your menu and ambiance deserve a website that matches - a modern site with online ordering could boost takeout orders by 30%."

Return ONLY valid JSON array (no markdown):
[
  {
    "placeId": "place_id_here",
    "websiteStatus": "None",
    "pitchAngle": "Your compelling pitch..."
  }
]`;

    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);

        if (!jsonMatch) {
            console.warn('No JSON array found in Gemini response');
            return [];
        }
        return JSON.parse(jsonMatch[0]);
    } catch (error) {
        console.error('Error analyzing websites with Gemini:', error);
        return [];
    }
}

// ==========================================
// EXISTING TYPES AND FUNCTIONS
// ==========================================

interface BusinessResearchResult {
    name: string;
    address?: string;
    phone?: string;
    email?: string;
    hours?: Record<string, string>;
    services?: string[];
    rating?: number;
    reviewCount?: number;
    websiteUrl?: string;
    googleMapsUrl?: string;
    socialLinks?: {
        facebook?: string;
        instagram?: string;
        twitter?: string;
        linkedin?: string;
        yelp?: string;
    };
    description?: string;
}

/**
 * Research a business using Gemini with Google Search grounding
 * This function gathers accurate, real-world data about a business
 */
export const researchBusiness = functions
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
    })
    .https.onRequest(async (req, res) => {
    // Handle CORS preflight
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
        const { businessName, location, category, websiteUrl } = req.body;

        if (!businessName) {
            res.status(400).json({ error: 'businessName is required' });
            return;
        }

        const ai = await getGenAI();

        // Use Gemini 2.0 Flash with Google Search grounding
        // Note: The SDK may need to be updated to support tools parameter
        // For now, we'll use a detailed prompt that encourages web-accurate responses
        const model = ai.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: {
                temperature: 0.3, // Lower temperature for more factual responses
            }
        });

        const locationStr = location ? ` in ${location}` : '';
        const categoryStr = category ? ` (${category} business)` : '';

        const prompt = `You are a business research assistant with access to current web information. Research "${businessName}"${locationStr}${categoryStr} and provide accurate, real information.

${websiteUrl ? `Their website is: ${websiteUrl}` : ''}

Find and return the following information about this specific business:

1. **Full Business Name** - The official registered name
2. **Address** - Complete street address with city, state, zip
3. **Phone Number** - Primary contact number
4. **Email** - Contact email if publicly available
5. **Business Hours** - Operating hours for each day of the week
6. **Services/Products** - What they offer (list 5-10 main services)
7. **Rating** - Google rating (number out of 5)
8. **Review Count** - Number of Google reviews
9. **Website URL** - Their official website
10. **Google Maps URL** - Direct link to their Google Maps listing
11. **Social Media Links** - Facebook, Instagram, Twitter, LinkedIn, Yelp profiles
12. **Business Description** - A brief 2-3 sentence description of what they do

Return ONLY valid JSON with this structure (use null for unavailable info):
{
  "name": "Official Business Name",
  "address": "123 Main St, City, State 12345",
  "phone": "(555) 123-4567",
  "email": "contact@business.com",
  "hours": {
    "monday": "9:00 AM - 5:00 PM",
    "tuesday": "9:00 AM - 5:00 PM",
    "wednesday": "9:00 AM - 5:00 PM",
    "thursday": "9:00 AM - 5:00 PM",
    "friday": "9:00 AM - 5:00 PM",
    "saturday": "10:00 AM - 2:00 PM",
    "sunday": "Closed"
  },
  "services": ["Service 1", "Service 2", "Service 3"],
  "rating": 4.5,
  "reviewCount": 150,
  "websiteUrl": "https://example.com",
  "googleMapsUrl": "https://maps.google.com/...",
  "socialLinks": {
    "facebook": "https://facebook.com/...",
    "instagram": "https://instagram.com/...",
    "twitter": null,
    "linkedin": null,
    "yelp": "https://yelp.com/..."
  },
  "description": "Brief description of the business..."
}

IMPORTANT:
- Only include information you are confident is accurate
- Use null for any fields you cannot verify
- Do not make up information - accuracy is critical
- Return ONLY the JSON object, no markdown or additional text`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const researchData: BusinessResearchResult = JSON.parse(jsonMatch[0]);

            // Clean up null values
            const cleanedData: BusinessResearchResult = {
                name: researchData.name || businessName
            };

            if (researchData.address) cleanedData.address = researchData.address;
            if (researchData.phone) cleanedData.phone = researchData.phone;
            if (researchData.email) cleanedData.email = researchData.email;
            if (researchData.hours) cleanedData.hours = researchData.hours;
            if (researchData.services?.length) cleanedData.services = researchData.services;
            if (researchData.rating) cleanedData.rating = researchData.rating;
            if (researchData.reviewCount) cleanedData.reviewCount = researchData.reviewCount;
            if (researchData.websiteUrl) cleanedData.websiteUrl = researchData.websiteUrl;
            if (researchData.googleMapsUrl) cleanedData.googleMapsUrl = researchData.googleMapsUrl;
            if (researchData.description) cleanedData.description = researchData.description;

            // Clean up social links
            if (researchData.socialLinks) {
                const socialLinks: BusinessResearchResult['socialLinks'] = {};
                if (researchData.socialLinks.facebook) socialLinks.facebook = researchData.socialLinks.facebook;
                if (researchData.socialLinks.instagram) socialLinks.instagram = researchData.socialLinks.instagram;
                if (researchData.socialLinks.twitter) socialLinks.twitter = researchData.socialLinks.twitter;
                if (researchData.socialLinks.linkedin) socialLinks.linkedin = researchData.socialLinks.linkedin;
                if (researchData.socialLinks.yelp) socialLinks.yelp = researchData.socialLinks.yelp;
                if (Object.keys(socialLinks).length > 0) {
                    cleanedData.socialLinks = socialLinks;
                }
            }

            res.json(cleanedData);
        } else {
            // Return minimal data if parsing fails
            res.json({
                name: businessName,
                address: location || undefined
            });
        }
    } catch (error: any) {
        console.error('researchBusiness error:', error);
        res.status(500).json({ error: error.message || 'Failed to research business' });
    }
});

/**
 * Enhanced business search with Google Search grounding
 * Returns real businesses with website URLs for scraping
 */
export const findBusinessesWithSearch = functions
    .runWith({
        timeoutSeconds: 60,
        memory: '512MB'
    })
    .https.onRequest(async (req, res) => {
    // Handle CORS preflight
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
        const { category, location } = req.body;

        if (!category || !location) {
            res.status(400).json({ error: 'category and location are required' });
            return;
        }

        const ai = await getGenAI();
        const model = ai.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: {
                temperature: 0.3,
            }
        });

        const prompt = `You are a local business research assistant. Find 5-8 REAL ${category} businesses in ${location}.

Use your knowledge to find actual businesses that exist. For each business provide:
- id: A unique slug identifier (lowercase, hyphens, no spaces)
- name: The actual business name
- rating: Their Google rating (realistic number 3.5-5.0)
- address: Their real street address in ${location}
- websiteStatus: "None" if they don't have a website, "Outdated" if basic/old, "Good" if modern
- phone: Their phone number if known
- websiteUrl: Their actual website URL if they have one
- googleMapsUrl: A Google Maps search URL for the business

Return ONLY a valid JSON array with this structure:
[
  {
    "id": "business-name-slug",
    "name": "Actual Business Name",
    "rating": 4.5,
    "address": "123 Main Street, ${location}",
    "websiteStatus": "Outdated",
    "phone": "(555) 123-4567",
    "websiteUrl": "https://their-website.com",
    "googleMapsUrl": "https://www.google.com/maps/search/Business+Name+${location.replace(/ /g, '+')}"
  }
]

IMPORTANT:
- Only include real businesses you are confident exist
- Focus on businesses that would benefit from a new website (no website or outdated website)
- Include websiteUrl only if you're confident it's correct
- Return ONLY the JSON array, no markdown or explanation`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Extract JSON from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const businesses = JSON.parse(jsonMatch[0]);
            res.json(businesses);
        } else {
            // Fallback with generic data
            res.json([
                {
                    id: `${category.toLowerCase()}-1`,
                    name: `${category} Business 1`,
                    rating: 4.5,
                    address: location,
                    websiteStatus: 'None'
                },
                {
                    id: `${category.toLowerCase()}-2`,
                    name: `${category} Business 2`,
                    rating: 4.2,
                    address: location,
                    websiteStatus: 'Outdated'
                }
            ]);
        }
    } catch (error: any) {
        console.error('findBusinessesWithSearch error:', error);
        res.status(500).json({ error: error.message || 'Failed to find businesses' });
    }
});

/**
 * Find business leads using Google Places API + Gemini Analysis
 * Search-Verify-Analyze Architecture:
 * 1. SEARCH: Google Places API for real businesses
 * 2. FILTER: TypeScript validation for correct location
 * 3. ANALYZE: Gemini evaluates website quality & generates pitch
 * 4. RETURN: Clean FinalLead[] array (empty if no results - NO fake data)
 */
export const findLeadsWithMaps = functions
    .runWith({
        timeoutSeconds: 90,
        memory: '512MB'
    })
    .https.onRequest(async (req, res) => {
    // Handle CORS preflight
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
        const { query, location } = req.body;

        if (!query || !location) {
            res.status(400).json({ error: 'query and location are required' });
            return;
        }

        console.log(`[findLeadsWithMaps] Searching for: "${query}" in "${location}"`);

        // 1. SEARCH: Get real businesses from Google Places API
        let allPlaces: GooglePlaceResult[];
        try {
            allPlaces = await searchPlaces(query, location);
            console.log(`[findLeadsWithMaps] Places API returned ${allPlaces.length} results`);
        } catch (placesError: any) {
            console.error('[findLeadsWithMaps] Places API error:', placesError);
            // Return empty array instead of fake data
            res.json({ leads: [], message: 'Unable to search businesses. Please try again.' });
            return;
        }

        if (allPlaces.length === 0) {
            // No fake data - return empty array
            res.json({ leads: [], message: 'No businesses found in this area' });
            return;
        }

        // 2. FILTER: Only filter by state to catch obvious mismatches
        // Trust Google Places API's geo-relevance - when you search "Brookhaven GA", it returns Brookhaven businesses
        console.log(`[findLeadsWithMaps] Raw addresses from API:`, allPlaces.map(p => p.formattedAddress));

        const filteredPlaces = filterByLocation(allPlaces, location);
        console.log(`[findLeadsWithMaps] After state filter: ${allPlaces.length} -> ${filteredPlaces.length} places`);

        if (filteredPlaces.length === 0) {
            res.json({ leads: [], message: 'No businesses found in the specified state' });
            return;
        }

        // 3. ANALYZE: Use Gemini to evaluate websites and generate pitches
        // Also scrape emails in parallel
        const [analyses, emailMap] = await Promise.all([
            analyzeWebsites(filteredPlaces),
            batchScrapeEmails(filteredPlaces)
        ]);
        console.log(`[findLeadsWithMaps] Gemini analyzed ${analyses.length} businesses`);

        // 4. STANDARDIZE: Build final lead array
        const leads: FinalLead[] = filteredPlaces.map(place => {
            const analysis = analyses.find(a => a.placeId === place.id);

            // Default values if Gemini analysis not found
            const defaultStatus: 'None' | 'Outdated' | 'Modern' = place.websiteUri ? 'Outdated' : 'None';
            const defaultPitch = place.websiteUri
                ? 'Their current website could use a modern refresh to better serve customers.'
                : 'A professional website could help this business reach more customers online.';

            return {
                id: place.id,
                businessName: place.displayName.text,
                location: place.formattedAddress,
                phone: place.nationalPhoneNumber || null,
                email: emailMap.get(place.id) || null,  // Add scraped email
                websiteUrl: place.websiteUri || null,
                websiteStatus: analysis?.websiteStatus || defaultStatus,
                pitchAngle: analysis?.pitchAngle || defaultPitch,
                mapsUrl: `https://www.google.com/maps/place/?q=place_id:${place.id}`
            };
        });

        // Prioritize businesses that need websites (None or Outdated)
        const prioritizedLeads = leads
            .filter(l => l.websiteStatus !== 'Modern')
            .slice(0, 10);

        // If all filtered results are Modern, return them anyway (but still capped at 10)
        const finalLeads = prioritizedLeads.length > 0 ? prioritizedLeads : leads.slice(0, 10);

        console.log(`[findLeadsWithMaps] Returning ${finalLeads.length} leads`);
        res.json({ leads: finalLeads });

    } catch (error: any) {
        console.error('[findLeadsWithMaps] Error:', error);
        res.status(500).json({ error: error.message || 'Failed to find leads' });
    }
});
