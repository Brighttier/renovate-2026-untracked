import { GoogleGenAI, Type } from "@google/genai";
import { Message } from "../types";
import { SYSTEM_INSTRUCTION } from "../utils/prompts";

export type SearchStrategy = 'mix' | 'no_website' | 'has_website' | 'low_rated';

export const generateSiteUpdate = async (
  history: Message[],
  prompt: string,
  currentCode: string
): Promise<{ text: string; code: string | null }> => {
  const apiKey = process.env.API_KEY || '';
  if (!apiKey) {
    return { 
      text: "Error: API_KEY is missing. Please select a project.", 
      code: null 
    };
  }
  
  // Create instance here to ensure fresh API key
  const ai = new GoogleGenAI({ apiKey });

  try {
    const contextPrompt = `
      USER REQUEST: ${prompt}

      INSTRUCTIONS FOR UPDATE:
      1. You are editing the CURRENT CODE STATE provided below.
      2. If the user asks for a new page, DO NOT delete the existing code. Instead, restructure the site into sections (Home, About, etc.) and add a navigation bar to toggle them.
      3. CRITICAL: You MUST return the FULL, COMPLETE HTML for the entire application (inside body tags). Do not output partial snippets.
      
      ${currentCode ? `\n\nCURRENT CODE STATE (Do not lose this context):\n${currentCode}` : ''}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: [
        { role: 'user', parts: [{ text: contextPrompt }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 2048 }, // High thinking level for architecture
        temperature: 0.7,
      }
    });

    const outputText = response.text || '';
    
    // Robust extraction: Handle cases where model adds markdown code fences inside the tags
    const codeMatch = outputText.match(/\[CODE_UPDATE\]([\s\S]*?)\[\/CODE_UPDATE\]/);
    let code = codeMatch ? codeMatch[1].trim() : null;
    
    // Clean up markdown fences if present
    if (code) {
        code = code.replace(/^```(html|xml)?/i, '').replace(/```$/, '').trim();
    }
    
    const cleanText = outputText.replace(/\[CODE_UPDATE\][\s\S]*?\[\/CODE_UPDATE\]/, '').trim();

    return { text: cleanText, code };

  } catch (error) {
    console.error("Gemini API Error:", error);
    return { 
      text: "I encountered an error while communicating with the design engine. Please try again.", 
      code: null 
    };
  }
};

export const generateImage = async (prompt: string): Promise<string | null> => {
  const apiKey = process.env.API_KEY || '';
  if (!apiKey) return null;

  const ai = new GoogleGenAI({ apiKey });

  // Helper to extract image from response
  const extractImageFromResponse = (response: any) => {
    if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData && part.inlineData.data) {
             const base64Data = part.inlineData.data;
             const mimeType = part.inlineData.mimeType || 'image/png';
             return `data:${mimeType};base64,${base64Data}`;
          }
        }
      }
      return null;
  };

  try {
    console.log("Generating Image with Nano Banana Pro (gemini-3-pro-image-preview)...");
    
    // Attempt 1: High Quality (Nano Banana Pro)
    // We append specific keywords to ensure the model knows we want high fidelity.
    const enhancedPrompt = `${prompt}, photorealistic, 4k, high fidelity, no text`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: enhancedPrompt }] },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      }
    });
    return extractImageFromResponse(response);

  } catch (error) {
    console.warn("Gemini 3 Pro Image failed (likely 403/404), falling back to Flash Image:", error);
    
    try {
        // Attempt 2: Fallback to Flash Image (Standard Quality, less restricted)
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                imageConfig: {
                    aspectRatio: "16:9" 
                    // imageSize is NOT supported in flash-image
                }
            }
        });
        return extractImageFromResponse(response);

    } catch (fallbackError) {
        console.error("All image generation failed:", fallbackError);
        return null;
    }
  }
};

// --- NEW BRAND ANALYSIS FUNCTIONS ---

export interface BusinessResult {
    name: string;
    address: string;
    phoneNumber?: string;
    website: string | null;
    rating: number | null;
    userRatingCount?: number;
    description: string;
}

export const searchBusiness = async (query: string, strategy: SearchStrategy = 'mix'): Promise<BusinessResult[]> => {
  const apiKey = process.env.API_KEY || '';
  const ai = new GoogleGenAI({ apiKey });
  
  let strategyInstruction = "";
  switch(strategy) {
      case 'no_website': 
          strategyInstruction = "CRITICAL: Strictly prioritize finding businesses that do NOT have a website listed."; 
          break;
      case 'has_website': 
          strategyInstruction = "CRITICAL: Strictly prioritize finding businesses that HAVE an existing website url. Use Google Search to find the website if Maps data is missing. Do NOT return results with null website."; 
          break;
      case 'low_rated': 
          strategyInstruction = "Prioritize businesses with ratings below 4.0."; 
          break;
      default: 
          strategyInstruction = "Find a balanced mix. Use Google Search to verify website links."; 
          break;
  }
  
  try {
    console.log(`Searching with Google Maps & Search Grounding (Strategy: ${strategy}):`, query);
    
    // We use gemini-2.5-flash because it supports BOTH googleMaps and googleSearch tools together.
    // This allows for deep verification of website URLs.
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `
        Task: Find 12 local businesses matching: "${query}".
        Targeting Strategy: ${strategyInstruction}
        
        TOOLS: Use Google Maps to find the business entities, and Google Search to find/verify their official website URLs.
        
        Return a strict JSON Array of objects. 
        schema: [{ 
            "name": string, 
            "address": string, 
            "phoneNumber": string,
            "website": string | null, 
            "rating": number, 
            "userRatingCount": number,
            "description": string 
        }]
        
        Instructions:
        1. Follow the Targeting Strategy strictly.
        2. If 'has_website' is selected, verify the URL exists.
        3. Describe the business vibe in 'description'.
        4. Extract 'phoneNumber' if available, otherwise empty string.
        5. Do NOT include markdown formatting. Just the JSON.
      `,
      config: {
        tools: [{ googleMaps: {}, googleSearch: {} }], // Enable both tools for maximum data fidelity
      }
    });
    
    let jsonText = response.text || "[]";
    console.log("Raw Response:", jsonText);
    
    // Aggressive Cleanup to find JSON array
    jsonText = jsonText.replace(/^```(json)?/gm, '').replace(/```$/gm, '').trim();
    
    const start = jsonText.indexOf('[');
    const end = jsonText.lastIndexOf(']');
    
    if (start !== -1 && end !== -1) {
        jsonText = jsonText.substring(start, end + 1);
    } else {
        // Fallback single object check
        if (jsonText.startsWith('{')) {
            jsonText = `[${jsonText}]`;
        }
    }

    let data: any;
    try {
        data = JSON.parse(jsonText);
    } catch (e) {
        console.warn("JSON Parse Error", e, jsonText);
        return [];
    }

    if (Array.isArray(data)) {
        return data;
    } else if (data && Array.isArray(data.businesses)) {
        return data.businesses;
    }

    return [];

  } catch (e) {
    console.error("Search failed", e);
    return [];
  }
};

export const analyzeBrand = async (
  businessInfo: string, 
  logoBase64: string | null,
  websiteUrl: string
): Promise<string> => {
  const apiKey = process.env.API_KEY || '';
  const ai = new GoogleGenAI({ apiKey });
  
  const parts: any[] = [];
  
  // Prompt Construction
  const promptText = `
    Role: Elite Brand Strategist & Web Architect.
    Task: Analyze this business to create a comprehensive "Vibe Design System" for their new website.
    
    --- INPUTS ---
    Business Research: ${businessInfo}
    ${websiteUrl ? `Existing Website to Audit: ${websiteUrl}` : 'NOTE: This business currently has NO WEBSITE. You must invent a high-end digital identity for them.'}
    ${logoBase64 ? `(Logo Image Attached below)` : ''}
    
    --- ACTIONS ---
    1. If a URL is provided, use Google Search to find their current branding, services, and reputation.
    2. USE GOOGLE SEARCH to find their specific MENU ITEMS, SERVICE LIST, PRICING, and OPENING HOURS if available online.
    3. Analyze the business type and location to determine the appropriate "Atmosphere".
    
    --- OUTPUT ---
    Produce a "Design Brief" that I can feed directly into a web generator. It MUST include:
    
    SECTION 1: VIBE & AESTHETICS
    - Core Vibe (Adjectives)
    - Primary & Secondary Colors (Hex)
    - Typography Recommendations
    - Hero Section Concept
    
    SECTION 2: CONTENT DATA SHEET (CRITICAL)
    - Official Name
    - Full Address (Use the one provided in input)
    - Phone Number (Use the one provided in input)
    - Estimated Opening Hours (Find online or infer standard hours for this business type)
    - Key Services/Products List (Real data found via search)
    - Pricing Examples (if found)
    
    Keep it concise but ensure SECTION 2 is populated with facts to be used in the website text.
  `;

  parts.push({ text: promptText });
  
  // Add Image if present
  if (logoBase64) {
    const matches = logoBase64.match(/^data:(.+);base64,(.+)$/);
    if (matches) {
        parts.push({
            inlineData: {
                mimeType: matches[1],
                data: matches[2]
            }
        });
    }
  }

  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview', // High reasoning + Search + Multimodal
        contents: { parts },
        config: {
        tools: [{ googleSearch: {} }]
        }
    });

    return response.text || "Could not generate analysis.";
  } catch (e) {
      console.error("Brand analysis failed", e);
      return "Brand analysis failed. Proceeding with default vibe.";
  }
};
