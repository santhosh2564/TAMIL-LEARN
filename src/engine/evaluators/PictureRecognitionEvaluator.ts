import { Activity } from '../../types';
import { ActivityEvaluation, ActivityEvaluator } from '../types';

export class PictureRecognitionEvaluator implements ActivityEvaluator<string> {
  evaluate(activity: Activity, inputId: string): ActivityEvaluation {
    if (!activity.options || activity.options.length === 0) {
      throw new Error('Picture recognition activity has no options');
    }

    const selectedOption = activity.options.find(opt => opt.id === inputId);
    
    if (!selectedOption) {
      return {
        correct: false,
        completed: false,
        attempts: 1,
        feedback: {
          type: 'error',
          message: 'Invalid selection.'
        }
      };
    }

    const isCorrect = selectedOption.label === activity.correctAnswer;

    return {
      correct: isCorrect,
      completed: true, // Complete on first submit, whether correct or incorrect, based on simple UX rules. Let session handle retries if we want later.
      attempts: 1,
      feedback: {
        type: isCorrect ? 'success' : 'error'
      }
    };
  }
}
