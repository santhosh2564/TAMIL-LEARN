import { useState, useEffect, useMemo } from 'react';
import { ActivityComponentProps } from '../../../engine';
import { shuffleOptions } from '../../../utils/shuffle';
import { 
  ActivityCard, 
  ActivityOptionGrid, 
  ActivityOption, 
  ActivitySubmitArea,
  ActivityFeedback,
  WordCompletionDisplay
} from '../components';

export function WordCompletionActivity({ activity, state, onSubmit, onNext }: ActivityComponentProps<string>) {
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

  // Normalize prompt to strip any unbracketed fill-blanks from context sentences
  const normalizedPrompt = activity.prompt.replace(/(?<!\[)_{2,}\.?\s*/g, '');

  let displayPrompt = normalizedPrompt;
  if (selectedId && selectedOption) {
    // Replaces only the bracketed blank ([blank] or [____]) with the selected option label
    displayPrompt = normalizedPrompt.replace(/\[(?:blank|_{2,})\]/g, selectedOption.label);
  }

  return (
    <ActivityCard>
      <div className="mb-8 text-center w-full">
        <WordCompletionDisplay prompt={displayPrompt} />
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
