/**
 * Class code generator and validation.
 *
 * Rules:
 *   - Exactly 6 characters
 *   - Uppercase
 *   - No ambiguous characters: excludes 0, O, 1, I, L
 */

import crypto from 'crypto';

// 32 unambiguous characters (excludes 0, O, 1, I, L)
export const UNAMBIGUOUS_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/**
 * Generates an unambiguous random class code of exactly 6 characters.
 */
export function generateClassCode(length: number = 6): string {
  if (length !== 6) {
    throw new Error('Class code length must be exactly 6 characters.');
  }
  const bytes = crypto.randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += UNAMBIGUOUS_CHARSET[bytes[i] % UNAMBIGUOUS_CHARSET.length];
  }
  return result;
}

/**
 * Validates whether a given class code conforms to format rules.
 */
export function isValidClassCode(code: string): boolean {
  if (!code || code.trim().length !== 6) {
    return false;
  }
  const validSet = new Set(UNAMBIGUOUS_CHARSET);
  for (const char of code.toUpperCase().trim()) {
    if (!validSet.has(char)) {
      return false;
    }
  }
  return true;
}

