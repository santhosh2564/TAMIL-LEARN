/**
 * Pure, unbiased Fisher-Yates shuffle utility.
 * Does not mutate the original array; returns a new shuffled array.
 */
export function shuffleArray<T>(
  array: readonly T[],
  randomSource: () => number = Math.random
): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(randomSource() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

/**
 * Shuffles an array of options (or units) preserving all option objects,
 * IDs, labels, and semantics.
 */
export function shuffleOptions<T extends { id: string; label: string }>(
  options: readonly T[],
  randomSource: () => number = Math.random
): T[] {
  return shuffleArray(options, randomSource);
}
