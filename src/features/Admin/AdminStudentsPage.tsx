import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Building2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  Edit2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';
import { BulkImportModal } from './components/BulkImportModal';

interface StudentRosterItem {
  id: string;
  name: string;
  studentName?: string;
  rollNumber: string;
  schoolId: string;
  schoolName: string;
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string;
}

interface SchoolRef {
  id: string;
  name: string;
  schoolCode: string;
}

export const AdminStudentsPage: React.FC = () => {
  // Reference data
  const [schools, setSchools] = useState<SchoolRef[]>([]);

  // Query / Filter state
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Data state
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [studentModalMode, setStudentModalMode] = useState<'create' | 'edit' | null>(null);
  const [activeStudent, setActiveStudent] = useState<StudentRosterItem | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formRollNo, setFormRollNo] = useState('');
  const [formSchoolId, setFormSchoolId] = useState('');
  const [formPin, setFormPin] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Load reference schools
  useEffect(() => {
    async function loadRefs() {
      try {
        const res = await fetch('/api/schools');
        if (res.ok) {
          const data = await res.json();
          setSchools(
            (data.schools || []).map((s: { id: string; name: string; school_name?: string; school_code?: string }) => ({
              id: s.id,
              name: s.school_name || s.name,
              schoolCode: s.school_code || s.id,
            }))
          );
        }
      } catch {
        // Fallback
      }
    }
    loadRefs();
  }, []);

  // 2. Fetch Paginated Students
  const fetchStudents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('paginated', 'true');

      if (selectedSchoolId !== 'all') params.set('schoolId', selectedSchoolId);
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const res = await fetch(`/api/students?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load students roster');

      const data = await res.json();
      setStudents(data.students || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching student roster');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, selectedSchoolId, searchTerm, statusFilter]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Reset page when filter changes
  const handleSchoolChange = (newSchool: string) => {
    setSelectedSchoolId(newSchool);
    setPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchTerm(val);
    setPage(1);
  };

  const handleStatusChange = (val: 'active' | 'archived' | 'all') => {
    setStatusFilter(val);
    setPage(1);
  };

  // Open Add Student Modal
  const openAddStudent = () => {
    setStudentModalMode('create');
    setActiveStudent(null);
    setFormName('');
    setFormRollNo('');
    const defaultSchool = selectedSchoolId !== 'all' ? selectedSchoolId : schools[0]?.id || '';
    setFormSchoolId(defaultSchool);
    setFormPin('');
    setFormIsActive(true);
    setFormError(null);
  };

  // Open Edit Student Modal
  const openEditStudent = (s: StudentRosterItem) => {
    setStudentModalMode('edit');
    setActiveStudent(s);
    setFormName(s.studentName || s.name);
    setFormRollNo(s.rollNumber || '');
    setFormSchoolId(s.schoolId);
    setFormPin('');
    setFormIsActive(s.isActive);
    setFormError(null);
  };

  // Save Student (Create or Update)
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Student name is required');
      return;
    }
    if (!formSchoolId) {
      setFormError('School assignment is required');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (studentModalMode === 'create') {
        const pinArray = formPin.trim() ? formPin.trim().split('').slice(0, 3) : undefined;
        const res = await fetch('/api/admin/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            schoolId: formSchoolId,
            name: formName.trim(),
            rollNumber: formRollNo.trim() || undefined,
            pin: pinArray,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create student');
        }
      } else if (studentModalMode === 'edit' && activeStudent) {
        const res = await fetch(`/api/students/${encodeURIComponent(activeStudent.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            name: formName.trim(),
            rollNumber: formRollNo.trim() || undefined,
            schoolId: formSchoolId,
            isActive: formIsActive,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update student');
        }
      }

      setStudentModalMode(null);
      await fetchStudents();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving student');
    } finally {
      setIsSaving(false);
    }
  };

  // Archive / Reactivate quick toggle
  const handleToggleArchive = async (student: StudentRosterItem) => {
    try {
      if (student.isActive) {
        if (!window.confirm(`Archive ${student.name}? Their question attempts and progress will be preserved.`)) {
          return;
        }
        await fetch(`/api/students/${encodeURIComponent(student.id)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
      } else {
        await fetch(`/api/students/${encodeURIComponent(student.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ isActive: true }),
        });
      }
      await fetchStudents();
    } catch {
      // Ignore
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-text tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-primary-600" />
            <span>Student Management</span>
          </h1>
          <p className="text-text-muted text-sm sm:text-base mt-1">
            Browse, search, edit, and bulk-import students across educational institutions.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button
            variant="secondary"
            onClick={fetchStudents}
            disabled={isLoading}
            className="text-sm py-2 px-3"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            variant="secondary"
            onClick={() => setIsBulkImportOpen(true)}
            className="inline-flex items-center gap-2 text-sm py-2 px-3.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Bulk Excel Import</span>
          </Button>

          <Button
            variant="primary"
            onClick={openAddStudent}
            className="inline-flex items-center gap-2 text-sm py-2 px-4 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Card */}
      <div className="bg-surface-raised border border-surface-highlight rounded-3xl p-6 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {/* Search by Name or Roll Number */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search by student name or roll #..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-surface-highlight rounded-xl text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* School Filter */}
          <div>
            <select
              value={selectedSchoolId}
              onChange={(e) => handleSchoolChange(e.target.value)}
              className="w-full px-3.5 py-2 bg-surface border border-surface-highlight rounded-xl text-sm font-semibold text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.schoolCode})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center">
            <div className="inline-flex rounded-xl p-1 bg-surface border border-surface-highlight text-xs font-semibold w-full justify-between">
              <button
                type="button"
                onClick={() => handleStatusChange('active')}
                className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-colors ${
                  statusFilter === 'active'
                    ? 'bg-surface-raised text-primary-700 font-bold shadow-xs'
                    : 'text-text-muted'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('archived')}
                className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-colors ${
                  statusFilter === 'archived'
                    ? 'bg-surface-raised text-primary-700 font-bold shadow-xs'
                    : 'text-text-muted'
                }`}
              >
                Archived
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange('all')}
                className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-surface-raised text-primary-700 font-bold shadow-xs'
                    : 'text-text-muted'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Students Directory Table */}
      <div className="bg-surface-raised border border-surface-highlight rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            Showing {students.length} of {total} students
          </span>
          <span>Page {page} of {totalPages}</span>
        </div>

        {isLoading ? (
          <div className="py-20 flex items-center justify-center">
            <LoadingState message="Loading student roster..." />
          </div>
        ) : (
          <div className="border border-surface-highlight rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-text-muted border-b border-surface-highlight text-xs font-semibold">
                <tr>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">School</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-highlight">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-text-muted text-sm">
                      No students found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  students.map((st) => (
                    <tr key={st.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          to={`/admin/students/${st.id}`}
                          className="font-bold text-text hover:text-primary-600 transition-colors flex items-center gap-1.5 group"
                        >
                          <span>{st.studentName || st.name}</span>
                          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary-600" />
                        </Link>
                        <div className="text-[11px] font-mono text-text-muted truncate max-w-xs">{st.id}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-text">
                        {st.rollNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-text">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-surface-highlight">
                          <Building2 className="w-3 h-3 text-text-muted" />
                          <span>{st.schoolName || 'Unassigned'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {st.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-danger-700 bg-danger-50 px-2 py-0.5 rounded-full border border-danger-200">
                            <XCircle className="w-3 h-3" />
                            <span>Archived</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditStudent(st)}
                            className="p-1.5 rounded-lg text-text-muted hover:text-primary-600 hover:bg-surface cursor-pointer transition-colors"
                            title="Edit Student"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(st)}
                            className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                              st.isActive
                                ? 'text-text-muted hover:text-danger-600 hover:bg-danger-50'
                                : 'text-text-muted hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={st.isActive ? 'Archive student' : 'Reactivate student'}
                          >
                            {st.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 bg-surface border border-surface-highlight rounded-lg text-xs font-semibold text-text"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="normal"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="px-2.5 py-1"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-xs font-semibold px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="secondary"
                size="normal"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="px-2.5 py-1"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Student Modal */}
      {studentModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-surface-raised border border-surface-highlight rounded-3xl w-full max-w-md p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-display font-extrabold text-text flex items-center gap-2">
                <Users className="w-5 h-5 text-primary-600" />
                <span>{studentModalMode === 'create' ? 'Add New Student' : 'Edit Student Details'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setStudentModalMode(null)}
                className="text-text-muted hover:text-text cursor-pointer p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  School *
                </label>
                <select
                  value={formSchoolId}
                  onChange={(e) => setFormSchoolId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2 bg-surface border border-surface-highlight rounded-xl text-sm font-semibold text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">-- Select School --</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.schoolCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Student Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kavitha Sundaram"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface border border-surface-highlight rounded-xl text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Roll Number or Identifier (Unique per School)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 01, R101, or S1001"
                  value={formRollNo}
                  onChange={(e) => setFormRollNo(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface border border-surface-highlight rounded-xl text-sm font-mono text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {studentModalMode === 'create' && (
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                    Optional PIN (3 digits)
                  </label>
                  <input
                    type="password"
                    maxLength={3}
                    placeholder="Optional 3-digit PIN"
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface border border-surface-highlight rounded-xl text-sm font-mono text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-[11px] text-text-muted mt-1">
                    Leave blank if this student logs in by tapping their name without a PIN.
                  </p>
                </div>
              )}

              {studentModalMode === 'edit' && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="studentActiveToggle"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="studentActiveToggle" className="text-sm font-semibold text-text cursor-pointer">
                    Active Student (uncheck to archive)
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-surface-highlight flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setStudentModalMode(null)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : studentModalMode === 'create' ? 'Add Student' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Excel Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportOpen}
        onClose={() => setIsBulkImportOpen(false)}
        onSuccess={() => {
          setIsBulkImportOpen(false);
          fetchStudents();
        }}
        schools={schools}
        defaultSchoolId={selectedSchoolId !== 'all' ? selectedSchoolId : undefined}
      />
    </div>
  );
};
