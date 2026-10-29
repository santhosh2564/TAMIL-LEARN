import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight, ArrowUpDown, Filter } from 'lucide-react';
import { StudentProgressSummary } from '../../../admin/types';
import { Button } from '../../../components/ui/Button';

interface StudentTableProps {
  students: StudentProgressSummary[];
}

type SortField =
  | 'studentName'
  | 'activitiesCompleted'
  | 'questionsCompleted'
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
      let valA: string | number = a[sortField];
      let valB: string | number = b[sortField];

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
            Real-time learning analytics, accuracy rates, and retry counts across all registered students.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="inline-flex rounded-xl p-1 bg-surface border border-surface-highlight text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
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
            className={`px-3 py-1.5 rounded-lg transition-colors ${
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
            className={`px-3 py-1.5 rounded-lg transition-colors ${
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

      {/* Table */}
      {filteredAndSortedStudents.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-surface text-text-muted">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-text">No students match your filter</h3>
          <p className="text-sm text-text-muted max-w-sm mx-auto">
            {searchTerm
              ? `No student profiles match "${searchTerm}". Try another search term.`
              : 'No students have been recorded under this category yet.'}
          </p>
          {(searchTerm || filterMode !== 'all') && (
            <Button
              variant="secondary"
              onClick={() => {
                setSearchTerm('');
                setFilterMode('all');
              }}
              className="text-xs py-1.5 px-3"
            >
              Clear filters
            </Button>
          )}
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
                  onClick={() => handleSort('activitiesCompleted')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Activities Completed
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('questionsCompleted')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Questions Completed
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('firstAttemptCorrectCount')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-center gap-1 text-emerald-700">
                    First-Attempt Correct
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('questionsRetriedCount')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-center gap-1 text-amber-700">
                    Questions Retried
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalRetriesCount')}
                  className="py-3.5 px-3 text-center cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-center gap-1 text-rose-700">
                    Total Retries
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('completionPercentage')}
                  className="py-3.5 px-4 text-center cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-center gap-1">
                    Completion %
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('lastActiveAt')}
                  className="py-3.5 px-4 text-right cursor-pointer hover:text-text select-none"
                >
                  <div className="flex items-center justify-end gap-1">
                    Last Active
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </div>
                </th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-highlight">
              {filteredAndSortedStudents.map((student) => {
                const formattedDate = student.lastActiveAt
                  ? new Date(student.lastActiveAt).toLocaleDateString(undefined, {
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
                      {student.activitiesCompleted}
                    </td>
                    <td className="py-4 px-3 text-center font-bold text-text">
                      {student.questionsCompleted}
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {student.firstAttemptCorrectCount}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                          student.questionsRetriedCount > 0
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-surface text-text-muted border-surface-highlight'
                        }`}
                      >
                        {student.questionsRetriedCount}
                      </span>
                    </td>
                    <td className="py-4 px-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                          student.totalRetriesCount > 0
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-surface text-text-muted border-surface-highlight'
                        }`}
                      >
                        {student.totalRetriesCount}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 bg-surface-highlight rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${student.completionPercentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-text min-w-[32px]">
                          {student.completionPercentage}%
                        </span>
                      </div>
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
