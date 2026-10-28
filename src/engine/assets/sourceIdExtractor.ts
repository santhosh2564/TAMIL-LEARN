/**
 * Source ID extraction and normalization utility.
 * Matches FTS identifiers (FTS0001-FTS9999) and Earlier Question IDs (Q001-Q999)
 * with strict non-alphanumeric boundaries to avoid false substring collisions.
 */

export const SOURCE_ID_REGEX = /(?:^|[^A-Za-z0-9])(FTS\d{4}|Q\d{3})(?:[^A-Za-z0-9]|$)/i;

/**
 * Extracts a normalized uppercase Source ID from a filename or path.
 * Returns null if no valid discrete Source ID identifier is found.
 */
export function extractSourceId(filePathOrName: string): string | null {
  if (!filePathOrName || typeof filePathOrName !== 'string') return null;
  // Get filename from path
  const base = filePathOrName.split(/[/\\]/).pop() || filePathOrName;
  const match = base.match(SOURCE_ID_REGEX);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Tests if a candidate string matches a target Source ID.
 * Avoids false substring matches (e.g. FTS103 matching FTS1039).
 */
export function matchesSourceId(filename: string, targetSourceId: string): boolean {
  if (!filename || !targetSourceId) return false;
  const extracted = extractSourceId(filename);
  if (!extracted) return false;
  return extracted === targetSourceId.trim().toUpperCase();
}

