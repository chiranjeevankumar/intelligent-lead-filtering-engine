import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export interface ColumnMapping {
  [sourceHeader: string]: string; // sourceHeader -> targetCRMField
}

export const TARGET_CRM_FIELDS = [
  { key: 'companyName', label: 'Company Name', required: true },
  { key: 'email', label: 'Email Address', required: true },
  { key: 'phone', label: 'Phone Number', required: false },
  { key: 'domain', label: 'Domain / Website', required: false },
  { key: 'name', label: 'Contact Name', required: false },
  { key: 'jobTitle', label: 'Job Title', required: false },
  { key: 'managementLevel', label: 'Management Level', required: false },
  { key: 'department', label: 'Department', required: false },
  { key: 'location', label: 'Location', required: false },
  { key: 'industry', label: 'Industry', required: false },
  { key: 'skills', label: 'Skills', required: false },
  { key: 'companyLocation', label: 'Company Location', required: false },
  { key: 'companySize', label: 'Company Size', required: false },
  { key: 'revenue', label: 'Revenue', required: false },
  { key: 'description', label: 'Company Description', required: false },
  { key: 'notes', label: 'Lead Notes', required: false },
  { key: 'source', label: 'Lead Source', required: false },
];

export interface ParsedFileData {
  filename: string;
  fileSizeMB: number;
  headers: string[];
  rows: Record<string, any>[];
  initialMapping: ColumnMapping;
}

export function autoMapHeaders(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};

  headers.forEach(header => {
    const norm = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (norm.includes('email') || norm === 'mail') {
      mapping[header] = 'email';
    } else if (norm.includes('company') || norm.includes('organisation') || norm.includes('organization') || norm === 'business') {
      mapping[header] = 'companyName';
    } else if (norm.includes('phone') || norm.includes('mobile') || norm.includes('cell') || norm.includes('tel')) {
      mapping[header] = 'phone';
    } else if (norm.includes('domain') || norm.includes('website') || norm.includes('url') || norm.includes('site')) {
      mapping[header] = 'domain';
    } else if (norm.includes('name') || norm.includes('contact') || norm === 'fullname') {
      mapping[header] = 'name';
    } else if (norm.includes('title') || norm.includes('role') || norm.includes('position')) {
      mapping[header] = 'jobTitle';
    } else if (norm.includes('industry') || norm.includes('sector')) {
      mapping[header] = 'industry';
    } else if (norm.includes('location') || norm.includes('city') || norm.includes('country') || norm.includes('address')) {
      mapping[header] = 'location';
    } else if (norm.includes('source') || norm.includes('channel') || norm.includes('campaign')) {
      mapping[header] = 'source';
    } else if (norm.includes('size') || norm.includes('headcount')) {
      mapping[header] = 'companySize';
    } else if (norm.includes('revenue') || norm.includes('turnover')) {
      mapping[header] = 'revenue';
    } else if (norm.includes('description') || norm.includes('about') || norm.includes('overview')) {
      mapping[header] = 'description';
    } else if (norm.includes('note') || norm.includes('comment')) {
      mapping[header] = 'notes';
    } else {
      mapping[header] = ''; // unmapped
    }
  });

  return mapping;
}


export async function parseFile(file: File): Promise<ParsedFileData> {
  const maxSizeMB = 10;
  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > maxSizeMB) {
    throw new Error(`File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum allowed limit of ${maxSizeMB}MB.`);
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
    throw new Error('Unsupported file type. Please upload a valid CSV (.csv) or Excel (.xlsx, .xls) file.');
  }

  if (extension === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          const headers = results.meta.fields || [];
          const rows = (results.data as Record<string, any>[]).filter(row => 
            Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== '')
          );
          const mapping = autoMapHeaders(headers);
          resolve({
            filename: file.name,
            fileSizeMB,
            headers,
            rows,
            initialMapping: mapping
          });
        },
        error: (err) => {
          reject(new Error(`CSV parsing error: ${err.message}`));
        }
      });
    });
  } else {
    // Excel file parsing
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

          if (rawRows.length === 0) {
            throw new Error('The uploaded Excel file contains no data.');
          }

          const headers = Object.keys(rawRows[0]);
          const mapping = autoMapHeaders(headers);
          resolve({
            filename: file.name,
            fileSizeMB,
            headers,
            rows: rawRows,
            initialMapping: mapping
          });
        } catch (err: any) {
          reject(new Error(`Excel parsing error: ${err.message}`));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read Excel file.'));
      reader.readAsArrayBuffer(file);
    });
  }
}

export function transformAndPrevalidateRows(rows: Record<string, any>[], mapping: ColumnMapping) {
  const transformedRows: any[] = [];
  const seenEmails = new Set<string>();
  let duplicateCountInFile = 0;
  let missingRequiredCount = 0;

  rows.forEach((row, index) => {
    const leadObj: Record<string, any> = { _originalIndex: index + 1 };
    
    Object.entries(mapping).forEach(([sourceCol, targetField]) => {
      if (targetField && targetField !== '') {
        const val = row[sourceCol];
        leadObj[targetField] = val !== undefined && val !== null ? String(val).trim() : '';
      }
    });

    // Check email presence & internal duplicate
    const email = (leadObj.email || '').toLowerCase();
    let isInternalDuplicate = false;
    let isMissingRequired = false;

    if (!email && !leadObj.companyName) {
      isMissingRequired = true;
      missingRequiredCount++;
    } else if (email) {
      if (seenEmails.has(email)) {
        isInternalDuplicate = true;
        duplicateCountInFile++;
      } else {
        seenEmails.add(email);
      }
    }

    leadObj._isInternalDuplicate = isInternalDuplicate;
    leadObj._isMissingRequired = isMissingRequired;
    transformedRows.push(leadObj);
  });

  return {
    transformedRows,
    totalRows: rows.length,
    duplicateCountInFile,
    missingRequiredCount,
  };
}
