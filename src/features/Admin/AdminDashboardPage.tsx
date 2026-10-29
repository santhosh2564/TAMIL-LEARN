import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { AdminProgressService } from '../../admin/AdminProgressService';
import { AdminDashboardMetrics, StudentProgressSummary } from '../../admin/types';
import { SummaryCards } from './components/SummaryCards';
import { StudentTable } from './components/StudentTable';
import { LoadingState } from '../../components/ui/LoadingState';
import { Button } from '../../components/ui/Button';

export function AdminDashboardPage() {
  const service = useMemo(() => new AdminProgressService(), []);

  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [students, setStudents] = useState<StudentProgressSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [metricsData, studentsData] = await Promise.all([
        service.getDashboardMetrics(),
        service.getStudentSummaries(),
      ]);
      setMetrics(metricsData);
      setStudents(studentsData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load admin metrics');
    } finally {
      setIsLoading(false);
    }
  }, [service]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  if (isLoading && !metrics) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingState message="Loading administrative metrics and student rosters..." />
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="py-16 text-center space-y-4 bg-surface-raised border border-danger-200 rounded-3xl p-8 max-w-lg mx-auto">
        <AlertCircle className="w-12 h-12 text-danger-500 mx-auto" />
        <h2 className="text-xl font-bold text-text">Error Loading Dashboard</h2>
        <p className="text-sm text-text-muted">{error}</p>
        <Button variant="primary" onClick={loadDashboardData}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-text tracking-tight">
            Learning Progress Overview
          </h1>
          <p className="text-text-muted text-sm sm:text-base mt-1">
            Institutional metrics, question completion stats, first-attempt accuracy, and retry telemetry.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={loadDashboardData}
          disabled={isLoading}
          className="inline-flex items-center gap-2 text-sm py-2 px-4"
          aria-label="Refresh dashboard data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </Button>
      </div>

      {/* Summary Cards */}
      {metrics && <SummaryCards metrics={metrics} />}

      {/* Student Table */}
      <StudentTable students={students} />
    </div>
  );
}
