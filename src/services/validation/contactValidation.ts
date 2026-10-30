export type ValidationStatus = 'valid' | 'invalid' | 'missing' | 'unverified' | 'unknown';

const SOCIAL_DOMAINS = [
  'linkedin.com', 'facebook.com', 'twitter.com', 'x.com', 
  'instagram.com', 'youtube.com', 'github.com', 'crunchbase.com'
];

export interface FieldValidation {
  value: any;
  status: ValidationStatus;
  explanation?: string;
}

export function validateContact(lead: any): Record<string, FieldValidation> {
  const result: Record<string, FieldValidation> = {};
  
  // 1. Email Validation
  const email = lead?.email;
  if (!email) {
    result.email = { value: null, status: 'missing', explanation: 'Email address is missing.' };
  } else {
    const trimmedEmail = String(email).trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(trimmedEmail)) {
      // Syntactically valid but not externally verified
      result.email = { 
        value: trimmedEmail, 
        status: 'unverified', 
        explanation: 'Email format is syntactically valid (unverified mailbox existence).' 
      };
    } else {
      result.email = { 
        value: trimmedEmail, 
        status: 'invalid', 
        explanation: 'Email format is malformed or invalid.' 
      };
    }
  }

  // 2. Phone Validation
  const phone = lead?.phone;
  if (!phone) {
    result.phone = { value: null, status: 'missing', explanation: 'Phone number is missing.' };
  } else {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) {
      result.phone = { 
        value: phone, 
        status: 'unverified', 
        explanation: 'Phone number format appears valid (unverified reachability).' 
      };
    } else {
      result.phone = { 
        value: phone, 
        status: 'invalid', 
        explanation: 'Phone number is malformed or contains an incorrect number of digits.' 
      };
    }
  }

  // 3. Domain Validation
  const domain = lead?.domain;
  if (!domain) {
    result.domain = { value: null, status: 'missing', explanation: 'Company domain is missing.' };
  } else {
    const domainRegex = /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    const cleanDomain = String(domain)
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase();
    
    if (domainRegex.test(cleanDomain)) {
      if (SOCIAL_DOMAINS.includes(cleanDomain)) {
        result.domain = { 
          value: null, 
          status: 'unknown', 
          explanation: 'Social profile URL provided (official corporate domain is unknown).' 
        };
      } else {
        result.domain = { 
          value: cleanDomain, 
          status: 'unverified', 
          explanation: 'Domain format is valid (unverified reachability).' 
        };
      }
    } else {
      result.domain = { 
        value: domain, 
        status: 'invalid', 
        explanation: 'Domain format is malformed or invalid.' 
      };
    }

  }

  // 4. Company Name Validation
  const companyName = lead?.companyName;
  if (!companyName || String(companyName).trim() === '') {
    result.companyName = { value: null, status: 'missing', explanation: 'Company name is missing.' };
  } else {
    const nameStr = String(companyName).trim();
    // If name looks like a URL, it's unverified/un-normalized
    const looksLikeUrl = nameStr.includes('http') || nameStr.includes('.com') || nameStr.includes('.io');
    result.companyName = { 
      value: nameStr, 
      status: 'unverified', 
      explanation: looksLikeUrl 
        ? 'Company name contains a URL and requires normalization.' 
        : 'Company name is present (unverified business existence).' 
    };
  }
  
  return result;
}

