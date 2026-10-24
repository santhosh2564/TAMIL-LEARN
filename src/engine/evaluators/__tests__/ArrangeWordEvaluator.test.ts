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

  describe('Defect 3 Regression: Compound Arrange Spacing Normalization', () => {
    it('evaluates FTS0295 "காவல்" + "நிலையம்" -> "காவல் நிலையம்" correctly', () => {
      const fts0295Activity = {
        id: 'FTS0295',
        category: 'arrange-word',
        variant: 'arrange',
        correctAnswer: 'காவல் நிலையம்',
        options: [
          { id: '1', label: 'காவல்' },
          { id: '2', label: 'நிலையம்' }
        ]
      } as Activity;

      const result = evaluator.evaluate(fts0295Activity, ['1', '2']);
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);

      const wrongResult = evaluator.evaluate(fts0295Activity, ['2', '1']);
      expect(wrongResult.correct).toBe(false);
      expect(wrongResult.completed).toBe(false);
    });

    it('evaluates FTS0715 "பளு" + "தூக்கும்" -> "பளு தூக்கும்" correctly', () => {
      const fts0715Activity = {
        id: 'FTS0715',
        category: 'arrange-word',
        variant: 'arrange',
        correctAnswer: 'பளு தூக்கும்',
        options: [
          { id: '1', label: 'பளு' },
          { id: '2', label: 'தூக்கும்' }
        ]
      } as Activity;

      const result = evaluator.evaluate(fts0715Activity, ['1', '2']);
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);

      const wrongResult = evaluator.evaluate(fts0715Activity, ['2', '1']);
      expect(wrongResult.correct).toBe(false);
      expect(wrongResult.completed).toBe(false);
    });

    it('evaluates multi-word arrange with 3 or more spaced units', () => {
      const multiWordActivity = {
        id: 'MULTI-WORD-TEST',
        category: 'arrange-word',
        variant: 'arrange',
        correctAnswer: 'தமிழ் நாடு அரசு',
        options: [
          { id: '1', label: 'தமிழ்' },
          { id: '2', label: 'நாடு' },
          { id: '3', label: 'அரசு' }
        ]
      } as Activity;

      const result = evaluator.evaluate(multiWordActivity, ['1', '2', '3']);
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);

      const wrongResult = evaluator.evaluate(multiWordActivity, ['2', '1', '3']);
      expect(wrongResult.correct).toBe(false);
      expect(wrongResult.completed).toBe(false);
    });

    it('evaluates English multi-word and hyphenated answers without space tiles (e.g. "thank you", "pitter-patter")', () => {
      // 1. "thank you"
      const thankYouAct = {
        id: 'ENG-M4-EW834',
        category: 'arrange-word',
        variant: 'arrange',
        correctAnswer: 'thank you',
        options: [
          { id: '1', label: 't' },
          { id: '2', label: 'h' },
          { id: '3', label: 'a' },
          { id: '4', label: 'n' },
          { id: '5', label: 'k' },
          { id: '6', label: 'y' },
          { id: '7', label: 'o' },
          { id: '8', label: 'u' }
        ]
      } as Activity;
      expect(evaluator.evaluate(thankYouAct, ['1', '2', '3', '4', '5', '6', '7', '8']).correct).toBe(true);

      // 2. "pitter-patter"
      const pitterPatterAct = {
        id: 'ENG-M8-EW588',
        category: 'arrange-word',
        variant: 'arrange',
        correctAnswer: 'pitter-patter',
        options: [
          { id: '1', label: 'pitter' },
          { id: '2', label: 'patter' }
        ]
      } as Activity;
      expect(evaluator.evaluate(pitterPatterAct, ['1', '2']).correct).toBe(true);
      expect(evaluator.evaluate(pitterPatterAct, ['2', '1']).correct).toBe(false);

      // 3. "post office"
      const postOfficeAct = {
        id: 'ENG-M8-EW609',
        category: 'arrange-word',
        variant: 'arrange',
        correctAnswer: 'post office',
        options: [
          { id: '1', label: 'post' },
          { id: '2', label: 'off' },
          { id: '3', label: 'ice' }
        ]
      } as Activity;
      expect(evaluator.evaluate(postOfficeAct, ['1', '2', '3']).correct).toBe(true);
      expect(evaluator.evaluate(postOfficeAct, ['2', '3', '1']).correct).toBe(false);
    });
  });
});
