import { describe, it, expect } from 'vitest';
import { PictureRecognitionEvaluator } from '../PictureRecognitionEvaluator';
import { Activity } from '../../../types';

describe('PictureRecognitionEvaluator', () => {
  const evaluator = new PictureRecognitionEvaluator();

  const mockActivity = {
    id: 'Q001',
    category: 'picture-recognition',
    variant: 'select',
    correctAnswer: 'முயல்',
    options: [
      { id: 'A', label: 'முயல்' },
      { id: 'B', label: 'மயில்' }
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
    expect(result.completed).toBe(true);
    expect(result.feedback?.type).toBe('error');
  });

  it('handles invalid input id gracefully', () => {
    const result = evaluator.evaluate(mockActivity, 'INVALID');
    expect(result.correct).toBe(false);
    expect(result.completed).toBe(false);
    expect(result.feedback?.type).toBe('error');
    expect(result.feedback?.message).toContain('Invalid');
  });

  it('throws if no options are present', () => {
    const badActivity = { ...mockActivity, options: undefined } as Activity;
    expect(() => evaluator.evaluate(badActivity, 'A')).toThrow('Picture recognition activity has no options');
  });
});
