import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStudent } from '../../student';
import { sessionSync, ActiveSessionDto } from '../../services/SessionSyncService';
import { Sparkles, Check, Monitor, Play, BookOpen } from 'lucide-react';
import { Button } from '../../components/ui/Button';

// Playful child-friendly color themes for student avatar badges
const AVATAR_COLORS = [
  'bg-emerald-500 text-white',
  'bg-amber-500 text-white',
  'bg-sky-500 text-white',
  'bg-purple-500 text-white',
  'bg-rose-500 text-white',
  'bg-indigo-500 text-white',
];

export interface StudentSelectionViewProps {
  onSuccess?: () => void;
}

export function StudentSelectionView({ onSuccess }: StudentSelectionViewProps = {}) {
  const navigate = useNavigate();
  const { selectStudent, activeStudent } = useStudent();
  const [classId, setClassId] = useState<string | null>(null);
  const [className, setClassName] = useState<string>('');
  const [students, setStudents] = useState<Array<{ id: string; name: string; avatar: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resume state after tapping a name
  const [pendingResume, setPendingResume] = useState<ActiveSessionDto | null>(null);
  const [resumingStudentName, setResumingStudentName] = useState<string | null>(null);

  useEffect(() => {
    const storedClassId = typeof localStorage !== 'undefined' ? localStorage.getItem('sara_class_id') : null;
    setClassId(storedClassId);

    if (!storedClassId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadRoster() {
      try {
        setIsLoading(true);
        setError(null);
        const res = await fetch(`/api/classes/${encodeURIComponent(storedClassId!)}/roster`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('The class configured for this computer was not found or has been archived.');
          } else {
            setError('Unable to load student roster. Please check network connection.');
          }
          return;
        }
        const data = await res.json();
        if (isMounted) {
          setStudents(data.students || []);
          if (data.class?.name) {
            setClassName(data.class.name);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error loading student roster');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRoster();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelect = async (student: { id: string; name: string }) => {
    if (!classId) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await selectStudent(classId, student.id);
      if (!res.success) {
        setError(res.error || 'Unable to select student. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Check if an active session exists for resume
      const activeSess = await sessionSync.getActiveSession(student.id);
      if (activeSess && activeSess.currentIndex < activeSess.activityIds.length) {
        setPendingResume(activeSess);
        setResumingStudentName(student.name);
        setIsSubmitting(false);
      } else {
        // No active session: go straight to subject selection
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/classes/3/subjects');
        }
      }
    } catch {
      setError('Error signing in student. Please try again.');
      setIsSubmitting(false);
    }
  };

  // 1. Not set up computer
  if (!isLoading && !classId) {
    return (
      <div className="w-full max-w-xl mx-auto bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-10 shadow-xl space-y-8 animate-in fade-in duration-200 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 mb-2">
          <Monitor className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text">
          Set up this computer
        </h1>
        <p className="text-lg text-text-muted">
          இந்தக் கணினி இன்னும் எந்த வகுப்புடனும் இணைக்கப்படவில்லை. தயவுசெய்து உங்கள் ஆசிரியரை அணுகவும்.
        </p>
        <p className="text-sm text-text-muted">
          This computer has not been set up with a class yet. Please ask your teacher to set up this computer.
        </p>
        <div className="pt-4">
          <Button
            size="large"
            variant="primary"
            onClick={() => navigate('/setup')}
            className="w-full py-4 text-lg font-bold rounded-2xl cursor-pointer"
          >
            Set up this computer / கணினி அமைப்பு
          </Button>
        </div>
      </div>
    );
  }

  // 2. Resume Card active after child tapped name
  if (pendingResume && resumingStudentName) {
    return (
      <div
        data-testid="session-resume-card"
        className="w-full max-w-xl mx-auto bg-surface-raised border-2 border-primary-400 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 mb-1">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text">
            மீண்டும் வருக, {resumingStudentName}!
          </h1>
          <p className="text-base text-text-muted">
            நீங்கள் விட்ட இடத்திலிருந்து தொடரலாம் (Continue where you left off)
          </p>
        </div>

        <div className="bg-white border border-primary-200 rounded-2xl p-5 text-center space-y-2 shadow-xs">
          <div className="text-xs uppercase tracking-wider font-bold text-primary-600">
            {pendingResume.subject === 'tamil' ? 'தமிழ் பயிற்சி' : 'English Practice'} · {pendingResume.categoryOrModule}
          </div>
          <div className="text-xl font-bold text-text">
            கேள்வி {pendingResume.currentIndex + 1} / {pendingResume.activityIds.length} · Question{' '}
            {pendingResume.currentIndex + 1} of {pendingResume.activityIds.length}
          </div>
          <div className="w-full bg-surface-highlight rounded-full h-2.5 mt-2 overflow-hidden">
            <div
              className="bg-primary-500 h-2.5 rounded-full transition-all duration-300"
              style={{
                width: `${((pendingResume.currentIndex) / pendingResume.activityIds.length) * 100}%`,
              }}
            />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Button
            size="large"
            variant="primary"
            onClick={() =>
              navigate(
                `/session/3/${pendingResume.subject}/play?category=${encodeURIComponent(pendingResume.categoryOrModule)}&resumeSessionId=${encodeURIComponent(pendingResume.id)}`
              )
            }
            className="w-full py-5 text-xl font-extrabold rounded-2xl shadow-lg flex items-center justify-center gap-3 cursor-pointer"
          >
            <Play className="w-6 h-6 fill-current" />
            <span>தொடர்க / Continue ▶</span>
          </Button>

          <Button
            size="large"
            variant="secondary"
            onClick={() => navigate('/classes/3/subjects')}
            className="w-full py-4 text-base font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-5 h-5 text-primary-600" />
            <span>பாடங்களைத் தேர்வுசெய் / Choose Subject</span>
          </Button>
        </div>
      </div>
    );
  }

  // 3. Regular "Who is Learning?" roster list
  return (
    <div className="w-full max-w-xl mx-auto bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-10 shadow-xl space-y-8 animate-in fade-in duration-200">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 mb-2">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-text">
          Who is learning today?
        </h1>
        <p className="text-lg text-text-muted">
          இன்று கற்பவர் யார்? உங்கள் பெயரைத் தேர்ந்தெடுக்கவும்
        </p>
        {className && (
          <span className="inline-block mt-1 text-xs font-bold text-primary-700 bg-primary-50 border border-primary-200 px-3 py-1 rounded-full">
            {className}
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-danger-50 text-danger-700 rounded-2xl text-center text-sm font-semibold border border-danger-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-12 text-center text-text-muted font-bold text-lg animate-pulse">
          மாணவர் பட்டியல் ஏற்றப்படுகிறது... / Loading student list...
        </div>
      ) : students.length === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-text-muted font-medium">
            இந்த வகுப்பில் மாணவர்கள் எவரும் சேர்க்கப்படவில்லை. (No students found in this class.)
          </p>
          <p className="text-xs text-text-muted">
            ஆசிரியர்கள் நிர்வாகப் பக்கத்தில் மாணவர்களைச் சேர்க்கலாம். (Teachers can add students from the Admin Dashboard.)
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto px-1 py-1">
          {students.map((student, idx) => {
            const isCurrent = activeStudent?.id === student.id;
            const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            const initial = (student.name || '?').charAt(0).toUpperCase();

            return (
              <button
                key={student.id}
                type="button"
                onClick={() => handleSelect(student)}
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
      )}

      {/* Subtle teacher link to change PC's class */}
      <div className="pt-4 border-t border-surface-highlight text-center">
        <Link
          to="/setup"
          className="text-xs text-text-muted hover:text-primary-700 transition-colors underline font-medium"
        >
          Teacher: Change class for this computer (கணினி அமைப்பை மாற்று)
        </Link>
      </div>
    </div>
  );
}
