import { getAi } from '../../lib/gemini.ts';
import { Type } from '@google/genai';

export interface RelevanceResult {
  relevanceScore: number; // -1 (Unknown/Insufficient), 0 to 100
  explanation: string;
}

function calculateHeuristicRelevance(leadData: any, fallbackReason: string): RelevanceResult {
  const companyName = leadData?.companyName || '';
  const industry = leadData?.industry?.value || (typeof leadData?.industry === 'string' ? leadData.industry : '');
  const domain = leadData?.domain || '';
  const location = leadData?.location?.value || (typeof leadData?.location === 'string' ? leadData.location : '');
  const description = leadData?.description || '';
  const companySize = leadData?.companySize || leadData?.company_size_hint?.value || '';

  const hasName = companyName.length > 2;
  const hasDomain = domain.length > 4 && domain.includes('.');
  const hasIndustry = industry.length > 2;
  const hasDescription = description.length > 10;
  const hasLocation = location.length > 2;

  let score = 0;
  const reasons: string[] = [];

  if (hasName) {
    score += 20;
    reasons.push('Identifiable company name');
  }
  if (hasDomain) {
    score += 20;
    reasons.push('Corporate domain present');
  }
  if (hasIndustry) {
    score += 20;
    reasons.push('Defined industry');
  }
  if (hasDescription) {
    score += 30;
    reasons.push('Detailed business description');
  }
  if (hasLocation) {
    score += 10;
    reasons.push('Geographic footprint');
  }

  if (score === 0) {
    return {
      relevanceScore: -1,
      explanation: `Insufficient lead information to determine business relevance [${fallbackReason}].`,
    };
  }

  return {
    relevanceScore: score,
    explanation: `Heuristic relevance score ${score}% based on: ${reasons.join(', ')} [${fallbackReason}].`,
  };
}

export async function evaluateBusinessRelevance(leadData: any): Promise<RelevanceResult> {
  const hasSubstantialData = (leadData.companyName && leadData.companyName.length > 2) || 
                             (leadData.industry && String(leadData.industry).length > 2) ||
                             (leadData.description && leadData.description.length > 10);

  if (!hasSubstantialData) {
    return { relevanceScore: -1, explanation: 'Insufficient company details to perform business relevance assessment.' };
  }

  if (!process.env.GEMINI_API_KEY) {
    return calculateHeuristicRelevance(leadData, 'Gemini API key not configured');
  }

  try {
    const ai = getAi();
    const timeoutMs = 4000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI relevance request timed out after ${timeoutMs}ms`)), timeoutMs)
    );

    const prompt = `Evaluate the business relevance and legitimacy of this lead based on available data.
    Lead Data: ${JSON.stringify(leadData)}
    
    INSTRUCTIONS:
    1. Provide an integer relevanceScore from 0 to 100.
    2. Higher scores indicate a well-defined, identifiable, and active business entity with clear market presence.
    3. If the data is too sparse to make a determination, return -1 as the relevanceScore.
    4. Provide a concise explanation of the business relevance.
    5. Focus on entity legitimacy, industry clarity, and information completeness.`;

    const apiCallPromise = ai.models.generateContent(
      {
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              relevanceScore: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
            },
            required: ['relevanceScore', 'explanation'],
          },
        },
      }
    );

    const response = await Promise.race([apiCallPromise, timeoutPromise]);
    const result = JSON.parse(response.text || '{}');
    
    return {
      relevanceScore: result.relevanceScore ?? -1,
      explanation: result.explanation ?? 'Evaluated business relevance.',
    };
  } catch (error: any) {
    const errorMsg = error?.message?.includes('429')
      ? 'AI rate limit (429)'
      : error?.message?.includes('503')
        ? 'AI service high demand (503)'
        : error?.message?.includes('timed out')
          ? 'AI request timed out'
          : 'AI service unavailable';

    console.warn(`Business Relevance evaluation fallback applied: ${errorMsg}`);
    return calculateHeuristicRelevance(leadData, errorMsg);
  }
}
