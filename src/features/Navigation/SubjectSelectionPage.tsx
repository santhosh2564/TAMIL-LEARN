import { useEffect, useState } from 'react';
import { Page } from '../../components/ui/Page';
import { useNavigate, useParams } from 'react-router-dom';
import { useStudent } from '../../student';
import { sessionSync, ActiveSessionDto } from '../../services/SessionSyncService';
import { BookOpen, Languages, Sparkles, Play, CheckCircle2, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function SubjectSelectionPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { activeStudent, logout } = useStudent();
  const [activeSession, setActiveSession] = useState<ActiveSessionDto | null>(null);

  const handleChangeLearner = async () => {
    try {
      await logout();
    } catch {
      // Ignore errors on logout
    }
    navigate('/');
  };

  useEffect(() => {
    let isMounted = true;
    if (activeStudent?.id) {
      sessionSync.getActiveSession(activeStudent.id).then((sess) => {
        if (isMounted) setActiveSession(sess);
      });
    }
    return () => {
      isMounted = false;
    };
  }, [activeStudent?.id]);

  const tamilCategories = [
    'படங்கள் (Picture Recognition)',
    'சொல் உருவாக்கம் (Word Completion)',
    'வரிசைப்படுத்துதல் (Arrange Word)',
    'சரியான சொல் (Spelling Choice)',
    'வாக்கிய அமைவு (Context Choice)',
    'பொருள் பொருத்துதல் (Meaning Match)',
  ];

  const englishCategories = [
    'Picture Recognition',
    'Word Completion',
    'Arrange Word',
    'Spelling Choice',
    'Context Choice',
    'Meaning Match',
  ];

  return (
    <Page>
      <div className="max-w-5xl mx-auto space-y-8 py-6 sm:py-10 animate-in fade-in duration-200">
        {/* Navigation & Welcome Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleChangeLearner}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 font-extrabold text-sm transition-all border-2 border-slate-200 shadow-sm hover:shadow cursor-pointer active:scale-95"
            aria-label="Back to Name Entry / பெயர் உள்ளீடுக்குத் திரும்பு"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-600" />
            <span>பெயர் மாற்று / Change Learner</span>
          </button>

          <div className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>மகிழ்ச்சியான கற்றல் பயணம் · Joyful Learning</span>
          </div>
        </div>

        {/* Welcome Student Greeting Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-100 via-teal-100 to-sky-100 text-emerald-800 font-bold text-xs sm:text-sm shadow-xs border border-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>TAMIL-LEARN · பொதுக் கற்றல் தளம்</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-black text-slate-800 tracking-tight">
            வணக்கம், <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{activeStudent?.name || 'மாணவர்'}</span>! 🌟
          </h1>
          <p className="text-base sm:text-xl text-slate-600 font-medium max-w-2xl mx-auto">
            இன்று நீங்கள் என்ன பயில விரும்புகிறீர்கள்? Choose a course to start your learning journey.
          </p>
        </div>

        {/* Unfinished Session Resume Card if student has active session */}
        {activeSession && activeSession.currentIndex < activeSession.activityIds.length && (
          <div
            data-testid="session-resume-card"
            className="max-w-2xl mx-auto rounded-[32px] border-2 border-amber-300 bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-yellow-50/90 p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-5 animate-in slide-in-from-bottom-2 duration-200"
          >
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-800 bg-amber-200/80 px-3 py-1 rounded-full">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>தொடரவும் / Resume In-Progress Session</span>
              </div>
              <div className="text-lg font-black text-slate-800">
                {activeSession.subject === 'tamil' ? 'தமிழ் பயிற்சி' : 'English Practice'} · {activeSession.categoryOrModule}
              </div>
              <p className="text-sm text-slate-600 font-medium">
                கேள்வி {activeSession.currentIndex + 1} / {activeSession.activityIds.length} · Question{' '}
                {activeSession.currentIndex + 1} of {activeSession.activityIds.length}
              </p>
            </div>

            <Button
              variant="primary"
              size="large"
              onClick={() =>
                navigate(
                  `/session/${classId || '3'}/${activeSession.subject}/play?category=${encodeURIComponent(activeSession.categoryOrModule)}&resumeSessionId=${encodeURIComponent(activeSession.id)}`
                )
              }
              className="py-4 px-6 text-base font-black rounded-2xl shrink-0 shadow-md bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white cursor-pointer active:scale-95"
              aria-label="தொடர்க / Continue"
            >
              தொடர்க / Continue ▶
            </Button>
          </div>
        )}

        {/* Two Prominent Course Cards: Tamil and English */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Tamil Course Card */}
          <div
            data-testid="course-card-tamil"
            className="relative overflow-hidden bg-white/95 border-2 border-emerald-200 hover:border-emerald-500 rounded-[36px] p-6 sm:p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
            onClick={() => navigate(`/classes/${classId || '3'}/subjects/tamil`)}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center font-display font-black text-3xl shadow-md group-hover:scale-105 transition-transform">
                  தமிழ்
                </div>
                <span className="text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Primary Subject
                </span>
              </div>

              <div>
                <h2 className="text-3xl font-display font-black text-slate-800 group-hover:text-emerald-600 transition-colors">
                  தமிழ் (Tamil)
                </h2>
                <p className="text-slate-600 text-sm sm:text-base mt-1.5 font-medium leading-relaxed">
                  8 தொகுதிகள், 40 கற்றல் நாட்கள், பட அறிதல், சொல் உருவாக்கம் மற்றும் பொருள் பொருத்துதல் பயிற்சிகள்.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">
                  பயிற்சி பிரிவுகள் (6 Activity Families):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tamilCategories.map((cat, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-bold bg-emerald-50/80 px-2.5 py-1 rounded-xl border border-emerald-200 text-emerald-900"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-slate-100">
              <button
                type="button"
                className="w-full py-4 px-6 text-base font-black rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 active:scale-95 text-white shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/classes/${classId || '3'}/subjects/tamil`);
                }}
              >
                <BookOpen className="w-5 h-5" />
                <span>தமிழ் கற்கத் தொடங்குங்கள் ▶</span>
              </button>
            </div>
          </div>

          {/* English Course Card */}
          <div
            data-testid="course-card-english"
            className="relative overflow-hidden bg-white/95 border-2 border-sky-200 hover:border-sky-500 rounded-[36px] p-6 sm:p-8 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group cursor-pointer"
            onClick={() => navigate(`/classes/${classId || '3'}/subjects/english`)}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white flex items-center justify-center font-display font-black text-2xl shadow-md group-hover:scale-105 transition-transform">
                  Eng
                </div>
                <span className="text-xs font-black uppercase tracking-wider px-3.5 py-1.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                  Primary Subject
                </span>
              </div>

              <div>
                <h2 className="text-3xl font-display font-black text-slate-800 group-hover:text-sky-600 transition-colors">
                  English (ஆங்கிலம்)
                </h2>
                <p className="text-slate-600 text-sm sm:text-base mt-1.5 font-medium leading-relaxed">
                  Interactive vocabulary, phonics, spelling choice, word completion and comprehension modules.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="text-xs font-extrabold text-sky-800 uppercase tracking-wider">
                  Included Activities (6 Activity Families):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {englishCategories.map((cat, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-bold bg-sky-50/80 px-2.5 py-1 rounded-xl border border-sky-200 text-sky-900"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-slate-100">
              <button
                type="button"
                className="w-full py-4 px-6 text-base font-black rounded-2xl bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-700 hover:from-sky-700 hover:to-indigo-700 active:scale-95 text-white shadow-lg shadow-sky-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/classes/${classId || '3'}/subjects/english`);
                }}
              >
                <Languages className="w-5 h-5" />
                <span>Start Learning English ▶</span>
              </button>
            </div>
          </div>
        </div>

        {/* Motivational Learning Footer */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-2 text-xs text-text-muted font-medium bg-surface-raised px-4 py-2 rounded-full border border-surface-highlight">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Progress and question attempts are securely tracked to your personal learner profile.</span>
          </div>
        </div>
      </div>
    </Page>
  );
}
