import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStudent } from '../../student';
import { sessionSync, ActiveSessionDto } from '../../services/SessionSyncService';
import { Sparkles, Check, Play, BookOpen, Building2, Lock, ArrowLeft, Search, GraduationCap } from 'lucide-react';
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

interface StudentItem {
  id: string;
  name: string;
  avatar: string;
  rollNumber?: string;
  hasPin?: boolean;
}

interface SchoolItem {
  id: string;
  name: string;
  schoolCode: string;
}

export function StudentSelectionView({ onSuccess }: StudentSelectionViewProps = {}) {
  const navigate = useNavigate();
  const { selectStudent, activeStudent } = useStudent();

  // Institution / School state
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>('');
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [isChoosingSchool, setIsChoosingSchool] = useState(false);

  // Roster state
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Name entry state
  const [nameInput, setNameInput] = useState('');

  // PIN modal state
  const [pinStudent, setPinStudent] = useState<StudentItem | null>(null);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Resume state after tapping a name
  const [pendingResume, setPendingResume] = useState<ActiveSessionDto | null>(null);
  const [resumingStudentName, setResumingStudentName] = useState<string | null>(null);

  // Initialize from localStorage
  useEffect(() => {
    const storedSchoolId = typeof localStorage !== 'undefined' ? localStorage.getItem('sara_school_id') : null;
    const storedSchoolName = typeof localStorage !== 'undefined' ? localStorage.getItem('sara_school_name') : null;
    const storedClassId = typeof localStorage !== 'undefined' ? localStorage.getItem('sara_class_id') : null;

    if (storedSchoolId) {
      setSchoolId(storedSchoolId);
      if (storedSchoolName) setSchoolName(storedSchoolName);
    } else if (storedClassId) {
      setSchoolId(storedClassId);
    }

    // Always fetch available schools
    fetch('/api/public/schools')
      .then((res) => (res.ok ? res.json() : { schools: [] }))
      .then((data) => {
        const list = data.schools || [];
        setSchools(list);
        if (!storedSchoolId && !storedClassId && list.length > 0) {
          const defaultSchool = list[0];
          setSchoolId(defaultSchool.id);
          setSchoolName(defaultSchool.name || defaultSchool.school_name || '');
          try {
            localStorage.setItem('sara_school_id', defaultSchool.id);
            if (defaultSchool.name) localStorage.setItem('sara_school_name', defaultSchool.name);
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});
  }, []);

  // Fetch roster when schoolId is set
  useEffect(() => {
    if (!schoolId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    async function loadRoster() {
      try {
        setIsLoading(true);
        setError(null);

        // First try school roster endpoint
        let res = await fetch(`/api/schools/${encodeURIComponent(schoolId!)}/roster`);
        if (!res.ok) {
          // Fallback to class roster for backwards compatibility
          res = await fetch(`/api/classes/${encodeURIComponent(schoolId!)}/roster`);
        }

        if (!res.ok) {
          if (res.status === 404) {
            setError('The school configured for this computer was not found or has been archived.');
          } else {
            setError('Unable to load student roster. Please check network connection.');
          }
          return;
        }

        const data = await res.json();
        if (isMounted) {
          setStudents(data.students || []);
          if (data.school?.name) {
            setSchoolName(data.school.name);
          } else if (data.class?.name) {
            setSchoolName(data.class.name);
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
  }, [schoolId]);

  const handleSelectSchool = (chosen: SchoolItem) => {
    setSchoolId(chosen.id);
    setSchoolName(chosen.name);
    try {
      localStorage.setItem('sara_school_id', chosen.id);
      localStorage.setItem('sara_school_name', chosen.name);
      localStorage.setItem('sara_class_id', chosen.id);
    } catch {
      // Ignore
    }
    setIsChoosingSchool(false);
  };

  const executeSelect = async (student: StudentItem, pinDigits?: string[]) => {
    if (!schoolId) return;
    try {
      setIsSubmitting(true);
      setError(null);
      setPinError(null);

      const res = await selectStudent(schoolId, student.id, pinDigits);
      if (!res.success) {
        if (student.hasPin) {
          setPinError(res.error || 'Incorrect PIN. Please try again.');
        } else {
          setError(res.error || 'Unable to select student. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      setPinStudent(null);
      setPinInput('');

      // Check if an active session exists for resume
      const activeSess = await sessionSync.getActiveSession(student.id);
      if (activeSess && activeSess.currentIndex < activeSess.activityIds.length) {
        setPendingResume(activeSess);
        setResumingStudentName(student.name);
        setIsSubmitting(false);
      } else {
        // No active session: go straight to subject selection dashboard
        if (onSuccess) {
          onSuccess();
        } else {
          navigate('/subjects');
        }
      }
    } catch {
      setError('Error signing in student. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleStudentClick = (student: StudentItem) => {
    if (student.hasPin) {
      setPinStudent(student);
      setPinInput('');
      setPinError(null);
    } else {
      executeSelect(student);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinStudent) return;
    if (pinInput.length < 3) {
      setPinError('Please enter your 3-digit PIN');
      return;
    }
    executeSelect(pinStudent, pinInput.split('').slice(0, 3));
  };

  // Name form submit: find exact or closest match in roster
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const query = nameInput.trim();
    if (!query) {
      setError('Please type your name or select from the list below.');
      return;
    }

    const exactMatch = students.find(
      (s) => s.name.trim().toLowerCase() === query.toLowerCase()
    );

    if (exactMatch) {
      handleStudentClick(exactMatch);
      return;
    }

    // Try prefix or substring match if only 1 student matches
    const partialMatches = students.filter((s) =>
      s.name.toLowerCase().includes(query.toLowerCase())
    );

    if (partialMatches.length === 1) {
      handleStudentClick(partialMatches[0]);
      return;
    }

    // Reject unknown students without creating silent records
    setError(
      `Student "${query}" was not found in ${schoolName || 'this school roster'}. Please check your spelling or choose your name from the list below.`
    );
  };

  // Filter students by typed input if any
  const filteredStudents = nameInput.trim()
    ? students.filter((s) =>
        s.name.toLowerCase().includes(nameInput.trim().toLowerCase())
      )
    : students;

  // 1. Prompt to choose school or set up computer if user asked to switch or no schools exist
  if (!isLoading && (isChoosingSchool || (!schoolId && schools.length === 0))) {
    return (
      <div className="w-full max-w-xl mx-auto bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-10 shadow-xl space-y-6 animate-in fade-in duration-200">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 mb-1">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text">
            பள்ளியைத் தேர்ந்தெடுக்கவும் / Select Your School
          </h1>
          <p className="text-sm text-text-muted">
            Choose your school to view student names and continue learning
          </p>
        </div>

        {schools.length > 0 ? (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {schools.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSelectSchool(s)}
                className="w-full p-4 rounded-2xl bg-surface hover:bg-primary-50 border border-surface-highlight hover:border-primary-300 text-left transition-colors flex items-center justify-between cursor-pointer group"
              >
                <div>
                  <div className="font-bold text-base text-text group-hover:text-primary-700">
                    {s.name}
                  </div>
                  <div className="text-xs text-text-muted font-mono">{s.schoolCode}</div>
                </div>
                <div className="w-8 h-8 rounded-full bg-surface-raised border border-surface-highlight group-hover:border-primary-400 flex items-center justify-center text-primary-600">
                  ▶
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <p className="text-sm text-text-muted">
              This computer has not been set up with a school yet. Please ask your teacher to set up this computer.
            </p>
            <Button
              size="large"
              variant="primary"
              onClick={() => navigate('/setup')}
              className="w-full py-4 text-base font-bold rounded-2xl cursor-pointer"
            >
              Set up this computer / கணினி அமைப்பு
            </Button>
          </div>
        )}

        {schoolId && (
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => setIsChoosingSchool(false)}
              className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text font-bold cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to current school roster</span>
            </button>
          </div>
        )}
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
            onClick={() => navigate('/subjects')}
            className="w-full py-4 text-base font-bold rounded-2xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-5 h-5 text-primary-600" />
            <span>பாடங்களைத் தேர்வுசெய் / Choose Subject</span>
          </Button>
        </div>
      </div>
    );
  }

  // 3. Regular Student Welcome / Name Entry screen
  return (
    <div className="w-full max-w-2xl mx-auto bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-10 shadow-xl space-y-6 animate-in fade-in duration-200">
      {/* TAMIL-LEARN Branding Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-100 text-primary-700 font-mono text-xs font-bold uppercase tracking-wider mb-1">
          <GraduationCap className="w-4 h-4" />
          <span>TAMIL-LEARN · கல்வி தளம்</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-text">
          Welcome! Let&apos;s Learn
        </h1>
        <p className="text-sm sm:text-base text-primary-600 font-bold">
          வணக்கம்! கற்கலாம் வாருங்கள்
        </p>

        {schoolName && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-800 bg-primary-50 border border-primary-200 px-3 py-1 rounded-full shadow-xs">
              <Building2 className="w-3.5 h-3.5" />
              <span>{schoolName}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsChoosingSchool(true)}
              className="text-xs text-primary-600 hover:text-primary-800 underline font-semibold cursor-pointer"
            >
              பள்ளியை மாற்றுக / Change
            </button>
          </div>
        )}
      </div>

      {/* Active Student Banner if already selected */}
      {activeStudent && (
        <div className="p-4 rounded-2xl bg-primary-50 border border-primary-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500 text-white font-bold flex items-center justify-center shadow-xs">
              {activeStudent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xs text-primary-700 font-semibold">Signed in as:</div>
              <div className="text-base font-bold text-text">{activeStudent.name}</div>
            </div>
          </div>
          <Button
            size="normal"
            variant="primary"
            onClick={() => navigate('/subjects')}
            className="text-xs font-bold py-2 px-4 shadow-sm"
          >
            Open Dashboard ▶
          </Button>
        </div>
      )}

      {/* Name Entry Form */}
      <form onSubmit={handleNameSubmit} className="space-y-3 pt-2">
        <label
          htmlFor="student-name-input"
          className="block text-xs font-bold text-text-muted uppercase tracking-wider text-left"
        >
          Enter Your Name / உங்கள் பெயர்
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              id="student-name-input"
              type="text"
              value={nameInput}
              onChange={(e) => {
                setNameInput(e.target.value);
                setError(null);
              }}
              placeholder="Type your name / உங்கள் பெயரை உள்ளிடவும்"
              className="w-full pl-10 pr-10 py-3.5 bg-surface border-2 border-surface-highlight focus:border-primary-500 rounded-2xl text-base text-text font-medium outline-hidden transition-all shadow-inner"
              autoComplete="off"
            />
            {nameInput && (
              <button
                type="button"
                onClick={() => setNameInput('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text text-sm font-bold p-1 cursor-pointer"
                aria-label="Clear name"
              >
                ✕
              </button>
            )}
          </div>
          <Button
            type="submit"
            variant="primary"
            size="large"
            disabled={isSubmitting || !nameInput.trim()}
            className="px-6 py-3.5 text-base font-bold rounded-2xl shrink-0 cursor-pointer shadow-md"
          >
            Continue / தொடர்க ▶
          </Button>
        </div>
      </form>

      {/* Validation Error Message */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-danger-50 text-danger-700 rounded-2xl text-center text-sm font-semibold border border-danger-200 animate-in fade-in duration-150"
        >
          {error}
        </div>
      )}

      {/* Roster Selection Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-text-muted uppercase tracking-wider pt-2">
          <span>Choose from roster / பட்டியலிலிருந்து தேர்வு செய்க:</span>
          <span>{filteredStudents.length} {filteredStudents.length === 1 ? 'student' : 'students'}</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-text-muted font-bold text-lg animate-pulse">
            மாணவர் பட்டியல் ஏற்றப்படுகிறது... / Loading student list...
          </div>
        ) : students.length === 0 ? (
          <div className="text-center py-8 space-y-3 bg-surface rounded-2xl border border-surface-highlight p-6">
            <p className="text-text-muted font-medium">
              இந்தப் பள்ளியில் மாணவர்கள் எவரும் சேர்க்கப்படவில்லை. (No students found in this school roster.)
            </p>
            <p className="text-xs text-text-muted">
              ஆசிரியர்கள் நிர்வாகப் பக்கத்தில் மாணவர்களைச் சேர்க்கலாம். (Teachers can add students from the Admin Portal.)
            </p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="text-center py-6 text-sm text-text-muted bg-surface rounded-2xl border border-surface-highlight">
            No students found matching &quot;{nameInput}&quot;. Please check the spelling or select from the full list.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-80 overflow-y-auto px-1 py-1">
            {filteredStudents.map((student, idx) => {
              const isCurrent = activeStudent?.id === student.id;
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              const initial = (student.name || '?').charAt(0).toUpperCase();

              return (
                <button
                  key={student.id}
                  type="button"
                  onClick={() => handleStudentClick(student)}
                  disabled={isSubmitting}
                  className={`w-full flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border-2 transition-all duration-150 text-left cursor-pointer group focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-primary-400 ${
                    isCurrent
                      ? 'border-primary-500 bg-primary-50/60 shadow-xs'
                      : 'border-surface-highlight bg-white hover:border-primary-300 hover:bg-surface/50'
                  }`}
                  aria-label={`Select student ${student.name}`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold font-display shadow-xs ${avatarColor}`}
                    >
                      {initial}
                    </div>
                    <div>
                      <div className="text-lg sm:text-xl font-bold text-text group-hover:text-primary-600 transition-colors flex items-center gap-2">
                        <span>{student.name}</span>
                        {student.hasPin && (
                          <span title="PIN Protected">
                            <Lock className="w-3.5 h-3.5 text-amber-500" />
                          </span>
                        )}
                      </div>
                      {student.rollNumber && (
                        <div className="text-xs font-mono text-text-muted">
                          Roll: {student.rollNumber}
                        </div>
                      )}
                      {isCurrent && (
                        <div className="text-xs font-semibold text-primary-600">
                          தற்போதைய மாணவர் (Current Student)
                        </div>
                      )}
                    </div>
                  </div>

                  {isCurrent && (
                    <div className="w-7 h-7 rounded-full bg-primary-500 text-white flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* PIN Verification Modal */}
      {pinStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface-raised border border-surface-highlight rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-100 text-amber-600">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-display font-extrabold text-text">
              Enter PIN for {pinStudent.name}
            </h3>
            <p className="text-xs text-text-muted">
              உங்கள் 3 இலக்க கடவு எண்ணை உள்ளிடவும்
            </p>

            {pinError && (
              <div className="p-2.5 rounded-xl bg-danger-50 text-danger-700 text-xs font-semibold">
                {pinError}
              </div>
            )}

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                maxLength={3}
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="•••"
                className="w-full text-center text-3xl font-mono tracking-widest px-4 py-3 bg-surface border border-surface-highlight rounded-2xl text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
              />

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPinStudent(null)}
                  className="flex-1 py-3 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isSubmitting || pinInput.length < 3}
                  className="flex-1 py-3 text-sm font-bold"
                >
                  {isSubmitting ? 'Verifying...' : 'Sign In'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Info & Settings Hint */}
      <div className="pt-4 border-t border-surface-highlight flex items-center justify-between text-xs text-text-muted">
        <Link
          to="/setup"
          className="hover:text-primary-700 transition-colors underline font-medium"
        >
          Teacher: Set up computer
        </Link>
        <Link
          to="/settings"
          className="hover:text-primary-700 transition-colors underline font-medium"
        >
          Settings & Admin Login
        </Link>
      </div>
    </div>
  );
}
