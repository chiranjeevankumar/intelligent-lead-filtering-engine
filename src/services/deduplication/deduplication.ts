import { getDb } from '../../db/index.ts';
import { leads } from '../../db/schema.ts';
import { DuplicateMatch, ICrmIntegration } from '../integration/types.ts';
import stringSimilarity from 'string-similarity';

const GENERIC_COMPANY_WORDS = new Set([
  'solutions', 'services', 'technologies', 'technology', 'tech', 
  'systems', 'digital', 'global', 'international', 'holdings', 
  'group', 'consulting', 'software', 'corporation', 'corp', 
  'inc', 'llc', 'ltd', 'limited', 'private', 'pvt', 'india',
  'co', 'company', 'enterprises', 'associates', 'partners', 'agency'
]);

function isPlaceholder(val: any): boolean {
  if (!val || typeof val !== 'string') return true;
  const lower = val.trim().toLowerCase();
  return lower === '' || lower === 'not found' || lower === 'n/a' || lower === 'unknown' || lower === 'none' || lower === '-' || lower === 'null' || lower === 'missing' || lower === 'unverified';
}

function isValidEmailFormat(email: string): boolean {
  if (isPlaceholder(email)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isSocialDomain(domain: string): boolean {
  if (!domain) return true;
  const lower = domain.toLowerCase();
  return lower.includes('linkedin.com') || lower.includes('facebook.com') || 
         lower.includes('twitter.com') || lower.includes('x.com') || 
         lower.includes('instagram.com') || lower.includes('youtube.com') || 
         lower.includes('github.com') || lower.includes('crunchbase.com');
}

function stripGenericWords(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !GENERIC_COMPANY_WORDS.has(w))
    .join(' ')
    .trim();
}

export async function detectDuplicates(
  lead: any, 
  crm: ICrmIntegration, 
  localCandidates?: any[]
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];

  let candidateLeads: any[] = [];

  if (localCandidates && localCandidates.length > 0) {
    candidateLeads = localCandidates;
  } else {
    try {
      const db = getDb();
      if (db) {
        candidateLeads = await db.select().from(leads);
      }
    } catch (err) {
      // In unit test or offline mode
    }
  }

  const leadEmail = (lead.email || '').toLowerCase().trim();
  const leadCompany = (lead.companyName || '').toLowerCase().trim();
  const leadDomain = (lead.domain || '').toLowerCase().trim();
  const leadContact = (lead.name || '').toLowerCase().trim();

  for (const existingLead of candidateLeads) {
    // Do not compare a lead with itself
    if (lead.id && existingLead.id && String(lead.id) === String(existingLead.id)) {
      continue;
    }

    const existingData = existingLead.processed_data || existingLead;
    const existingEmail = (existingData.email || '').toLowerCase().trim();
    const existingCompany = (existingData.companyName || '').toLowerCase().trim();
    const existingDomain = (existingData.domain || '').toLowerCase().trim();
    const existingContact = (existingData.name || '').toLowerCase().trim();

    // 1. Exact Email Match (Requires valid email format on both records)
    if (isValidEmailFormat(leadEmail) && isValidEmailFormat(existingEmail) && leadEmail === existingEmail) {
      matches.push({
        id: (existingLead.id || '1').toString(),
        matchLevel: 'confirmed',
        source: 'local',
        details: `Exact email match: ${leadEmail}`,
      });
      continue;
    }

    // 2. Exact Re-import / Exact Entity Match (Identical Company AND matching Contact or Corporate Domain)
    if (!isPlaceholder(leadCompany) && !isPlaceholder(existingCompany) && leadCompany === existingCompany) {
      const hasMatchingContact = !isPlaceholder(leadContact) && !isPlaceholder(existingContact) && leadContact === existingContact;
      const hasMatchingDomain = !isPlaceholder(leadDomain) && !isPlaceholder(existingDomain) && 
                                leadDomain === existingDomain && !isSocialDomain(leadDomain);

      if (hasMatchingContact || hasMatchingDomain) {
        matches.push({
          id: (existingLead.id || '1').toString(),
          matchLevel: 'confirmed',
          source: 'local',
          details: `Exact duplicate: Identical company (${lead.companyName}) and matching ${hasMatchingContact ? 'contact' : 'corporate domain'}`,
        });
        continue;
      }
    }

    // 3. Fuzzy Company Name Match
    if (!isPlaceholder(leadCompany) && !isPlaceholder(existingCompany)) {
      const coreA = stripGenericWords(leadCompany);
      const coreB = stripGenericWords(existingCompany);

      // Do not run fuzzy match if stripped core is empty or too short (e.g. generic terms only)
      if (coreA.length >= 3 && coreB.length >= 3) {
        const rawSimilarity = stringSimilarity.compareTwoStrings(leadCompany, existingCompany);
        const coreSimilarity = stringSimilarity.compareTwoStrings(coreA, coreB);
        const similarity = Math.max(rawSimilarity, coreSimilarity);

        // Enforce strict thresholds to avoid false positives between distinct companies (e.g., FactSet vs Capgemini)
        const minThreshold = (leadCompany.length <= 6 || existingCompany.length <= 6) ? 0.90 : 0.80;

        if (similarity >= minThreshold) {
          matches.push({
            id: (existingLead.id || '1').toString(),
            matchLevel: 'probable',
            source: 'local',
            details: `Fuzzy company match: ${(similarity * 100).toFixed(0)}% similarity (${leadCompany} vs ${existingCompany})`,
          });
        }
      }
    }
  }

  // 4. CRM Integration Search
  try {
    const crmMatches = await crm.findDuplicates(lead);
    matches.push(...crmMatches);
  } catch (err) {
    // Offline or CRM check error
  }

  return matches;
}


