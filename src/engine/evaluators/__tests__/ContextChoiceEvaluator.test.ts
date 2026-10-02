import { describe, it, expect } from 'vitest';
import { ContextChoiceEvaluator } from '../ContextChoiceEvaluator';
import { Activity } from '../../../types';

describe('ContextChoiceEvaluator', () => {
  const evaluator = new ContextChoiceEvaluator();

  const mockActivity = {
    id: 'Q011',
    category: 'context-choice',
    variant: 'fill-blank',
    correctAnswer: 'மணி',
    options: [
      { id: 'A', label: 'மணி' },
      { id: 'B', label: 'மனி' }
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
});
