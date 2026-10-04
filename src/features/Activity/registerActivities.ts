import { activityRegistry } from '../../engine';
import { 
  PictureRecognitionEvaluator, 
  SpellingChoiceEvaluator,
  MeaningMatchEvaluator,
  ContextChoiceEvaluator,
  ArrangeWordEvaluator,
  WordCompletionEvaluator,
  WordEntryEvaluator
} from '../../engine/evaluators';
import { 
  PictureSelectActivity, 
  SpellingSelectActivity,
  MeaningMatchActivity,
  ContextChoiceActivity,
  ArrangeWordActivity,
  WordCompletionActivity,
  WordEntryActivity
} from './variants';

export function registerCoreActivities() {
  // 1. Picture Recognition -> Select
  activityRegistry.register({
    category: 'picture-recognition',
    variant: 'select',
    component: PictureSelectActivity,
    evaluator: new PictureRecognitionEvaluator(),
  });

  // 2. Picture Recognition -> Word Entry (English E01 and E12 write)
  activityRegistry.register({
    category: 'picture-recognition',
    variant: 'word-entry',
    component: WordEntryActivity,
    evaluator: new WordEntryEvaluator(),
  });

  // 3. Spelling Choice -> Select (English E08)
  activityRegistry.register({
    category: 'spelling-choice',
    variant: 'select',
    component: SpellingSelectActivity,
    evaluator: new SpellingChoiceEvaluator(),
  });

  // 4. Meaning Match -> Translate Select (Tamil)
  activityRegistry.register({
    category: 'meaning-match',
    variant: 'translate-select',
    component: MeaningMatchActivity,
    evaluator: new MeaningMatchEvaluator(),
  });

  // 5. Meaning Match -> Word Entry (English E09)
  activityRegistry.register({
    category: 'meaning-match',
    variant: 'word-entry',
    component: WordEntryActivity,
    evaluator: new WordEntryEvaluator(),
  });

  // 6. Context Choice -> Fill Blank
  activityRegistry.register({
    category: 'context-choice',
    variant: 'fill-blank',
    component: ContextChoiceActivity,
    evaluator: new ContextChoiceEvaluator(),
  });

  // 7. Arrange Word -> Arrange (English E04, E06, E07)
  activityRegistry.register({
    category: 'arrange-word',
    variant: 'arrange',
    component: ArrangeWordActivity,
    evaluator: new ArrangeWordEvaluator(),
  });

  // 8. Word Completion -> Missing Unit (English E05, E11)
  activityRegistry.register({
    category: 'word-completion',
    variant: 'missing-unit',
    component: WordCompletionActivity,
    evaluator: new WordCompletionEvaluator(),
  });
}
