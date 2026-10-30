export interface DuplicateMatch {
  id: string;
  matchLevel: 'confirmed' | 'probable' | 'possible';
  source: 'crm' | 'local';
  details: string;
}

export interface ICrmIntegration {
  findDuplicates(lead: any): Promise<DuplicateMatch[]>;
}

export { SalesForgeCrmAdapter, SalesForgeCrmAdapter as LocalCrmAdapter } from './salesforgeAdapter.ts';
