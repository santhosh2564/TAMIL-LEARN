import { useState, useRef, useEffect, useMemo } from 'react';
import { ActivityComponentProps } from '../../../engine';
import { AssetResolver, AssetReference } from '../../../engine/assets';
import { 
  ActivityCard, 
  ActivityOptionGrid, 
  ActivityOption, 
  ActivitySubmitArea, 
  ActivityFeedback, 
  WordCompletionDisplay, 
  ActivityPrompt,
  ActivityAsset, 
  useSelectableRetry 
} from '../components';

export function WordCompletionActivity({ activity, state, onSubmit, onNext }: ActivityComponentProps<string>) {
  const isEnglish = activity.language?.startsWith('en') || activity.subject === 'English';
  const hasOptions = activity.options && activity.options.length > 0;

  // 1. Multiple-choice mode (for Tamil and option-based activities)
  if (hasOptions) {
    return <WordCompletionOptionsMode activity={activity} state={state} onSubmit={onSubmit} onNext={onNext} isEnglish={isEnglish} />;
  }

  // 2. Direct missing-letter entry mode (for English E05 / E11 without options)
  return <WordCompletionInputMode activity={activity} state={state} onSubmit={onSubmit} onNext={onNext} isEnglish={isEnglish} />;
}

function WordCompletionOptionsMode({ activity, state, onSubmit, onNext, isEnglish }: ActivityComponentProps<string> & { isEnglish: boolean }) {
  const {
    options,
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
  const selectedOption = options.find(o => o.id === selectedId);

  const assetRef = useMemo<AssetReference | null>(() => {
    if (activity.image?.source) {
      return { id: activity.image.source, type: 'image' };
    }
    if (isEnglish) {
      const isPictureRequired = Boolean(activity.image) || /look at the picture|picture/i.test(activity.prompt || '');
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
    if (isEnglish) return Boolean(activity.image) || /look at the picture|picture/i.test(activity.prompt || '');
    return resolver.resolve(assetRef).status === 'resolved';
  }, [assetRef, resolver, isEnglish]);

  // Normalize bracketed blanks like [____] or [blank] to [blank]
  const withNormalizedBlanks = activity.prompt.replace(/\[_+\]/g, '[blank]');
  // Normalize prompt to strip any unbracketed fill-blanks from context sentences
  const normalizedPrompt = withNormalizedBlanks.replace(/_{2,}\.?\s*/g, '');
  const hasPromptBlank = normalizedPrompt.includes('[blank]');

  let displayPrompt = normalizedPrompt;
  if (selectedId && selectedOption && hasPromptBlank) {
    displayPrompt = normalizedPrompt.replace(/\[blank\]/g, selectedOption.label);
  }

  const templateDisplay = activity.template
    ? (selectedOption ? activity.template.replace('_', selectedOption.label) : activity.template)
    : null;

  return (
    <ActivityCard>
      {hasImage && assetRef && (
        <div className="mb-6">
          <ActivityAsset assetRef={assetRef} language={isEnglish ? 'english' : 'tamil'} alt={activity.template || undefined} />
        </div>
      )}

      {hasPromptBlank ? (
        <div className="mb-8 text-center w-full">
          <WordCompletionDisplay prompt={displayPrompt} />
        </div>
      ) : (
        <div className="mb-6 text-center w-full">
          <ActivityPrompt prompt={activity.prompt} />
        </div>
      )}

      {!hasPromptBlank && templateDisplay && !/^picture/i.test(templateDisplay.trim()) && (
        <div className="mb-8 text-center">
          <div className="inline-block px-8 py-3 bg-surface-raised rounded-2xl border-2 border-primary-200 shadow-sm">
            <span className="font-mono text-3xl md:text-4xl font-bold tracking-widest text-primary-600 select-none">
              {templateDisplay}
            </span>
          </div>
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

function WordCompletionInputMode({ activity, state, onSubmit, onNext, isEnglish }: ActivityComponentProps<string> & { isEnglish: boolean }) {
  const [inputValue, setInputValue] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCompleted = state.status === 'completed';

  const targetWord = (activity.targetWord || (Array.isArray(activity.correctAnswer) ? activity.correctAnswer[0] : activity.correctAnswer) || '').toLowerCase().trim();

  // Extract expected missing letter(s)
  let expectedLetters = '';
  if (activity.template && targetWord) {
    const cleanedTemplate = activity.template.replace(/[|\s]/g, '');
    const cleanedTarget = targetWord.replace(/\s+/g, '');
    for (let i = 0; i < cleanedTemplate.length && i < cleanedTarget.length; i++) {
      if (cleanedTemplate[i] === '_') {
        expectedLetters += cleanedTarget[i];
      }
    }
  }

  const trimmed = inputValue.trim().toLowerCase();
  const expectedUnit = (expectedLetters || (Array.isArray(activity.correctAnswer) ? activity.correctAnswer[0] : activity.correctAnswer) || '').toLowerCase().trim();
  const isCorrect = submitted
    ? (expectedUnit.length > 0 && trimmed === expectedUnit)
    : undefined;

  const showRetry = submitted && isCorrect === false && !isCompleted;
  const locked = isCompleted || showRetry;

  useEffect(() => {
    setInputValue('');
    setSubmitted(false);
    inputRef.current?.focus();
  }, [activity.id]);

  const handleCheck = () => {
    if (!inputValue.trim() || submitted || isCompleted) return;
    setSubmitted(true);
    onSubmit(inputValue.trim());
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
  const resolver = useMemo(() => new AssetResolver(), []);
  const inputAssetRef = useMemo<AssetReference | null>(() => {
    if (activity.image?.source) {
      return { id: activity.image.source, type: 'image' };
    }
    if (isEnglish) {
      const isPictureRequired = Boolean(activity.image) || /look at the picture|picture/i.test(activity.prompt || '');
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
    if (!inputAssetRef) return false;
    if (isEnglish) return Boolean(activity.image) || /look at the picture|picture/i.test(activity.prompt || '');
    return resolver.resolve(inputAssetRef).status === 'resolved';
  }, [inputAssetRef, resolver, isEnglish]);

  return (
    <ActivityCard className="max-w-xl mx-auto">
      {/* Context sentence or instruction */}
      <div className="mb-6 text-center w-full">
        <ActivityPrompt prompt={activity.prompt} />
      </div>

      {/* Visual stimulus if picture is required */}
      {hasImage && inputAssetRef && (
        <div className="mb-6 w-full flex justify-center">
          <ActivityAsset assetRef={inputAssetRef} language={isEnglish ? 'english' : 'tamil'} alt={activity.template || undefined} />
        </div>
      )}

      {/* Missing letter template display: e.g. "a b _ u t" (only for actual missing letter hints) */}
      {activity.template && !/^picture/i.test(activity.template.trim()) && (
        <div className="mb-6 text-center">
          <div className="inline-block px-6 py-3 bg-surface-raised rounded-2xl border border-border">
            <span className="font-mono text-3xl md:text-4xl font-bold tracking-widest text-primary-600 select-none">
              {activity.template}
            </span>
          </div>
        </div>
      )}

      {/* Answer entry input */}
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
          placeholder={isEnglish ? 'Type missing letter...' : 'விடுபட்ட எழுத்தை உள்ளிடவும்...'}
          aria-label={isEnglish ? 'Missing letter input' : 'விடுபட்ட எழுத்து உள்ளீடு'}
          className={`w-full max-w-xs h-14 px-4 text-center text-3xl font-bold tracking-widest rounded-2xl border-2 transition-all outline-none ${
            locked
              ? 'bg-surface-raised border-border text-text-muted cursor-not-allowed'
              : 'bg-surface border-border focus:border-primary-500 focus:ring-4 focus:ring-primary-500/20 text-text'
          }`}
        />
      </div>

      {/* Action / Feedback area */}
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
