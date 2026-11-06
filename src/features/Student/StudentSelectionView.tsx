import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudent } from '../../student';
import { Building2, ArrowLeft, Sparkles, Smile, Star, Heart } from 'lucide-react';
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

  // Optimistic student entry: immediate zero-delay progression with background synchronization
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      setError('Please enter your name / உங்கள் பெயரை உள்ளிடவும்.');
      return;
    }

    const effectiveSchoolId = schoolId || 'school_unassigned';

    // Optimistic UI: initiate resolution concurrently and transition immediately
    resolveStudent(effectiveSchoolId, trimmedName).catch((err) => {
      console.warn('Background resolution issue:', err);
    });

    if (onSuccess) {
      onSuccess();
    } else {
      navigate('/subjects');
    }
  };

  // 1. School Selector Overlay / Modal
  if (isChoosingSchool || (!schoolId && schools.length > 1)) {
    return (
      <div className="w-full max-w-xl mx-auto bg-surface border border-surface-highlight rounded-[32px] p-6 sm:p-10 shadow-2xl space-y-6 animate-in fade-in duration-200">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md mb-1">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-black text-text">
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
                    ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
                    : 'border-surface-highlight hover:border-emerald-300 bg-surface hover:bg-emerald-50/30'
                }`}
              >
                <div>
                  <div className="font-bold text-base text-text group-hover:text-emerald-700 transition-colors">
                    {sch.name}
                  </div>
                  {sch.schoolCode && (
                    <div className="text-xs text-text-muted font-mono mt-0.5">
                      Code: {sch.schoolCode}
                    </div>
                  )}
                </div>
                <div className="text-emerald-600 font-bold text-sm group-hover:translate-x-1 transition-transform">
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

  // 2. Modern, Joyful, Optimistic Student Welcome Screen
  return (
    <div className="w-full max-w-xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="relative overflow-hidden bg-white/95 backdrop-blur-md border-2 border-emerald-100 rounded-[36px] p-6 sm:p-10 shadow-2xl space-y-6">
        {/* Playful Floating Accent Blobs */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-100/60 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-emerald-100/60 rounded-full blur-2xl pointer-events-none" />

        {/* Brand & Optimistic Cheerful Badge */}
        <div className="relative text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-100 via-emerald-100 to-sky-100 text-emerald-800 font-bold text-xs sm:text-sm shadow-xs border border-emerald-200/60">
            <Sparkles className="w-4 h-4 text-amber-500 animate-spin-slow" />
            <span>TAMIL-LEARN · தமிழ் & English</span>
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
          </div>

          <div className="flex items-center justify-center gap-2 pt-1">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 transform hover:scale-105 transition-transform">
              <Smile className="w-8 h-8 sm:w-9 sm:h-9" />
            </div>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-display font-black text-slate-800 tracking-tight">
              Welcome! Let&apos;s Learn
            </h1>
            <p className="text-base sm:text-lg text-emerald-700 font-bold">
              வணக்கம்! வாருங்கள் கற்கலாம்
            </p>
          </div>

          {schoolName && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 rounded-full shadow-xs">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{schoolName}</span>
              </span>
              <button
                type="button"
                onClick={() => setIsChoosingSchool(true)}
                className="text-xs text-emerald-600 hover:text-emerald-800 underline font-bold cursor-pointer"
              >
                Change
              </button>
            </div>
          )}
        </div>

        {/* Returning Student Quick-Access Card */}
        {activeStudent && (
          <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-2 border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3.5 text-center sm:text-left">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white font-extrabold text-lg flex items-center justify-center shadow-md shrink-0">
                {activeStudent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-center sm:justify-start gap-1">
                  <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                  <span>கற்பவர் / Active Learner:</span>
                </div>
                <div className="text-lg font-black text-slate-800">{activeStudent.name}</div>
              </div>
            </div>
            <Button
              size="normal"
              variant="primary"
              onClick={() => {
                if (onSuccess) onSuccess();
                else navigate('/subjects');
              }}
              className="text-xs font-bold py-2.5 px-4 shadow-sm"
            >
              Continue Learning →
            </Button>
          </div>
        )}

        {/* Optimistic Student Name Input Form */}
        <form onSubmit={handleNameSubmit} className="space-y-5 pt-1">
          <div className="space-y-2 text-left">
            <label
              htmlFor="student-name-input"
              className="block text-sm sm:text-base font-extrabold text-slate-800 tracking-wide"
            >
              Student Name / உங்கள் பெயர் <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="student-name-input"
                type="text"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your name / உங்கள் பெயரை உள்ளிடவும்"
                className="w-full px-5 py-4 bg-slate-50/70 hover:bg-white border-2 border-slate-200 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-400/20 rounded-2xl text-lg text-slate-900 font-bold placeholder:text-slate-400 placeholder:font-normal outline-hidden transition-all shadow-inner"
                autoComplete="name"
                autoFocus
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <Smile className="w-5 h-5 text-emerald-500/70" />
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 text-rose-700 rounded-2xl text-center text-sm font-bold border border-rose-200 animate-in fade-in duration-150"
            >
              {error}
            </div>
          )}

          {/* Instant Action Button */}
          <button
            type="submit"
            disabled={!nameInput.trim()}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-600 hover:to-teal-600 active:scale-98 text-white font-display font-black text-lg shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            <Sparkles className="w-5 h-5" />
            <span>Continue / தொடர்க →</span>
          </button>
        </form>

        {/* Uplifting Footer Note */}
        <div className="text-center pt-1 border-t border-slate-100">
          <p className="text-xs text-slate-500 font-medium">
            ✨ பதிவு அல்லது கடவுச்சொல் தேவையில்லை · No login or password required
          </p>
        </div>
      </div>
    </div>
  );
}
