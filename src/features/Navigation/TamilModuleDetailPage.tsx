import { useState, useEffect } from 'react';
import { Page } from '../../components/ui/Page';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { LocalContentRepository } from '../../repositories/implementations/LocalContentRepository';
import { TamilModuleManifest } from '../../types';
import { TamilProgressService, TamilDayProgress } from '../../progress';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Play, CheckCircle, RotateCcw, Layers } from 'lucide-react';
import { useStudent } from '../../student';

export function TamilModuleDetailPage() {
  const { classId = '3', moduleId } = useParams<{ classId: string; moduleId: string }>();
  const navigate = useNavigate();
  const { activeStudent } = useStudent();

  const [manifest, setManifest] = useState<TamilModuleManifest | null>(null);
  const [dayProgressMap, setDayProgressMap] = useState<Record<number, TamilDayProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);

  useEffect(() => {
    async function loadModule() {
      setIsLoading(true);
      setIsNotFound(false);

      const modNum = Number(moduleId);
      if (!Number.isInteger(modNum) || modNum < 1 || modNum > 8) {
        setIsNotFound(true);
        setIsLoading(false);
        return;
      }

      try {
        const repo = new LocalContentRepository();
        const data = await repo.getTamilModuleManifest(modNum);
        if (!data) {
          setIsNotFound(true);
        } else {
          setManifest(data);

          const progressService = new TamilProgressService(undefined, repo);
          const dayProgs: Record<number, TamilDayProgress> = {};
          for (const d of data.days) {
            dayProgs[d.day] = await progressService.getDayProgress(modNum, d.day, activeStudent?.id);
          }
          setDayProgressMap(dayProgs);
        }
      } catch {
        setIsNotFound(true);
      } finally {
        setIsLoading(false);
      }
    }

    loadModule();
  }, [moduleId, activeStudent?.id]);

  if (isLoading) {
    return (
      <Page>
        <LoadingState message="தொகுதி விவரங்கள் ஏற்றப்படுகின்றன..." />
      </Page>
    );
  }

  if (isNotFound || !manifest) {
    return (
      <Page>
        <EmptyState
          title="தொகுதி கிடைக்கவில்லை"
          message="கோரப்பட்ட தமிழ் தொகுதி இல்லை அல்லது பயிற்சிகள் எதுவும் இல்லை."
          actionLabel="தொகுதிகளுக்குத் திரும்பு"
          onAction={() => navigate(`/classes/${classId}/subjects/tamil`)}
        />
      </Page>
    );
  }

  const handleStartDay = (dayNumber: number) => {
    navigate(`/session/${classId}/tamil/play?module=${manifest.module}&day=${dayNumber}&size=all`);
  };

  return (
    <Page>
      <div className="space-y-8 max-w-5xl mx-auto pb-12 animate-in fade-in duration-200">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/classes/${classId}/subjects/tamil`)}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-2 font-medium cursor-pointer"
            aria-label="Back to Tamil Modules"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-sm font-bold text-text-muted">தமிழ் தொகுதிகள் / Tamil Modules</span>
          </button>

          <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200">
            தொகுதி {manifest.module} / 8
          </span>
        </div>

        {/* Module Header Card */}
        <div className="bg-surface-raised p-8 rounded-[32px] border border-border shadow-sm space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
            <span className="px-3 py-1 bg-emerald-100 rounded-full">தொகுதி {manifest.module}</span>
            <span>·</span>
            <span>வகுப்பு {classId} தமிழ்</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-display font-bold text-text">
            {manifest.title}
          </h1>

          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-muted bg-surface px-4 py-2 rounded-xl border border-border">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <span>5 நாள்கள் ({manifest.totalActivities || manifest.activityCount} பயிற்சிகள்)</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-text-muted bg-surface px-4 py-2 rounded-xl border border-border">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>ஒரு நாளுக்கு 29–30 பயிற்சிகள்</span>
            </div>
          </div>
        </div>

        {/* Days List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold text-text">நாள்தோறும் பயிற்சிகள் (Daily Practice)</h2>
            <span className="text-sm font-medium text-text-muted hidden sm:inline">
              ஒவ்வொரு நாளின் பயிற்சிகளையும் நிறைவுசெய்து அடுத்த நாளுக்கு முன்னேறவும்
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {manifest.days.map((day) => {
              const dayProg = dayProgressMap[day.day];
              const completedCount = dayProg?.completedActivities ?? 0;
              const totalCount = day.totalCount;
              const percent = dayProg?.percent ?? 0;
              const isCompleted = dayProg?.isCompleted ?? false;
              const isInProgress = completedCount > 0 && !isCompleted;

              const actDist = day.activityDistribution || {};
              const actEntries = Object.entries(actDist).slice(0, 4);

              return (
                <Card
                  key={day.day}
                  interactive
                  onClick={() => handleStartDay(day.day)}
                  className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-emerald-400 group transition-all cursor-pointer ${
                    isCompleted ? 'border-emerald-300 bg-emerald-50/20' : ''
                  }`}
                  aria-label={`Day ${day.day}: ${completedCount} of ${totalCount} activities completed`}
                >
                  <div className="flex items-center gap-5">
                    <div
                      className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-display shrink-0 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-7 h-7 text-emerald-600" />
                      ) : (
                        <>
                          <span className="text-xs uppercase font-bold tracking-wider">நாள்</span>
                          <span className="text-2xl font-bold leading-none">{day.day}</span>
                        </>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-text group-hover:text-emerald-600 transition-colors">
                          நாள் {day.day} பயிற்சி (Day {day.day})
                        </h3>
                        {isCompleted && (
                          <span className="text-xs font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                            நிறைவு (Completed)
                          </span>
                        )}
                        {isInProgress && (
                          <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                            தொடர்கிறது ({completedCount}/{totalCount})
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-text-muted flex items-center gap-2">
                        <span>{totalCount} பயிற்சிகள்</span>
                        {day.activityTypesCount && (
                          <>
                            <span>·</span>
                            <span>{day.activityTypesCount} பயிற்சி வகைகள்</span>
                          </>
                        )}
                      </div>

                      {/* Activity badges preview */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {actEntries.map(([actName, cnt], idx) => (
                          <span
                            key={idx}
                            className="text-[11px] font-medium bg-surface px-2 py-0.5 rounded-md border border-border text-text-muted"
                          >
                            {actName}: {cnt}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Progress */}
                  <div className="flex items-center gap-6 md:justify-end">
                    <div className="w-32 hidden sm:block space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-text-muted">
                        <span>முன்னேற்றம்</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            isCompleted ? 'bg-emerald-500' : 'bg-emerald-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <Button
                      variant={isCompleted ? 'secondary' : 'primary'}
                      size="normal"
                      className={`font-bold flex items-center gap-2 shrink-0 ${
                        isCompleted ? '' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartDay(day.day);
                      }}
                    >
                      {isCompleted ? (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>மீண்டும் பயிற்சி</span>
                        </>
                      ) : isInProgress ? (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>தொடர்க ▶</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>தொடங்கு ▶</span>
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </Page>
  );
}
