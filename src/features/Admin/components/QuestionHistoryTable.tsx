import { useState, useMemo } from 'react';
import { QuestionAttemptDetail } from '../../../admin/types';
import { Search, CheckCircle2, AlertTriangle, HelpCircle } from 'lucide-react';

interface QuestionHistoryTableProps {
  questions: QuestionAttemptDetail[];
}

export function QuestionHistoryTable({ questions }: QuestionHistoryTableProps) {
  const [filterStruggledOnly, setFilterStruggledOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredQuestions = useMemo(() => {
    let result = [...questions];

    if (filterStruggledOnly) {
      result = result.filter((q) => q.retries > 0 || !q.firstAttemptCorrect);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (item) =>
          item.questionId.toLowerCase().includes(q) ||
          item.activityTitle.toLowerCase().includes(q) ||
          item.categoryTitle.toLowerCase().includes(q) ||
          item.subject.toLowerCase().includes(q)
      );
    }

    return result;
  }, [questions, filterStruggledOnly, searchTerm]);

  return (
    <div className="bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg sm:text-xl font-display font-bold text-text">
            Question & Attempt History
          </h3>
          <p className="text-sm text-text-muted mt-0.5">
            Detailed log of all question submissions, attempts, retries, and mastery status.
          </p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-text select-none bg-surface px-3 py-1.5 rounded-xl border border-surface-highlight">
          <input
            type="checkbox"
            checked={filterStruggledOnly}
            onChange={(e) => setFilterStruggledOnly(e.target.checked)}
            className="w-4 h-4 text-primary-600 rounded border-surface-highlight focus:ring-primary-500"
          />
          <span className="text-amber-800">Show only questions with retries / struggles</span>
        </label>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter questions by ID or prompt..."
          className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-highlight bg-white text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {filteredQuestions.length === 0 ? (
        <div className="py-12 text-center text-text-muted space-y-2">
          <div className="inline-flex p-3 rounded-full bg-surface">
            <HelpCircle className="w-6 h-6 text-text-muted" />
          </div>
          <div className="font-semibold text-text">No question attempts found</div>
          <p className="text-xs">
            {filterStruggledOnly
              ? 'Great news! This student had zero retries or struggled questions in this selection.'
              : 'This student has not attempted any questions yet.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-surface-highlight bg-white">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface border-b border-surface-highlight text-text-muted font-bold text-xs uppercase tracking-wider">
                <th className="py-3 px-4">Question ID</th>
                <th className="py-3 px-4">Activity / Prompt</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-3 text-center">Attempts</th>
                <th className="py-3 px-3 text-center">Retries</th>
                <th className="py-3 px-3 text-center">First Attempt</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Last Attempt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-highlight">
              {filteredQuestions.map((q) => {
                const isStruggled = q.retries > 0;
                const formattedDate = q.lastAttemptAt
                  ? new Date(q.lastAttemptAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';

                return (
                  <tr
                    key={q.questionId}
                    className={`transition-colors ${
                      isStruggled ? 'bg-amber-50/30 hover:bg-amber-50/60' : 'hover:bg-primary-50/20'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-text">
                      <span className="px-2 py-0.5 rounded-lg bg-surface border border-surface-highlight text-xs">
                        {q.questionId}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-text max-w-xs truncate">
                      {q.activityTitle}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-text-muted">
                      {q.categoryTitle}
                    </td>
                    <td className="py-3.5 px-3 text-center font-bold text-text">
                      {q.attempts}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                          q.retries > 0
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-surface text-text-muted border-surface-highlight'
                        }`}
                      >
                        {q.retries}
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {q.attempts === 0 ? (
                        <span className="text-text-muted text-xs">—</span>
                      ) : q.firstAttemptCorrect ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> No
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-center">
                      {q.status === 'completed' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          Completed
                        </span>
                      ) : q.status === 'in-progress' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
                          In Progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface text-text-muted border border-surface-highlight">
                          Not Started
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-text-muted whitespace-nowrap">
                      {formattedDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
