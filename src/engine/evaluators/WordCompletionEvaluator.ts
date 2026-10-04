import { Activity } from '../../types';
import { ActivityEvaluation, ActivityEvaluator } from '../types';

export class WordCompletionEvaluator implements ActivityEvaluator<string> {
  evaluate(activity: Activity, input: string): ActivityEvaluation {
    const isEnglish = activity.language?.startsWith('en') || activity.subject === 'English';

    // 1. Multiple-choice selection (Tamil pattern or choice-based)
    if (activity.options && activity.options.length > 0) {
      const selectedOption = activity.options.find(opt => opt.id === input);
      
      if (!selectedOption) {
        return {
          correct: false,
          completed: false,
          attempts: 1,
          feedback: {
            type: 'error',
            message: isEnglish ? 'Please select an option' : 'தேர்வு செல்லுபடியாகவில்லை'
          }
        };
      }

      // For missing-unit, correctAnswer contains the missing string (e.g. "தி")
      const targetAns = Array.isArray(activity.correctAnswer) ? activity.correctAnswer[0] : (activity.correctAnswer || '');
      const isCorrect = selectedOption.label.trim().toLowerCase() === targetAns.trim().toLowerCase();

      return {
        correct: isCorrect,
        completed: isCorrect,
        attempts: 1,
        feedback: {
          type: isCorrect ? 'success' : 'error',
          message: isCorrect
            ? (isEnglish ? 'Correct!' : 'சரியான விடை!')
            : (isEnglish ? 'Not quite. Try again.' : 'தவறான விடை')
        }
      };
    }

    // 2. Direct letter/unit entry (English E05 / E11 pattern)
    if (typeof input !== 'string' || !input.trim()) {
      return {
        correct: false,
        completed: false,
        attempts: 0,
        feedback: {
          type: 'error',
          message: isEnglish ? 'Please enter the missing letter' : 'விடுபட்ட எழுத்தை உள்ளிடவும்'
        }
      };
    }

    const trimmedInput = input.trim().toLowerCase();
    const targetWord = (activity.targetWord || (Array.isArray(activity.correctAnswer) ? activity.correctAnswer[0] : activity.correctAnswer) || '').toLowerCase().trim();

    // Extract missing letter(s) from template and targetWord
    let expectedLetters = '';
    if (activity.template && targetWord) {
      const cleanedTemplate = activity.template.replace(/[|\s]/g, '');
      const cleanedTarget = targetWord.replace(/\s+/g, '');
      for (let i = 0; i < cleanedTemplate.length && i < cleanedTarget.length; i++) {
        if (cleanedTemplate[i] === '_') {
          expectedLetters += cleanedTarget[i];
        }
      }
    }

    // Determine the expected missing unit(s)
    const expectedUnit = (expectedLetters || (Array.isArray(activity.correctAnswer) ? activity.correctAnswer[0] : activity.correctAnswer) || '').toLowerCase().trim();

    // Strict missing-letter evaluation:
    // Only the required missing letter/unit(s) in correct order is accepted.
    // Full-word input (e.g. "about" when expected is "o") is strictly rejected.
    const isCorrect = expectedUnit.length > 0 && trimmedInput === expectedUnit;

    return {
      correct: isCorrect,
      completed: isCorrect,
      attempts: 1,
      feedback: {
        type: isCorrect ? 'success' : 'error',
        message: isCorrect
          ? (isEnglish ? 'Correct!' : 'சரியான விடை!')
          : (isEnglish ? 'Not quite. Try again.' : 'தவறான விடை')
      }
    };
  }
}
