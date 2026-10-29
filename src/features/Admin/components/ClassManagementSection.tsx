import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Printer, ExternalLink, Check } from 'lucide-react';
import { PICTURE_PIN_ITEMS, PicturePinItem } from '../../../constants/picturePin';

interface ClassItem {
  id: string;
  name: string;
  grade: string;
  class_code: string;
}

export const ClassManagementSection: React.FC = () => {
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Class Form State
  const [showNewClassModal, setShowNewClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('Class 2');
  const [isCreatingClass, setIsCreatingClass] = useState(false);

  // Add Student Form State
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentRollNo, setStudentRollNo] = useState('');
  const [studentAvatar, setStudentAvatar] = useState('avatar_sun');
  const [selectedPin, setSelectedPin] = useState<PicturePinItem[]>([]);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [addStudentSuccess, setAddStudentSuccess] = useState(false);

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/classes');
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes || []);
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
    if (!selectedClassId || !studentName.trim() || !studentRollNo.trim() || selectedPin.length !== 3) {
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
          rollNo: studentRollNo.trim(),
          avatar: studentAvatar,
          pin: selectedPin.map((p) => p.id),
        }),
      });

      if (res.ok) {
        setStudentName('');
        setStudentRollNo('');
        setSelectedPin([]);
        setAddStudentSuccess(true);
        setTimeout(() => setAddStudentSuccess(false), 3000);
      }
    } catch {
      // Ignore
    } finally {
      setIsAddingStudent(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-200">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900">
            வகுப்புகள் & அட்டைகள் / Classes & Login Cards
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage classes, student picture PINs, and print student login cards with QR codes.
          </p>
        </div>

        <button
          onClick={() => setShowNewClassModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold rounded-2xl shadow-sm text-sm cursor-pointer transition-all"
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
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="border-2 border-gray-200 rounded-2xl p-4 flex flex-col justify-between hover:border-amber-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 text-xs font-bold rounded-full border border-amber-200">
                    {cls.grade}
                  </span>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block">Class Code</span>
                    <span className="font-mono font-black text-sm bg-gray-100 px-2 py-0.5 rounded text-gray-800 border">
                      {cls.class_code}
                    </span>
                  </div>
                </div>
                <h3 className="text-lg font-black text-gray-800">{cls.name}</h3>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                <a
                  href={`/c/${cls.class_code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs font-bold text-amber-700 hover:text-amber-800"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Student View</span>
                </a>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedClassId(cls.id)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Student</span>
                  </button>

                  <button
                    onClick={() => navigate(`/admin/classes/${cls.id}/print`)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Cards</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
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
                  வகுப்பு பெயர் / Class Name (e.g. 2A, 3B)
                </label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Class 2A"
                  className="w-full px-4 py-2 border rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">பிரிவு / Grade</label>
                <select
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                  className="w-full px-4 py-2 border rounded-xl font-bold"
                >
                  <option value="Class 2">Class 2</option>
                  <option value="Class 3">Class 3</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewClassModal(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingClass}
                  className="px-5 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl"
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
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border">
            <h3 className="text-xl font-black text-gray-800 mb-1">மாணவரைச் சேர்க்கவும் / Add Student</h3>
            <p className="text-xs text-gray-500 mb-4">
              Assign avatar and 3-picture PIN for desktop login.
            </p>

            {addStudentSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 text-emerald-800 text-sm font-bold rounded-xl flex items-center gap-2">
                <Check className="w-5 h-5 text-emerald-600" />
                <span>மாணவர் வெற்றிகரமாக சேர்க்கப்பட்டார்! / Student added!</span>
              </div>
            )}

            <form onSubmit={handleAddStudent} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">பெயர் / Name</label>
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
                  <label className="block text-xs font-bold text-gray-600 mb-1">எண் / Roll No</label>
                  <input
                    type="text"
                    required
                    value={studentRollNo}
                    onChange={(e) => setStudentRollNo(e.target.value)}
                    placeholder="01"
                    className="w-full px-3 py-2 border rounded-xl font-bold text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Avatar</label>
                <div className="flex items-center gap-3">
                  {['avatar_sun', 'avatar_star'].map((av) => (
                    <button
                      key={av}
                      type="button"
                      onClick={() => setStudentAvatar(av)}
                      className={`px-3 py-2 rounded-xl border-2 flex items-center gap-2 text-sm font-bold ${
                        studentAvatar === av ? 'border-amber-500 bg-amber-50' : 'border-gray-200'
                      }`}
                    >
                      <span>{av === 'avatar_sun' ? '☀️ Sun' : '⭐ Star'}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 3-Picture PIN Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-gray-600">
                    ரகசியப் படங்கள் / 3-Picture PIN (Select 3)
                  </label>
                  {selectedPin.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedPin([])}
                      className="text-[10px] text-red-600 font-bold hover:underline"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 mb-2 p-2 bg-gray-50 rounded-xl border border-dashed">
                  {[0, 1, 2].map((idx) => {
                    const pick = selectedPin[idx];
                    return (
                      <div
                        key={idx}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center border text-lg ${
                          pick ? 'bg-amber-100 border-amber-400 p-1' : 'bg-white border-gray-200 text-xs text-gray-400'
                        }`}
                      >
                        {pick ? <img src={pick.svg} alt={pick.labelTa} className="w-6 h-6 object-contain" /> : idx + 1}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {PICTURE_PIN_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      disabled={selectedPin.length >= 3 && !selectedPin.some((p) => p.id === item.id)}
                      onClick={() => {
                        if (selectedPin.length < 3) {
                          setSelectedPin([...selectedPin, item]);
                        }
                      }}
                      className="p-1.5 bg-gray-50 hover:bg-amber-50 border rounded-xl flex items-center gap-1.5 text-xs font-bold"
                    >
                      <img src={item.svg} alt={item.labelTa} className="w-5 h-5 object-contain" />
                      <span className="truncate">{item.labelTa}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedClassId(null)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl"
                >
                  Done
                </button>
                <button
                  type="submit"
                  disabled={isAddingStudent || selectedPin.length !== 3}
                  className="px-5 py-2 text-sm font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl"
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
