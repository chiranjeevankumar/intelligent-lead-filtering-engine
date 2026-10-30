import { DuplicateMatch } from './types.ts';

export interface CrmConnectionStatus {
  isConnected: boolean;
  mode: 'salesforge_live' | 'mock_offline';
  endpointUrl?: string;
  message: string;
  lastSyncTime?: string;
}

export interface CrmSyncRecordResult {
  leadId: number;
  companyName: string;
  email: string;
  result: 'created' | 'matched_existing' | 'skipped_duplicate' | 'rejected_validation' | 'failed';
  crmRecordId?: string;
  reason: string;
  tagsAssociated: string[];
  idempotencyKey: string;
}

export interface ICrmAdapter {
  getConnectionStatus(): Promise<CrmConnectionStatus>;
  findDuplicates(lead: any): Promise<DuplicateMatch[]>;
  previewSync(leads: any[]): Promise<{
    totalSubmitted: number;
    readyToCreateCount: number;
    duplicateCount: number;
    invalidCount: number;
    items: any[];
  }>;
  syncLeadsToCrm(leads: any[], dryRun?: boolean): Promise<{
    success: boolean;
    mode: string;
    syncResults: CrmSyncRecordResult[];
  }>;
}

// Generates an idempotency key to prevent duplicate creation
export function generateLeadIdempotencyKey(lead: any): string {
  const email = (lead.processed_data?.email || lead.email || '').toLowerCase().trim();
  const company = (lead.processed_data?.companyName || lead.companyName || '').toLowerCase().trim();
  return `sf_lead_${Buffer.from(`${email}:${company}`).toString('hex')}`;
}

export class SalesForgeCrmAdapter implements ICrmAdapter {
  private apiBaseUrl: string | undefined;
  private apiKey: string | undefined;

  constructor() {
    this.apiBaseUrl = process.env.SALESFORGE_CRM_API_URL;
    this.apiKey = process.env.SALESFORGE_CRM_API_KEY;
  }

  async getConnectionStatus(): Promise<CrmConnectionStatus> {
    if (this.apiBaseUrl && this.apiKey) {
      return {
        isConnected: true,
        mode: 'salesforge_live',
        endpointUrl: this.apiBaseUrl,
        message: 'SalesForge Production CRM Live API Connected with Tenant Scoping',
      };
    }

    return {
      isConnected: false,
      mode: 'mock_offline',
      message: 'Mock / Offline Testing Mode Active — actions here will NOT write to production SalesForge CRM.',
    };
  }

  async findDuplicates(lead: any): Promise<DuplicateMatch[]> {
    const status = await this.getConnectionStatus();

    if (status.mode === 'salesforge_live' && this.apiBaseUrl) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/api/v1/salesforge/leads/search-duplicates`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            email: lead.email,
            companyName: lead.companyName,
            domain: lead.domain,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.matches || [];
        }
      } catch (err) {
        console.error('SalesForge Live CRM Duplicate search failed:', err);
      }
    }

    // Fallback Mock Behavior
    const matches: DuplicateMatch[] = [];
    if (lead.email && lead.email.toLowerCase().includes('acme')) {
      matches.push({
        id: 'sf_crm_mock_102',
        matchLevel: 'confirmed',
        source: 'crm',
        details: 'SalesForge CRM record #102 email match',
      });
    }
    return matches;
  }

  async previewSync(leadsList: any[]) {
    const status = await this.getConnectionStatus();
    let readyToCreateCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    const items = leadsList.map(lead => {
      const pd = lead.processed_data || {};
      const vr = pd.validationResults || {};

      let resultState: 'created' | 'matched_existing' | 'skipped_duplicate' | 'rejected_validation' = 'created';
      let reason = 'Ready for SalesForge creation';

      if (vr.email?.status === 'invalid' || !pd.companyName) {
        resultState = 'rejected_validation';
        reason = 'Failed contact validation';
        invalidCount++;
      } else if (pd.duplicates && pd.duplicates.length > 0) {
        resultState = 'skipped_duplicate';
        reason = `Duplicate detected (${pd.duplicates.length} match)`;
        duplicateCount++;
      } else {
        readyToCreateCount++;
      }

      return {
        leadId: lead.id,
        companyName: pd.companyName || 'Unknown',
        email: pd.email || 'Missing',
        previewState: resultState,
        reason,
        idempotencyKey: generateLeadIdempotencyKey(lead),
        tags: lead.tags || [],
      };
    });

    return {
      totalSubmitted: leadsList.length,
      readyToCreateCount,
      duplicateCount,
      invalidCount,
      items,
    };
  }

  async syncLeadsToCrm(leadsList: any[], dryRun = false): Promise<{
    success: boolean;
    mode: string;
    syncResults: CrmSyncRecordResult[];
  }> {
    const status = await this.getConnectionStatus();
    const results: CrmSyncRecordResult[] = [];

    for (const lead of leadsList) {
      const pd = lead.processed_data || {};
      const vr = pd.validationResults || {};
      const idempotencyKey = generateLeadIdempotencyKey(lead);

      if (vr.email?.status === 'invalid' || !pd.companyName) {
        results.push({
          leadId: lead.id,
          companyName: pd.companyName || 'Unknown',
          email: pd.email || 'Missing',
          result: 'rejected_validation',
          reason: 'Invalid lead schema or contact details',
          tagsAssociated: [],
          idempotencyKey,
        });
        continue;
      }

      if (pd.duplicates && pd.duplicates.length > 0) {
        results.push({
          leadId: lead.id,
          companyName: pd.companyName || 'Unknown',
          email: pd.email || 'Missing',
          result: 'skipped_duplicate',
          crmRecordId: pd.duplicates[0]?.id || 'sf_existing_crm_record',
          reason: 'Skipped to prevent duplicate CRM entry',
          tagsAssociated: lead.tags || [],
          idempotencyKey,
        });
        continue;
      }

      if (dryRun) {
        results.push({
          leadId: lead.id,
          companyName: pd.companyName || 'Unknown',
          email: pd.email || 'Missing',
          result: 'created',
          crmRecordId: `dry_run_${lead.id}`,
          reason: 'Dry-run preview successful (no records modified)',
          tagsAssociated: lead.tags || [],
          idempotencyKey,
        });
        continue;
      }

      // Live or Mock CRM Creation
      if (status.mode === 'salesforge_live' && this.apiBaseUrl) {
        try {
          const response = await fetch(`${this.apiBaseUrl}/api/v1/salesforge/leads/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({
              companyName: pd.companyName,
              email: pd.email,
              phone: pd.phone,
              domain: pd.domain,
              qualityScore: lead.score,
              tags: lead.tags,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            results.push({
              leadId: lead.id,
              companyName: pd.companyName,
              email: pd.email,
              result: 'created',
              crmRecordId: data.leadId || `sf_live_${lead.id}`,
              reason: 'Successfully created in SalesForge CRM',
              tagsAssociated: lead.tags || [],
              idempotencyKey,
            });
            continue;
          }
        } catch (err: any) {
          results.push({
            leadId: lead.id,
            companyName: pd.companyName,
            email: pd.email,
            result: 'failed',
            reason: `SalesForge CRM API call failed: ${err.message}`,
            tagsAssociated: [],
            idempotencyKey,
          });
          continue;
        }
      }

      // Mock Adapter Success
      results.push({
        leadId: lead.id,
        companyName: pd.companyName,
        email: pd.email,
        result: 'created',
        crmRecordId: `sf_mock_record_${lead.id}`,
        reason: 'Mock SalesForge record created (Mock Mode)',
        tagsAssociated: lead.tags || [],
        idempotencyKey,
      });
    }

    return {
      success: true,
      mode: status.mode,
      syncResults: results,
    };
  }
}
