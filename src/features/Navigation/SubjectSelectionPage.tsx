import { useEffect, useState } from 'react';
import { Page } from '../../components/ui/Page';
import { SubjectCard } from '../../components/domain/SubjectCard';
import { useNavigate, useParams } from 'react-router-dom';
import { useStudent } from '../../student';
import { sessionSync, ActiveSessionDto } from '../../services/SessionSyncService';

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

  const subjects = [
    { id: 'tamil', name: 'Tamil', nativeName: 'தமிழ்', isAvailable: true },
    { id: 'english', name: 'English', nativeName: 'English', isAvailable: true },
    { id: 'maths', name: 'Mathematics', nativeName: 'கணிதம்', isAvailable: false },
    { id: 'evs', name: 'EVS', nativeName: 'சூழ்நிலையியல்', isAvailable: false },
    { id: 'science', name: 'Science', nativeName: 'அறிவியல்', isAvailable: false },
  ];

  return (
    <Page>
      <div className="space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text">வகுப்பு 2 & 3 · பாடங்கள்</h1>
          <p className="text-xl text-text-muted">இன்று நீங்கள் என்ன பயில விரும்புகிறீர்கள்? · Choose Subject</p>
        </div>

        {/* Resume a session left unfinished on this or another desktop */}
        {activeSession && activeSession.currentIndex < activeSession.activityIds.length && (
          <div
            data-testid="session-resume-card"
            className="max-w-xl mx-auto flex items-center justify-between gap-4 rounded-2xl border-2 border-primary-200 bg-white p-5 shadow-sm"
          >
            <p className="font-bold text-text">
              கேள்வி {activeSession.currentIndex + 1} / {activeSession.activityIds.length} · Question{' '}
              {activeSession.currentIndex + 1} of {activeSession.activityIds.length}
            </p>
            <button
              onClick={() =>
                navigate(
                  `/session/${classId || '3'}/${activeSession.subject}/play?category=${encodeURIComponent(activeSession.categoryOrModule)}&resumeSessionId=${encodeURIComponent(activeSession.id)}`
                )
              }
              className="px-5 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold rounded-2xl cursor-pointer"
            >
              தொடர்க · Resume
            </button>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-center items-stretch gap-6 pt-8 max-w-3xl mx-auto">
          {subjects.filter(s => ['tamil', 'english'].includes(s.id)).map(s => (
            <SubjectCard 
              key={s.id} 
              subject={s.name}
              nativeName={s.nativeName}
              isAvailable={s.isAvailable}
              onClick={() => navigate(`/classes/${classId || '3'}/subjects/${s.id}`)}
            />
          ))}
        </div>
      </div>
    </Page>
  );
}
