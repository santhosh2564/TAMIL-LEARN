import { useState, useEffect } from 'react';
import { ActivityComponentProps } from '../../../engine';
import { 
  ActivityCard, 
  ActivityPrompt, 
  ActivitySubmitArea,
  ActivityFeedback,
  ArrangeToken,
  ActivityAsset
} from '../components';

import { shuffleArray } from '../../../utils/shuffle';
import { matchesTamilOrTarget } from '../../../utils/tamil';

export function ArrangeWordActivity({ activity, state, onSubmit, onNext }: ActivityComponentProps<string[]>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [availableIds, setAvailableIds] = useState<string[]>([]);
  const [shuffled, setShuffled] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const isEnglish = activity.subject === 'English' || activity.language?.startsWith('en');
  const isTamilPicturePrompt = /படத்தில் காணப்படும்/.test(activity.prompt || '');
  const hasImage = Boolean(activity.image) || /look at the picture/i.test(activity.prompt || '') || isTamilPicturePrompt;
  const assetId = activity.image?.source
    || (isTamilPicturePrompt ? `class3-tamil-picture-${activity.id.toLowerCase()}` : null)
    || (activity.targetWord ? `eng-${activity.targetWord.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : null);

  const options = activity.options || [];

  useEffect(() => {
    // Reset and shuffle when activity changes
    setSelectedIds([]);
    setAvailableIds(shuffleArray(activity.options?.map(o => o.id) || []));
    setShuffled(true);
    setSubmitted(false);
  }, [activity.id, activity.options]);

  const isCompleted = state.status === 'completed';

  // Evaluation correctness for UI feedback, known once submitted.
  // The engine evaluation in SessionPage stays authoritative for completion.
  const formedWord = selectedIds.map(id => options.find(o => o.id === id)?.label || '').join('');
  const isCorrect = submitted ? matchesTamilOrTarget(formedWord, activity.correctAnswer) : undefined;

  // Wrong submission: show retry, lock tokens until the learner retries.
  // Retry keeps the current arrangement so the child can reorder and try again.
  const showRetry = submitted && isCorrect === false && !isCompleted;
  const locked = isCompleted || showRetry;

  const handleSelect = (id: string) => {
    if (locked) return;
    setAvailableIds(prev => prev.filter(i => i !== id));
    setSelectedIds(prev => [...prev, id]);
  };

  const handleRemove = (id: string) => {
    if (locked) return;
    setSelectedIds(prev => prev.filter(i => i !== id));
    setAvailableIds(prev => [...prev, id]); // Add back to end of available pool
  };

  const handleMoveLeft = (id: string) => {
    if (locked) return;
    setSelectedIds(prev => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const newIds = [...prev];
      [newIds[idx - 1], newIds[idx]] = [newIds[idx], newIds[idx - 1]];
      return newIds;
    });
  };

  const handleMoveRight = (id: string) => {
    if (locked) return;
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
    if (!submitted && !isCompleted) {
      setSubmitted(true);
      onSubmit(selectedIds);
    }
  };

  const handleRetry = () => {
    // Same activity becomes interactive again; arrangement is preserved.
    setSubmitted(false);
  };

  const handleNext = () => {
    if (onNext) onNext();
  };

  if (!shuffled) return null; // Wait for initial shuffle

  return (
    <ActivityCard className="max-w-4xl">
      <div className="mb-4 text-center w-full">
        <ActivityPrompt prompt={activity.prompt} />
      </div>

      {hasImage && assetId && (
        <div className="mb-6 w-full flex justify-center">
          <ActivityAsset assetRef={{ id: assetId, type: 'image' }} language={isEnglish ? 'english' : 'tamil'} alt={activity.template || undefined} />
        </div>
      )}
      
      {/* Answer Area */}
      <div className="w-full min-h-[100px] p-6 mb-4 bg-surface rounded-2xl border-4 border-dashed border-primary-200 flex flex-wrap gap-3 items-center justify-center">
        {selectedIds.length === 0 && (
          <span className="text-text-muted font-bold opacity-50 select-none">
            {isEnglish ? 'Tap or move tiles here...' : 'இங்கே கட்டங்களை நகர்த்தவும்...'}
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
              disabled={locked}
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
              disabled={locked}
              onSelect={handleSelect}
            />
          );
        })}
      </div>
      
      <ActivitySubmitArea 
        status={state.status}
        canCheck={selectedIds.length > 0 && !submitted} // Must select at least 1 token to check
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
