import { Activity } from '../../types';
import { ActivityEvaluation, ActivityEvaluator } from '../types';

export class ArrangeWordEvaluator implements ActivityEvaluator<string[]> {
  evaluate(activity: Activity, inputIds: string[]): ActivityEvaluation {
    if (!activity.options || activity.options.length === 0) {
      throw new Error('Arrange word activity has no options');
    }

    // Map the selected option IDs back to their labels
    const selectedLabels = inputIds.map(id => {
      const opt = activity.options!.find(o => o.id === id);
      return opt ? opt.label : '';
    });

    // Check if the joined labels match the correct answer exactly.
    // This avoids unsafe Tamil grapheme splitting since the JSON options
    // already provide the correct atomic units, and the correctAnswer provides
    // the canonical joined string.
    const formedWord = selectedLabels.join('');
    
    // In arrange-word, correctAnswer is typically the full string (e.g. "கிழங்கு")
    const isCorrect = formedWord === activity.correctAnswer;

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
