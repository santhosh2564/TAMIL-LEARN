import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Printer, ArrowLeft, AlertCircle } from 'lucide-react';
import { PICTURE_PIN_MAP } from '../../constants/picturePin';

interface ClassDetails {
  id: string;
  school_id: string;
  name: string;
  grade: string;
  class_code: string;
}

interface StudentCardItem {
  id: string;
  name: string;
  rollNo: string;
  avatar: string;
  isLocked: boolean;
  qrDataUrl?: string;
}

export const PrintClassCardsPage: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [cls, setCls] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<StudentCardItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCards = async () => {
      if (!classId) return;
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/classes/${classId}/cards`);
        if (!res.ok) {
          setError('வகுப்பு தகவல் பெற முடியவில்லை / Failed to load class details');
          return;
        }
        const data = await res.json();
        setCls(data.class);

        // Generate QR code locally using qrcode (no external service)
        const baseUrl = window.location.origin;
        const loginUrl = `${baseUrl}/c/${data.class.class_code}`;

        const qrDataUrl = await QRCode.toDataURL(loginUrl, {
          width: 256,
          margin: 1,
          color: {
            dark: '#1e293b',
            light: '#ffffff',
          },
        });

        const studentsWithQr = (data.students || []).map((s: StudentCardItem) => ({
          ...s,
          qrDataUrl,
        }));

        setStudents(studentsWithQr);
      } catch {
        setError('பிழை ஏற்பட்டது / Failed to generate login cards');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCards();
  }, [classId]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center font-bold text-gray-600">அட்டைகள் தயாராகின்றன... / Generating cards...</div>
      </div>
    );
  }

  if (error || !cls) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center text-red-600 font-bold flex flex-col items-center gap-2">
          <AlertCircle className="w-8 h-8" />
          <span>{error || 'Class not found'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white p-4 sm:p-6 md:p-8">
      {/* Non-print action header */}
      <div className="max-w-5xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate('/admin/dashboard')}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl hover:bg-gray-100 font-bold text-gray-700 text-sm shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>பின்செல் / Back</span>
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer"
        >
          <Printer className="w-5 h-5" />
          <span>அச்சிடுக / Print Cards</span>
        </button>
      </div>

      {/* Printable Cards Grid */}
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
          {students.map((student) => {
            return (
              <div
                key={student.id}
                className="bg-white border-2 border-dashed border-gray-400 rounded-2xl p-4 sm:p-5 flex flex-col justify-between break-inside-avoid shadow-sm print:shadow-none"
                style={{ pageBreakInside: 'avoid' }}
              >
                {/* Card Top: School & Class Name */}
                <div className="border-b pb-2 mb-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider">
                      Sara Learning Platform
                    </span>
                    <h3 className="text-base font-black text-gray-800 leading-tight">
                      {cls.name} ({cls.grade})
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-gray-500 uppercase font-bold block">Class Code</span>
                    <span className="font-mono font-black text-sm bg-gray-100 px-2 py-0.5 rounded border border-gray-300 text-gray-800">
                      {cls.class_code}
                    </span>
                  </div>
                </div>

                {/* Card Middle: Student details & QR code */}
                <div className="flex items-center justify-between gap-3 my-2">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center p-2 shadow-inner border border-amber-300">
                      <img src={PICTURE_PIN_MAP['sun']?.svg} alt="Avatar" className="w-9 h-9 object-contain" />
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 font-bold block">
                        எண் / Roll No: {student.rollNo}
                      </span>
                      <h4 className="text-lg font-black text-gray-900 leading-tight">
                        {student.name}
                      </h4>
                    </div>
                  </div>

                  {student.qrDataUrl && (
                    <div className="flex flex-col items-center">
                      <img
                        src={student.qrDataUrl}
                        alt="Class QR Code"
                        className="w-20 h-20 border border-gray-300 rounded-lg p-0.5 bg-white"
                      />
                      <span className="text-[8px] text-gray-500 font-mono mt-0.5">Scan to Login</span>
                    </div>
                  )}
                </div>

                {/* Card Bottom: PIN Instructions */}
                <div className="border-t pt-2 mt-2 bg-amber-50/60 rounded-xl p-2 text-center border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-900 block leading-tight">
                    ரகசியப் படம்: உங்கள் 3 படங்களைத் தொட்டு நுழையவும்
                  </span>
                  <span className="text-[9px] text-gray-600 block leading-tight">
                    PIN: Tap your 3 secret pictures to login
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

