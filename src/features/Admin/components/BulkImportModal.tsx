import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, CheckCircle2, AlertCircle, X, FileSpreadsheet, RefreshCw, Building2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

interface SchoolRef {
  id: string;
  name: string;
  schoolCode: string;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schools: SchoolRef[];
  defaultSchoolId?: string;
}

interface ParsedStudentRow {
  rowNumber: number;
  name: string;
  rollNumber: string;
  schoolCode: string;
  schoolName: string;
  schoolId?: string;
  pin?: string;
  isValid: boolean;
  error?: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  schools,
  defaultSchoolId,
}) => {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    defaultSchoolId && defaultSchoolId !== 'all' ? defaultSchoolId : schools[0]?.id || ''
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedStudentRow[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'valid' | 'errors'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccessCount, setSubmitSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const activeSchool = schools.find((s) => s.id === selectedSchoolId) || schools[0];
    const defaultCode = activeSchool?.schoolCode || 'SCH001';

    const sampleData = [
      ['Student Name', 'Roll Number', 'School Code', 'PIN'],
      ['Kavitha S', '01', defaultCode, ''],
      ['Murugan R', '02', defaultCode, ''],
      ['Ananya P', '03', defaultCode, ''],
      ['Dinesh K', '04', defaultCode, ''],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'sara_students_import_template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSubmitError(null);
    setSubmitSuccessCount(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const wb = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = wb.SheetNames[0];
        const ws = wb.Sheets[firstSheetName];
        const rawJson: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

        if (rawJson.length === 0) {
          setSubmitError('The uploaded spreadsheet contains no data rows.');
          setRows([]);
          return;
        }

        const parsedRows: ParsedStudentRow[] = [];
        const seenRollInSchool = new Set<string>();

        rawJson.forEach((row, idx) => {
          const rowNumber = idx + 2; // account for header line

          // Flexible header mapping
          const name = String(row['Student Name'] || row['name'] || row['Name'] || row['student_name'] || '').trim();
          const rollNumber = String(row['Roll Number'] || row['rollNumber'] || row['roll_no'] || row['Roll'] || '').trim();
          const schoolCode = String(row['School Code'] || row['schoolCode'] || row['school'] || row['School'] || '').trim();
          const pinStr = String(row['PIN'] || row['pin'] || '').trim();

          let isValid = true;
          let error: string | undefined = undefined;

          if (!name) {
            isValid = false;
            error = 'Student name is required';
          }

          if (!rollNumber) {
            isValid = false;
            error = error ? `${error}; Roll number is required` : 'Roll number is required';
          }

          // Match school: first check selectedSchoolId from modal dropdown, then check schoolCode in row
          let matchedSchool: SchoolRef | undefined = undefined;
          if (selectedSchoolId) {
            matchedSchool = schools.find((s) => s.id === selectedSchoolId);
          }

          if (!matchedSchool && schoolCode) {
            matchedSchool = schools.find(
              (s) =>
                s.schoolCode.toLowerCase() === schoolCode.toLowerCase() ||
                s.id.toLowerCase() === schoolCode.toLowerCase() ||
                s.name.toLowerCase() === schoolCode.toLowerCase()
            );
          } else if (!matchedSchool && schools.length === 1) {
            matchedSchool = schools[0];
          }

          if (!matchedSchool) {
            isValid = false;
            error = schoolCode ? `School "${schoolCode}" not recognized` : 'Target school must be selected';
          }

          // Check duplicate roll numbers within school
          if (isValid && rollNumber && matchedSchool) {
            const rollKey = `${matchedSchool.id}:${rollNumber.toLowerCase()}`;
            if (seenRollInSchool.has(rollKey)) {
              isValid = false;
              error = `Duplicate roll number "${rollNumber}" in School "${matchedSchool.name}"`;
            } else {
              seenRollInSchool.add(rollKey);
            }
          }

          parsedRows.push({
            rowNumber,
            name,
            rollNumber,
            schoolCode: matchedSchool?.schoolCode || schoolCode,
            schoolName: matchedSchool?.name || 'Unassigned',
            schoolId: matchedSchool?.id,
            pin: pinStr || undefined,
            isValid,
            error,
          });
        });

        setRows(parsedRows);
      } catch (err: unknown) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to parse Excel file');
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const validRows = rows.filter((r) => r.isValid);
  const invalidRows = rows.filter((r) => !r.isValid);

  const displayedRows = rows.filter((r) => {
    if (filterMode === 'valid') return r.isValid;
    if (filterMode === 'errors') return !r.isValid;
    return true;
  });

  const handleSubmitImport = async () => {
    if (validRows.length === 0) {
      setSubmitError('No valid student rows to import.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccessCount(null);

    try {
      const payloadStudents = validRows.map((r) => ({
        name: r.name,
        rollNumber: r.rollNumber,
        schoolId: r.schoolId || selectedSchoolId,
        pin: r.pin ? r.pin.split('').slice(0, 3) : undefined,
      }));

      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          schoolId: selectedSchoolId || undefined,
          students: payloadStudents,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || 'Bulk import failed on server');
      }

      setSubmitSuccessCount(data.count ?? data.importedCount ?? validRows.length);
      onSuccess();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error importing students');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface-raised border border-surface-highlight rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-surface-highlight flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold text-text">Bulk Excel Import</h2>
              <p className="text-xs text-text-muted">Import student rosters directly under educational institutions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {/* Target School Selector & Instructions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-surface border border-surface-highlight space-y-2">
              <label className="block text-xs font-bold text-text-muted uppercase flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-primary-600" />
                <span>Target School (Optional if in sheet)</span>
              </label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full px-3.5 py-2 bg-surface-raised border border-surface-highlight rounded-xl text-sm font-semibold text-text focus:outline-hidden focus:ring-2 focus:ring-primary-500"
              >
                <option value="">-- Match from School Code column --</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.schoolCode})
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-muted">
                Selecting a school sets the default school for all uploaded rows.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-surface-highlight flex flex-col justify-between space-y-3">
              <div>
                <div className="font-bold text-text flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-primary-600" />
                  <span>Download Sample Template</span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Includes formatted headers: Student Name, Roll Number, School Code, PIN.
                </p>
              </div>
              <Button
                variant="secondary"
                size="normal"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-2 self-start"
              >
                <Download className="w-4 h-4" />
                <span>Download .XLSX Template</span>
              </Button>
            </div>
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-surface-highlight hover:border-primary-400 rounded-3xl p-6 text-center transition-colors">
            <input
              type="file"
              id="excel-file-input"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="excel-file-input"
              className="cursor-pointer flex flex-col items-center justify-center space-y-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div className="font-bold text-text text-base">
                {fileName ? fileName : 'Choose an Excel or CSV file to upload'}
              </div>
              <p className="text-xs text-text-muted">Supports .xlsx, .xls, and .csv files with student rosters</p>
            </label>
          </div>

          {submitError && (
            <div className="p-4 rounded-2xl bg-danger-50 border border-danger-200 text-danger-700 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {submitSuccessCount !== null && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Successfully imported {submitSuccessCount} students!</span>
            </div>
          )}

          {/* Preview Table */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="font-display font-bold text-base text-text flex items-center gap-2">
                  <span>Import Preview</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface border border-surface-highlight text-text-muted">
                    Total: {rows.length} | Valid: {validRows.length} | Errors: {invalidRows.length}
                  </span>
                </div>

                <div className="inline-flex rounded-xl p-1 bg-surface border border-surface-highlight text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setFilterMode('all')}
                    className={`px-3 py-1 rounded-lg cursor-pointer ${
                      filterMode === 'all' ? 'bg-surface-raised font-bold text-primary-700 shadow-xs' : 'text-text-muted'
                    }`}
                  >
                    All ({rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('valid')}
                    className={`px-3 py-1 rounded-lg cursor-pointer ${
                      filterMode === 'valid' ? 'bg-surface-raised font-bold text-emerald-700 shadow-xs' : 'text-text-muted'
                    }`}
                  >
                    Valid ({validRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('errors')}
                    className={`px-3 py-1 rounded-lg cursor-pointer ${
                      filterMode === 'errors' ? 'bg-surface-raised font-bold text-danger-700 shadow-xs' : 'text-text-muted'
                    }`}
                  >
                    Errors ({invalidRows.length})
                  </button>
                </div>
              </div>

              <div className="border border-surface-highlight rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface text-text-muted border-b border-surface-highlight font-semibold sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Roll Number</th>
                      <th className="py-2.5 px-3">School</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-highlight">
                    {displayedRows.map((r) => (
                      <tr key={r.rowNumber} className={r.isValid ? 'hover:bg-surface/50' : 'bg-danger-50/50'}>
                        <td className="py-2 px-3 text-text-muted font-mono">{r.rowNumber}</td>
                        <td className="py-2 px-3 font-bold text-text">{r.name || '—'}</td>
                        <td className="py-2 px-3 font-mono text-text">{r.rollNumber || '—'}</td>
                        <td className="py-2 px-3 text-text-muted">{r.schoolName}</td>
                        <td className="py-2 px-3">
                          {r.isValid ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Ready</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-danger-700 font-bold" title={r.error}>
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>{r.error}</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-surface-highlight flex items-center justify-end gap-3 bg-surface/50">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmitImport}
            disabled={isSubmitting || validRows.length === 0}
            className="inline-flex items-center gap-2"
          >
            {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>Import {validRows.length} Valid Students</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
