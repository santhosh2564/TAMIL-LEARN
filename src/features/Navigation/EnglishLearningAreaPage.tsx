import { useState, useEffect } from 'react';
import { Page } from '../../components/ui/Page';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LocalContentRepository } from '../../repositories/implementations/LocalContentRepository';
import { EnglishCurriculumManifest } from '../../types';
import { EnglishProgressService, EnglishCurriculumProgress, EnglishModuleProgress } from '../../progress';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Layers, Sparkles, CheckCircle, Play, Award } from 'lucide-react';

export function EnglishLearningAreaPage() {
  const { classId = '3' } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [manifest, setManifest] = useState<EnglishCurriculumManifest | null>(null);
  const [curriculumProgress, setCurriculumProgress] = useState<EnglishCurriculumProgress | null>(null);
  const [moduleProgressMap, setModuleProgressMap] = useState<Record<number, EnglishModuleProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const repo = new LocalContentRepository();
        const data = await repo.getEnglishCurriculumManifest();
        setManifest(data);

        const progressService = new EnglishProgressService(undefined, repo);
        const [currProg, allMods] = await Promise.all([
          progressService.getCurriculumProgress(),
          progressService.getAllModulesProgress(),
        ]);

        setCurriculumProgress(currProg);
        const modMap: Record<number, EnglishModuleProgress> = {};
        for (const m of allMods) {
          modMap[m.module] = m;
        }
        setModuleProgressMap(modMap);
      } catch {
        setError('Unable to load English curriculum.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [classId]);

  if (isLoading) {
    return (
      <Page>
        <LoadingState message="Loading English modules..." />
      </Page>
    );
  }

  if (error || !manifest) {
    return (
      <Page>
        <ErrorState
          message={error || 'No English modules available.'}
          onRetry={() => window.location.reload()}
        />
      </Page>
    );
  }

  const recommended = curriculumProgress?.recommendedSession;

  return (
    <Page>
      <div className="space-y-8 max-w-6xl mx-auto pb-12">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/classes/${classId}/subjects`)}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-2 font-medium"
            aria-label="Back to Subjects"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-sm font-bold text-text-muted">Subjects</span>
          </button>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary-50 text-primary-700 rounded-full text-sm font-bold border border-primary-200">
            <Sparkles className="w-4 h-4 text-primary-500" />
            <span>Class {classId} · English Vocabulary</span>
          </div>
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-display font-bold text-text">
            English Modules
          </h1>
          <p className="text-xl text-text-muted max-w-2xl mx-auto">
            Build your vocabulary step by step across 8 comprehensive modules.
          </p>
        </div>

        {/* Curriculum overview banner */}
        <div className="bg-gradient-to-r from-primary-600 via-primary-500 to-accent-600 text-white p-6 sm:p-8 rounded-[32px] shadow-md space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider text-white">
                <Sparkles className="w-3.5 h-3.5" /> Comprehensive Curriculum
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold">Vocabulary Journey</h2>
              <p className="text-white/90 text-sm sm:text-base">
                {manifest.totalUniqueWords} Words · {manifest.totalActivities} Total Practice Activities
              </p>
            </div>

            {recommended && (
              <Button
                variant="primary"
                size="large"
                className="bg-white text-primary-700 hover:bg-primary-50 border-0 shadow-lg font-bold flex items-center gap-2 shrink-0"
                onClick={() =>
                  navigate(
                    `/session/${classId}/english/play?module=${recommended.module}&day=${recommended.day}&size=all`
                  )
                }
              >
                <Play className="w-5 h-5 fill-current" />
                <span>
                  {curriculumProgress?.wordsLearned === 0
                    ? `Start Learning: ${recommended.label}`
                    : `Continue: ${recommended.label}`}
                </span>
              </Button>
            )}
          </div>

          {/* Curriculum Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-2 border-t border-white/20">
            <div className="bg-white/15 backdrop-blur-sm p-4 rounded-2xl">
              <div className="text-xs uppercase font-semibold text-white/80">Words Learned</div>
              <div className="text-2xl sm:text-3xl font-bold mt-1">
                {curriculumProgress?.wordsLearned ?? 0}
                <span className="text-sm font-normal text-white/70"> / {manifest.totalUniqueWords}</span>
              </div>
              <div className="text-xs text-white/80 mt-1">New exposures completed</div>
            </div>

            <div className="bg-white/15 backdrop-blur-sm p-4 rounded-2xl">
              <div className="text-xs uppercase font-semibold text-white/80 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" /> Words Mastered
              </div>
              <div className="text-2xl sm:text-3xl font-bold mt-1 text-amber-200">
                {curriculumProgress?.wordsMastered ?? 0}
                <span className="text-sm font-normal text-white/70"> / {manifest.totalUniqueWords}</span>
              </div>
              <div className="text-xs text-white/80 mt-1">≥ 80% spaced review</div>
            </div>

            <div className="bg-white/15 backdrop-blur-sm p-4 rounded-2xl">
              <div className="text-xs uppercase font-semibold text-white/80">Reviews Completed</div>
              <div className="text-2xl sm:text-3xl font-bold mt-1">
                {curriculumProgress?.reviewsCompleted ?? 0}
                <span className="text-sm font-normal text-white/70"> / {manifest.totalReviewInstances}</span>
              </div>
              <div className="text-xs text-white/80 mt-1">Spaced reinforcement</div>
            </div>

            <div className="bg-white/15 backdrop-blur-sm p-4 rounded-2xl">
              <div className="text-xs uppercase font-semibold text-white/80">Modules Completed</div>
              <div className="text-2xl sm:text-3xl font-bold mt-1 text-emerald-200">
                {curriculumProgress?.modulesCompleted ?? 0}
                <span className="text-sm font-normal text-white/70"> / {manifest.moduleCount}</span>
              </div>
              <div className="text-xs text-white/80 mt-1">5 of 5 days required</div>
            </div>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          {manifest.modules.map((m) => {
            const modProg = moduleProgressMap[m.module];
            const completedDays = modProg?.completedDays ?? 0;
            const isCompleted = modProg?.isCompleted ?? false;
            const percent = modProg?.percent ?? 0;

            return (
              <Card
                key={m.module}
                interactive
                onClick={() => navigate(`/classes/${classId}/subjects/english/modules/${m.module}`)}
                className={`flex flex-col h-full hover:border-primary-400 group transition-all relative ${
                  isCompleted ? 'border-emerald-200 bg-emerald-50/20' : ''
                }`}
                aria-label={`Module ${m.module}: ${m.title}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`inline-flex items-center justify-center w-12 h-12 font-display font-bold text-xl rounded-2xl group-hover:scale-105 transition-transform ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-primary-100 text-primary-600'
                    }`}
                  >
                    {m.module}
                  </span>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Complete
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 bg-surface-raised rounded-full text-text-muted">
                      <Layers className="w-3.5 h-3.5" /> {completedDays} / 5 Days
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-text mb-2 group-hover:text-primary-600 transition-colors line-clamp-2">
                  {m.title}
                </h2>

                {/* Progress bar */}
                <div className="space-y-1.5 my-3">
                  <div className="flex justify-between text-xs font-semibold text-text-muted">
                    <span>Progress</span>
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

                <div className="mt-auto pt-4 border-t border-surface-highlight flex items-center justify-between text-sm">
                  <span className="font-semibold text-text-muted flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-primary-500" />
                    {m.newWordCount} words
                  </span>
                  <span className="font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full text-xs">
                    {m.totalActivities} activities
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </Page>
  );
}
