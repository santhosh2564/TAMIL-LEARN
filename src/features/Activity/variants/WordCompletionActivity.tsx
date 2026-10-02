import { ActivityComponentProps } from '../../../engine';
import { 
  ActivityCard, 
  ActivityOptionGrid, 
  ActivityOption, 
  ActivitySubmitArea,
  ActivityFeedback,
  WordCompletionDisplay,
  useSelectableRetry
} from '../components';

export function WordCompletionActivity({ activity, state, onSubmit, onNext }: ActivityComponentProps<string>) {
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

  const selectedOption = options.find(o => o.id === selectedId);

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
