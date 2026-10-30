import { getAi } from '../../lib/gemini.ts';
import { Type } from '@google/genai';

export interface EnrichedCompanyInfo {
  industry: { value: string | null; confidence: number; evidence: string };
  services: Array<{ value: string; confidence: number }>;
  company_size_hint: { value: string | null; confidence: number };
  location: { value: string | null; confidence: number };
  suggested_tags: string[];
}

/**
 * Deterministic heuristic fallback when AI is unavailable, rate-limited, or times out.
 */
function getHeuristicFallback(leadData: any, reason: string): EnrichedCompanyInfo {
  const companyName = String(leadData?.companyName || '').toLowerCase();
  const domain = String(leadData?.domain || '').toLowerCase();
  const combined = `${companyName} ${domain}`;

  let industry = 'General Business / B2B';
  let service = 'Business Services';
  const tags: string[] = ['B2B'];

  if (/tech|software|cloud|saas|digital|data|ai|systems|dev|cyber|security/.test(combined)) {
    if (/cyber|security/.test(combined)) {
      industry = 'Cybersecurity';
      service = 'Security Solutions';
      tags.push('Cybersecurity', 'IT');
    } else {
      industry = 'Technology & Software';
      service = 'Software & IT Services';
      tags.push('IT', 'Technology', 'SaaS');
    }
  } else if (/logistics|freight|transport|shipping|supply|carrier/.test(combined)) {
    industry = 'Logistics & Supply Chain';
    service = 'Freight & Transportation';
    tags.push('Logistics', 'Supply Chain');
  } else if (/finance|financial|capital|bank|invest|wealth|credit/.test(combined)) {
    industry = 'Financial Services';
    service = 'Financial Management';
    tags.push('Finance', 'Investment');
  } else if (/health|medical|care|pharma|bio|clinic/.test(combined)) {
    industry = 'Healthcare & Life Sciences';
    service = 'Healthcare Services';
    tags.push('Healthcare', 'Medical');
  } else if (/consulting|marketing|agency|media|creative|advisory/.test(combined)) {
    industry = 'Professional Services';
    service = 'Consulting & Strategy';
    tags.push('Consulting', 'Professional Services');
  } else if (/manufacturing|industrial|factory|engineering/.test(combined)) {
    industry = 'Manufacturing & Industrial';
    service = 'Manufacturing Operations';
    tags.push('Manufacturing', 'Industrial');
  }

  const locationVal = leadData?.location || leadData?.companyLocation || null;

  return {
    industry: {
      value: industry,
      confidence: 0.5,
      evidence: `Heuristic fallback: ${reason}`,
    },
    services: [{ value: service, confidence: 0.5 }],
    company_size_hint: { value: leadData?.companySize || null, confidence: 0.5 },
    location: { value: locationVal, confidence: locationVal ? 0.8 : 0.0 },
    suggested_tags: tags,
  };
}

export async function enrichCompanyData(leadData: any): Promise<EnrichedCompanyInfo> {
  const companyName = leadData?.companyName?.trim();
  const domain = leadData?.domain?.trim();

  // If minimal identifying data is missing, return fallback without network delay
  if (!companyName && !domain) {
    return getHeuristicFallback(leadData, 'Insufficient company details for AI analysis');
  }

  // If no Gemini API key configured, use documented heuristic fallback
  if (!process.env.GEMINI_API_KEY) {
    return getHeuristicFallback(leadData, 'Gemini API key not configured');
  }

  const prompt = `Analyze the following lead data and extract structured company information. 
  If information is missing, set value to null and confidence to 0.0. 
  Do not invent information. 
  Lead Data: ${JSON.stringify(leadData)}`;

  try {
    const ai = getAi();
    const timeoutMs = 3500;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI request timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    const apiCallPromise = ai.models.generateContent(
      {
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              industry: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING, nullable: true },
                  confidence: { type: Type.NUMBER },
                  evidence: { type: Type.STRING },
                },
                required: ['value', 'confidence', 'evidence'],
              },
              services: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    value: { type: Type.STRING },
                    confidence: { type: Type.NUMBER },
                  },
                  required: ['value', 'confidence'],
                },
              },
              company_size_hint: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING, nullable: true },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              location: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING, nullable: true },
                  confidence: { type: Type.NUMBER },
                },
                required: ['value', 'confidence'],
              },
              description: { type: Type.STRING, nullable: true },
              suggested_tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['industry', 'services', 'company_size_hint', 'location', 'suggested_tags'],
          },
        },
      }
    );

    const response = await Promise.race([apiCallPromise, timeoutPromise]);
    const parsed = JSON.parse(response.text || '{}');
    if (parsed.industry && parsed.suggested_tags) {
      return parsed;
    }
    return getHeuristicFallback(leadData, 'AI response format incomplete');
  } catch (error: any) {
    const errorMsg = error?.message?.includes('429') 
      ? 'AI rate limit exceeded (429)'
      : error?.message?.includes('503') 
        ? 'AI service high demand (503)' 
        : error?.message?.includes('timed out')
          ? 'AI request timed out'
          : 'AI service unavailable';

    console.warn(`AI Company Enrichment fallback applied: ${errorMsg}`);
    return getHeuristicFallback(leadData, errorMsg);
  }
}
