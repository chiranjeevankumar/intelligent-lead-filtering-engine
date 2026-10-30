import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface LeadExportItem {
  id: number;
  companyName: string;
  email: string;
  phone: string;
  domain: string;
  qualityScore: number;
  businessRelevance: number;
  scoreReason: string;
  emailStatus: string;
  phoneStatus: string;
  domainStatus: string;
  duplicateStatus: string;
  tags: string;
  status: string;
  createdAt: string;
}

export function generateProcessedLeadsData(leads: any[]): LeadExportItem[] {
  return leads.map(l => {
    const pd = l.processed_data || {};
    const scoring = l.derived_scoring || pd.scoring || {};
    
    return {
      id: l.id,
      companyName: pd.companyName || pd.company_name || 'N/A',
      email: pd.email || 'N/A',
      phone: pd.phone || 'N/A',
      domain: pd.domain || 'N/A',
      qualityScore: scoring.quality_score ?? l.score ?? 0,
      businessRelevance: scoring.business_relevance ?? -1,
      scoreReason: scoring.reason || 'Calculated quality score',
      emailStatus: pd.validationResults?.email?.status || 'unverified',
      phoneStatus: pd.validationResults?.phone?.status || 'unverified',
      domainStatus: pd.validationResults?.domain?.status || 'unverified',
      duplicateStatus: (() => {
        if (!pd.duplicates || pd.duplicates.length === 0) return 'Unique record';
        const confirmedCount = pd.duplicates.filter((d: any) => d.matchLevel === 'confirmed').length;
        const probableCount = pd.duplicates.filter((d: any) => d.matchLevel === 'probable').length;
        
        if (confirmedCount > 0 && probableCount > 0) {
          return `${confirmedCount} confirmed duplicate(s), ${probableCount} probable match(es)`;
        } else if (confirmedCount > 0) {
          return `${confirmedCount} confirmed duplicate(s)`;
        } else if (probableCount > 0) {
          return `${probableCount} probable match(es)`;
        }
        return 'Unique record';
      })(),

      tags: Array.isArray(l.tags) ? l.tags.join('; ') : '',
      status: l.status || 'processed',
      createdAt: l.createdAt ? new Date(l.createdAt).toLocaleString() : new Date().toLocaleString(),
    };
  });
}


export function generateValidationErrorsData(leads: any[]) {
  const errorItems: any[] = [];
  leads.forEach(l => {
    const pd = l.processed_data || {};
    const vr = pd.validationResults || {};
    const isEmailInvalid = vr.email?.status === 'invalid' || vr.email?.status === 'missing';
    const isPhoneInvalid = vr.phone?.status === 'invalid';
    const isDomainInvalid = vr.domain?.status === 'invalid';

    if (isEmailInvalid || isPhoneInvalid || isDomainInvalid || !pd.companyName) {
      errorItems.push({
        leadId: l.id,
        companyName: pd.companyName || 'Missing',
        email: pd.email || 'Missing',
        emailStatus: vr.email?.status || 'missing',
        phone: pd.phone || 'Missing',
        phoneStatus: vr.phone?.status || 'missing',
        domain: pd.domain || 'Missing',
        domainStatus: vr.domain?.status || 'missing',
        issuesSummary: [
          isEmailInvalid ? `Email issue (${vr.email?.status || 'missing'})` : null,
          isPhoneInvalid ? `Phone invalid format` : null,
          isDomainInvalid ? `Domain invalid` : null,
          !pd.companyName ? `Company name missing` : null,
        ].filter(Boolean).join('; ')
      });
    }
  });
  return errorItems;
}

export function generateDuplicateReportData(leads: any[]) {
  const duplicateItems: any[] = [];
  leads.forEach(l => {
    const pd = l.processed_data || {};
    const duplicates = pd.duplicates || [];
    if (duplicates.length > 0) {
      duplicates.forEach((dup: any) => {
        duplicateItems.push({
          leadId: l.id,
          companyName: pd.companyName || 'N/A',
          email: pd.email || 'N/A',
          matchedRecordId: dup.id || 'N/A',
          matchLevel: dup.matchLevel || 'probable',
          matchSource: dup.source || 'local',
          matchDetails: dup.details || 'Fuzzy string match',
          leadStatus: l.status
        });
      });
    }
  });
  return duplicateItems;
}

export function generateProcessingSummaryData(leads: any[], overviewStats?: any) {
  const total = leads.length;
  let validContacts = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let totalScore = 0;
  let accepted = 0;
  let rejected = 0;

  leads.forEach(l => {
    const pd = l.processed_data || {};
    const emailStatus = pd.validationResults?.email?.status;
    if (emailStatus === 'valid' || emailStatus === 'unverified') validContacts++;
    if (emailStatus === 'invalid') invalidCount++;
    if (pd.duplicates && pd.duplicates.length > 0) duplicateCount++;
    totalScore += (l.score || pd.scoring?.quality_score || 0);
    if (l.status === 'accepted') accepted++;
    if (l.status === 'rejected') rejected++;
  });

  return [{
    reportGeneratedAt: new Date().toISOString(),
    totalProcessedLeads: total,
    validContactCount: validContacts,
    validContactPercentage: total > 0 ? `${((validContacts / total) * 100).toFixed(1)}%` : '0%',
    invalidContactCount: invalidCount,
    duplicateRecordsDetected: duplicateCount,
    acceptedLeads: accepted,
    rejectedLeads: rejected,
    averageQualityScore: total > 0 ? (totalScore / total).toFixed(1) : '0',
    crmIntegrationStatus: 'Local CRM Adapter (Cross-CRM pending)'
  }];
}

export function downloadFile(filename: string, content: string | ArrayBuffer, mimeType: string) {
  const blob = content instanceof ArrayBuffer 
    ? new Blob([content], { type: mimeType })
    : new Blob([content], { type: `${mimeType};charset=utf-8;` });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    const emptyCsv = Papa.unparse([{ note: 'No data records found for this export.' }]);
    downloadFile(`${filename}.csv`, emptyCsv, 'text/csv');
    return;
  }
  const csvStr = Papa.unparse(data);
  downloadFile(`${filename}.csv`, csvStr, 'text/csv');
}

export function exportToExcel(data: any[], filename: string, sheetName = 'Export') {
  if (!data || data.length === 0) {
    data = [{ note: 'No data records found for this export.' }];
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadFile(`${filename}.xlsx`, excelBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
}
