import React, { useState } from 'react';
import { Delete, X, Lock } from 'lucide-react';
import { PICTURE_PIN_ITEMS, PICTURE_PIN_MAP, PicturePinItem } from '../../../constants/picturePin';
import { useStudent } from '../../../student';

interface PicturePinModalProps {
  student: { id: string; name: string; avatar: string };
  classCode: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const PicturePinModal: React.FC<PicturePinModalProps> = ({
  student,
  classCode,
  onSuccess,
  onClose,
}) => {
  const { setActiveStudentFromServer } = useStudent();
  const [selectedPins, setSelectedPins] = useState<PicturePinItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handlePick = async (item: PicturePinItem) => {
    if (selectedPins.length >= 3 || isSubmitting || isLocked) return;

    const nextPicks = [...selectedPins, item];
    setSelectedPins(nextPicks);
    setError(null);

    // When 3 pictures are chosen, submit automatically
    if (nextPicks.length === 3) {
      await submitPin(nextPicks);
    }
  };

  const handleBackspace = () => {
    if (selectedPins.length > 0 && !isSubmitting && !isLocked) {
      setSelectedPins((prev) => prev.slice(0, -1));
      setError(null);
    }
  };

  const submitPin = async (picks: PicturePinItem[]) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/student/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classCode,
          studentId: student.id,
          pin: picks.map((p) => p.id),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setActiveStudentFromServer({
          id: data.student.id,
          name: data.student.name,
          avatar: data.student.avatar,
          classId: data.student.classId,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        });
        onSuccess();
      } else {
        if (res.status === 423 || data.locked) {
          setIsLocked(true);
          setError('கணக்கு பூட்டப்பட்டுள்ளது. உங்கள் ஆசிரியரிடம் கூறவும் / Account is locked. Please tell your teacher.');
        } else {
          setError('தவறான படங்கள். மீண்டும் முயற்சிக்கவும் / Incorrect pictures. Try again.');
          setSelectedPins([]);
        }
      }
    } catch {
      setError('இணைப்பு பிழை. மீண்டும் முயற்சிக்கவும் / Connection error. Please try again.');
      setSelectedPins([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pin-modal-title"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Student Avatar & Name */}
        <div className="flex flex-col items-center mb-3">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center p-3 shadow-md mb-2">
            <img src={PICTURE_PIN_MAP['sun']?.svg} alt="Avatar" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
          </div>
          <h2 id="pin-modal-title" className="text-xl sm:text-2xl font-black text-gray-800">
            வணக்கம் {student.name}!
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            உங்கள் 3 படங்களைத் தொடவும் / Touch your 3 pictures
          </p>
        </div>

        {/* Locked Banner */}
        {isLocked && (
          <div className="w-full mb-4 p-3 bg-red-50 border-2 border-red-300 rounded-2xl flex items-center gap-2.5 text-red-700 text-sm font-bold">
            <Lock className="w-5 h-5 flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Error message */}
        {error && !isLocked && (
          <div className="w-full mb-3 p-2 bg-amber-50 border border-amber-300 rounded-xl text-center text-amber-800 text-xs sm:text-sm font-bold">
            {error}
          </div>
        )}

        {/* 3 Selected Slots */}
        <div className="w-full flex items-center justify-center gap-3 sm:gap-4 mb-4">
          {[0, 1, 2].map((idx) => {
            const pick = selectedPins[idx];
            return (
              <div
                key={idx}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl border-2 flex flex-col items-center justify-center transition-all ${
                  pick
                    ? 'border-emerald-500 bg-emerald-50 shadow-sm scale-105'
                    : 'border-dashed border-gray-300 bg-gray-50'
                }`}
              >
                {pick ? (
                  <>
                    <img src={pick.svg} alt={pick.labelTa} className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
                    <span className="text-[9px] font-bold text-emerald-800 truncate max-w-[50px]">
                      {pick.labelTa}
                    </span>
                  </>
                ) : (
                  <span className="text-sm font-bold text-gray-300">{idx + 1}</span>
                )}
              </div>
            );
          })}

          {/* Backspace Button */}
          <button
            onClick={handleBackspace}
            disabled={selectedPins.length === 0 || isSubmitting || isLocked}
            className="w-12 h-14 sm:w-14 sm:h-16 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center text-gray-700 transition-all cursor-pointer"
            aria-label="Delete last picture"
            title="Delete last picture"
          >
            <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* 3x3 Picture Grid with Large Touch Targets */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 w-full">
          {PICTURE_PIN_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handlePick(item)}
              disabled={selectedPins.length >= 3 || isSubmitting || isLocked}
              className="h-20 sm:h-22 bg-amber-50/60 hover:bg-amber-100/90 active:scale-95 border-2 border-amber-200/80 rounded-2xl flex flex-col items-center justify-center p-1.5 transition-all shadow-sm hover:shadow focus:ring-4 focus:ring-amber-300 outline-none cursor-pointer"
              aria-label={`${item.labelTa} / ${item.labelEn}`}
            >
              <img src={item.svg} alt={item.labelTa} className="w-8 h-8 object-contain mb-0.5" />
              <span className="text-[11px] sm:text-xs font-bold text-gray-800 leading-tight">
                {item.labelTa}
              </span>
              <span className="text-[9px] sm:text-[10px] text-gray-500 leading-tight">
                {item.labelEn}
              </span>
            </button>
          ))}
        </div>

        {isSubmitting && (
          <div className="mt-3 text-xs sm:text-sm font-bold text-primary-600 animate-pulse">
            சரிபார்க்கிறது... / Verifying...
          </div>
        )}
      </div>
    </div>
  );
};

