import { Link } from 'react-router-dom';
import { Image as ImageIcon } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full border-t border-surface-highlight bg-surface-raised/70 backdrop-blur-sm py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs sm:text-sm text-text-muted">
        <div className="flex items-center gap-2">
          <span>தமிழ் & English Learning Platform</span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            to="/credits"
            className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-800 font-semibold transition-colors"
          >
            <ImageIcon size={15} />
            <span>Image credits / படங்களுக்கான நன்றி</span>
          </Link>
          <Link
            to="/settings"
            className="hover:text-text font-medium transition-colors"
          >
            Settings (அமைப்புகள்)
          </Link>
        </div>
      </div>
    </footer>
  );
}
