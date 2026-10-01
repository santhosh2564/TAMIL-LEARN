import { Activity } from '../../types';
import { ActivityEvaluation, ActivityEvaluator } from '../types';

export class ContextChoiceEvaluator implements ActivityEvaluator<string> {
  evaluate(activity: Activity, inputId: string): ActivityEvaluation {
    if (!activity.options || activity.options.length === 0) {
      throw new Error('Context choice activity has no options');
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
      completed: true,
      attempts: 1,
      feedback: {
        type: isCorrect ? 'success' : 'error'
      }
    };
  }
}
