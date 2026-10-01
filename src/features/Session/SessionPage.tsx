import { useEffect, useState, useCallback, useMemo } from 'react';
import { Page } from '../../components/ui/Page';
import { Button } from '../../components/ui/Button';
import { useNavigate, useSearchParams, useParams, useBlocker } from 'react-router-dom';
import { SessionService, SessionActivitySelector, ActivitySession, ActivityRuntimeState, CoreActivityEngine, ActivityRenderer, activityRegistry } from '../../engine';
import { SessionConfig } from '../../engine/types';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Activity, ActivityCategory } from '../../types';
import { ProgressService, LocalProgressRepository } from '../../progress';

export function SessionPage() {
  const navigate = useNavigate();
  const { classId, subjectId } = useParams<{ classId: string; subjectId: string }>();
  const [searchParams] = useSearchParams();
  const category = searchParams.get('category') as ActivityCategory | null;
  const levelStr = searchParams.get('level');
  const sizeStr = searchParams.get('size');
  
  const level = levelStr ? Number(levelStr) : undefined;
  const sizeValue = sizeStr ? Number(sizeStr) : 10;
  const config: SessionConfig = useMemo(() => ({
    classId: classId || '3',
    subjectId: subjectId || 'tamil',
    category,
    level,
    size: sizeValue === 9999 ? { mode: 'all' } : { mode: 'fixed', count: sizeValue }
  }), [classId, subjectId, category, level, sizeValue]);

  const [session, setSession] = useState<ActivitySession | null>(null);
  const [activities, setActivities] = useState<Record<string, Activity>>({});
  const [currentActivityState, setCurrentActivityState] = useState<ActivityRuntimeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // We don't want to block if they are deliberately navigating to results
  const [isNavigatingToResults, setIsNavigatingToResults] = useState(false);

  const sessionService = useMemo(() => new SessionService(), []);
  const engine = useMemo(() => new CoreActivityEngine(), []);
  const progressService = useMemo(
    () => new ProgressService(new LocalProgressRepository()),
    []
  );

  // Block navigation if session is active and not completed yet
  useBlocker(({ nextLocation }) => {
    if (isNavigatingToResults || !session || session.status === 'completed') {
      return false;
    }
    // Only warn if they made meaningful progress (e.g. at least on the first activity)
    // Actually, any active session shouldn't be lost accidentally
    if (nextLocation.pathname !== window.location.pathname) {
      return !window.confirm("பயிற்சியிலிருந்து வெளியேறவா? உங்கள் முன்னேற்றம் சேமிக்கப்படாது.");
    }
    return false;
  });

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (session && session.status !== 'completed') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [session]);

  useEffect(() => {
    async function initSession() {
      try {
        setIsLoading(true);
        const selector = new SessionActivitySelector();
        const selectedActivities = await selector.selectActivities(config);

        if (selectedActivities.length === 0) {
          setError('இந்தப் பயிற்சிக்கான செயல்கள் எதுவும் கிடைக்கவில்லை.');
          setIsLoading(false);
          return;
        }
        
        const activityMap = selectedActivities.reduce((acc, act) => {
          acc[act.id] = act;
          return acc;
        }, {} as Record<string, Activity>);

        setActivities(activityMap);

        const newSession = sessionService.createSession('session-' + Date.now(), selectedActivities.map(a => a.id));
        const startedSession = sessionService.startSession(newSession);
        
        setSession(startedSession);
        
        const firstActivityId = sessionService.getCurrentActivityId(startedSession);
        if (firstActivityId) {
          setCurrentActivityState(engine.start(activityMap[firstActivityId]));
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'பயிற்சியைத் தொடங்க முடியவில்லை');
        setIsLoading(false);
      }
    }

    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, levelStr, sizeStr]); // Re-run only if core query params change

  const handleSubmit = useCallback((input: unknown) => {
    if (!session || !currentActivityState) return;

    const currentActivityId = sessionService.getCurrentActivityId(session);
    if (!currentActivityId) return;

    const activity = activities[currentActivityId];
    
    let definition = activityRegistry.getDefinition(activity.category, activity.variant);
    if (!definition) {
      definition = activityRegistry.getDefinition('unknown', 'unknown');
    }
    
    if (!definition) {
      console.error('No evaluator found');
      return;
    }

    try {
      const { nextState, evaluation } = engine.submit(
        activity,
        currentActivityState,
        input,
        definition.evaluator
      );

      setCurrentActivityState(nextState);

      if (evaluation.completed) {
        const activityResult = {
          activityId: activity.id,
          completed: evaluation.completed,
          correct: evaluation.correct,
          attempts: nextState.attempts,
          startedAt: nextState.startedAt!,
          completedAt: nextState.completedAt,
        };

        const updatedSession = sessionService.completeActivity(session, activityResult);
        setSession(updatedSession);

        // Persist to local storage via ProgressService — no component touches localStorage
        progressService.recordCompletion(activityResult, activity.category).catch(() => {
          // Storage failures are non-fatal: session continues normally
        });
      }
    } catch (err) {
      console.error(err);
    }
  }, [session, currentActivityState, activities, engine, sessionService, progressService]);

  const handleNext = useCallback(() => {
    if (!session) return;
    
    const advancedSession = sessionService.nextActivity(session);
    setSession(advancedSession);

    if (advancedSession.status === 'completed') {
      setIsNavigatingToResults(true);
      // Wait for state flush then navigate
      setTimeout(() => {
        navigate('/session/results', { 
          state: { 
            session: advancedSession,
            activities: activities,
            config: config
          },
          replace: true
        });
      }, 0);
    } else {
      const nextActivityId = sessionService.getCurrentActivityId(advancedSession);
      if (nextActivityId) {
        setCurrentActivityState(engine.start(activities[nextActivityId]));
      }
    }
  }, [session, activities, config, navigate, engine, sessionService]);

  if (isLoading) return <Page hideHeader><LoadingState message="பயிற்சி தயாராகிறது..." /></Page>;
  
  if (error) {
    return (
      <Page hideHeader>
        <ErrorState 
          message={error} 
          onRetry={() => window.location.reload()} 
        />
        <div className="flex justify-center mt-4">
           <Button variant="secondary" onClick={() => navigate(`/classes/${classId}/subjects/${subjectId}`)}>
             கற்றல் பகுதிக்குத் திரும்பு
           </Button>
        </div>
      </Page>
    );
  }
  
  if (!session || !currentActivityState) return null;

  const currentActivityId = sessionService.getCurrentActivityId(session);
  if (!currentActivityId) {
    // Session state lost or corrupted
    return (
      <Page hideHeader>
        <ErrorState message="உங்கள் பயிற்சி தற்போது கிடைக்கவில்லை." onRetry={() => navigate(`/classes/${classId}/subjects/${subjectId}`)} />
      </Page>
    );
  }

  const activity = activities[currentActivityId];
  const progressPercent = (session.currentIndex / session.activityIds.length) * 100;

  const handleExit = () => {
    navigate(-1);
  };

  return (
    <Page hideHeader>
      <div className="min-h-screen flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
        {/* Session Header */}
        <header className="flex items-center justify-between mb-8">
          <Button variant="secondary" onClick={handleExit}>வெளியேறு</Button>
          <div className="flex-1 mx-8 h-4 bg-surface-raised rounded-full overflow-hidden" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div 
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-bold text-text-muted" aria-live="polite">
            செயல் {session.currentIndex + 1} / {session.activityIds.length}
          </span>
        </header>

        {/* Activity Area */}
        <main className="flex-1 flex flex-col items-center justify-center w-full py-4">
          <ActivityRenderer 
            activity={activity}
            state={currentActivityState}
            onSubmit={handleSubmit}
            onNext={handleNext}
          />
        </main>
      </div>
    </Page>
  );
}
