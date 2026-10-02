import { useState, useEffect, useMemo } from 'react';
import { Activity } from '../../../types';
import { ActivityStatus } from '../../../engine';
import { shuffleOptions } from '../../../utils/shuffle';

interface UseSelectableRetryArgs {
  activity: Activity;
  status: ActivityStatus;
  onSubmit: (input: string) => void;
  onNext?: () => void;
}

/**
 * Reusable wrong-answer retry interaction for all single-select activity
 * families (picture / spelling / meaning / context / word-completion).
 *
 * Flow: select → submit → (wrong: feedback + retry, stays on SAME activity,
 * options re-enabled on retry) → … → (correct: engine completes → continue).
 *
 * Correctness here mirrors the evaluator rule (selected label ===
 * correctAnswer) for immediate UI feedback only; the engine evaluation in
 * SessionPage remains authoritative for completion, session advance, and
 * progress persistence.
 */
export function useSelectableRetry({ activity, status, onSubmit, onNext }: UseSelectableRetryArgs) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSelectedId(null);
    setSubmitted(false);
  }, [activity.id]);

  const options = activity.options || [];

  // Presentation-order shuffle only; never mutates repository content.
  // Memoized on activity identity so retries do NOT rearrange options.
  const shuffledOptions = useMemo(() => {
    return shuffleOptions(options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id, activity.options]);

  const selectedOption = options.find(o => o.id === selectedId);
  const isCorrect = submitted && selectedId
    ? selectedOption?.label === activity.correctAnswer
    : undefined;

  const isCompleted = status === 'completed';
  // Wrong submission: show retry instead of check/continue, lock options
  // until the learner explicitly retries.
  const showRetry = submitted && isCorrect === false && !isCompleted;
  const locked = isCompleted || showRetry;

  const handleSelect = (id: string) => {
    if (locked) return;
    setSelectedId(id);
  };

  const handleCheck = () => {
    if (selectedId && !submitted && !isCompleted) {
      setSubmitted(true);
      onSubmit(selectedId);
    }
  };

  const handleRetry = () => {
    // Back to an interactive SAME activity: clear feedback state and the
    // previous (wrong) selection so the learner reconsiders the choices.
    setSubmitted(false);
    setSelectedId(null);
  };

  const handleNext = () => {
    if (onNext) onNext();
  };

  return {
    options,
    shuffledOptions,
    selectedId,
    submitted,
    isCorrect,
    isCompleted,
    showRetry,
    locked,
    handleSelect,
    handleCheck,
    handleRetry,
    handleNext,
  };
}
