import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, ArrowUpDown, PlayCircle } from 'lucide-react';
import { StudentProgressSummary } from '../../../admin/types';

interface StudentTableProps {
  students: StudentProgressSummary[];
}

type SortField =
  | 'studentName'
  | 'activitiesCompleted'
  | 'questionsCompleted'
  | 'accuracy'
  | 'firstAttemptCorrectCount'
  | 'questionsRetriedCount'
  | 'totalRetriesCount'
  | 'completionPercentage'
  | 'lastActiveAt';

type FilterMode = 'all' | 'active' | 'retried';

export function StudentTable({ students }: StudentTableProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastActiveAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const filteredAndSortedStudents = useMemo(() => {
    let result = [...students];

    // Search filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.studentName.toLowerCase().includes(q) ||
          s.studentId.toLowerCase().includes(q)
      );
    }

    // Filter mode
    if (filterMode === 'active') {
      result = result.filter((s) => s.totalQuestionsAttempted > 0);
    } else if (filterMode === 'retried') {
      result = result.filter((s) => s.totalRetriesCount > 0);
    }

    // Sort
    result.sort((a, b) => {
      let valA: string | number = a[sortField] ?? 0;
      let valB: string | number = b[sortField] ?? 0;

      if (sortField === 'lastActiveAt') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });

    return result;
  }, [students, searchTerm, sortField, sortDirection, filterMode]);

  return (
    <div className="bg-surface-raised border border-surface-highlight rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-text">
            Student Progress Roster
          </h2>
          <p className="text-sm text-text-muted mt-1">
            Real-time learning analytics, accuracy rates, resume positions, and retry counts across registered students.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="inline-flex rounded-xl p-1 bg-surface border border-surface-highlight text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filterMode === 'all'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            All ({students.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('active')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filterMode === 'active'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            Active ({students.filter((s) => s.totalQuestionsAttempted > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('retried')}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              filterMode === 'retried'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-text-muted hover:text-text'
            }`}
          >
            With Retries ({students.filter((s) => s.totalRetriesCount > 0).length})
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by student name or ID..."
          className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-surface-highlight bg-white text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
        />
      </div>

      {/* Roster Table */}
      {filteredAndSortedStudents.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          No students match the current criteria.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-surface-highlight bg-white">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface border-b border-surface-highlight text-text-muted font-bold text-xs uppercase tracking-wider">
                <th
                  onClick={() => handleSort('studentName')}
                  className="py-3.5 px-4 cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center gap-1.5">
                    Student
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('questionsCompleted')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Done (Correct)
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('accuracy')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-center gap-1 text-primary-700">
                    Accuracy
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('firstAttemptCorrectCount')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-center gap-1 text-emerald-700">
                    1st Try Correct
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalRetriesCount')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-center gap-1 text-rose-700">
                    Retries
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-3 text-center">Resume Position</th>
                <th
                  onClick={() => handleSort('lastActiveAt')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    Last Practised
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-highlight">
              {filteredAndSortedStudents.map((student) => {
                const lastPractised = student.lastPractisedAt || student.lastActiveAt;
                const formattedDate = lastPractised
                  ? new Date(lastPractised).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '—';

                return (
                  <tr
                    key={student.studentId}
                    className="hover:bg-primary-50/40 transition-colors"
                  >
                    <td className="py-4 px-4 font-semibold text-text">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-sm shrink-0">
                          {student.studentName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-text truncate max-w-[180px]">
                            {student.studentName}
                          </div>
                          <div className="text-[11px] text-text-muted font-mono truncate max-w-[180px]">
                            {student.studentId}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-center font-bold text-text">
                      <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                        {student.questionsCompleted}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-center font-bold text-text">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                        student.accuracy >= 80
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : student.accuracy >= 50
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-surface text-text-muted'
                      }`}>
                        {student.accuracy}%
                      </span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {student.firstAttemptCorrectCount}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold border ${
                          student.totalRetriesCount > 0
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-surface text-text-muted border-surface-highlight'
                        }`}
                      >
                        {student.totalRetriesCount}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      {student.resumePosition ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-200">
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>{student.resumePosition}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right text-xs text-text-muted whitespace-nowrap">
                      {formattedDate}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => navigate(`/admin/students/${encodeURIComponent(student.studentId)}`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 font-bold text-xs hover:bg-primary-100 border border-primary-200 transition-colors cursor-pointer"
                        aria-label={`Details for ${student.studentName}`}
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
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
