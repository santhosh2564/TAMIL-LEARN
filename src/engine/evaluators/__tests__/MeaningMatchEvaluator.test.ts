import { describe, it, expect } from 'vitest';
import { MeaningMatchEvaluator } from '../MeaningMatchEvaluator';
import { Activity } from '../../../types';

describe('MeaningMatchEvaluator', () => {
  const evaluator = new MeaningMatchEvaluator();

  const mockActivity = {
    id: 'Q031',
    category: 'meaning-match',
    variant: 'translate-select',
    correctAnswer: 'ஒற்றுமை',
    options: [
      { id: 'A', label: 'ஒற்றுமை' },
      { id: 'B', label: 'ஒற்றுமி' }
    ]
  } as Activity;

  it('evaluates correct answer', () => {
    const result = evaluator.evaluate(mockActivity, 'A');
    expect(result.correct).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.feedback?.type).toBe('success');
  });

  it('evaluates incorrect answer', () => {
    const result = evaluator.evaluate(mockActivity, 'B');
    expect(result.correct).toBe(false);
    // Wrong answers must NOT complete: the learner retries the same activity.
    expect(result.completed).toBe(false);
    expect(result.feedback?.type).toBe('error');
  });

  it('handles invalid input id gracefully', () => {
    const result = evaluator.evaluate(mockActivity, 'INVALID');
    expect(result.correct).toBe(false);
    expect(result.completed).toBe(false);
  });
});
