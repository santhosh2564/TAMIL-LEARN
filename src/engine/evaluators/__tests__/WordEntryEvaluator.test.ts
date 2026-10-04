import { describe, it, expect } from 'vitest';
import { WordEntryEvaluator } from '../WordEntryEvaluator';
import { Activity } from '../../../types';
import { ActivityRuntimeState } from '../../types';

describe('WordEntryEvaluator', () => {
  const evaluator = new WordEntryEvaluator();

  const mockActivity: Activity = {
    id: 'ENG-M1-EW017',
    classLevel: 3,
    subject: 'English',
    language: 'en-IN',
    module: 1,
    day: 1,
    level: 1,
    targetWord: 'apple',
    category: 'picture-recognition',
    variant: 'word-entry',
    prompt: 'Look at the picture. Write the word.',
    correctAnswer: 'apple',
    source: {
      workbook: 'English_Module_1_120_Word_Implementation_Plan.xlsx',
      ewId: 'EW017',
      activityCode: 'E01',
      originalActivity: 'E01 – Picture → Write'
    }
  };

  const mockState: ActivityRuntimeState = {
    activityId: 'ENG-M1-EW017',
    status: 'active',
    attempts: 0
  };

  it('evaluates exact matching answer as correct and completed', () => {
    const result = evaluator.evaluate(mockActivity, 'apple', mockState);
    expect(result.correct).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.feedback?.type).toBe('success');
    expect(result.feedback?.message).toBe('Correct!');
  });

  it('evaluates case-insensitively', () => {
    const resultUpper = evaluator.evaluate(mockActivity, 'APPLE', mockState);
    expect(resultUpper.correct).toBe(true);
    expect(resultUpper.completed).toBe(true);

    const resultMixed = evaluator.evaluate(mockActivity, 'Apple', mockState);
    expect(resultMixed.correct).toBe(true);
    expect(resultMixed.completed).toBe(true);
  });

  it('trims leading and trailing whitespace', () => {
    const result = evaluator.evaluate(mockActivity, '   apple   ', mockState);
    expect(result.correct).toBe(true);
    expect(result.completed).toBe(true);
  });

  it('marks wrong answer as not correct and not completed without revealing solution', () => {
    const result = evaluator.evaluate(mockActivity, 'orange', mockState);
    expect(result.correct).toBe(false);
    expect(result.completed).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.feedback?.type).toBe('error');
    expect(result.feedback?.message).toBe('Not quite. Try again.');
    // Must NOT reveal "apple" in feedback
    expect(result.feedback?.message).not.toContain('apple');
  });

  it('rejects partial answers', () => {
    const resultPrefix = evaluator.evaluate(mockActivity, 'app', mockState);
    expect(resultPrefix.correct).toBe(false);
    expect(resultPrefix.completed).toBe(false);

    const resultNear = evaluator.evaluate(mockActivity, 'appl', mockState);
    expect(resultNear.correct).toBe(false);
    expect(resultNear.completed).toBe(false);
  });

  it('rejects fuzzy / near matches (plural or typo)', () => {
    const resultPlural = evaluator.evaluate(mockActivity, 'apples', mockState);
    expect(resultPlural.correct).toBe(false);
    expect(resultPlural.completed).toBe(false);

    const resultTypo = evaluator.evaluate(mockActivity, 'aple', mockState);
    expect(resultTypo.correct).toBe(false);
    expect(resultTypo.completed).toBe(false);
  });

  it('handles empty input as invalid without marking activity completed', () => {
    const resultEmpty = evaluator.evaluate(mockActivity, '', mockState);
    expect(resultEmpty.correct).toBe(false);
    expect(resultEmpty.completed).toBe(false);
    expect(resultEmpty.attempts).toBe(0);

    const resultWhitespace = evaluator.evaluate(mockActivity, '   ', mockState);
    expect(resultWhitespace.correct).toBe(false);
    expect(resultWhitespace.completed).toBe(false);
    expect(resultWhitespace.attempts).toBe(0);
  });
});
