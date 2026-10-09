/**
 * Normalizes combined Tamil text where word components/tiles ending in a virama
 * (pulli \u0BCD) meet an independent vowel (\u0B85 - \u0B94), combining them into
 * their proper uyirmei character (e.g. நாள் + இதழ் -> நாளிதழ், வான் + ஒலி -> வானொலி).
 */
export function combineTamilSandhi(text: string): string {
  const vowelToSign: Record<string, string> = {
    '\u0B85': '',        // அ -> removes virama to yield inherent 'a'
    '\u0B86': '\u0BBE',  // ஆ -> ா
    '\u0B87': '\u0BBF',  // இ -> ி
    '\u0B88': '\u0BC0',  // ஈ -> ீ
    '\u0B89': '\u0BC1',  // உ -> ு
    '\u0B8A': '\u0BC2',  // ஊ -> ூ
    '\u0B8E': '\u0BC6',  // எ -> ெ
    '\u0B8F': '\u0BC7',  // ஏ -> ே
    '\u0B90': '\u0BC8',  // ஐ -> ை
    '\u0B92': '\u0BCA',  // ஒ -> ொ
    '\u0B93': '\u0BCB',  // ஓ -> ோ
    '\u0B94': '\u0BCC',  // ஔ -> ௌ
  };

  return text.replace(/\u0BCD([\u0B85-\u0B94])/g, (_, vowel) => vowelToSign[vowel] ?? '');
}

/**
 * Checks if a formed string matches any of the expected answer targets,
 * considering case, trimming, array of targets, and Tamil sandhi combinations.
 */
export function matchesTamilOrTarget(formedWord: string, correctAnswer?: string | string[]): boolean {
  if (!correctAnswer) return false;

  const targets = Array.isArray(correctAnswer) ? correctAnswer : [correctAnswer];
  const normalizedFormed = formedWord.trim().toLowerCase();
  const sandhiFormed = combineTamilSandhi(formedWord).trim().toLowerCase();

  return targets.some(target => {
    const normTarget = target.trim().toLowerCase();
    const sandhiTarget = combineTamilSandhi(target).trim().toLowerCase();
    return (
      normalizedFormed === normTarget ||
      sandhiFormed === normTarget ||
      normalizedFormed === sandhiTarget ||
      sandhiFormed === sandhiTarget
    );
  });
}
