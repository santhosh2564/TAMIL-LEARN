import { useEffect, useState } from 'react';
import { Page } from '../../components/ui/Page';
import { useNavigate, useParams } from 'react-router-dom';
import { useStudent } from '../../student';
import { sessionSync, ActiveSessionDto } from '../../services/SessionSyncService';
import { BookOpen, Languages, Sparkles, Play, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function SubjectSelectionPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { activeStudent } = useStudent();
  const [activeSession, setActiveSession] = useState<ActiveSessionDto | null>(null);

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
      <div className="max-w-5xl mx-auto space-y-10 py-6 sm:py-10 animate-in fade-in duration-200">
        {/* Welcome Student Greeting Banner */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-100 text-primary-700 font-semibold text-xs sm:text-sm shadow-xs">
            <Sparkles className="w-4 h-4 text-primary-600" />
            <span>TAMIL-LEARN Common Course · பொதுக் கற்றல் தளம்</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-text tracking-tight">
            வணக்கம், <span className="text-primary-600">{activeStudent?.name || 'மாணவர்'}</span>!
          </h1>
          <p className="text-base sm:text-xl text-text-muted max-w-2xl mx-auto">
            இன்று நீங்கள் என்ன பயில விரும்புகிறீர்கள்? Choose a subject to start your learning journey.
          </p>
        </div>

        {/* Unfinished Session Resume Card if student has active session */}
        {activeSession && activeSession.currentIndex < activeSession.activityIds.length && (
          <div
            data-testid="session-resume-card"
            className="max-w-2xl mx-auto rounded-3xl border-2 border-primary-400 bg-surface-raised p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-5 animate-in slide-in-from-bottom-2 duration-200"
          >
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary-700 bg-primary-100 px-3 py-1 rounded-full">
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>தொடரவும் / Resume In-Progress Session</span>
              </div>
              <div className="text-lg font-bold text-text">
                {activeSession.subject === 'tamil' ? 'தமிழ் பயிற்சி' : 'English Practice'} · {activeSession.categoryOrModule}
              </div>
              <p className="text-sm text-text-muted">
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
              className="py-4 px-6 text-base font-extrabold rounded-2xl shrink-0 shadow-md cursor-pointer"
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
            className="bg-surface-raised border-2 border-surface-highlight hover:border-emerald-500 rounded-3xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col justify-between group cursor-pointer"
            onClick={() => navigate(`/classes/${classId || '3'}/subjects/tamil`)}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-display font-extrabold text-3xl shadow-sm group-hover:scale-105 transition-transform">
                  தமிழ்
                </div>
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Primary Subject
                </span>
              </div>

              <div>
                <h2 className="text-3xl font-display font-black text-text group-hover:text-emerald-600 transition-colors">
                  தமிழ் (Tamil)
                </h2>
                <p className="text-text-muted text-sm sm:text-base mt-1">
                  எழுத்துகள், சொல் உருவாக்கம், பட அறிதல், வாக்கிய அமைவு மற்றும் பொருள் பொருத்துதல் பயிற்சிகள்.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  பயிற்சி பிரிவுகள் (6 Activity Families):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tamilCategories.map((cat, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-medium bg-surface px-2.5 py-1 rounded-lg border border-surface-highlight text-text-muted"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-surface-highlight">
              <Button
                variant="primary"
                size="large"
                className="w-full py-4 text-base font-extrabold rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-md group-hover:shadow-lg flex items-center justify-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/classes/${classId || '3'}/subjects/tamil`);
                }}
              >
                <BookOpen className="w-5 h-5" />
                <span>Start Learning Tamil / தமிழ் கற்க ▶</span>
              </Button>
            </div>
          </div>

          {/* English Course Card */}
          <div
            data-testid="course-card-english"
            className="bg-surface-raised border-2 border-surface-highlight hover:border-sky-500 rounded-3xl p-6 sm:p-8 shadow-lg hover:shadow-2xl transition-all duration-200 flex flex-col justify-between group cursor-pointer"
            onClick={() => navigate(`/classes/${classId || '3'}/subjects/english`)}
          >
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="w-16 h-16 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-display font-extrabold text-3xl shadow-sm group-hover:scale-105 transition-transform">
                  Eng
                </div>
                <span className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                  Primary Subject
                </span>
              </div>

              <div>
                <h2 className="text-3xl font-display font-black text-text group-hover:text-sky-600 transition-colors">
                  English (ஆங்கிலம்)
                </h2>
                <p className="text-text-muted text-sm sm:text-base mt-1">
                  Interactive vocabulary, phonics, spelling choice, word completion and comprehension modules.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Included Activities (6 Activity Families):
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {englishCategories.map((cat, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-medium bg-surface px-2.5 py-1 rounded-lg border border-surface-highlight text-text-muted"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6 mt-4 border-t border-surface-highlight">
              <Button
                variant="primary"
                size="large"
                className="w-full py-4 text-base font-extrabold rounded-2xl bg-sky-600 hover:bg-sky-700 shadow-md group-hover:shadow-lg flex items-center justify-center gap-2"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/classes/${classId || '3'}/subjects/english`);
                }}
              >
                <Languages className="w-5 h-5" />
                <span>Start Learning English / Start ▶</span>
              </Button>
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
