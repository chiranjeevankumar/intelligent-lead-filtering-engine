import { NormalizationResult } from './email.ts';

const SOCIAL_DOMAINS = [
  'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 
  'instagram.com', 'youtube.com', 'github.com', 'crunchbase.com'
];

const PUBLIC_MAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
  'icloud.com', 'protonmail.com', 'mail.com', 'aol.com'
];

export function normalizeDomain(domain: string | undefined): NormalizationResult<string> {
  if (!domain || typeof domain !== 'string') return { value: null, status: 'unverified', original: null };

  try {
    let clean = domain.trim().toLowerCase();
    
    // If the input is a full profile URL (e.g. linkedin.com/in/user), extract host
    if (clean.includes('/') || clean.startsWith('http')) {
      if (!clean.startsWith('http')) clean = 'https://' + clean;
      const url = new URL(clean);
      clean = url.hostname;
    }
    
    // Strip www. prefix
    if (clean.startsWith('www.')) {
      clean = clean.substring(4);
    }

    // Basic domain syntax check
    const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(clean)) {
      return { value: null, status: 'invalid', original: domain };
    }

    // Check if it's a social profile domain vs public mail vs corporate
    if (SOCIAL_DOMAINS.includes(clean)) {
      return { value: null, status: 'unknown', original: domain };
    }

    if (PUBLIC_MAIL_DOMAINS.includes(clean)) {
      return { value: clean, status: 'unverified', original: domain };
    }

    return { value: clean, status: 'unverified', original: domain };
  } catch (e) {
    return { value: null, status: 'invalid', original: domain };
  }
}


