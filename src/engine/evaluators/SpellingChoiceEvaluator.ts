import { Activity } from '../../types';
import { ActivityEvaluation, ActivityEvaluator } from '../types';

export class SpellingChoiceEvaluator implements ActivityEvaluator<string> {
  evaluate(activity: Activity, inputId: string): ActivityEvaluation {
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
          message: 'தேர்வு செல்லுபடியாகவில்லை'
        }
      };
    }

    // Tamil text must be handled safely. 
    // Basic equality check is sufficient as both originate from the normalized JSON strings.
    const isCorrect = selectedOption.label === activity.correctAnswer;

    return {
      correct: isCorrect,
      // Only complete on a correct answer. A wrong answer keeps the activity
      // active so the learner can retry the SAME activity (see retry flow).
      completed: isCorrect,
      attempts: 1,
      feedback: {
        type: isCorrect ? 'success' : 'error'
      }
    };
  }
}
