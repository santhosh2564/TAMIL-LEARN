import { describe, it, expect } from 'vitest';
import { WordCompletionEvaluator } from '../WordCompletionEvaluator';
import { Activity } from '../../../types';

describe('WordCompletionEvaluator', () => {
  const evaluator = new WordCompletionEvaluator();

  const mockActivity = {
    id: 'Q002',
    category: 'word-completion',
    variant: 'missing-unit',
    correctAnswer: 'தி',
    options: [
      { id: 'A', label: 'தி' },
      { id: 'B', label: 'தீ' }
    ]
  } as Activity;

  it('evaluates correct answer', () => {
    const result = evaluator.evaluate(mockActivity, 'A');
    expect(result.correct).toBe(true);
    expect(result.completed).toBe(true);
  });

  it('evaluates incorrect answer', () => {
    const result = evaluator.evaluate(mockActivity, 'B');
    expect(result.correct).toBe(false);
    // Wrong answers must NOT complete: the learner retries the same activity.
    expect(result.completed).toBe(false);
  });

  it('handles invalid input id gracefully', () => {
    const result = evaluator.evaluate(mockActivity, 'INVALID');
    expect(result.correct).toBe(false);
    expect(result.completed).toBe(false);
  });
});
