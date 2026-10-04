import { useState, useRef, useEffect } from 'react';
import { ActivityComponentProps } from '../../../engine';
import {
  ActivityCard,
  ActivityPrompt,
  ActivitySubmitArea,
  ActivityFeedback,
  ActivityAsset
} from '../components';

export function WordEntryActivity({
  activity,
  state,
  onSubmit,
  onNext
}: ActivityComponentProps<string>) {
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isEnglish = activity.language?.startsWith('en') || activity.subject === 'English';
  const isCompleted = state.status === 'completed';

  // Target answer for comparison
  const expected = (
    Array.isArray(activity.correctAnswer)
      ? activity.correctAnswer[0]
      : (activity.correctAnswer || activity.targetWord || '')
  ).trim();

  const isCorrect = submitted
    ? inputValue.trim().toLowerCase() === expected.toLowerCase()
    : undefined;

  const showRetry = submitted && isCorrect === false && !isCompleted;
  const locked = isCompleted || showRetry;

  useEffect(() => {
    // Reset state on activity change
    setInputValue('');
    setSubmitted(false);
    inputRef.current?.focus();
  }, [activity.id]);

  const handleCheck = () => {
    const trimmed = inputValue.trim();
    if (!trimmed || submitted || isCompleted) return;
    setSubmitted(true);
    onSubmit(trimmed);
  };

  const handleRetry = () => {
    setSubmitted(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleNext = () => {
    if (onNext) onNext();
  };

  const canCheck = inputValue.trim().length > 0 && !submitted && !isCompleted;

  // Determine if this activity requires an image display
  const hasImage =
    activity.category === 'picture-recognition' ||
    Boolean(activity.image) ||
    /picture|look at the picture/i.test(activity.prompt || '');

  const semanticKey = activity.targetWord
    ? `eng-${activity.targetWord.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
    : (activity.source?.ewId ? `eng-${activity.source.ewId.toLowerCase()}` : 'unknown');

  const assetId = activity.image?.source || semanticKey;

  return (
    <ActivityCard className="max-w-xl mx-auto">
      {/* Visual stimulus if activity is picture-based */}
      {hasImage && (
        <div className="mb-6 w-full flex justify-center">
          <ActivityAsset
            assetRef={{ id: assetId, type: 'image' }}
            language="english"
            alt={activity.template || undefined}
          />
        </div>
      )}

      {/* Clue or child-facing instruction */}
      <div className="mb-6 text-center w-full">
        <ActivityPrompt prompt={activity.prompt} />
      </div>

      {/* Optional word length / template display hint (only for non-picture letter templates) */}
      {activity.template && !hasImage && !/^picture/i.test(activity.template.trim()) && (
        <div className="mb-4 text-center">
          <span className="font-mono text-2xl tracking-widest text-text-muted select-none">
            {activity.template}
          </span>
        </div>
      )}

      {/* Large readable touch-friendly answer input area */}
      <div className="mb-8 w-full flex flex-col items-center">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCheck) {
              handleCheck();
            }
          }}
          disabled={locked}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck="false"
          placeholder={isEnglish ? 'Type your answer here...' : 'விடையை உள்ளிடவும்...'}
          aria-label={isEnglish ? 'Word answer input' : 'விடை உள்ளீடு'}
          className={`w-full max-w-md h-14 px-6 text-center text-2xl font-bold tracking-wider rounded-2xl border-2 transition-all outline-none ${
            locked
              ? 'bg-surface-raised border-border text-text-muted cursor-not-allowed'
              : 'bg-surface border-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 text-text'
          }`}
        />
      </div>

      {/* Submit / Retry action area */}
      <ActivitySubmitArea
        status={state.status}
        canCheck={canCheck}
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
