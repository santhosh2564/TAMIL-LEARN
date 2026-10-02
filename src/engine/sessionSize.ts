import { SessionSize } from './types';

/**
 * Parses a session size URL query parameter into a semantic SessionSize model.
 *
 * Supported formats:
 * - 'all' -> { mode: 'all' }
 * - '5', '10', etc. -> { mode: 'fixed', count: N }
 * - '9999' -> { mode: 'all' } (Legacy URL backward compatibility only)
 * - missing / invalid / negative / zero / decimal -> fallback { mode: 'fixed', count: 10 }
 */
export function parseSessionSize(param: string | null | undefined): SessionSize {
  if (!param) {
    return { mode: 'fixed', count: 10 };
  }

  const normalized = param.trim().toLowerCase();

  if (normalized === 'all' || normalized === '9999') {
    return { mode: 'all' };
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { mode: 'fixed', count: 10 };
  }

  return { mode: 'fixed', count: parsed };
}

/**
 * Serializes a semantic SessionSize model into a clean URL query parameter.
 * Never outputs magic numbers (e.g. 9999).
 */
export function serializeSessionSize(size: SessionSize): string {
  if (size.mode === 'all') {
    return 'all';
  }
  return String(size.count);
}
