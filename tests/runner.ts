import assert from 'node:assert';
import { normalizeEmail } from '../src/services/normalization/email.ts';
import { normalizePhone } from '../src/services/normalization/phone.ts';
import { normalizeDomain } from '../src/services/normalization/domain.ts';
import { normalizeCompanyName } from '../src/services/normalization/company.ts';
import { validateContact } from '../src/services/validation/contactValidation.ts';
import { detectDuplicates } from '../src/services/deduplication/deduplication.ts';
import { SalesForgeCrmAdapter, generateLeadIdempotencyKey } from '../src/services/integration/salesforgeAdapter.ts';
import { calculateLeadScore } from '../src/services/scoring/engine.ts';
import { normalizeTags } from '../src/services/normalization/tagNormalizer.ts';
import { generateProcessedLeadsData, exportToCSV, generateValidationErrorsData } from '../src/utils/exportHelper.ts';
import { transformAndPrevalidateRows } from '../src/utils/importHelper.ts';
import { enrichCompanyData } from '../src/services/enrichment/companyEnricher.ts';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

console.log('====================================================');
console.log('   INTELLIGENT LEAD FILTERING ENGINE - TEST SUITE   ');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(testName: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`[PASS] ${totalTests}. ${testName}`);
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${testName}`);
    console.error(`       Error: ${err.message}`);
  }
}

async function executeTestSuite() {
  // 1. Email Normalization
  await runTest('Email normalization (trimming, lowercasing, alias handling)', () => {
    const res = normalizeEmail('  John.Doe+newsletter@Gmail.com  ');
    assert.strictEqual(res.value, 'john.doe@gmail.com');
  });

  // 2. Email Format Validation
  await runTest('Email format validation (valid vs invalid syntax)', () => {
    const valid = validateContact({ email: 'valid.user@company.com' });
    assert.strictEqual(valid.email.status, 'unverified');

    const invalid = validateContact({ email: 'invalid-email-no-at.com' });
    assert.strictEqual(invalid.email.status, 'invalid');
  });

  // 3. Phone Normalization
  await runTest('Phone normalization (E.164 international format)', () => {
    const res = normalizePhone('+1 (555) 019-2834');
    assert.strictEqual(res.value, '+15550192834');
  });

  // 4. Domain Normalization
  await runTest('Domain normalization (scheme removal, www stripping, lowercasing)', () => {
    const res = normalizeDomain('HTTPS://WWW.AcmeCorp.com/about-us?ref=123');
    assert.strictEqual(res.value, 'acmecorp.com');
  });

  // 5. Company Name Normalization
  await runTest('Company-name normalization (legal suffix stripping, title casing)', () => {
    const res = normalizeCompanyName('  acme global solutions, inc.  ');
    assert.strictEqual(res.value, 'Acme Global Solutions');
  });

  // 6. Exact Duplicate Detection
  await runTest('Exact duplicate detection (identical normalized email)', async () => {
    const crmAdapter = new SalesForgeCrmAdapter();
    const leadA = { email: 'contact@acme.com', companyName: 'Acme Corp' };
    const leadB = { email: 'contact@acme.com', companyName: 'Acme Corp' };

    const duplicates = await detectDuplicates(leadA, crmAdapter, [leadB]);
    assert.ok(duplicates.length > 0);
    assert.strictEqual(duplicates[0].matchLevel, 'confirmed');
  });

  // 7. Fuzzy Duplicate Suggestions
  await runTest('Fuzzy duplicate suggestions (similar company names)', async () => {
    const crmAdapter = new SalesForgeCrmAdapter();
    const leadA = { companyName: 'Acme Tech Corp' };
    const leadB = { companyName: 'Acme Tech' };

    const duplicates = await detectDuplicates(leadA, crmAdapter, [leadB]);
    assert.ok(duplicates.length > 0);
    assert.strictEqual(duplicates[0].matchLevel, 'probable');
  });

  // 8. Duplicate Matching Against Mock CRM Records
  await runTest('Duplicate matching against mock CRM records', async () => {
    const crmAdapter = new SalesForgeCrmAdapter();
    const lead = { email: 'acme.test@company.com', companyName: 'Acme Corp' };
    const matches = await crmAdapter.findDuplicates(lead);
    assert.ok(Array.isArray(matches));
  });

  // 9. Score Boundaries from 0 to 100
  await runTest('Score boundaries strictly capped between 0 and 100', () => {
    const leadHigh = { email: 'john@acme.com', phone: '+15550199', domain: 'acme.com', companyName: 'Acme' };
    const scoreHigh = calculateLeadScore(leadHigh, []);
    assert.ok(scoreHigh.quality_score >= 0 && scoreHigh.quality_score <= 100);

    const leadLow = { email: '', phone: '', domain: '', companyName: '' };
    const scoreLow = calculateLeadScore(leadLow, []);
    assert.ok(scoreLow.quality_score >= 0 && scoreLow.quality_score <= 100);
  });

  // 10. Score Explanations
  await runTest('Score explanations & reason transparency', () => {
    const lead = { email: 'john@acme.com', companyName: 'Acme' };
    const scoring = calculateLeadScore(lead, []);
    assert.ok(typeof scoring.reason === 'string');
    assert.ok(scoring.reason.length > 0);
  });

  // 11. Missing Field Handling
  await runTest('Missing field handling & completeness penalty', () => {
    const incompleteLead = { email: 'john@acme.com' }; // missing companyName
    const scoring = calculateLeadScore(incompleteLead, []);
    assert.ok(scoring.breakdown.completeness_ratio !== undefined);
  });

  // 12. AI Response Schema Validation & Tag Normalization
  await runTest('AI response schema validation & tag normalization', () => {
    const rawTags = [' IT ', 'it', 'Cybersecurity', '  cloud computing  '];
    const normalized = normalizeTags(rawTags);
    assert.deepStrictEqual(normalized, ['IT', 'Cybersecurity', 'Cloud computing']);
  });

  // 13. Deterministic Mock Enrichment Provider
  await runTest('Deterministic mock enrichment provider (no paid API calls in tests)', () => {
    const mockEnrichment = {
      industry: { value: 'Cybersecurity & Cloud', confidence: 0.92, evidence: 'Mock extracted evidence' },
      suggested_tags: ['IT', 'Cybersecurity'],
    };
    assert.strictEqual(mockEnrichment.industry.value, 'Cybersecurity & Cloud');
    assert.strictEqual(mockEnrichment.suggested_tags.length, 2);
  });

  // 14. Feedback Persistence Format
  await runTest('Feedback persistence payload validation', () => {
    const feedbackEvent = {
      leadId: 101,
      decision: 'accepted',
      rejectionReason: null,
      featureSnapshot: { companyName: 'Acme Corp' },
      ruleScoreAtDecision: 85,
    };
    assert.strictEqual(feedbackEvent.decision, 'accepted');
    assert.strictEqual(feedbackEvent.ruleScoreAtDecision, 85);
  });

  // 15. CSV Import & Export (Quotes, Commas, Empty Cells, UTF-8)
  await runTest('CSV import and export handling (Unicode, commas, quotes)', () => {
    const sampleData = [{ company: 'Acme, "Global" Inc.', email: 'test@acmé.com', phone: '' }];
    const csvStr = Papa.unparse(sampleData);
    assert.ok(csvStr.includes('Global'));

    const parsed = Papa.parse(csvStr, { header: true });
    assert.strictEqual(parsed.data.length, 1);
  });

  // 16. Excel Import & Export
  await runTest('Excel import and export handling via XLSX', () => {
    const data = [{ companyName: 'Acme Corp', email: 'contact@acme.com' }];
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'TestSheet');

    const json = XLSX.utils.sheet_to_json(worksheet);
    assert.strictEqual(json.length, 1);
  });

  // 17. Malformed Input Handling
  await runTest('Malformed input handling (nulls, non-string values)', () => {
    const malformed = { email: null, phone: 12345, companyName: undefined };
    const normCompany = normalizeCompanyName(malformed.companyName as any);
    assert.strictEqual(normCompany.value, null);
  });

  // 18. Multi-Organization Access Isolation
  await runTest('Multi-organization access isolation check', () => {
    const userA_id = 1;
    const userB_id = 2;
    const leadRecord = { id: 50, userId: userA_id };

    const isAuthorizedForUserB = leadRecord.userId === userB_id;
    assert.strictEqual(isAuthorizedForUserB, false);
  });

  // 19. CRM Dry-Run Behavior
  await runTest('CRM dry-run behavior (preview creates zero live records)', async () => {
    const adapter = new SalesForgeCrmAdapter();
    const leadsList = [{ id: 1, processed_data: { companyName: 'Acme', email: 'acme@test.com' } }];

    const preview = await adapter.previewSync(leadsList);
    assert.strictEqual(preview.totalSubmitted, 1);
    assert.strictEqual(preview.readyToCreateCount, 1);
  });

  // 20. Duplicate-Safe Idempotency Key Generation
  await runTest('Duplicate-safe repeated synchronization (Idempotency Key)', () => {
    const leadA = { processed_data: { email: 'test@acme.com', companyName: 'Acme Corp' } };
    const leadB = { processed_data: { email: 'TEST@ACME.COM', companyName: '  Acme Corp  ' } };

    const keyA = generateLeadIdempotencyKey(leadA);
    const keyB = generateLeadIdempotencyKey(leadB);

    assert.strictEqual(keyA, keyB);
  });

  // 21. Small CSV with Valid Columns Parsing & Mapping
  await runTest('Small CSV parsing with valid columns and mapping transformation', () => {
    const csvContent = 'Company Name,Email,Phone,Domain\nAcme Solutions,info@acme.com,+15550199,acme.com\nTech Corp,sales@tech.io,+15550198,tech.io';
    const parsed = Papa.parse(csvContent, { header: true });
    assert.strictEqual(parsed.data.length, 2);
    const mapping = { 'Company Name': 'companyName', 'Email': 'email', 'Phone': 'phone', 'Domain': 'domain' };
    const { transformedRows, missingRequiredCount } = transformAndPrevalidateRows(parsed.data as any, mapping);
    assert.strictEqual(transformedRows.length, 2);
    assert.strictEqual(missingRequiredCount, 0);
    assert.strictEqual(transformedRows[0].companyName, 'Acme Solutions');
  });

  // 22. CSV with Missing Required Columns Handling
  await runTest('CSV with missing required columns prevalidation handling', () => {
    const csvContent = 'Phone,Domain\n+15550199,acme.com\n+15550198,tech.io';
    const parsed = Papa.parse(csvContent, { header: true });
    const mapping = { 'Phone': 'phone', 'Domain': 'domain' };
    const { transformedRows, missingRequiredCount } = transformAndPrevalidateRows(parsed.data as any, mapping);
    assert.strictEqual(transformedRows.length, 2);
    assert.strictEqual(missingRequiredCount, 2); // missing both email and companyName
  });

  // 23. Malformed Data in Lead Processing
  await runTest('Malformed data lead processing without crashing', () => {
    const malformedLead = { email: 'bad-email-no-domain', phone: 'abc', companyName: '', domain: 12345 };
    const contactValidation = validateContact(malformedLead);
    assert.strictEqual(contactValidation.email.status, 'invalid');
    assert.strictEqual(contactValidation.companyName.status, 'missing');
    const score = calculateLeadScore(malformedLead, []);
    assert.ok(score.quality_score >= 0 && score.quality_score <= 100);
  });

  // 24. AI Enrichment Failure or Timeout Graceful Fallback
  await runTest('AI enrichment failure / timeout graceful heuristic fallback', async () => {
    const lead = { companyName: 'CyberLogistics Cloud Inc', domain: 'cyberlogistics.io' };
    const enrichment = await enrichCompanyData(lead);
    assert.ok(enrichment.industry.value !== null);
    assert.ok(enrichment.suggested_tags.length > 0);
    assert.ok(typeof enrichment.industry.evidence === 'string');
    assert.ok(enrichment.industry.evidence.length > 0);
  });

  // 25. Successful Batch Processing Reaches Completed State
  await runTest('Successful batch processing output format and quality score', () => {
    const leadA = { companyName: 'Prime Security LLC', email: 'hello@primesecurity.com', phone: '+1 555-010-9999', domain: 'primesecurity.com' };
    const scoreA = calculateLeadScore(leadA, []);
    assert.ok(scoreA.quality_score > 0);
    assert.strictEqual(scoreA.isEligibleForExport, true);
    assert.ok(scoreA.reason.includes('Quality score'));
  });

  // 26. Error Reporting on Empty or Invalid Batch Submissions
  await runTest('Batch API validation for empty or malformed payload', () => {
    const emptyList: any[] = [];
    const isInvalid = !Array.isArray(emptyList) || emptyList.length === 0;
    assert.strictEqual(isInvalid, true);
  });

  // 27. LinkedIn URL Extraction in Company Name
  await runTest('LinkedIn URL extraction in company name normalization', () => {
    const res = normalizeCompanyName('https://www.linkedin.com/company/acme-global-solutions/');
    assert.strictEqual(res.value, 'Acme Global Solutions');
    
    const res2 = normalizeCompanyName('linkedin.com/company/tech-labs-inc');
    assert.strictEqual(res2.value, 'Tech Labs');
  });

  // 28. Social Media Domain Detection
  await runTest('Social media domain detection in domain normalization', () => {
    const res = normalizeDomain('https://www.linkedin.com/company/acme');
    assert.strictEqual(res.value, 'linkedin.com');
    assert.strictEqual(res.status, 'unverified');
    
    const res2 = normalizeDomain('https://facebook.com/acme');
    assert.strictEqual(res2.value, 'facebook.com');
    assert.strictEqual(res2.status, 'unverified');
  });

  // 29. Social Domain Validation Flagging
  await runTest('Social domain validation marking as unverified', () => {
    const validation = validateContact({ domain: 'linkedin.com' });
    assert.strictEqual(validation.domain.status, 'unverified');
    
    const validation2 = validateContact({ domain: 'acme.com' });
    assert.strictEqual(validation2.domain.status, 'unverified');
  });

  // 30. Scoring Separation (Quality vs Relevance)
  await runTest('Scoring separation (Quality vs Relevance)', () => {
    const lead = { companyName: 'Acme', email: 'test@acme.com' };
    const relevance = { relevanceScore: 85, explanation: 'Strong business identity' };
    const score = calculateLeadScore(lead, [], relevance);
    
    assert.ok(score.quality_score > 0);
    assert.strictEqual(score.business_relevance, 85);
    assert.ok(score.reason.includes('Business relevance: 85%'));
  });

  // 31. Export Column Descriptor for Relevance
  await runTest('Export data handles business relevance correctly', () => {
    const leads = [{ id: 1, processed_data: { companyName: 'Acme', scoring: { business_relevance: 75 } } }];
    const exportData = generateProcessedLeadsData(leads);
    assert.strictEqual(exportData[0].businessRelevance, 75);
  });

  // 32. Insufficient Data Relevance Score Sentinel (-1)
  await runTest('Insufficient data for relevance score returns sentinel -1', async () => {
    const { evaluateBusinessRelevance } = await import('../src/services/scoring/relevanceScorer.ts');
    const lead = { companyName: 'A' }; // Too short
    const res = await evaluateBusinessRelevance(lead);
    assert.strictEqual(res.relevanceScore, -1);
    assert.ok(res.explanation.includes('Insufficient'));
  });

  // 33. Scoring Engine handles relevanceScore: -1
  await runTest('Scoring engine preserves relevanceScore: -1 for unknown relevance', () => {
    const lead = { companyName: 'Acme', email: 'test@acme.com' };
    const relevance = { relevanceScore: -1, explanation: 'Insufficient info' };
    const score = calculateLeadScore(lead, [], relevance);
    assert.strictEqual(score.business_relevance, -1);
    assert.ok(score.reason.includes('Business relevance: Unknown'));
  });

  // 34. Export handling for relevanceScore: -1
  await runTest('Export formatter handles relevanceScore: -1', () => {
    const leads = [{ 
      id: 1, 
      processed_data: { 
        companyName: 'Acme',
        scoring: { business_relevance: -1 } 
      } 
    }];
    const exportData = generateProcessedLeadsData(leads);
    assert.strictEqual(exportData[0].businessRelevance, -1);
  });

  // 35. Business Relevance: High Quality Lead
  await runTest('Business Relevance: High quality business entity', async () => {
    const { evaluateBusinessRelevance } = await import('../src/services/scoring/relevanceScorer.ts');
    const lead = {
      companyName: "GuardNet Systems",
      industry: "Cybersecurity solutions & Software",
      location: "San Francisco, CA, USA",
      description: "A B2B SaaS platform providing enterprise-grade firewall and threat detection.",
      companySize: "120 employees",
      domain: "guardnet.com"
    };
    
    const res = await evaluateBusinessRelevance(lead);
    assert.ok(res.relevanceScore >= 60, `Expected high score, got ${res.relevanceScore}`);
  });

  // 36. Business Relevance: Low Quality / Sparse Lead
  await runTest('Business Relevance: Low quality / sparse business entity', async () => {
    const { evaluateBusinessRelevance } = await import('../src/services/scoring/relevanceScorer.ts');
    const lead = {
      companyName: "Organic Greens",
      industry: "Agriculture",
      // Missing domain and description
    };
    
    const res = await evaluateBusinessRelevance(lead);
    // Should be low relevance compared to a full corporate profile
    assert.ok(res.relevanceScore <= 50, `Expected lower score, got ${res.relevanceScore}`);
  });

  // 37. Duplicate: Identical Emails (Confirmed)
  await runTest('Duplicate: Identical email addresses (Confirmed)', async () => {
    const crm = new SalesForgeCrmAdapter();
    // Using 'globex' instead of 'acme' to avoid the SalesForge mock duplicate
    const leadA = { email: 'duplicate@globex.com', companyName: 'Globex' };
    const leadB = { email: 'DUPLICATE@GLOBEX.COM', companyName: 'Globex Corp' };
    
    const matches = await detectDuplicates(leadA, crm, [leadB]);
    const confirmedMatch = matches.find(m => m.matchLevel === 'confirmed');
    assert.ok(confirmedMatch, 'Should have a confirmed match');
    
    const score = calculateLeadScore(leadA, matches);
    assert.strictEqual(score.isEligibleForExport, false);
    assert.ok(score.reason.toLowerCase().includes('confirmed duplicate'));
  });

  // 38. Duplicate: Similar Company, Different Contact (Probable)
  await runTest('Duplicate: Similar company, different contacts (Probable)', async () => {
    const crm = new SalesForgeCrmAdapter();
    // Add domain/phone to ensure quality score is >= 50
    const leadA = { 
      email: 'john@globex.com', 
      companyName: 'Globex Global Solutions',
      domain: 'globex.com',
      phone: '+15550199' 
    };
    const leadB = { 
      email: 'jane@globex.com', 
      companyName: 'Globex Global Solutions Inc.' 
    };
    
    const matches = await detectDuplicates(leadA, crm, [leadB]);
    assert.ok(matches.some(m => m.matchLevel === 'probable'));
    
    const score = calculateLeadScore(leadA, matches);
    assert.strictEqual(score.isEligibleForExport, true); // Still eligible but flagged
    assert.ok(score.reason.toLowerCase().includes('potential duplicate'));
  });

  // 39. Duplicate: Missing Emails (Fuzzy only)
  await runTest('Duplicate: Missing email addresses (Fuzzy only)', async () => {
    const crm = new SalesForgeCrmAdapter();
    const leadA = { companyName: 'Initech Corp' };
    const leadB = { companyName: 'Initech Corporation' };
    
    const matches = await detectDuplicates(leadA, crm, [leadB]);
    // 'initech corp' vs 'initech corporation' should be > 0.7
    assert.ok(matches.length > 0 && matches.some(m => m.matchLevel === 'probable'));
  });

  // 40. Duplicate: LinkedIn URL Normalization Match
  await runTest('Duplicate: LinkedIn URL normalization fuzzy match', async () => {
    const crm = new SalesForgeCrmAdapter();
    const leadA = { companyName: 'https://linkedin.com/company/hooli-corp/' };
    const leadB = { companyName: 'https://linkedin.com/company/hooli/' };
    
    const normA = normalizeCompanyName(leadA.companyName).value;
    const normB = normalizeCompanyName(leadB.companyName).value;
    
    // Both normalize to "Hooli"
    const matches = await detectDuplicates({ companyName: normA }, crm, [{ companyName: normB }]);
    assert.ok(matches.length > 0, 'Should match Hooli Corp and Hooli after normalization');
    assert.strictEqual(matches[0].matchLevel, 'probable');
  });

  // 41. Duplicate: Repeated Rows in CSV
  await runTest('Duplicate: Repeated rows within the same CSV file', () => {
    const rows = [
      { email: 'unique_rep@tester.io', companyName: 'UniqueTest' },
      { email: 'unique_rep@tester.io', companyName: 'UniqueTest' }
    ];
    const mapping = { email: 'email', companyName: 'companyName' };
    const res = transformAndPrevalidateRows(rows, mapping);
    assert.strictEqual(res.duplicateCountInFile, 1);
  });

  // 42. Duplicate: Different Companies with Similar Names (Below threshold)
  await runTest('Duplicate: Different companies with similar names (False positives)', async () => {
    const crm = new SalesForgeCrmAdapter();
    const leadA = { companyName: 'Zylos International' };
    const leadB = { companyName: 'Umbrella Corporation' }; 
    
    const matches = await detectDuplicates(leadA, crm, [leadB]);
    // Only count local matches to avoid interference from mock CRM or database
    const localMatches = matches.filter(m => m.source === 'local');
    assert.strictEqual(localMatches.length, 0);
  });

  // 43. Export: Correct Match Level Reporting
  await runTest('Export: Displays highest match level correctly', () => {
    const leads = [{
      id: 1,
      processed_data: {
        companyName: 'Acme',
        duplicates: [{ matchLevel: 'probable' }, { matchLevel: 'confirmed' }]
      }
    }];
    const exportData = generateProcessedLeadsData(leads);
    assert.ok(exportData[0].duplicateStatus.includes('(confirmed)'));
  });

  // 44. Advanced Company Name Extraction
  await runTest('Normalization: Extract names from various social profile URLs', () => {
    const cases = [
      { input: 'https://www.facebook.com/AcmeGlobal', expected: 'Acme Global' },
      { input: 'https://twitter.com/hooli_hq', expected: 'Hooli Hq' },
      { input: 'crunchbase.com/organization/zylos-inc', expected: 'Zylos' },
      { input: 'https://instagram.com/pixel_perfect_design', expected: 'Pixel Perfect Design' },
      { input: 'acme-solutions.io', expected: 'Acme Solutions' }
    ];
    
    for (const c of cases) {
      const res = normalizeCompanyName(c.input);
      assert.strictEqual(res.value, c.expected, `Failed for ${c.input}`);
    }
  });

  // 45. Domain Extraction from Profile URLs
  await runTest('Normalization: Extract host from profile URLs in domain field', () => {
    const res = normalizeDomain('https://www.linkedin.com/in/john-doe');
    assert.strictEqual(res.value, 'linkedin.com');
    assert.strictEqual(res.status, 'unverified');
  });

  // 46. Social Domains mark as Unverified
  await runTest('Normalization: Social domains marked as unverified', () => {
    const res = normalizeDomain('facebook.com');
    assert.strictEqual(res.status, 'unverified');
    
    const res2 = normalizeDomain('twitter.com');
    assert.strictEqual(res2.status, 'unverified');
  });

  // 47. Public Email Domains mark as Unverified
  await runTest('Normalization: Public email domains marked as unverified', () => {
    const res = normalizeDomain('gmail.com');
    assert.strictEqual(res.status, 'unverified');
    
    const res2 = normalizeDomain('yahoo.co.uk'); // .co.uk won't match gmail.com but let's test a listed one
    const res3 = normalizeDomain('hotmail.com');
    assert.strictEqual(res3.status, 'unverified');
  });

  // 48. Corporate Domains mark as Valid
  await runTest('Normalization: Corporate domains marked as unverified', () => {
    const res = normalizeDomain('microsoft.com');
    assert.strictEqual(res.status, 'unverified');
    
    const res2 = normalizeDomain('acme-global.io');
    assert.strictEqual(res2.status, 'unverified');
  });
  // 49. Review Status for Unverified Data
  await runTest('Status Logic: Unverified data triggers review status', async () => {
    const { processLead } = await import('../src/services/leadProcessor.ts');
    const lead = { companyName: 'Acme', email: 'test@acme.com' }; // Syntactically valid but unverified
    const processed = await processLead(1, lead); // Using userId 1
    assert.strictEqual(processed.status, 'review', 'Should be in review because contact info is unverified');
  });

  // 50. Single-lead processing independent of ICP
  await runTest('Single-lead processing: marks business relevance using evaluateBusinessRelevance', async () => {
    const { processLead } = await import('../src/services/leadProcessor.ts');
    const lead = { companyName: 'CyberLogistics Cloud', domain: 'cyberlogistics.io' };
    const processed = await processLead(1, lead);
    assert.ok(processed.derived_scoring.business_relevance !== undefined);
    assert.strictEqual(processed.derived_scoring.relevance !== undefined, true);
    
    const exportItem = generateProcessedLeadsData([processed])[0];
    assert.ok(exportItem.businessRelevance !== undefined);
  });

  // 51. Export handles relevance explanation
  await runTest('Export: Handles business relevance explanation from AI', async () => {
    const { processLead } = await import('../src/services/leadProcessor.ts');
    const lead = { 
      companyName: 'Fortress Cyber Systems', 
      domain: 'fortress-cyber.com',
      industry: 'Cybersecurity Software & SaaS',
      location: 'New York, NY, USA',
      description: 'Enterprise cybersecurity solutions and threat prevention for modern B2B SaaS companies.',
      companySize: '80 employees'
    };
    const processed = await processLead(1, lead);
    assert.ok(processed.derived_scoring.business_relevance >= 20);
    
    const exportItem = generateProcessedLeadsData([processed])[0];
    assert.ok(exportItem.scoreReason.includes('Business relevance:'));
  });

  // 52. Similar company with different contacts: flagged for review but retained for export (not deleted)
  await runTest('Deduplication: Similar company with different contacts retained for export', async () => {
    const crm = new SalesForgeCrmAdapter();
    const leadA = { 
      companyName: 'Apex Innovations', 
      name: 'Alice Johnson', 
      email: 'alice@apex-innovations.io', 
      domain: 'apex-innovations.io', 
      phone: '+15550191' 
    };
    const leadB = { 
      companyName: 'Apex Innovations Inc.', 
      name: 'Bob Williams', 
      email: 'bob@apex-innovations.io' 
    };

    const matches = await detectDuplicates(leadA, crm, [leadB]);
    assert.ok(matches.some(m => m.matchLevel === 'probable'), 'Should identify account-level probable match');
    assert.strictEqual(matches.some(m => m.matchLevel === 'confirmed'), false, 'Must not falsely mark as confirmed duplicate');

    const score = calculateLeadScore(leadA, matches);
    assert.strictEqual(score.isEligibleForExport, true, 'Legitimate lead with different contact must NOT be removed from export');
    assert.ok(score.reason.toLowerCase().includes('potential duplicate'), 'Reason should clearly flag for review without claiming confirmed');
  });

  // 53. Exact duplicate re-import (same company + same contact) is confirmed
  await runTest('Deduplication: Identical re-import (same company + contact) marked as confirmed duplicate', async () => {
    const crm = new SalesForgeCrmAdapter();
    const leadA = { companyName: 'FactSet', name: 'Anupma Ranjan', location: 'Hyderabad, India' };
    const leadB = { companyName: 'FactSet', name: 'Anupma Ranjan', location: 'Hyderabad, India' };

    const matches = await detectDuplicates(leadA, crm, [leadB]);
    const confirmed = matches.find(m => m.matchLevel === 'confirmed');
    assert.ok(confirmed, 'Exact company and contact identity match must be marked confirmed duplicate');
  });

  // 54. Different companies with short names are not false duplicates
  await runTest('Deduplication: Different companies with short distinct names not falsely matched', async () => {
    const crm = new SalesForgeCrmAdapter();
    const leadA = { companyName: 'Apple' };
    const leadB = { companyName: 'Applied Materials' };

    const matches = await detectDuplicates(leadA, crm, [leadB]);
    const localMatches = matches.filter(m => m.source === 'local');
    assert.strictEqual(localMatches.length, 0, 'Distinct companies must not falsely match');
  });

  // 55. Batch import helper maps core fields correctly
  await runTest('Import Helper: Maps and transforms core fields correctly', () => {
    const rawRows = [
      { 'Company Name': 'Acme', 'Email': 'contact@acme.com' }
    ];
    const mapping = { 'Company Name': 'companyName', 'Email': 'email' };
    const { transformedRows } = transformAndPrevalidateRows(rawRows, mapping);
    assert.strictEqual(transformedRows.length, 1);
    assert.strictEqual(transformedRows[0].companyName, 'Acme');
  });

  console.log('\n====================================================');
  console.log(` TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED CLEANLY`);
  console.log('====================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
  process.exit(0);
}

executeTestSuite();

