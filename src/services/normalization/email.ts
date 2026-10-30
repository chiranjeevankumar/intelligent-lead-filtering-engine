export type NormalizationStatus = 'valid' | 'invalid' | 'unverified';

export interface NormalizationResult<T> {
  value: T | null;
  status: NormalizationStatus;
  original: T | null;
}

export function normalizeEmail(email: string | undefined): NormalizationResult<string> {
  if (!email || typeof email !== 'string') return { value: null, status: 'invalid', original: null };
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(trimmed)) {
    return { value: null, status: 'invalid', original: email };
  }
  
  const [local, domain] = trimmed.split('@');
  // Alias removal for standard email normalization (e.g., john.doe+alias@gmail.com -> john.doe@gmail.com)
  const cleanLocal = local.split('+')[0];

  return { 
    value: `${cleanLocal}@${domain}`, 
    status: 'unverified', 
    original: email 
  };
}
