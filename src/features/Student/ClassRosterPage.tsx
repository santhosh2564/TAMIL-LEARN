import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { PicturePinModal } from './components/PicturePinModal';

interface ClassData {
  id: string;
  name: string;
  grade: string;
  classCode: string;
}

interface StudentRosterItem {
  id: string;
  name: string;
  avatar: string;
}

export const ClassRosterPage: React.FC = () => {
  const { classCode } = useParams<{ classCode: string }>();
  const navigate = useNavigate();

  const [classInfo, setClassInfo] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentRosterItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRosterItem | null>(null);

  const fetchRoster = useCallback(async () => {
    if (!classCode) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/classes/by-code/${encodeURIComponent(classCode.trim())}`);
      if (res.status === 429) {
        setError('அதிக கோரிக்கைகள். சிறிது நேரம் காத்திருக்கவும் / Too many requests. Please wait.');
        return;
      }
      if (!res.ok) {
        setError('வகுப்பு காணப்படவில்லை / Class not found.');
        return;
      }
      const data = await res.json();
      setClassInfo(data.class);
      setStudents(data.students || []);
    } catch {
      setError('இணைப்பு பிழை. மீண்டும் முயற்சிக்கவும் / Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [classCode]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const handleStudentSelect = (student: StudentRosterItem) => {
    setSelectedStudent(student);
  };

  const handleLoginSuccess = () => {
    setSelectedStudent(null);
    navigate('/subjects');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-amber-50/50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-amber-400 border-t-amber-600 rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold text-gray-700">வகுப்பு திறக்கிறது... / Loading class...</h2>
      </div>
    );
  }

  if (error || !classInfo) {
    return (
      <div className="min-h-screen bg-amber-50/50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-6 text-center border-2 border-red-200">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-black text-gray-800 mb-2">{error || 'வகுப்பு காணப்படவில்லை'}</h2>
          <p className="text-sm text-gray-500 mb-6">Class code: {classCode?.toUpperCase()}</p>
          <button
            onClick={fetchRoster}
            className="flex items-center justify-center gap-2 w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer"
          >
            <RefreshCw className="w-5 h-5" />
            <span>மீண்டும் முயற்சிக்கவும் / Retry</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/30 to-amber-100/50 p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Class Banner Header */}
        <header className="bg-white rounded-3xl shadow-sm border border-amber-200/70 p-4 sm:p-6 mb-6 sm:mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl shadow-md">
              🏫
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-gray-800">{classInfo.name}</h1>
                <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-300">
                  {classInfo.grade}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 font-medium">Sara Tamil & English Learning</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-200">
            <span className="text-xs text-gray-500 font-medium">வகுப்புக் குறியீடு / Code:</span>
            <span className="font-mono font-black text-lg text-amber-900 tracking-wider">
              {classInfo.classCode}
            </span>
          </div>
        </header>

        {/* Title & Instruction */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-200/60 rounded-full text-amber-900 font-bold text-sm mb-2">
            <Sparkles className="w-4 h-4 text-amber-700" />
            <span>மாணவர் தேர்வு / Student Selection</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-800">
            உங்கள் பெயரைத் தொடவும்!
          </h2>
          <p className="text-base sm:text-lg text-gray-600 mt-1">Tap your name to start learning</p>
        </div>

        {/* Students Avatar Grid */}
        {students.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center text-gray-500 max-w-md mx-auto shadow-sm">
            மாணவர்கள் யாரும் சேர்க்கப்படவில்லை / No students in this class yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
            {students.map((student) => {
              const avatarEmoji =
                student.avatar === 'avatar_sun' ? '☀️' : student.avatar === 'avatar_star' ? '⭐' : '🎒';
              return (
                <button
                  key={student.id}
                  onClick={() => handleStudentSelect(student)}
                  className="group bg-white hover:bg-amber-50/70 border-2 border-amber-200/80 hover:border-amber-400 active:scale-95 rounded-3xl p-3 sm:p-4 flex flex-col items-center justify-center transition-all shadow-sm hover:shadow-md cursor-pointer outline-none focus:ring-4 focus:ring-amber-300"
                  aria-label={`Student ${student.name}`}
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 group-hover:from-amber-200 group-hover:to-orange-200 flex items-center justify-center text-3xl sm:text-4xl shadow-inner mb-2.5 transition-transform group-hover:scale-105">
                    {avatarEmoji}
                  </div>
                  <span className="font-black text-gray-800 text-sm sm:text-base text-center leading-tight truncate w-full">
                    {student.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Picture PIN Modal */}
      {selectedStudent && (
        <PicturePinModal
          student={selectedStudent}
          classCode={classInfo.classCode}
          onSuccess={handleLoginSuccess}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
};
