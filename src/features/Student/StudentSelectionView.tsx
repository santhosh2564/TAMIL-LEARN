import React, { useState } from 'react';
import { useStudent } from '../../student';
import { Button } from '../../components/ui/Button';
import { UserPlus, ArrowLeft, Sparkles, Check } from 'lucide-react';

interface StudentSelectionViewProps {
  onSuccess?: () => void;
  titleOverride?: string;
}

// Playful child-friendly color themes for student avatar badges
const AVATAR_COLORS = [
  'bg-emerald-500 text-white',
  'bg-amber-500 text-white',
  'bg-sky-500 text-white',
  'bg-purple-500 text-white',
  'bg-rose-500 text-white',
  'bg-indigo-500 text-white',
];

export function StudentSelectionView({ onSuccess, titleOverride }: StudentSelectionViewProps) {
  const { students, activeStudent, selectStudent, createAndSelectStudent } = useStudent();
  const [userModeOverride, setUserModeOverride] = useState<'select' | 'create' | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mode = userModeOverride ?? (students.length === 0 ? 'create' : 'select');

  const handleSelect = async (id: string) => {
    try {
      setIsSubmitting(true);
      await selectStudent(id);
      if (onSuccess) onSuccess();
    } catch {
      setError('Unable to select student. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError('தயவுசெய்து உங்கள் பெயரை உள்ளிடவும் (Please enter your name)');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await createAndSelectStudent(trimmed);
      setNameInput('');
      setUserModeOverride(null);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating student profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-10 shadow-xl space-y-8 animate-in fade-in duration-200">
      {mode === 'select' ? (
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 mb-2">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-text">
              {titleOverride || 'Who is learning today?'}
            </h1>
            <p className="text-lg text-text-muted">இன்று கற்பவர் யார்? உங்கள் பெயரைத் தேர்ந்தெடுக்கவும்</p>
          </div>

          {error && (
            <div className="p-4 bg-danger-50 text-danger-700 rounded-2xl text-center text-sm font-semibold border border-danger-200">
              {error}
            </div>
          )}

          {/* Existing Students List */}
          <div className="space-y-3 max-h-80 overflow-y-auto px-1 py-1">
            {students.map((student, idx) => {
              const isCurrent = activeStudent?.id === student.id;
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const initial = student.name.charAt(0).toUpperCase();

              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => handleSelect(student.id)}
                  disabled={isSubmitting}
                  className={`w-full flex items-center justify-between p-4 sm:p-5 rounded-2xl border-2 transition-all duration-150 text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-400 ${
                    isCurrent
                      ? 'border-primary-500 bg-primary-50/60 shadow-sm'
                      : 'border-surface-highlight bg-white hover:border-primary-300 hover:bg-surface/50'
                  }`}
                  aria-label={`Select student ${student.name}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold font-display shadow-sm ${avatarColor}`}
                    >
                      {initial}
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-bold text-text group-hover:text-primary-600 transition-colors">
                        {student.name}
                      </div>
                      {isCurrent && (
                        <div className="text-xs font-semibold text-primary-600">
                          தற்போதைய மாணவர் (Current Student)
                        </div>
                      )}
                    </div>
                  </div>

                  {isCurrent && (
                    <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center">
                      <Check className="w-5 h-5 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-surface-highlight">
            <Button
              type="button"
              variant="secondary"
              size="large"
              onClick={() => {
                setError(null);
                setUserModeOverride('create');
              }}
              className="w-full flex items-center justify-center gap-3 text-lg py-5 rounded-2xl"
            >
              <UserPlus className="w-6 h-6 text-primary-600" />
              <span>+ New Student (புதிய மாணவர்)</span>
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 mb-2">
              <UserPlus className="w-8 h-8" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-text">
              What's your name?
            </h1>
            <p className="text-lg text-text-muted">உங்கள் பெயர் என்ன?</p>
          </div>

          {error && (
            <div className="p-4 bg-danger-50 text-danger-700 rounded-2xl text-center text-sm font-semibold border border-danger-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="student-name-input" className="block text-sm font-bold text-text-muted px-1">
              Student Name / மாணவர் பெயர்
            </label>
            <input
              id="student-name-input"
              type="text"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter your name"
              autoFocus
              maxLength={40}
              className="w-full px-5 py-4 text-xl sm:text-2xl font-bold bg-white text-text border-2 border-surface-highlight rounded-2xl focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-100 transition-all placeholder:text-text-muted/50"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            {students.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="large"
                onClick={() => {
                  setError(null);
                  setUserModeOverride('select');
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-lg py-4 rounded-2xl"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back</span>
              </Button>
            )}

            <Button
              type="submit"
              variant="primary"
              size="large"
              disabled={isSubmitting || !nameInput.trim()}
              className="w-full flex-1 text-xl font-bold py-4 rounded-2xl shadow-button"
            >
              {isSubmitting ? 'சேமிக்கப்படுகிறது...' : 'Start Learning (கற்கத் தொடங்கு)'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
