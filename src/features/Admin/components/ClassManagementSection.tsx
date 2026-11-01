import React, { useState, useEffect } from 'react';
import { Plus, Check, Monitor, Users } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  grade: string;
  class_code: string;
}

export const ClassManagementSection: React.FC = () => {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [currentPcClassId, setCurrentPcClassId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New Class Form State
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('Class 3');
  const [isCreatingClass, setIsCreatingClass] = useState(false);

  // Add Student Form State
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentRollNo, setStudentRollNo] = useState('');
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentSuccess, setAddStudentSuccess] = useState(false);

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      setCurrentPcClassId(localStorage.getItem('sara_class_id'));
    }
  }, []);

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/classes');
      if (res.ok) {
        const data = await res.json();
        setClasses((data.classes || []).filter((c: ClassItem & { archived_at?: string | null }) => !c.archived_at));
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    setIsCreatingClass(true);
    try {
      const res = await fetch('/api/admin/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClassName.trim(),
          grade: newClassGrade,
        }),
      });
      if (res.ok) {
        setNewClassName('');
        setShowNewClassModal(false);
        fetchClasses();
      }
    } catch {
      // Ignore
    } finally {
      setIsCreatingClass(false);
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId || !studentName.trim()) {
      return;
    }

    setIsAddingStudent(true);
    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selectedClassId,
          name: studentName.trim(),
          rollNo: studentRollNo.trim() || undefined,
          avatar: 'avatar_default',
        }),
      });

      if (res.ok) {
        setStudentName('');
        setStudentRollNo('');
        setAddStudentSuccess(true);
        setTimeout(() => setAddStudentSuccess(false), 3000);
      }
    } catch {
      // Ignore
    } finally {
      setIsAddingStudent(false);
    }
  };

  const handleSetPcClass = (classId: string) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sara_class_id', classId);
      setCurrentPcClassId(classId);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">
            வகுப்புகள் & மாணவர்கள் / Classes & Students
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Create classes, add students to rosters, and set this computer's active class.
          </p>
        </div>

        <button
          onClick={() => setShowNewClassModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-bold rounded-2xl shadow-sm text-sm cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>புதிய வகுப்பு / New Class</span>
        </button>
      </div>

      {/* Classes List */}
      {isLoading ? (
        <div className="py-8 text-center text-gray-500 font-bold">வகுப்புகள் தயாராகின்றன...</div>
      ) : classes.length === 0 ? (
        <div className="py-8 text-center text-gray-400 font-medium bg-gray-50 rounded-2xl">
          வகுப்புகள் ஏதுமில்லை. புதிய வகுப்பை உருவாக்கவும். / No classes created yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => {
            const isThisPc = currentPcClassId === cls.id;
            return (
              <div
                key={cls.id}
                className={`border-2 rounded-2xl p-4 flex flex-col justify-between transition-colors ${
                  isThisPc ? 'border-primary-500 bg-primary-50/30' : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 bg-primary-100 text-primary-900 text-xs font-bold rounded-full border border-primary-200">
                      {cls.grade}
                    </span>
                    {isThisPc && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-primary-700 bg-primary-100/70 px-2 py-0.5 rounded-full border border-primary-300">
                        <Monitor className="w-3 h-3" />
                        <span>This PC</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-black text-gray-800">{cls.name}</h3>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                  <button
                    onClick={() => handleSetPcClass(cls.id)}
                    className={`flex items-center gap-1 px-3 py-1.5 font-bold text-xs rounded-xl cursor-pointer transition-colors ${
                      isThisPc
                        ? 'bg-primary-600 text-white'
                        : 'bg-surface-raised hover:bg-surface border border-surface-highlight text-text'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>{isThisPc ? 'Active on This PC' : 'Set as This PC'}</span>
                  </button>

                  <button
                    onClick={() => setSelectedClassId(cls.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-primary-600" />
                    <span>Add Student</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Class Modal */}
      {showNewClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border">
            <h3 className="text-xl font-black text-gray-800 mb-4">புதிய வகுப்பு / Create New Class</h3>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">
                  வகுப்பு பெயர் / Class Name (e.g. Class 3A)
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Class 3A"
                  className="w-full px-4 py-2 border rounded-xl font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">பிரிவு / Grade</label>
                <select
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl font-bold text-sm"
                >
                  <option value="Class 2">Class 2</option>
                  <option value="Class 3">Class 3</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewClassModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingClass}
                  className="px-5 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-xl cursor-pointer"
                >
                  {isCreatingClass ? 'Creating...' : 'Create Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {selectedClassId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border">
            <h3 className="text-xl font-black text-gray-800 mb-1">மாணவரைச் சேர்க்கவும் / Add Student</h3>
            <p className="text-xs text-gray-500 mb-4">
              Add a student to the selected class roster. No PIN required.
            </p>

            {addStudentSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-xl flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" />
                <span>மாணவர் சேர்க்கப்பட்டார்! / Student added to class!</span>
              </div>
            )}

            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">பெயர் / Name *</label>
                <input
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Kavitha"
                  className="w-full px-3 py-2 border rounded-xl font-bold text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">எண் / Roll No (Optional)</label>
                <input
                  type="text"
                  value={studentRollNo}
                  onChange={(e) => setStudentRollNo(e.target.value)}
                  placeholder="01"
                  className="w-full px-3 py-2 border rounded-xl font-bold text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedClassId(null)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isAddingStudent || !studentName.trim()}
                  className="px-5 py-2 text-sm font-bold bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-xl cursor-pointer"
                >
                  {isAddingStudent ? 'Adding...' : 'Add Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
