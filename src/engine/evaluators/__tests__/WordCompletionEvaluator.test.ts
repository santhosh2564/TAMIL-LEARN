import { describe, it, expect } from 'vitest';
import { WordCompletionEvaluator } from '../WordCompletionEvaluator';
import { Activity } from '../../../types';

describe('WordCompletionEvaluator', () => {
  const evaluator = new WordCompletionEvaluator();

  describe('Tamil word-completion regression (multiple-choice missing-unit)', () => {
    const tamilActivity = {
      id: 'Q002',
      category: 'word-completion',
      variant: 'missing-unit',
      correctAnswer: 'தி',
      options: [
        { id: 'A', label: 'தி' },
        { id: 'B', label: 'தீ' }
      ]
    } as Activity;

    it('evaluates correct option selection as correct and completed', () => {
      const result = evaluator.evaluate(tamilActivity, 'A');
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.feedback?.type).toBe('success');
      expect(result.feedback?.message).toBe('சரியான விடை!');
    });

    it('evaluates incorrect option selection as incorrect without completing', () => {
      const result = evaluator.evaluate(tamilActivity, 'B');
      expect(result.correct).toBe(false);
      expect(result.completed).toBe(false);
      expect(result.feedback?.type).toBe('error');
      expect(result.feedback?.message).toBe('தவறான விடை');
    });

    it('handles invalid option id gracefully without completing', () => {
      const result = evaluator.evaluate(tamilActivity, 'INVALID');
      expect(result.correct).toBe(false);
      expect(result.completed).toBe(false);
      expect(result.feedback?.type).toBe('error');
    });
  });

  describe('English missing-letter completion (E05 / E11)', () => {
    const englishActivity = {
      id: 'ENG-M2-EW001',
      subject: 'English',
      language: 'en-IN',
      category: 'word-completion',
      variant: 'missing-unit',
      targetWord: 'about',
      template: 'a b _ u t',
      correctAnswer: 'about'
    } as Activity;

    it('evaluates lowercase missing letter "o" as correct', () => {
      const result = evaluator.evaluate(englishActivity, 'o');
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
      expect(result.feedback?.type).toBe('success');
      expect(result.feedback?.message).toBe('Correct!');
    });

    it('evaluates uppercase missing letter "O" as correct (case-insensitive)', () => {
      const result = evaluator.evaluate(englishActivity, 'O');
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('evaluates trimmed missing letter "  o  " as correct', () => {
      const result = evaluator.evaluate(englishActivity, '  o  ');
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('rejects full target word " about " when only missing letter is expected', () => {
      const result = evaluator.evaluate(englishActivity, ' about ');
      expect(result.correct).toBe(false);
      expect(result.completed).toBe(false);
      expect(result.feedback?.type).toBe('error');
      expect(result.feedback?.message).toBe('Not quite. Try again.');
      expect(result.feedback?.message).not.toContain('about');
    });

    it('rejects wrong letter "a" without completing', () => {
      const result = evaluator.evaluate(englishActivity, 'a');
      expect(result.correct).toBe(false);
      expect(result.completed).toBe(false);
      expect(result.feedback?.type).toBe('error');
      expect(result.feedback?.message).toBe('Not quite. Try again.');
      expect(result.feedback?.message).not.toContain('about');
    });

    it('rejects wrong letter "e" without completing', () => {
      const result = evaluator.evaluate(englishActivity, 'e');
      expect(result.correct).toBe(false);
      expect(result.completed).toBe(false);
      expect(result.feedback?.type).toBe('error');
      expect(result.feedback?.message).toBe('Not quite. Try again.');
      expect(result.feedback?.message).not.toContain('about');
    });

    it('evaluates empty or whitespace-only input as invalid without completing', () => {
      const emptyResult = evaluator.evaluate(englishActivity, '');
      expect(emptyResult.correct).toBe(false);
      expect(emptyResult.completed).toBe(false);
      expect(emptyResult.attempts).toBe(0);

      const spacesResult = evaluator.evaluate(englishActivity, '   ');
      expect(spacesResult.correct).toBe(false);
      expect(spacesResult.completed).toBe(false);
      expect(spacesResult.attempts).toBe(0);
    });

    it('supports multi-blank template if present', () => {
      const multiBlankActivity = {
        id: 'ENG-TEST-MULTI',
        subject: 'English',
        language: 'en-IN',
        category: 'word-completion',
        variant: 'missing-unit',
        targetWord: 'banana',
        template: 'b _ n _ n _',
        correctAnswer: 'banana'
      } as Activity;

      // Expects "aaa" in sequence
      const correctMulti = evaluator.evaluate(multiBlankActivity, 'aaa');
      expect(correctMulti.correct).toBe(true);
      expect(correctMulti.completed).toBe(true);

      const caseInsensitiveMulti = evaluator.evaluate(multiBlankActivity, 'AAA');
      expect(caseInsensitiveMulti.correct).toBe(true);
      expect(caseInsensitiveMulti.completed).toBe(true);

      // Full word "banana" is rejected
      const fullWordMulti = evaluator.evaluate(multiBlankActivity, 'banana');
      expect(fullWordMulti.correct).toBe(false);
      expect(fullWordMulti.completed).toBe(false);

      // Incomplete missing letters rejected
      const partialMulti = evaluator.evaluate(multiBlankActivity, 'aa');
      expect(partialMulti.correct).toBe(false);
      expect(partialMulti.completed).toBe(false);
    });
  });

  describe('Defect 1 Regression: Tamil Unicode Multi-Code-Unit Grapheme Indexing', () => {
    it('correctly evaluates uyirmei completion with pulli (e.g. மகன் with missing ன்)', () => {
      const maganActivity = {
        id: 'FTS-TEST-MAGAN',
        category: 'word-completion',
        variant: 'missing-unit',
        targetWord: 'மகன்',
        template: 'மக_',
        correctAnswer: 'மகன்',
        options: [
          { id: 'A', label: 'ன்' },
          { id: 'B', label: 'ல்' }
        ]
      } as Activity;

      // Via Option ID
      const optResult = evaluator.evaluate(maganActivity, 'A');
      expect(optResult.correct).toBe(true);
      expect(optResult.completed).toBe(true);

      // Via direct text
      const textResult = evaluator.evaluate(maganActivity, 'ன்');
      expect(textResult.correct).toBe(true);
      expect(textResult.completed).toBe(true);

      // Reject incorrect option
      const wrongResult = evaluator.evaluate(maganActivity, 'B');
      expect(wrongResult.correct).toBe(false);
      expect(wrongResult.completed).toBe(false);
    });

    it('correctly evaluates multi-character / compound unit completion (e.g. பணியாரம் with missing யாரம்)', () => {
      const paniyaramActivity = {
        id: 'FTS-TEST-PANIYARAM',
        category: 'word-completion',
        variant: 'missing-unit',
        targetWord: 'பணியாரம்',
        template: 'பணி_',
        correctAnswer: 'பணியாரம்',
        options: [
          { id: 'A', label: 'யாரம்' },
          { id: 'B', label: 'வாரம்' }
        ]
      } as Activity;

      const result = evaluator.evaluate(paniyaramActivity, 'A');
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('correctly evaluates multi-grapheme plural unit completion (e.g. பயணிகள் with missing கள்)', () => {
      const payanigalActivity = {
        id: 'FTS-TEST-PAYANIGAL',
        category: 'word-completion',
        variant: 'missing-unit',
        targetWord: 'பயணிகள்',
        template: 'பயணி_',
        correctAnswer: 'பயணிகள்',
        options: [
          { id: 'A', label: 'கள்' },
          { id: 'B', label: 'கள்' }
        ]
      } as Activity;

      const result = evaluator.evaluate(payanigalActivity, 'A');
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('correctly evaluates complex vowel sign completion (e.g. ஊற்ற with missing ற்ற)', () => {
      const ootraActivity = {
        id: 'FTS-TEST-OOTRA',
        category: 'word-completion',
        variant: 'missing-unit',
        targetWord: 'ஊற்ற',
        template: 'ஊ_',
        correctAnswer: 'ஊற்ற',
        options: [
          { id: 'A', label: 'ற்ற' },
          { id: 'B', label: 'த்த' }
        ]
      } as Activity;

      const result = evaluator.evaluate(ootraActivity, 'A');
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('correctly evaluates uyirmei completion (e.g. கிளை with missing ளை)', () => {
      const kilaiActivity = {
        id: 'FTS-TEST-KILAI',
        category: 'word-completion',
        variant: 'missing-unit',
        targetWord: 'கிளை',
        template: 'கி_',
        correctAnswer: 'கிளை',
        options: [
          { id: 'A', label: 'ளை' },
          { id: 'B', label: 'லை' }
        ]
      } as Activity;

      const result = evaluator.evaluate(kilaiActivity, 'A');
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('correctly evaluates uyirmei with vowel i sign (e.g. சிரி with missing ரி)', () => {
      const siriActivity = {
        id: 'FTS-TEST-SIRI',
        category: 'word-completion',
        variant: 'missing-unit',
        targetWord: 'சிரி',
        template: 'சி_',
        correctAnswer: 'சிரி',
        options: [
          { id: 'A', label: 'ரி' },
          { id: 'B', label: 'லி' }
        ]
      } as Activity;

      const result = evaluator.evaluate(siriActivity, 'A');
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
    });

    it('correctly evaluates long multi-character word (e.g. செம்பருத்தி with missing தி)', () => {
      const sembaruthiActivity = {
        id: 'FTS-TEST-SEMBARUTHI',
        category: 'word-completion',
        variant: 'missing-unit',
        targetWord: 'செம்பருத்தி',
        template: 'செம்பருத்_',
        correctAnswer: 'செம்பருத்தி',
        options: [
          { id: 'A', label: 'தி' },
          { id: 'B', label: 'டி' }
        ]
      } as Activity;

      const result = evaluator.evaluate(sembaruthiActivity, 'A');
      expect(result.correct).toBe(true);
      expect(result.completed).toBe(true);
    });
  });
});
