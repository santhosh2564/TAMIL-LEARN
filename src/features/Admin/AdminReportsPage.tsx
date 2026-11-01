import React, { useState, useEffect } from 'react';
import { BarChart3, School, Users, FileText, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';

export const AdminReportsPage: React.FC = () => {
  const [metrics, setMetrics] = useState<{
    schoolsCount?: number;
    studentsCount?: number;
    sessionsCount?: number;
    totalAttempts?: number;
    accuracyPercentage?: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOverallReport = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/admin/reports/overall');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data.metrics || null);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverallReport();
  }, []);

  if (isLoading && !metrics) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingState message="Loading institutional assessment reports..." />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-text tracking-tight flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary-600" />
            <span>Institutional Assessment Reports</span>
          </h1>
          <p className="text-text-muted text-sm sm:text-base mt-1">
            Aggregated institutional accuracy, question-level attempt breakdown, and school-level analytics.
          </p>
        </div>

        <Button variant="secondary" onClick={fetchOverallReport} disabled={isLoading} className="text-sm py-2 px-3">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Reports</span>
        </Button>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-surface-raised border border-surface-highlight rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-3 text-text-muted text-xs font-bold uppercase">
              <School className="w-4 h-4 text-primary-600" />
              <span>Institutions</span>
            </div>
            <div className="text-3xl font-extrabold text-text mt-2">{metrics.schoolsCount ?? 0}</div>
            <div className="text-xs text-text-muted mt-1">Configured schools</div>
          </div>

          <div className="bg-surface-raised border border-surface-highlight rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-3 text-text-muted text-xs font-bold uppercase">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Registered Students</span>
            </div>
            <div className="text-3xl font-extrabold text-text mt-2">{metrics.studentsCount ?? 0}</div>
            <div className="text-xs text-text-muted mt-1">Across all schools</div>
          </div>

          <div className="bg-surface-raised border border-surface-highlight rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-3 text-text-muted text-xs font-bold uppercase">
              <FileText className="w-4 h-4 text-amber-600" />
              <span>Assessment Sessions</span>
            </div>
            <div className="text-3xl font-extrabold text-text mt-2">{metrics.sessionsCount ?? 0}</div>
            <div className="text-xs text-text-muted mt-1">Recorded sessions</div>
          </div>

          <div className="bg-surface-raised border border-surface-highlight rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-3 text-text-muted text-xs font-bold uppercase">
              <CheckCircle2 className="w-4 h-4 text-purple-600" />
              <span>Question Attempts</span>
            </div>
            <div className="text-3xl font-extrabold text-text mt-2">{metrics.totalAttempts ?? 0}</div>
            <div className="text-xs text-text-muted mt-1">{metrics.accuracyPercentage ?? 0}% overall accuracy</div>
          </div>
        </div>
      )}

      <div className="bg-surface-raised border border-surface-highlight rounded-3xl p-8 text-center space-y-3">
        <h3 className="text-xl font-bold text-text">Multi-Level Institutional Reporting</h3>
        <p className="text-sm text-text-muted max-w-xl mx-auto">
          Detailed school-by-school reports, student-level progress, question attempt breakdown, and Tamil and English learning telemetry.
        </p>
      </div>
    </div>
  );
};
