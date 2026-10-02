import { describe, it, expect } from 'vitest';
import { SpellingChoiceEvaluator } from '../SpellingChoiceEvaluator';
import { Activity } from '../../../types';

describe('SpellingChoiceEvaluator', () => {
  const evaluator = new SpellingChoiceEvaluator();

  const mockActivity = {
    id: 'Q006',
    category: 'spelling-choice',
    variant: 'select',
    correctAnswer: 'மான்',
    options: [
      { id: 'A', label: 'மான்' },
      { id: 'B', label: 'மாண்' }
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
    const result = evaluator.evaluate(mockActivity, 'C');
    expect(result.correct).toBe(false);
    expect(result.completed).toBe(false); // Does not consume an attempt basically, or completes it early
  });
});
