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

  return (
    <ActivityCard>
      <ActivityPrompt prompt={activity.prompt} />
      
      <ActivityAsset assetRef={{ id: `class3-tamil-picture-${activity.id.toLowerCase()}`, type: 'image' }} />
      
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
