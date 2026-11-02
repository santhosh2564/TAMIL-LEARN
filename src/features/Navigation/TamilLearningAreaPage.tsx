import { useState, useEffect } from 'react';
import { Page } from '../../components/ui/Page';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { ErrorState } from '../../components/ui/ErrorState';
import { LocalContentRepository } from '../../repositories/implementations/LocalContentRepository';
import { TamilCurriculumManifest } from '../../types';
import { TamilProgressService, TamilCurriculumProgress, TamilModuleProgress } from '../../progress';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Layers, Sparkles, CheckCircle, Play } from 'lucide-react';
import { useStudent } from '../../student';

export function TamilLearningAreaPage() {
  const { classId = '3' } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { activeStudent } = useStudent();

  const [manifest, setManifest] = useState<TamilCurriculumManifest | null>(null);
  const [curriculumProgress, setCurriculumProgress] = useState<TamilCurriculumProgress | null>(null);
  const [moduleProgressMap, setModuleProgressMap] = useState<Record<number, TamilModuleProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      try {
        const repo = new LocalContentRepository();
        const data = await repo.getTamilCurriculumManifest();
        setManifest(data);

        const progressService = new TamilProgressService(undefined, repo);
        const [currProg, allMods] = await Promise.all([
          progressService.getCurriculumProgress(activeStudent?.id),
          progressService.getAllModulesProgress(activeStudent?.id),
        ]);

        setCurriculumProgress(currProg);
        const modMap: Record<number, TamilModuleProgress> = {};
        for (const m of allMods) {
          modMap[m.module] = m;
        }
        setModuleProgressMap(modMap);
      } catch {
        setError('தமிழ் பாடத்திட்டத்தை ஏற்றுவதில் சிக்கல் ஏற்பட்டது.');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [classId, activeStudent?.id]);

  if (isLoading) {
    return (
      <Page>
        <LoadingState message="தமிழ் தொகுதிகள் ஏற்றப்படுகின்றன..." />
      </Page>
    );
  }

  if (error || !manifest) {
    return (
      <Page>
        <ErrorState
          message={error || 'தமிழ் தொகுதிகள் கிடைக்கவில்லை.'}
          onRetry={() => window.location.reload()}
        />
      </Page>
    );
  }

  const recommended = curriculumProgress?.recommendedSession;

  return (
    <Page>
      <div className="space-y-8 max-w-6xl mx-auto pb-12 animate-in fade-in duration-200">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/classes/${classId}/subjects`)}
            className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-2 font-medium cursor-pointer"
            aria-label="Back to Subjects"
          >
            <ArrowLeft className="w-6 h-6" />
            <span className="text-sm font-bold text-text-muted">பாடங்கள் / Subjects</span>
          </button>

          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold border border-emerald-200">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>வகுப்பு {classId} · தமிழ் பயிற்சித் தொகுதிகள்</span>
          </div>
        </div>

        <div className="text-center space-y-3">
          <h1 className="text-4xl md:text-5xl font-display font-extrabold text-text tracking-tight">
            தமிழ் தொகுதிகள் (Tamil Modules)
          </h1>
          <p className="text-lg md:text-xl text-text-muted max-w-2xl mx-auto">
            8 தொகுதிகள், 40 கற்றல் நாள்கள் மூலம் தமிழ்ச் சொற்களையும் இலக்கணப் பயிற்சிகளையும் படிப்படியாகக் கற்கவும்.
          </p>
        </div>

        {/* Curriculum overview banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white p-6 sm:p-8 rounded-[32px] shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold uppercase tracking-wider text-white">
                <Sparkles className="w-3.5 h-3.5" /> 8 Modules · 40 Days
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold">முழுமையான தமிழ்ப் பயிற்சிப் பயணம்</h2>
              <p className="text-white/90 text-sm sm:text-base">
                மொத்தம் {manifest.activityCount} பயிற்சிகள் · 8 தொகுதிகள் · 40 கற்றல் நாள்கள்
              </p>
            </div>

            {recommended && (
              <Button
                variant="primary"
                size="large"
                className="bg-white text-emerald-800 hover:bg-emerald-50 border-0 shadow-lg font-bold flex items-center gap-2 shrink-0 cursor-pointer"
                onClick={() =>
                  navigate(
                    `/session/${classId}/tamil/play?module=${recommended.module}&day=${recommended.day}&size=all`
                  )
                }
              >
                <Play className="w-5 h-5 fill-current" />
                <span>
                  {curriculumProgress?.completedActivities === 0
                    ? `தொடங்கு: ${recommended.label}`
                    : `தொடரவும்: ${recommended.label}`}
                </span>
              </Button>
            )}
          </div>

          {/* Curriculum Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 pt-2 border-t border-white/20">
            <div className="bg-white/15 backdrop-blur-sm p-4 rounded-2xl">
              <div className="text-xs uppercase font-semibold text-white/80">முடிந்த பயிற்சிகள்</div>
              <div className="text-2xl sm:text-3xl font-bold mt-1">
                {curriculumProgress?.completedActivities ?? 0}
                <span className="text-sm font-normal text-white/70"> / {manifest.activityCount}</span>
              </div>
              <div className="text-xs text-white/80 mt-1">Completed Activities</div>
            </div>

            <div className="bg-white/15 backdrop-blur-sm p-4 rounded-2xl">
              <div className="text-xs uppercase font-semibold text-white/80">முடிந்த தொகுதிகள்</div>
              <div className="text-2xl sm:text-3xl font-bold mt-1 text-emerald-200">
                {curriculumProgress?.modulesCompleted ?? 0}
                <span className="text-sm font-normal text-white/70"> / {manifest.moduleCount}</span>
              </div>
              <div className="text-xs text-white/80 mt-1">Completed Modules</div>
            </div>

            <div className="bg-white/15 backdrop-blur-sm p-4 rounded-2xl col-span-2 sm:col-span-1">
              <div className="text-xs uppercase font-semibold text-white/80">கற்றல் முன்னேற்றம்</div>
              <div className="text-2xl sm:text-3xl font-bold mt-1 text-cyan-200">
                {curriculumProgress?.percent ?? 0}%
              </div>
              <div className="text-xs text-white/80 mt-1">Overall Progress</div>
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
                onClick={() => navigate(`/classes/${classId}/subjects/tamil/modules/${m.module}`)}
                className={`flex flex-col h-full hover:border-emerald-400 group transition-all relative cursor-pointer ${
                  isCompleted ? 'border-emerald-300 bg-emerald-50/20' : ''
                }`}
                aria-label={`Module ${m.module}: ${m.title}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span
                    className={`inline-flex items-center justify-center w-12 h-12 font-display font-bold text-xl rounded-2xl group-hover:scale-105 transition-transform ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-emerald-50 text-emerald-600'
                    }`}
                  >
                    {m.module}
                  </span>
                  {isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> நிறைவு
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 bg-surface-raised rounded-full text-text-muted">
                      <Layers className="w-3.5 h-3.5" /> {completedDays} / 5 நாள்கள்
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold text-text mb-2 group-hover:text-emerald-600 transition-colors line-clamp-2">
                  {m.title}
                </h2>

                {/* Progress bar */}
                <div className="space-y-1.5 my-3">
                  <div className="flex justify-between text-xs font-semibold text-text-muted">
                    <span>முன்னேற்றம் (Progress)</span>
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

                <div className="mt-auto pt-4 border-t border-surface-highlight flex items-center justify-between text-sm">
                  <span className="font-semibold text-text-muted flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    5 நாள்கள் (Days)
                  </span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full text-xs">
                    {m.totalActivities} பயிற்சிகள்
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
