import { activityRegistry } from '../../engine';
import { 
  PictureRecognitionEvaluator, 
  SpellingChoiceEvaluator,
  MeaningMatchEvaluator,
  ContextChoiceEvaluator,
  ArrangeWordEvaluator,
  WordCompletionEvaluator
} from '../../engine/evaluators';
import { 
  PictureSelectActivity, 
  SpellingSelectActivity,
  MeaningMatchActivity,
  ContextChoiceActivity,
  ArrangeWordActivity,
  WordCompletionActivity
} from './variants';

export function registerCoreActivities() {
  // 1. Picture Recognition -> Select
  activityRegistry.register({
    category: 'picture-recognition',
    variant: 'select',
    component: PictureSelectActivity,
    evaluator: new PictureRecognitionEvaluator(),
  });

  // 2. Spelling Choice -> Select
  activityRegistry.register({
    category: 'spelling-choice',
    variant: 'select',
    component: SpellingSelectActivity,
    evaluator: new SpellingChoiceEvaluator(),
  });

  // 3. Meaning Match -> Translate Select
  activityRegistry.register({
    category: 'meaning-match',
    variant: 'translate-select',
    component: MeaningMatchActivity,
    evaluator: new MeaningMatchEvaluator(),
  });

  // 4. Context Choice -> Fill Blank
  activityRegistry.register({
    category: 'context-choice',
    variant: 'fill-blank',
    component: ContextChoiceActivity,
    evaluator: new ContextChoiceEvaluator(),
  });

  // 5. Arrange Word -> Arrange
  activityRegistry.register({
    category: 'arrange-word',
    variant: 'arrange',
    component: ArrangeWordActivity,
    evaluator: new ArrangeWordEvaluator(),
  });

  // 6. Word Completion -> Missing Unit
  activityRegistry.register({
    category: 'word-completion',
    variant: 'missing-unit',
    component: WordCompletionActivity,
    evaluator: new WordCompletionEvaluator(),
  });
}
