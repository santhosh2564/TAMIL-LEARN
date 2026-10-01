import { useState, useEffect, useMemo } from 'react';
import { ActivityComponentProps } from '../../../engine';
import { shuffleOptions } from '../../../utils/shuffle';
import { 
  ActivityCard, 
  ActivityPrompt, 
  ActivityOptionGrid, 
  ActivityOption, 
  ActivitySubmitArea, 
  ActivityAsset,
  ActivityFeedback 
} from '../components';

export function PictureSelectActivity({ activity, state, onSubmit, onNext }: ActivityComponentProps<string>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Reset local state if activity changes
  useEffect(() => {
    setSelectedId(null);
  }, [activity.id]);

  const shuffledOptions = useMemo(() => {
    return shuffleOptions(activity.options || []);
  }, [activity.id, activity.options]);

  const handleSelect = (id: string) => {
    if (state.status === 'completed') return;
    setSelectedId(id);
  };

  const handleCheck = () => {
    if (selectedId) {
      onSubmit(selectedId);
    }
  };

  const handleNext = () => {
    if (onNext) onNext();
  };

  const options = activity.options || [];

  // Determine correct answer status if completed
  // Note: we can evaluate correctness safely here for UX, or we can look up if the selected label === correctAnswer.
  // The engine doesn't explicitly pass down the `evaluation` back into the props yet, except via state.status === 'completed'.
  // However, we know what we submitted and we can figure out if it was correct (to show green/red).
  const isCompleted = state.status === 'completed';
  const selectedOption = options.find(o => o.id === selectedId);
  const isCorrect = isCompleted ? (selectedOption?.label === activity.correctAnswer) : undefined;

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
            disabled={isCompleted}
            onSelect={handleSelect}
          />
        ))}
      </ActivityOptionGrid>
      
      <ActivitySubmitArea 
        status={state.status}
        canCheck={selectedId !== null}
        onCheck={handleCheck}
        onNext={handleNext}
        feedback={<ActivityFeedback status={state.status} correct={isCorrect} />}
      />
    </ActivityCard>
  );
}
