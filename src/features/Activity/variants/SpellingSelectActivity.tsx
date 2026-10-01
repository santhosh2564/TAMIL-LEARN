import { useState, useEffect, useMemo } from 'react';
import { ActivityComponentProps } from '../../../engine';
import { shuffleOptions } from '../../../utils/shuffle';
import { 
  ActivityCard, 
  ActivityPrompt, 
  ActivityOptionGrid, 
  ActivityOption, 
  ActivitySubmitArea,
  ActivityFeedback 
} from '../components';

export function SpellingSelectActivity({ activity, state, onSubmit, onNext }: ActivityComponentProps<string>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
  
  const isCompleted = state.status === 'completed';
  const selectedOption = options.find(o => o.id === selectedId);
  const isCorrect = isCompleted ? (selectedOption?.label === activity.correctAnswer) : undefined;

  return (
    <ActivityCard>
      <div className="mb-4 text-center">
        <ActivityPrompt prompt={activity.prompt} />
        {/* Spelling activities might not have images, but they heavily rely on the prompt or target word context.
            For many spelling-choice activities, the user needs to pick the correct spelling from options. */}
      </div>
      
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
