import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { School, Plus, Search, Edit2, Archive, CheckCircle2, RefreshCw, AlertCircle, Building2, Users } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { LoadingState } from '../../components/ui/LoadingState';

interface SchoolData {
  id: string;
  name: string;
  school_name?: string;
  school_code?: string;
  address?: string | null;
  academic_year?: string;
  is_active?: boolean;
  student_count?: number;
  created_at: string;
}

export const AdminSchoolsPage: React.FC = () => {
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('active');

  // Modal State: Create or Edit
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [selectedSchool, setSelectedSchool] = useState<SchoolData | null>(null);
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formAcademicYear, setFormAcademicYear] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchSchools = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/schools');
      if (!res.ok) throw new Error('Failed to fetch schools');
      const data = await res.json();
      setSchools(data.schools || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error loading schools');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedSchool(null);
    setFormName('');
    const currentYear = new Date().getFullYear();
    setFormAcademicYear(`${currentYear}-${currentYear + 1}`);
    setFormCode(`SCH${Math.floor(100 + Math.random() * 900)}`);
    setFormAddress('');
    setFormIsActive(true);
    setFormError(null);
  };

  const openEditModal = (school: SchoolData) => {
    setModalMode('edit');
    setSelectedSchool(school);
    setFormName(school.school_name || school.name);
    setFormCode(school.school_code || school.id);
    setFormAddress(school.address || '');
    setFormAcademicYear(school.academic_year || '2026-2027');
    setFormIsActive(school.is_active !== false);
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('School name is required');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (modalMode === 'create') {
        const res = await fetch('/api/schools', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            name: formName.trim(),
            schoolName: formName.trim(),
            schoolCode: formCode.trim() || undefined,
            address: formAddress.trim() || undefined,
            academicYear: formAcademicYear.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create school');
        }
      } else if (modalMode === 'edit' && selectedSchool) {
        const res = await fetch(`/api/schools/${encodeURIComponent(selectedSchool.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            name: formName.trim(),
            schoolName: formName.trim(),
            schoolCode: formCode.trim() || undefined,
            address: formAddress.trim() || undefined,
            academicYear: formAcademicYear.trim() || undefined,
            isActive: formIsActive,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to update school');
        }
      }

      setModalMode(null);
      await fetchSchools();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving school');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSchools = useMemo(() => {
    return schools.filter((s) => {
      const name = (s.school_name || s.name || '').toLowerCase();
      const code = (s.school_code || s.id || '').toLowerCase();
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || name.includes(q) || code.includes(q);

      const isActive = s.is_active !== false;
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? isActive
          : !isActive;

      return matchesSearch && matchesStatus;
    });
  }, [schools, searchTerm, statusFilter]);

  if (isLoading && schools.length === 0) {
    return (
      <div className="py-24 flex items-center justify-center">
        <LoadingState message="Loading institutional schools and statistics..." />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header & New School button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-text tracking-tight flex items-center gap-3">
            <School className="w-8 h-8 text-primary-600" />
            <span>School Management</span>
          </h1>
          <p className="text-text-muted text-sm sm:text-base mt-1">
            Manage educational institutions, unique school codes, academic years, and enrollment capacity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={fetchSchools} disabled={isLoading} className="text-sm py-2 px-3">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button variant="primary" onClick={openCreateModal} className="inline-flex items-center gap-2 text-sm py-2 px-4">
            <Plus className="w-4 h-4" />
            <span>Add School</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-surface-raised border border-surface-highlight rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="relative flex-1 w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="Search by school name or school code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface border border-surface-highlight rounded-xl text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="inline-flex rounded-xl p-1 bg-surface border border-surface-highlight text-xs font-semibold">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'active' ? 'bg-surface-raised text-primary-700 font-bold shadow-xs' : 'text-text-muted'
              }`}
            >
              Active Schools
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'archived' ? 'bg-surface-raised text-primary-700 font-bold shadow-xs' : 'text-text-muted'
              }`}
            >
              Archived
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg cursor-pointer transition-colors ${
                statusFilter === 'all' ? 'bg-surface-raised text-primary-700 font-bold shadow-xs' : 'text-text-muted'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Schools Table */}
        <div className="border border-surface-highlight rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-text-muted border-b border-surface-highlight text-xs font-semibold">
              <tr>
                <th className="py-3 px-4">School Name</th>
                <th className="py-3 px-4">School Code</th>
                <th className="py-3 px-4">Academic Year</th>
                <th className="py-3 px-4 text-center">Students</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-highlight">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-text-muted text-sm">
                    No schools match the current criteria.
                  </td>
                </tr>
              ) : (
                filteredSchools.map((s) => {
                  const isActive = s.is_active !== false;
                  return (
                    <tr key={s.id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-text flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary-600 shrink-0" />
                          <span>{s.school_name || s.name}</span>
                        </div>
                        {s.address && (
                          <div className="text-xs text-text-muted truncate max-w-xs mt-0.5">{s.address}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-text">
                        {s.school_code || s.id}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold text-text">
                        <span className="px-2 py-0.5 rounded-md bg-surface border border-surface-highlight">
                          {s.academic_year || '2026-2027'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-text bg-surface px-2 py-0.5 rounded-full border border-surface-highlight">
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          {s.student_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-text-muted bg-surface px-2 py-0.5 rounded-full border border-surface-highlight">
                            <Archive className="w-3 h-3" />
                            Archived
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="secondary"
                          onClick={() => openEditModal(s)}
                          className="text-xs py-1 px-2.5 inline-flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit School Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface-raised border border-surface-highlight rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6">
            <h3 className="text-xl font-bold text-text flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-600" />
              <span>{modalMode === 'create' ? 'Register New School' : 'Edit School Information'}</span>
            </h3>

            {formError && (
              <div className="p-3 rounded-xl bg-danger-50 border border-danger-200 text-danger-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  School Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Government Primary School, Madurai"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface border border-surface-highlight rounded-xl text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                    School Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GPS01"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface border border-surface-highlight rounded-xl text-sm font-mono text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                    Academic Year *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="2026-2027"
                    value={formAcademicYear}
                    onChange={(e) => setFormAcademicYear(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface border border-surface-highlight rounded-xl text-sm font-mono text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-muted uppercase mb-1">
                  Address / Location (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. West Main St, Madurai District"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface border border-surface-highlight rounded-xl text-sm text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {modalMode === 'edit' && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActiveToggle"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="isActiveToggle" className="text-sm font-semibold text-text cursor-pointer">
                    Active School (uncheck to archive)
                  </label>
                </div>
              )}

              <div className="pt-4 border-t border-surface-highlight flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setModalMode(null)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={isSaving}>
                  {isSaving ? 'Saving...' : modalMode === 'create' ? 'Create School' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
