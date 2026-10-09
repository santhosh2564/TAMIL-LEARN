import { describe, it, expect } from 'vitest';
import { ArrangeWordEvaluator } from '../ArrangeWordEvaluator';
import { Activity } from '../../../types';

describe('ArrangeWordEvaluator', () => {
  const evaluator = new ArrangeWordEvaluator();

  const mockActivity = {
    id: 'Q015',
    category: 'arrange-word',
    variant: 'arrange',
    correctAnswer: 'கிழங்கு',
    options: [
      { id: 'A', label: 'கி' },
      { id: 'B', label: 'ழ' },
      { id: 'C', label: 'ங்' },
      { id: 'D', label: 'கு' }
    ]
  } as Activity;

  it('evaluates correct sequence', () => {
    const result = evaluator.evaluate(mockActivity, ['A', 'B', 'C', 'D']);
    expect(result.correct).toBe(true);
    expect(result.completed).toBe(true);
  });

  it('evaluates incorrect sequence', () => {
    const result = evaluator.evaluate(mockActivity, ['B', 'A', 'C', 'D']);
    expect(result.correct).toBe(false);
    // Wrong answers must NOT complete: the learner retries the same activity.
    expect(result.completed).toBe(false);
  });

  it('handles empty sequence', () => {
    const result = evaluator.evaluate(mockActivity, []);
    expect(result.correct).toBe(false);
  });

  it('handles incomplete sequence', () => {
    const result = evaluator.evaluate(mockActivity, ['A', 'B']);
    expect(result.correct).toBe(false);
  });

  it('handles duplicate token scenarios effectively', () => {
    const duplicateActivity = {
      ...mockActivity,
      correctAnswer: 'மரம்',
      options: [
        { id: '1', label: 'ம' },
        { id: '2', label: 'ர' },
        { id: '3', label: 'ம்' },
        { id: '4', label: 'ம' } // Distractor or valid duplicate
      ]
    } as Activity;

    // Correctly using ID 1
    const result1 = evaluator.evaluate(duplicateActivity, ['1', '2', '3']);
    expect(result1.correct).toBe(true);

    // Correctly using ID 4 (since label is identical, it evaluates to same string)
    const result2 = evaluator.evaluate(duplicateActivity, ['4', '2', '3']);
    expect(result2.correct).toBe(true);
  });

  it('correctly evaluates compound Tamil words using sandhi (e.g. Q078 நாள் + இதழ் -> நாளிதழ்)', () => {
    const q078Activity = {
      id: 'Q078',
      category: 'arrange-word',
      variant: 'arrange',
      correctAnswer: 'நாளிதழ்',
      options: [
        { id: 'A', label: 'நாள்' },
        { id: 'B', label: 'இதழ்' }
      ]
    } as Activity;

    // Arranging நாள் (A) then இதழ் (B) should be correct
    const result = evaluator.evaluate(q078Activity, ['A', 'B']);
    expect(result.correct).toBe(true);
    expect(result.completed).toBe(true);

    // Arranging in reverse (இதழ் then நாள்) should be incorrect
    const wrongResult = evaluator.evaluate(q078Activity, ['B', 'A']);
    expect(wrongResult.correct).toBe(false);
    expect(wrongResult.completed).toBe(false);
  });

  it('evaluates correctly when correctAnswer is an array of acceptable spellings', () => {
    const arrayActivity = {
      id: 'Q078',
      category: 'arrange-word',
      variant: 'arrange',
      correctAnswer: ['நாளிதழ்', 'நாள்இதழ்'],
      options: [
        { id: 'A', label: 'நாள்' },
        { id: 'B', label: 'இதழ்' }
      ]
    } as Activity;

    const result = evaluator.evaluate(arrayActivity, ['A', 'B']);
    expect(result.correct).toBe(true);
    expect(result.completed).toBe(true);
  });
});
