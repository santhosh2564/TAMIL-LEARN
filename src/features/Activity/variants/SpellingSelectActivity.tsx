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
  const assetRef = useMemo<AssetReference>(() => ({
    id: `class3-tamil-picture-${activity.id.toLowerCase()}`,
    type: 'image'
  }), [activity.id]);

  const hasImage = useMemo(() => {
    return resolver.resolve(assetRef).status === 'resolved';
  }, [assetRef, resolver]);

  return (
    <ActivityCard>
      <div className="mb-4 text-center">
        <ActivityPrompt prompt={activity.prompt} />
      </div>

      {hasImage && (
        <div className="mb-6">
          <ActivityAsset assetRef={assetRef} />
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
        feedback={<ActivityFeedback status={state.status} correct={submitted ? isCorrect : undefined} />}
      />
    </ActivityCard>
  );
}
