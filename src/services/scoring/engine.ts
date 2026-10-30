import { SCORING_WEIGHTS, MAX_SCORE } from './config.ts';
import { FieldValidation } from '../validation/contactValidation.ts';

export interface ScoreResult {
  quality_score: number; // Data Completeness & Validity
  business_relevance: number; // Business Relevance & Legitimacy (-1 for unknown)
  reason: string;
  factors: Record<string, number>;
  breakdown: Record<string, any>;
  isEligibleForExport: boolean;
}

export function calculateLeadScore(
  lead: any, 
  duplicates: any[], 
  relevance?: any, 
  validation?: Record<string, FieldValidation>
): ScoreResult {
  const factors: Record<string, number> = {};
  const explanations: string[] = [];

  // Use provided validation or fallback to basic presence checks
  const v = validation || {};

  // 1. Email Quality (20%)
  const emailStatus = v.email?.status || (lead.email ? 'unverified' : 'missing');
  if (emailStatus === 'valid') {
    factors.email_quality = SCORING_WEIGHTS.email_validity;
    explanations.push('Verified email address.');
  } else if (emailStatus === 'unverified') {
    factors.email_quality = Math.round(SCORING_WEIGHTS.email_validity * 0.8);
    explanations.push('Syntactically valid email (unverified).');
  } else if (emailStatus === 'invalid') {
    factors.email_quality = 0;
    explanations.push('Malformed email address.');
  } else {
    factors.email_quality = 0;
    explanations.push('Missing email address.');
  }

  // 2. Phone Quality (15%)
  const phoneStatus = v.phone?.status || (lead.phone ? 'unverified' : 'missing');
  if (phoneStatus === 'valid') {
    factors.phone_quality = SCORING_WEIGHTS.phone_validity;
    explanations.push('Verified phone number.');
  } else if (phoneStatus === 'unverified') {
    factors.phone_quality = Math.round(SCORING_WEIGHTS.phone_validity * 0.8);
    explanations.push('Valid phone format (unverified).');
  } else {
    factors.phone_quality = 0;
    explanations.push(phoneStatus === 'invalid' ? 'Malformed phone number.' : 'Missing phone number.');
  }

  // 3. Domain Quality (15%)
  const domainStatus = v.domain?.status || (lead.domain ? 'unverified' : 'missing');
  if (domainStatus === 'valid') {
    factors.domain_quality = SCORING_WEIGHTS.domain_availability;
    explanations.push('Verified corporate domain.');
  } else if (domainStatus === 'unverified') {
    // Check if it's a social domain (often marked as unverified in validation)
    const isSocial = v.domain?.explanation?.toLowerCase().includes('social');
    factors.domain_quality = Math.round(SCORING_WEIGHTS.domain_availability * (isSocial ? 0.4 : 0.8));
    explanations.push(isSocial ? 'Social/Public domain used as corporate domain.' : 'Valid domain format (unverified).');
  } else {
    factors.domain_quality = 0;
    explanations.push(domainStatus === 'invalid' ? 'Malformed domain.' : 'Missing domain.');
  }

  // 4. Company Name Quality (20%)
  const companyStatus = v.companyName?.status || (lead.companyName ? 'unverified' : 'missing');
  if (companyStatus === 'valid') {
    factors.company_quality = SCORING_WEIGHTS.company_information;
    explanations.push('Verified company identity.');
  } else if (companyStatus === 'unverified') {
    factors.company_quality = Math.round(SCORING_WEIGHTS.company_information * 0.9);
    explanations.push('Company name present.');
  } else {
    factors.company_quality = 0;
    explanations.push('Missing company name.');
  }

  // 5. Data Completeness (30%)
  // Scores 7.5 pts for each of the 4 core fields being present (not missing)
  const coreFields = ['email', 'phone', 'domain', 'companyName'];
  const presentCount = coreFields.filter(f => (v[f]?.status || (lead[f] ? 'present' : 'missing')) !== 'missing').length;
  factors.data_completeness = Math.round((presentCount / coreFields.length) * SCORING_WEIGHTS.data_completeness);
  if (presentCount < coreFields.length) {
    explanations.push(`Data completeness penalty: ${coreFields.length - presentCount} fields missing.`);
  }

  const totalQualityScore = Object.values(factors).reduce((a, b) => a + b, 0);

  // Business Relevance
  const business_relevance = relevance ? (relevance.relevanceScore ?? -1) : -1;

  // Duplicate Classification
  const hasConfirmedMatch = Array.isArray(duplicates) && duplicates.some(d => d.matchLevel === 'confirmed');
  const hasProbableMatch = Array.isArray(duplicates) && duplicates.some(d => d.matchLevel === 'probable');
  
  const isEligibleForExport = !hasConfirmedMatch && totalQualityScore >= 50;

  let reason = `Quality score: ${totalQualityScore}/100. `;
  if (hasConfirmedMatch) {
    reason += 'REJECTED: Confirmed duplicate. ';
  } else if (hasProbableMatch) {
    reason += 'REVIEW: Potential duplicate detected. ';
  }

  reason += explanations.join(' ');
  
  if (relevance) {
    if (relevance.relevanceScore === -1) {
      reason += ` Business relevance: Unknown - ${relevance.explanation}`;
    } else {
      reason += ` Business relevance: ${relevance.relevanceScore}% - ${relevance.explanation}`;
    }
  } else {
    reason += ' Business relevance: Not evaluated.';
  }

  return {
    quality_score: Math.min(totalQualityScore, MAX_SCORE),
    business_relevance,
    reason,
    factors,
    breakdown: {
      ...factors,
      completeness_ratio: presentCount / coreFields.length,
      validation_summary: Object.fromEntries(
        Object.entries(v).map(([k, val]) => [k, { status: val.status, explanation: val.explanation }])
      )
    },
    isEligibleForExport,
  };
}


