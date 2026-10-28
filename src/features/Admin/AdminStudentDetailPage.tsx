import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, AlertTriangle } from 'lucide-react';
import { AdminProgressService } from '../../admin/AdminProgressService';
import { StudentDetailedProgress } from '../../admin/types';
import { CategoryMasteryTable } from './components/CategoryMasteryTable';
import { QuestionHistoryTable } from './components/QuestionHistoryTable';
import { LoadingState } from '../../components/ui/LoadingState';
import { Button } from '../../components/ui/Button';

export function AdminStudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const service = useMemo(() => new AdminProgressService(), []);

  const [detail, setDetail] = useState<StudentDetailedProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStudentDetail = useCallback(async () => {
    if (!studentId) {
      setError('Student ID missing');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await service.getStudentDetail(studentId);
      if (!data) {
        setError(`Student with ID "${studentId}" was not found.`);
      } else {
        setDetail(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load student progress');
    } finally {
      setIsLoading(false);
    }
  }, [studentId, service]);

  useEffect(() => {
    loadStudentDetail();
  }, [loadStudentDetail]);

  if (isLoading) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingState message="Loading student learning profile and attempt history..." />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="py-16 text-center space-y-4 bg-surface-raised border border-danger-200 rounded-3xl p-8 max-w-lg mx-auto">
        <AlertTriangle className="w-12 h-12 text-danger-500 mx-auto" />
        <h2 className="text-xl font-bold text-text">Student Profile Not Found</h2>
        <p className="text-sm text-text-muted">{error || 'Unable to locate student records.'}</p>
        <Button variant="primary" onClick={() => navigate('/admin/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const formattedLastActive = detail.lastActiveAt
    ? new Date(detail.lastActiveAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never';

  const formattedCreated = detail.createdAt
    ? new Date(detail.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Navigation & Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Link
            to="/admin/dashboard"
            className="hover:text-primary-600 font-semibold transition-colors"
          >
            Dashboard
          </Link>
          <span>/</span>
          <span className="text-text font-bold truncate max-w-xs">{detail.studentName}</span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              className="p-2.5 rounded-2xl bg-surface-raised border border-surface-highlight hover:bg-surface text-text transition-colors cursor-pointer"
              aria-label="Back to admin dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-2xl sm:text-3xl font-display font-extrabold text-text">
                {detail.studentName}
              </h1>
              <div className="flex items-center gap-3 text-xs text-text-muted mt-1 font-mono">
                <span>ID: {detail.studentId}</span>
                <span>•</span>
                <span>Joined: {formattedCreated}</span>
              </div>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-surface-raised border border-surface-highlight text-xs text-text-muted">
            <Calendar className="w-4 h-4 text-primary-600" />
            <span>Last Active: <strong className="text-text font-semibold">{formattedLastActive}</strong></span>
          </div>
        </div>
      </div>

      {/* Student Overview Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-surface-raised border border-surface-highlight rounded-2xl p-4 shadow-sm text-center">
          <div className="text-xs font-semibold text-text-muted">Overall Completion</div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-primary-600 mt-2">
            {detail.summary.completionPercentage}%
          </div>
          <div className="w-full bg-surface-highlight rounded-full h-1.5 mt-3 overflow-hidden">
            <div
              className="bg-primary-600 h-1.5 rounded-full"
              style={{ width: `${detail.summary.completionPercentage}%` }}
            />
          </div>
        </div>

        <div className="bg-surface-raised border border-surface-highlight rounded-2xl p-4 shadow-sm text-center">
          <div className="text-xs font-semibold text-text-muted">Activities Done</div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-text mt-2">
            {detail.summary.activitiesCompleted}
          </div>
          <span className="text-[11px] text-text-muted mt-2 block">Completed sessions</span>
        </div>

        <div className="bg-surface-raised border border-surface-highlight rounded-2xl p-4 shadow-sm text-center">
          <div className="text-xs font-semibold text-text-muted">Questions Done</div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-text mt-2">
            {detail.summary.questionsCompleted}
          </div>
          <span className="text-[11px] text-text-muted mt-2 block">Answered correctly</span>
        </div>

        <div className="bg-surface-raised border border-surface-highlight rounded-2xl p-4 shadow-sm text-center">
          <div className="text-xs font-semibold text-emerald-700">First-Attempt Correct</div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-emerald-600 mt-2">
            {detail.summary.firstAttemptCorrectCount}
          </div>
          <span className="text-[11px] text-emerald-700/80 mt-2 block">Zero retry accuracy</span>
        </div>

        <div className="bg-surface-raised border border-surface-highlight rounded-2xl p-4 shadow-sm text-center">
          <div className="text-xs font-semibold text-amber-700">Questions Retried</div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-amber-600 mt-2">
            {detail.summary.questionsRetriedCount}
          </div>
          <span className="text-[11px] text-amber-700/80 mt-2 block">Struggled questions</span>
        </div>

        <div className="bg-surface-raised border border-surface-highlight rounded-2xl p-4 shadow-sm text-center">
          <div className="text-xs font-semibold text-rose-700">Total Retries</div>
          <div className="text-2xl sm:text-3xl font-display font-extrabold text-rose-600 mt-2">
            {detail.summary.totalRetriesCount}
          </div>
          <span className="text-[11px] text-rose-700/80 mt-2 block">Total extra attempts</span>
        </div>
      </div>

      {/* Category Mastery Table */}
      <CategoryMasteryTable categories={detail.categoryMastery} />

      {/* Question & Attempt Log */}
      <QuestionHistoryTable questions={detail.questions} />
    </div>
  );
}
