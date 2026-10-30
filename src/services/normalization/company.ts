import { NormalizationResult } from './email.ts';

export function normalizeCompanyName(name: string | undefined): NormalizationResult<string> {
  if (!name || typeof name !== 'string') return { value: null, status: 'unverified', original: null };

  let normalized = name.trim();

  // 1. URL/Domain Extraction Logic
  // If the "name" looks like a URL or a domain (common in scraper exports)
  const isUrlLike = normalized.startsWith('http') || normalized.includes('www.') || /\.[a-z]{2,}(\/|$)/i.test(normalized);
  
  if (isUrlLike) {
    try {
      let cleanUrl = normalized;
      if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('//')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      const url = new URL(cleanUrl);
      const host = url.hostname.toLowerCase().replace('www.', '');
      
      // Try to extract name from path (e.g., linkedin.com/company/acme-inc -> acme-inc)
      const pathParts = url.pathname.split('/').filter(p => p.length > 0);
      
      if (pathParts.length > 0) {
        if (host.includes('linkedin.com')) {
          const companyIdx = pathParts.indexOf('company');
          normalized = companyIdx !== -1 && pathParts[companyIdx + 1] 
            ? pathParts[companyIdx + 1] 
            : pathParts[pathParts.length - 1];
        } else if (host.includes('facebook.com') || host.includes('fb.com')) {
          normalized = pathParts[0];
        } else if (host.includes('twitter.com') || host.includes('x.com')) {
          normalized = pathParts[0];
        } else if (host.includes('instagram.com')) {
          normalized = pathParts[0];
        } else if (host.includes('crunchbase.com')) {
          const orgIdx = pathParts.indexOf('organization');
          normalized = orgIdx !== -1 && pathParts[orgIdx + 1]
            ? pathParts[orgIdx + 1]
            : pathParts[pathParts.length - 1];
        } else {
          // For other domains, if there is a path, it might be the company name or a product
          // Use the first part of the path
          normalized = pathParts[0];
        }
      } else {
        // No path, use the domain name (e.g., acme-solutions.com -> acme-solutions)
        normalized = host.split('.')[0];
      }
    } catch (e) {
      // If URL parsing fails, strip protocol/www and take the first segment
      normalized = normalized
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('/')[0]
        .split('.')[0];
    }
  }

  // 2. Clean up separators and handle CamelCase
  // Replace common URL/ID separators with spaces
  normalized = normalized.replace(/[-_.,]/g, ' ').trim();

  // Split CamelCase (e.g., AcmeCorp -> Acme Corp)
  // We do this before lowercasing
  normalized = normalized.replace(/([a-z])([A-Z])/g, '$1 $2');

  // 3. Legal Suffix Stripping
  const suffixes = ['inc', 'corp', 'corporation', 'llc', 'ltd', 'limited', 'gmbh', 'sa', 'sas', 'srl', 'aps', 'ag', 'co'];
  const suffixRegex = new RegExp(`\\s*\\b(${suffixes.join('|')})\\.?$`, 'i');
  normalized = normalized.replace(suffixRegex, '').trim();

  // 4. Final Formatting
  if (normalized.length > 0) {
    normalized = normalized
      .toLowerCase()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // If after all that it's just 'Linkedin' or 'Facebook', it's probably unverified
  const nameLower = normalized.toLowerCase();
  const isSocialPlatform = ['linkedin', 'facebook', 'twitter', 'instagram', 'crunchbase'].includes(nameLower);

  return { 
    value: normalized || null, 
    status: 'unverified', 
    original: name 
  };
}


