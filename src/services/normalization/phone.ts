import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { NormalizationResult } from './email.ts';

export function normalizePhone(phone: string | undefined): NormalizationResult<string> {
  if (!phone || typeof phone !== 'string') return { value: null, status: 'unverified', original: null };
  const trimmed = phone.trim();

  try {
    const phoneNumber = parsePhoneNumber(trimmed, 'US');
    if (phoneNumber && isValidPhoneNumber(phoneNumber.number)) {
      return { value: phoneNumber.number, status: 'valid', original: phone };
    }
  } catch (e) {
    // Fallback E.164 formatting for digit strings starting with +
  }

  const digitsOnly = trimmed.replace(/[^\d+]/g, '');
  if (digitsOnly.length >= 8) {
    const formatted = digitsOnly.startsWith('+') ? digitsOnly : `+1${digitsOnly}`;
    return { value: formatted, status: 'valid', original: phone };
  }

  return { value: null, status: 'invalid', original: phone };
}
