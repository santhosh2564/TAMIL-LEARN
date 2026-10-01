import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const BackButton = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
      className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors touch-target flex items-center justify-center"
      aria-label="Go back"
    >
      <ArrowLeft className="w-6 h-6" />
    </button>
  );
};
