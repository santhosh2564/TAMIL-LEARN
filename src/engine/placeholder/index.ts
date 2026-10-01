import { activityRegistry } from '../ActivityRegistry';
import { PlaceholderActivity } from './PlaceholderActivity';
import { PlaceholderEvaluator } from './PlaceholderEvaluator';

export function registerPlaceholderActivity() {
  activityRegistry.register({
    category: 'unknown',
    variant: 'unknown',
    component: PlaceholderActivity,
    evaluator: new PlaceholderEvaluator(),
  });
}
