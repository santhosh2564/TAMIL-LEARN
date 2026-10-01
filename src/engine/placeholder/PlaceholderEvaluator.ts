import { ActivityEvaluator, ActivityEvaluation, ActivityRuntimeState } from '../types';
import { Activity } from '../../types';

export class PlaceholderEvaluator implements ActivityEvaluator<string> {
  evaluate(
    _activity: Activity,
    _input: string,
    state: ActivityRuntimeState
  ): ActivityEvaluation {
    return {
      correct: true, // We treat skipped placeholder as completed correctly
      completed: true,
      attempts: state.attempts + 1,
      feedback: {
        type: 'info',
        message: 'Skipped placeholder activity.'
      }
    };
  }
}
