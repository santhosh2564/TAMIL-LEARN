import { useState, useEffect, useMemo } from 'react';
import { Activity } from '../../../types';
import { ActivityStatus } from '../../../engine';
import { shuffleOptions } from '../../../utils/shuffle';
import { getGraphemes } from '../../../utils/tamil';

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

  const targetAns = (
    Array.isArray(activity.correctAnswer)
      ? activity.correctAnswer[0]
      : (activity.correctAnswer || activity.targetWord || '')
  ).trim().toLowerCase();

  const targetWord = (activity.targetWord || targetAns).trim().toLowerCase();
  let expectedUnit = targetAns;
  if (activity.category === 'word-completion' && activity.template && targetWord) {
    const cleanedTemplate = activity.template.replace(/[|\s]/g, '');
    const cleanedTarget = targetWord.replace(/\s+/g, '');
    const isEnglish = activity.language?.startsWith('en') || activity.subject === 'English';
    const locale = isEnglish ? 'en' : 'ta';
    const tGraphemes = getGraphemes(cleanedTemplate, locale);
    const wGraphemes = getGraphemes(cleanedTarget, locale);
    let missing = '';
    for (let i = 0; i < tGraphemes.length && i < wGraphemes.length; i++) {
      if (tGraphemes[i] === '_') {
        missing += wGraphemes[i];
      }
    }
    if (missing) expectedUnit = missing.trim().toLowerCase();
  }

  const selectedLabel = selectedOption?.label.trim().toLowerCase();
  const completedWord = (activity.template && activity.template.includes('_') && selectedLabel)
    ? activity.template.replace(/[|\s]/g, '').replace('_', selectedLabel).trim().toLowerCase()
    : '';


  const isCorrect = submitted && selectedId
    ? (
        selectedLabel === targetAns ||
        selectedLabel === expectedUnit ||
        (completedWord.length > 0 && (completedWord === targetWord || completedWord === targetAns))
      )
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
