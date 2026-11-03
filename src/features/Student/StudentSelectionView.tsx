import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudent } from '../../student';
import { Building2, ArrowLeft, GraduationCap, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export interface StudentSelectionViewProps {
  onSuccess?: () => void;
}

interface SchoolItem {
  id: string;
  name: string;
  schoolCode: string;
}

export function StudentSelectionView({ onSuccess }: StudentSelectionViewProps = {}) {
  const navigate = useNavigate();
  const { resolveStudent, activeStudent } = useStudent();

  // Institution / School state
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [schoolName, setSchoolName] = useState<string>('');
  const [schools, setSchools] = useState<SchoolItem[]>([]);
  const [isChoosingSchool, setIsChoosingSchool] = useState(false);

  // Form submission & feedback
  const [nameInput, setNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize from localStorage and fetch public schools list
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
    setError(null);
  };

  // Name form submit: automatic student resolution and immediate progression
  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setError('Please enter your name / உங்கள் பெயரை உள்ளிடவும்.');
      return;
    }

    const effectiveSchoolId = schoolId || 'school_unassigned';

    try {
      setIsSubmitting(true);
      const res = await resolveStudent(effectiveSchoolId, trimmedName);
      if (!res.success) {
        setError(res.error || 'Failed to enter student name. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Successfully resolved/created student session: go to course selection
      if (onSuccess) {
        onSuccess();
      } else {
        navigate('/subjects');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error entering student name');
      setIsSubmitting(false);
    }
  };

  // 1. School Selector Overlay / Modal
  if (isChoosingSchool || (!schoolId && schools.length > 1)) {
    return (
      <div className="w-full max-w-xl mx-auto bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-10 shadow-xl space-y-6 animate-in fade-in duration-200">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 text-primary-600 mb-1">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text">
            Select Your School
          </h1>
          <p className="text-sm text-text-muted">
            பள்ளியைத் தேர்ந்தெடுக்கவும் (Choose your school for this device)
          </p>
        </div>

        {schools.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {schools.map((sch) => (
              <button
                key={sch.id}
                type="button"
                onClick={() => handleSelectSchool(sch)}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between group cursor-pointer ${
                  schoolId === sch.id
                    ? 'border-primary-500 bg-primary-50/50 shadow-xs'
                    : 'border-surface-highlight hover:border-primary-300 bg-surface hover:bg-surface-raised'
                }`}
              >
                <div>
                  <div className="font-bold text-base text-text group-hover:text-primary-600 transition-colors">
                    {sch.name}
                  </div>
                  {sch.schoolCode && (
                    <div className="text-xs text-text-muted font-mono mt-0.5">
                      Code: {sch.schoolCode}
                    </div>
                  )}
                </div>
                <div className="text-primary-600 font-bold text-sm group-hover:translate-x-1 transition-transform">
                  Select →
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
              Set up this computer / அமைவு
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
              <span>Back to student entry</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // 2. Simple Student Welcome / Name Entry screen
  return (
    <div className="w-full max-w-lg mx-auto bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-10 shadow-xl space-y-6 animate-in fade-in duration-200">
      {/* Branding & Welcome Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-100 text-primary-700 font-mono text-xs font-bold uppercase tracking-wider mb-1">
          <GraduationCap className="w-4 h-4" />
          <span>TAMIL-LEARN · கற்றல் தளம்</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-text tracking-tight">
          Welcome! Let&apos;s Learn
        </h1>
        <p className="text-sm sm:text-base text-primary-600 font-bold">
          வணக்கம்! வாருங்கள் கற்கலாம்
        </p>

        {schoolName && (
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-800 bg-primary-50 border border-primary-200 px-3 py-1 rounded-full shadow-xs">
              <Building2 className="w-3.5 h-3.5" />
              <span>{schoolName}</span>
            </span>
            <button
              type="button"
              onClick={() => setIsChoosingSchool(true)}
              className="text-xs text-primary-600 hover:text-primary-800 underline font-semibold cursor-pointer"
            >
              Change
            </button>
          </div>
        )}
      </div>

      {/* Active Student Shortcut if session is already active */}
      {activeStudent && (
        <div className="p-4 rounded-2xl bg-primary-50 border border-primary-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500 text-white font-bold flex items-center justify-center shadow-xs">
              {activeStudent.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-xs text-primary-700 font-semibold">Active Learner:</div>
              <div className="text-base font-bold text-text">{activeStudent.name}</div>
            </div>
          </div>
          <Button
            size="normal"
            variant="primary"
            onClick={() => {
              if (onSuccess) onSuccess();
              else navigate('/subjects');
            }}
            className="text-xs font-bold py-2 px-4 shadow-sm"
          >
            Continue Learning →
          </Button>
        </div>
      )}

      {/* Single Required Name Entry Form */}
      <form onSubmit={handleNameSubmit} className="space-y-4 pt-2">
        <div className="space-y-1.5 text-left">
          <label
            htmlFor="student-name-input"
            className="block text-sm font-extrabold text-text tracking-wide"
          >
            Student Name / உங்கள் பெயர் <span className="text-rose-500">*</span>
          </label>
          <input
            id="student-name-input"
            type="text"
            value={nameInput}
            onChange={(e) => {
              setNameInput(e.target.value);
              setError(null);
            }}
            placeholder="Enter your name / உங்கள் பெயரை உள்ளிடவும்"
            className="w-full px-4 py-3.5 bg-surface border-2 border-surface-highlight focus:border-primary-500 rounded-2xl text-base text-text font-medium outline-hidden transition-all shadow-inner"
            autoComplete="name"
            autoFocus
          />
        </div>

        {/* Validation Error Message */}
        {error && (
          <div
            role="alert"
            className="p-3.5 bg-danger-50 text-danger-700 rounded-2xl text-center text-sm font-semibold border border-danger-200 animate-in fade-in duration-150"
          >
            {error}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          size="large"
          disabled={isSubmitting || !nameInput.trim()}
          className="w-full py-4 text-base font-extrabold rounded-2xl cursor-pointer shadow-md flex items-center justify-center gap-2"
        >
          <Sparkles className="w-5 h-5" />
          <span>{isSubmitting ? 'Entering...' : 'Continue / தொடர்க →'}</span>
        </Button>
      </form>

      <div className="text-center pt-2">
        <p className="text-xs text-text-muted">
          No registration required. Enter your name and start learning immediately!
        </p>
      </div>
    </div>
  );
}
