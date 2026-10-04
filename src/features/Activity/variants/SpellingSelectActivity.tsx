import { useMemo } from 'react';
import { ActivityComponentProps } from '../../../engine';
import { AssetResolver, AssetReference } from '../../../engine/assets';
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

export function SpellingSelectActivity({ activity, state, onSubmit, onNext }: ActivityComponentProps<string>) {
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

  const resolver = useMemo(() => new AssetResolver(), []);
  const isEnglish = activity.subject === 'English' || activity.language?.startsWith('en');

  const assetRef = useMemo<AssetReference | null>(() => {
    if (isEnglish) {
      const isPictureRequired = Boolean(activity.image) || /look at the picture/i.test(activity.prompt || '');
      if (!isPictureRequired) return null;
      const wordKey = activity.targetWord?.toLowerCase().replace(/[^a-z0-9]/g, '-') || activity.id.toLowerCase();
      return { id: `eng-${wordKey}`, type: 'image' };
    }
    return {
      id: `class3-tamil-picture-${activity.id.toLowerCase()}`,
      type: 'image'
    };
  }, [activity, isEnglish]);

  const hasImage = useMemo(() => {
    if (!assetRef) return false;
    if (isEnglish) return true; // Show image or graceful fallback
    return resolver.resolve(assetRef).status === 'resolved';
  }, [assetRef, resolver, isEnglish]);

  return (
    <ActivityCard>
      <div className="mb-4 text-center">
        <ActivityPrompt prompt={activity.prompt} />
      </div>

      {hasImage && assetRef && (
        <div className="mb-6">
          <ActivityAsset assetRef={assetRef} language={isEnglish ? 'english' : 'tamil'} alt={activity.template || undefined} />
        </div>
      )}
      
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
