import { useState, useEffect } from 'react';
import { Page } from '../../components/ui/Page';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { EmptyState } from '../../components/ui/EmptyState';
import { LocalContentRepository } from '../../repositories/implementations/LocalContentRepository';
import { EnglishModuleManifest } from '../../types';
import { EnglishProgressService, EnglishDayProgress } from '../../progress';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Play, Sparkles, BookOpen, CheckCircle, RotateCcw } from 'lucide-react';

export function EnglishModuleDetailPage() {
  const { classId = '3', moduleId } = useParams<{ classId: string; moduleId: string }>();
  const navigate = useNavigate();

  const [manifest, setManifest] = useState<EnglishModuleManifest | null>(null);
  const [dayProgressMap, setDayProgressMap] = useState<Record<number, EnglishDayProgress>>({});
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
        const data = await repo.getEnglishModuleManifest(modNum);
        if (!data) {
          setIsNotFound(true);
        } else {
          setManifest(data);

          const progressService = new EnglishProgressService(undefined, repo);
          const dayProgs: Record<number, EnglishDayProgress> = {};
          for (const d of data.days) {
            dayProgs[d.day] = await progressService.getDayProgress(modNum, d.day);
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
  }, [moduleId]);

  if (isLoading) {
    return (
      <Page>
        <LoadingState message="Loading module details..." />
      </Page>
    );
  }

  if (isNotFound || !manifest) {
    return (
      <Page>
        <EmptyState
          title="Module not found"
          message="The requested English module does not exist or has no activities."
          actionLabel="Back to Modules"
          onAction={() => navigate(`/classes/${classId}/subjects/english`)}
        />
      </Page>
    );
  }

  const handleStartDay = (dayNumber: number) => {
    navigate(`/session/${classId}/english/play?module=${manifest.module}&day=${dayNumber}&size=all`);
  };

  return (
    <Page>
      <div className="space-y-8 max-w-5xl mx-auto pb-12">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/classes/${classId}/subjects/english`)}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-2 font-medium"
            aria-label="Back to English Modules"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-sm font-bold text-text-muted">English Modules</span>
          </button>

          <span className="text-sm font-bold text-primary-600 bg-primary-50 px-4 py-1.5 rounded-full border border-primary-200">
            Module {manifest.module} of 8
          </span>
        </div>

        {/* Module Header Card */}
        <div className="bg-surface-raised p-8 rounded-[32px] border border-border space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary-600">
            <span className="px-3 py-1 bg-primary-100 rounded-full">Module {manifest.module}</span>
            <span>·</span>
            <span>Class {classId} English</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-display font-bold text-text">
            {manifest.title}
          </h1>

          <div className="flex flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-muted bg-surface px-4 py-2 rounded-xl border border-border">
              <BookOpen className="w-4 h-4 text-primary-500" />
              <span>{manifest.newWordCount} New Words</span>
            </div>

            {manifest.reviewWordCount > 0 && (
              <div className="flex items-center gap-2 text-sm font-semibold text-text-muted bg-surface px-4 py-2 rounded-xl border border-border">
                <Sparkles className="w-4 h-4 text-accent-500" />
                <span>{manifest.reviewWordCount} Review Activities</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm font-semibold text-text-muted bg-surface px-4 py-2 rounded-xl border border-border">
              <Calendar className="w-4 h-4 text-secondary-500" />
              <span>{manifest.days.length} Days ({manifest.totalActivities} Total Activities)</span>
            </div>
          </div>
        </div>

        {/* Days List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold text-text">Daily Practice</h2>
            <span className="text-sm font-medium text-text-muted">
              Complete each day's activities to progress through the module
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

              return (
                <Card
                  key={day.day}
                  interactive
                  onClick={() => handleStartDay(day.day)}
                  className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-primary-400 group transition-all ${
                    isCompleted ? 'border-emerald-200 bg-emerald-50/20' : ''
                  }`}
                  aria-label={`Day ${day.day}: ${completedCount} of ${totalCount} activities completed`}
                >
                  <div className="flex items-center gap-5">
                    <div
                      className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-display shrink-0 transition-colors ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-primary-50 text-primary-600 group-hover:bg-primary-500 group-hover:text-white'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-7 h-7 text-emerald-600" />
                      ) : (
                        <>
                          <span className="text-xs uppercase font-bold tracking-wider">Day</span>
                          <span className="text-2xl font-bold leading-none">{day.day}</span>
                        </>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold text-text group-hover:text-primary-600 transition-colors">
                          Day {day.day} Practice
                        </h3>
                        {isCompleted && (
                          <span className="text-xs font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                            Completed
                          </span>
                        )}
                        {isInProgress && (
                          <span className="text-xs font-bold px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                            In Progress
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-text-muted">
                        {day.newCount} new words
                        {day.reviewCount > 0 ? ` · ${day.reviewCount} review activities` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Progress & CTA Area */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between md:justify-end gap-4 sm:gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-surface-highlight">
                    <span className="text-sm font-bold text-primary-700 bg-primary-100/80 px-3.5 py-1.5 rounded-full shrink-0">
                      {day.totalCount} activities
                    </span>

                    <div className="w-full sm:w-36 space-y-1">
                      <div className="flex justify-between text-xs font-semibold text-text-muted">
                        <span>
                          {completedCount} / {totalCount} done
                        </span>
                        <span>{percent}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            isCompleted ? 'bg-emerald-500' : 'bg-primary-500'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    <Button
                      size="normal"
                      variant={isCompleted ? 'secondary' : 'primary'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartDay(day.day);
                      }}
                      className="flex items-center gap-2 w-full sm:w-auto justify-center shrink-0"
                    >
                      {isCompleted ? (
                        <>
                          <RotateCcw className="w-4 h-4" />
                          <span>Practice Again</span>
                        </>
                      ) : isInProgress ? (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Continue</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-current" />
                          <span>Start</span>
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
