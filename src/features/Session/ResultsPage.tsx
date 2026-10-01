import { Page } from '../../components/ui/Page';
import { Button } from '../../components/ui/Button';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle2, XCircle, RotateCcw } from 'lucide-react';
import { ActivitySession } from '../../engine/types';
import { Activity } from '../../types';

interface SessionState {
  session?: ActivitySession;
  activities?: Record<string, Activity>;
  config?: {
    classId: string;
    subjectId: string;
    category: string | null;
    size: number;
    level: number | undefined;
  };
}

export function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, activities, config } = (location.state as SessionState) || {};

  if (!session || !activities || !config) {
    return (
      <Page>
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold">முடிவுகள் எதுவும் கிடைக்கவில்லை.</h1>
          <Button className="mt-8" onClick={() => navigate('/')}>முகப்புக்குத் திரும்பு</Button>
        </div>
      </Page>
    );
  }

  const results = Object.values(session.results);
  const total = results.length;
  const correctCount = results.filter(r => r.correct).length;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  
  const modeName = config.category ? 'வகைப் பயிற்சி' : 'கலப்பு பயிற்சி';

  const handleRetry = () => {
    let url = `/session/${config.classId}/${config.subjectId}/play?size=${config.size}`;
    if (config.category) url += `&category=${config.category}`;
    if (config.level) url += `&level=${config.level}`;
    navigate(url, { replace: true });
  };

  const handleCategoryAgain = () => {
    navigate(`/session/${config.classId}/${config.subjectId}/setup?category=${config.category}`);
  };

  return (
    <Page>
      <div className="max-w-3xl mx-auto py-12 space-y-12">
        
        {/* Header / Summary */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl md:text-6xl font-display font-extrabold text-primary-600">
            {accuracy >= 80 ? 'அருமையான முயற்சி!' : accuracy >= 50 ? 'நல்ல முயற்சி!' : 'தொடர்ந்து பயிற்சி செய்!'}
          </h1>
          <p className="text-2xl text-text-muted">உங்கள் {modeName} நிறைவுற்றது.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-raised p-6 rounded-3xl text-center">
            <div className="text-4xl font-bold text-text">{total}</div>
            <div className="text-text-muted font-medium mt-2">செயல்கள்</div>
          </div>
          <div className="bg-surface-raised p-6 rounded-3xl text-center">
            <div className="text-4xl font-bold text-success-600">{accuracy}%</div>
            <div className="text-text-muted font-medium mt-2">சரியான விடை சதவீதம்</div>
          </div>
          <div className="bg-surface-raised p-6 rounded-3xl text-center">
            <div className="text-4xl font-bold text-text">{correctCount}</div>
            <div className="text-text-muted font-medium mt-2">சரியானவை</div>
          </div>
        </div>

        {/* Breakdown List */}
        <div className="bg-surface-raised rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-surface-highlight">
            <h2 className="text-xl font-bold text-text">செயல்களின் விவரம்</h2>
          </div>
          <div className="divide-y divide-surface-highlight">
            {session.activityIds.map((id, index) => {
              const activity = activities[id];
              const result = session.results[id];
              const isCorrect = result?.correct;

              return (
                <div key={id} className="p-6 flex items-center justify-between hover:bg-surface-highlight/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-text-muted font-bold w-6">{index + 1}.</span>
                    <div>
                      <div className="font-bold text-text capitalize">
                        {activity?.category.replace('-', ' ')}
                      </div>
                      {activity?.prompt && typeof activity.prompt === 'string' && (
                        <div className="text-sm text-text-muted mt-1 truncate max-w-[200px] md:max-w-md">
                          {activity.prompt}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCorrect ? (
                      <span className="flex items-center gap-2 text-success-600 font-bold bg-success-50 px-4 py-2 rounded-full">
                        <CheckCircle2 size={20} /> சரி
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-danger-600 font-bold bg-danger-50 px-4 py-2 rounded-full">
                        <XCircle size={20} /> தவறு
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button size="large" onClick={handleRetry}>
            <div className="flex items-center gap-2">
              <RotateCcw size={20} /> மீண்டும் முயற்சி செய்
            </div>
          </Button>
          {config.category && (
            <Button size="large" variant="secondary" onClick={handleCategoryAgain}>
              வகைப் பயிற்சி
            </Button>
          )}
          <Button size="large" variant="secondary" onClick={() => navigate(`/classes/${config.classId}/subjects/${config.subjectId}`)}>
            கற்றல் பகுதி
          </Button>
        </div>
      </div>
    </Page>
  );
}
