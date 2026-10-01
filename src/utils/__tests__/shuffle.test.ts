import { describe, it, expect } from 'vitest';
import { shuffleArray, shuffleOptions } from '../shuffle';

describe('shuffle utility', () => {
  const sampleOptions = [
    { id: 'A', label: 'முயல்' },
    { id: 'B', label: 'மயில்' },
    { id: 'C', label: 'மான்' },
    { id: 'D', label: 'நாய்' }
  ];

  it('does not mutate the source array', () => {
    const originalCopy = [...sampleOptions];
    const shuffled = shuffleOptions(sampleOptions);

    expect(sampleOptions).toEqual(originalCopy);
    expect(shuffled).not.toBe(sampleOptions);
  });

  it('preserves all items and their identities', () => {
    const shuffled = shuffleOptions(sampleOptions);

    expect(shuffled).toHaveLength(sampleOptions.length);
    expect(shuffled.map(o => o.id).sort()).toEqual(['A', 'B', 'C', 'D']);
    expect(shuffled.map(o => o.label).sort()).toEqual(sampleOptions.map(o => o.label).sort());
  });

  it('preserves option IDs and works with duplicate visible labels', () => {
    const duplicates = [
      { id: 'opt-1', label: 'கள்' },
      { id: 'opt-2', label: 'கள்' },
      { id: 'opt-3', label: 'கல்' }
    ];
    const shuffled = shuffleOptions(duplicates);

    expect(shuffled).toHaveLength(3);
    expect(shuffled.map(o => o.id).sort()).toEqual(['opt-1', 'opt-2', 'opt-3']);
  });

  it('can produce different orders and uses mockable random source', () => {
    // Deterministic shuffle using fixed sequence
    const values = [0.1, 0.9, 0.5];
    let i = 0;
    const deterministicRandom = () => values[i++ % values.length];

    const shuffled = shuffleArray([1, 2, 3, 4], deterministicRandom);
    expect(shuffled).toHaveLength(4);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4]);
  });

  it('shuffles elements across multiple executions', () => {
    // Over many shuffles of 4 elements, not all permutations will equal the original order
    const arr = [1, 2, 3, 4];
    let differedAtLeastOnce = false;

    for (let trial = 0; trial < 20; trial++) {
      const result = shuffleArray(arr);
      if (result.some((val, idx) => val !== arr[idx])) {
        differedAtLeastOnce = true;
        break;
      }
    }

    expect(differedAtLeastOnce).toBe(true);
  });
});
