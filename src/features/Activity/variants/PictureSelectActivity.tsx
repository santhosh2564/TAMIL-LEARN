import { ActivityComponentProps } from '../../../engine';
import { 
  ActivityCard, 
  ActivityPrompt, 
  ActivityOptionGrid, 
  ActivityOption, 
  ActivitySubmitArea, 
  ActivityAsset,
  ActivityFeedback,
  useSelectableRetry
} from '../components';

export function PictureSelectActivity({ activity, state, onSubmit, onNext }: ActivityComponentProps<string>) {
  const {
    shuffledOptions,
    selectedId,
    submitted,
    isCorrect,
    showRetry,
    locked,
    handleSelect,
    handleCheck,
    handleRetry,
    handleNext,
  } = useSelectableRetry({ activity, status: state.status, onSubmit, onNext });

  const isEnglish = activity.subject === 'English' || activity.language?.startsWith('en');
  const assetId = isEnglish
    ? (activity.image?.source || `eng-${activity.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activity.id.toLowerCase()}`)
    : `class3-tamil-picture-${activity.id.toLowerCase()}`;

  return (
    <ActivityCard>
      <ActivityPrompt prompt={activity.prompt} />
      
      <div className="mb-6">
        <ActivityAsset assetRef={{ id: assetId, type: 'image' }} language={isEnglish ? 'english' : 'tamil'} alt={activity.template || undefined} />
      </div>
      
      <ActivityOptionGrid>
        {shuffledOptions.map((opt) => (
          <ActivityOption
            key={opt.id}
            id={opt.id}
            label={opt.label}
            selected={selectedId === opt.id}
            disabled={locked}
            onSelect={handleSelect}
          />
        ))}
      </ActivityOptionGrid>
      
      <ActivitySubmitArea 
        status={state.status}
        canCheck={selectedId !== null && !submitted}
        onCheck={handleCheck}
        onNext={handleNext}
        onRetry={handleRetry}
        showRetry={showRetry}
        checkLabel={isEnglish ? 'Check Answer' : 'விடையைச் சரிபார்'}
        continueLabel={isEnglish ? 'Continue' : 'தொடர்க'}
        retryLabel={isEnglish ? 'Try Again' : 'மீண்டும் முயற்சி செய்'}
        feedback={
          <ActivityFeedback 
            status={state.status} 
            correct={submitted ? isCorrect : undefined} 
            successMessage={isEnglish ? 'Correct!' : 'சரியான விடை!'}
            errorMessage={isEnglish ? 'Not quite. Try again.' : 'தவறான விடை'}
          />
        }
      />
    </ActivityCard>
  );
}
