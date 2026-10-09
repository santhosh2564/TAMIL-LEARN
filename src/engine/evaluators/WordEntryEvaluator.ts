import { Activity } from '../../types';
import { ActivityEvaluation, ActivityEvaluator, ActivityRuntimeState } from '../types';

export class WordEntryEvaluator implements ActivityEvaluator<string> {
  evaluate(activity: Activity, input: string, state?: ActivityRuntimeState): ActivityEvaluation {
    const isEnglish = activity.language?.startsWith('en') || activity.subject === 'English';

    if (typeof input !== 'string') {
      return {
        correct: false,
        completed: false,
        attempts: 0,
        feedback: {
          type: 'error',
          message: isEnglish ? 'Please enter an answer.' : 'விடையை உள்ளிடவும்'
        }
      };
    }

    const trimmedInput = input.trim();

    if (!trimmedInput) {
      return {
        correct: false,
        completed: false,
        attempts: 0,
        feedback: {
          type: 'error',
          message: isEnglish ? 'Please enter an answer.' : 'விடையை உள்ளிடவும்'
        }
      };
    }

    const expected = (
      Array.isArray(activity.correctAnswer)
        ? activity.correctAnswer[0]
        : (activity.correctAnswer || activity.targetWord || '')
    ).trim();

    // If options are provided, input might be an option ID (e.g. 'A') or direct option label
    let actualInput = trimmedInput;
    if (activity.options && activity.options.length > 0) {
      const matchedOpt = activity.options.find(
        o => o.id.toLowerCase() === trimmedInput.toLowerCase() || o.label.trim().toLowerCase() === trimmedInput.toLowerCase()
      );
      if (matchedOpt) {
        actualInput = matchedOpt.label.trim();
      }
    }

    // Strict case-insensitive matching — no fuzzy, no partial matching
    const isCorrect = actualInput.toLowerCase() === expected.toLowerCase();

    return {
      correct: isCorrect,
      // Only complete on a correct answer so wrong answers can be retried on the same activity
      completed: isCorrect,
      attempts: (state?.attempts ?? 0) + 1,
      feedback: {
        type: isCorrect ? 'success' : 'error',
        message: isCorrect
          ? (isEnglish ? 'Correct!' : 'சரியான விடை!')
          : (isEnglish ? 'Not quite. Try again.' : 'தவறான விடை')
      }
    };
  }
}
