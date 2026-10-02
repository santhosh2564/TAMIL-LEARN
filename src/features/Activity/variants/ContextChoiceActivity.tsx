import { ActivityComponentProps } from '../../../engine';
import { 
  ActivityCard, 
  ContextSentence,
  ActivityOptionGrid, 
  ActivityOption, 
  ActivitySubmitArea,
  ActivityFeedback,
  useSelectableRetry
} from '../components';

export function ContextChoiceActivity({ activity, state, onSubmit, onNext }: ActivityComponentProps<string>) {
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

  // Let's replace the blank with the selected answer if completed and correct, 
  // or simply let it stay as blank. We'll stick to blank for now as the ContextSentence takes care of it.
  // We could enhance ContextSentence to optionally take a filled-in word.
  // For now, replacing the _ in the prompt with the word if selected is a nice touch.
  let displaySentence = activity.prompt;
  if (selectedId && selectedOption) {
    displaySentence = activity.prompt.replace(/_{3,}/g, ` ${selectedOption.label} `);
  }

  return (
    <ActivityCard>
      <div className="mb-4 text-center">
        <ContextSentence sentence={displaySentence} />
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
