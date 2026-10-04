import { Activity } from '../../types';
import { ActivityEvaluation, ActivityEvaluator } from '../types';

export class SpellingChoiceEvaluator implements ActivityEvaluator<string> {
  evaluate(activity: Activity, inputId: string): ActivityEvaluation {
    const isEnglish = activity.language?.startsWith('en') || activity.subject === 'English';

    if (!activity.options || activity.options.length === 0) {
      throw new Error('Spelling choice activity has no options');
    }

    const selectedOption = activity.options.find(opt => opt.id === inputId);
    
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
}
