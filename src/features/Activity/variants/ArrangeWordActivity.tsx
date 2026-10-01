import { useState, useEffect } from 'react';
import { ActivityComponentProps } from '../../../engine';
import { 
  ActivityCard, 
  ActivityPrompt, 
  ActivitySubmitArea,
  ActivityFeedback,
  ArrangeToken
} from '../components';

import { shuffleArray } from '../../../utils/shuffle';

export function ArrangeWordActivity({ activity, state, onSubmit, onNext }: ActivityComponentProps<string[]>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [availableIds, setAvailableIds] = useState<string[]>([]);
  const [shuffled, setShuffled] = useState(false);

  const options = activity.options || [];

  useEffect(() => {
    // Reset and shuffle when activity changes
    setSelectedIds([]);
    setAvailableIds(shuffleArray(activity.options?.map(o => o.id) || []));
    setShuffled(true);
  }, [activity.id, activity.options]);

  const isCompleted = state.status === 'completed';

  const handleSelect = (id: string) => {
    if (isCompleted) return;
    setAvailableIds(prev => prev.filter(i => i !== id));
    setSelectedIds(prev => [...prev, id]);
  };

  const handleRemove = (id: string) => {
    if (isCompleted) return;
    setSelectedIds(prev => prev.filter(i => i !== id));
    setAvailableIds(prev => [...prev, id]); // Add back to end of available pool
  };

  const handleMoveLeft = (id: string) => {
    if (isCompleted) return;
    setSelectedIds(prev => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const newIds = [...prev];
      [newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]];
      return newIds;
    });
  };

  const handleMoveRight = (id: string) => {
    if (isCompleted) return;
    setSelectedIds(prev => {
      const idx = prev.indexOf(id);
      if (idx === -1 || idx === prev.length - 1) return prev;
      const newIds = [...prev];
      [newIds[idx], newIds[idx + 1]] = [newIds[idx + 1], newIds[idx]];
      return newIds;
    });
  };

  const handleCheck = () => {
    // Only allow submission if all tokens are used?
    // Let's allow submission anytime there is at least one token, or let them submit empty.
    // The prompt says "Check Answer evaluates the current sequence".
    onSubmit(selectedIds);
  };

  const handleNext = () => {
    if (onNext) onNext();
  };

  if (!shuffled) return null; // Wait for initial shuffle

  // Evaluation correctness calculation for UI feedback
  let isCorrect: boolean | undefined = undefined;
  if (isCompleted) {
    const formedWord = selectedIds.map(id => options.find(o => o.id === id)?.label || '').join('');
    isCorrect = formedWord === activity.correctAnswer;
  }

  return (
    <ActivityCard className="max-w-4xl">
      <div className="mb-4 text-center w-full">
        <ActivityPrompt prompt={activity.prompt} />
      </div>
      
      {/* Answer Area */}
      <div className="w-full min-h-[100px] p-6 mb-4 bg-surface rounded-2xl border-4 border-dashed border-primary-200 flex flex-wrap gap-3 items-center justify-center">
        {selectedIds.length === 0 && (
          <span className="text-text-muted font-bold opacity-50 select-none">
            இங்கே கட்டங்களை நகர்த்தவும்...
          </span>
        )}
        {selectedIds.map((id, idx) => {
          const opt = options.find(o => o.id === id);
          if (!opt) return null;
          return (
            <ArrangeToken
              key={`selected-${id}`}
              id={id}
              label={opt.label}
              status="selected"
              disabled={isCompleted}
              isFirst={idx === 0}
              isLast={idx === selectedIds.length - 1}
              onRemove={handleRemove}
              onMoveLeft={handleMoveLeft}
              onMoveRight={handleMoveRight}
            />
          );
        })}
      </div>

      {/* Available Pool Area */}
      <div className="w-full min-h-[80px] mb-8 flex flex-wrap gap-3 items-center justify-center">
        {availableIds.map((id) => {
          const opt = options.find(o => o.id === id);
          if (!opt) return null;
          return (
            <ArrangeToken
              key={`available-${id}`}
              id={id}
              label={opt.label}
              status="available"
              disabled={isCompleted}
              onSelect={handleSelect}
            />
          );
        })}
      </div>
      
      <ActivitySubmitArea 
        status={state.status}
        canCheck={selectedIds.length > 0} // Must select at least 1 token to check
        onCheck={handleCheck}
        onNext={handleNext}
        feedback={<ActivityFeedback status={state.status} correct={isCorrect} />}
      />
    </ActivityCard>
  );
}
