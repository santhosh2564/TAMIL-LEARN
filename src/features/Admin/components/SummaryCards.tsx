import { Users, UserCheck, Award, HelpCircle, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { AdminDashboardMetrics } from '../../../admin/types';

interface SummaryCardsProps {
  metrics: AdminDashboardMetrics;
}

export function SummaryCards({ metrics }: SummaryCardsProps) {
  const cards = [
    {
      title: 'Total Students',
      value: metrics.totalStudents,
      description: 'Registered learning profiles',
      icon: Users,
      color: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    {
      title: 'Active Students',
      value: metrics.activeStudents,
      description: 'Learners with recorded activity',
      icon: UserCheck,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    {
      title: 'Total Activities Completed',
      value: metrics.totalActivitiesCompleted,
      description: 'Finished activity sessions',
      icon: Award,
      color: 'bg-purple-50 text-purple-600 border-purple-200',
    },
    {
      title: 'Total Questions Completed',
      value: metrics.totalQuestionsCompleted,
      description: 'Successfully answered questions',
      icon: CheckCircle2,
      color: 'bg-sky-50 text-sky-600 border-sky-200',
    },
    {
      title: 'First-Attempt Successes',
      value: metrics.firstAttemptSuccesses,
      description: 'Mastered on attempt 1 without retry',
      icon: HelpCircle,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    },
    {
      title: 'Questions Retried',
      value: metrics.questionsRetried,
      description: 'Questions requiring at least 1 retry',
      icon: AlertCircle,
      color: 'bg-amber-50 text-amber-600 border-amber-200',
    },
    {
      title: 'Total Retries',
      value: metrics.totalRetries,
      description: 'Sum of all retry attempts',
      icon: RotateCcw,
      color: 'bg-rose-50 text-rose-600 border-rose-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-surface-raised border border-surface-highlight rounded-2xl p-5 shadow-sm flex flex-col justify-between hover:border-primary-300 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-text-muted">{card.title}</span>
              <div className={`p-2.5 rounded-xl border ${card.color}`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-display font-extrabold text-text">
                {card.value.toLocaleString()}
              </div>
              <p className="text-xs text-text-muted mt-1">{card.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
