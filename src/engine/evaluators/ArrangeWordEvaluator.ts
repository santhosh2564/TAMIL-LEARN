import { Activity } from '../../types';
import { ActivityEvaluation, ActivityEvaluator } from '../types';
import { matchesTamilOrTarget } from '../../utils/tamil';

export class ArrangeWordEvaluator implements ActivityEvaluator<string[]> {
  evaluate(activity: Activity, inputIds: string[]): ActivityEvaluation {
    const isEnglish = activity.language?.startsWith('en') || activity.subject === 'English';

    const options = (activity.options && activity.options.length > 0)
      ? activity.options
      : (activity.units?.map((u, i) => ({ id: String.fromCharCode(65 + i), label: u })) || []);

    if (options.length === 0) {
      return {
        correct: false,
        completed: false,
        attempts: 1,
        feedback: {
          type: 'error',
          message: isEnglish ? 'Activity tokens are not available' : 'சொல் அலகுகள் கிடைக்கவில்லை'
        }
      };
    }

    if (!Array.isArray(inputIds)) {
      return {
        correct: false,
        completed: false,
        attempts: 1,
        feedback: {
          type: 'error',
          message: isEnglish ? 'Invalid token selection' : 'செல்லுபடியாகாத தேர்வு'
        }
      };
    }

    // Map the selected option IDs back to their labels
    const selectedLabels = inputIds.map(id => {
      const opt = options.find(o => o.id === id);
      return opt ? opt.label : '';
    });

    // Check if the joined labels match the correct answer (supports exact, array targets, and Tamil sandhi)
    const formedWord = selectedLabels.join('');
    const isCorrect = matchesTamilOrTarget(formedWord, activity.correctAnswer);

    return {
      correct: isCorrect,
      // Only complete on a correct answer. A wrong answer keeps the activity
      // active so the learner can retry the SAME activity (see retry flow).
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
