import { getDb } from '../db/index.ts';
import { leads } from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { normalizeEmail } from './normalization/email.ts';
import { normalizePhone } from './normalization/phone.ts';
import { normalizeDomain } from './normalization/domain.ts';
import { normalizeCompanyName } from './normalization/company.ts';
import { calculateCompleteness } from './normalization/completeness.ts';
import { validateContact } from './validation/contactValidation.ts';
import { detectDuplicates } from './deduplication/deduplication.ts';
import { SalesForgeCrmAdapter, generateLeadIdempotencyKey } from './integration/salesforgeAdapter.ts';
import { calculateLeadScore } from './scoring/engine.ts';
import { enrichCompanyData } from './enrichment/companyEnricher.ts';
import { normalizeTags } from './normalization/tagNormalizer.ts';
import { evaluateBusinessRelevance } from './scoring/relevanceScorer.ts';

export async function processLead(userId: number, rawData: any, batchId?: number) {
  const db = getDb();

  // 0. Validation
  const validationResults = validateContact(rawData);

  // 1. Normalization
  const normalizedEmail = normalizeEmail(rawData.email);
  const normalizedPhone = normalizePhone(rawData.phone);
  const normalizedDomain = normalizeDomain(rawData.domain);
  const normalizedCompany = normalizeCompanyName(rawData.companyName);

  const normalizedData = {
    ...rawData,
    email: normalizedEmail.value,
    phone: normalizedPhone.value,
    domain: normalizedDomain.value,
    companyName: normalizedCompany.value,
  };

  // 2. Completeness
  const requiredFields = ['email', 'companyName'];
  const completeness = calculateCompleteness(normalizedData, requiredFields);

  // 3. Deduplication
  const duplicates = await detectDuplicates(normalizedData, new SalesForgeCrmAdapter());

  // 4. AI Enrichment & Relevance Evaluation (Executed concurrently for optimal throughput)
  const [aiEnrichment, relevance] = await Promise.all([
    enrichCompanyData(normalizedData),
    evaluateBusinessRelevance(normalizedData),
  ]);
  const normalizedTagsList = normalizeTags(aiEnrichment.suggested_tags);

  // 5. Final Scoring (Quality + Business Relevance)
  const scoring = calculateLeadScore(normalizedData, duplicates, relevance, validationResults);

  const derivedScoring = {
    ...scoring,
    completeness,
    relevance,
  };

  const combinedProcessedData = { 
    ...normalizedData, 
    aiEnrichment: { ...aiEnrichment, suggested_tags: normalizedTagsList }, 
    completeness, 
    validationResults, 
    duplicates, 
    scoring,
    relevance 
  };

  const idempotencyKey = generateLeadIdempotencyKey(normalizedData);

  // 6. Determine Status based on quality, duplicate conflicts, and contact validity
  let status: 'validated' | 'review' | 'rejected' = 'validated';
  
  const hasConfirmedDuplicate = duplicates.some(d => d.matchLevel === 'confirmed');
  const hasProbableDuplicate = duplicates.some(d => d.matchLevel === 'probable');
  const isInvalidEmail = validationResults.email?.status === 'invalid';
  const isMissingRequired = !normalizedData.companyName && !normalizedData.email;

  if (isInvalidEmail || isMissingRequired) {
    status = 'rejected';
  } else if (hasConfirmedDuplicate || hasProbableDuplicate || scoring.quality_score < 50) {
    status = 'review';
  } else {
    status = 'validated';
  }


  // Preserve 'raw' input data intact
  const newLead = await db.insert(leads).values({
    userId,
    batchId: batchId || null,
    raw_data: rawData,
    normalized_data: normalizedData,
    validation_results: validationResults,
    duplicate_matches: duplicates,
    ai_enrichment: { ...aiEnrichment, suggested_tags: normalizedTagsList },
    derived_scoring: derivedScoring,
    processed_data: combinedProcessedData,
    score: scoring.quality_score,
    tags: normalizedTagsList,
    status: status,
    crm_sync_status: 'unsynced',
    idempotency_key: idempotencyKey,
  }).returning();


  return newLead[0];
}

