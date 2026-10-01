import { Activity } from '../types';
import { ActivityEngine, ActivityRuntimeState, ActivityInput, ActivityEvaluator } from './types';

export class CoreActivityEngine implements ActivityEngine {
  start(activity: Activity): ActivityRuntimeState {
    return {
      activityId: activity.id,
      status: 'active',
      attempts: 0,
      startedAt: Date.now(),
    };
  }

  submit(
    activity: Activity,
    state: ActivityRuntimeState,
    input: ActivityInput,
    evaluator: ActivityEvaluator
  ) {
    if (state.status === 'completed') {
      throw new Error('Cannot submit to a completed activity');
    }

    if (state.status === 'idle') {
      throw new Error('Cannot submit to an idle activity');
    }

    const evaluation = evaluator.evaluate(activity, input, state);
    const newAttempts = state.attempts + 1;

    const nextState: ActivityRuntimeState = {
      ...state,
      attempts: newAttempts,
      status: evaluation.completed ? 'completed' : 'active',
      completedAt: evaluation.completed ? Date.now() : undefined,
    };

    return { nextState, evaluation };
  }

  reset(state: ActivityRuntimeState): ActivityRuntimeState {
    return {
      activityId: state.activityId,
      status: 'active',
      attempts: 0,
      startedAt: Date.now(),
      completedAt: undefined,
    };
  }
}
