import { ArrowLeft, ArrowRight, X } from 'lucide-react';

interface ArrangeTokenProps {
  id: string;
  label: string;
  status: 'available' | 'selected';
  disabled?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onSelect?: (id: string) => void;
  onRemove?: (id: string) => void;
  onMoveLeft?: (id: string) => void;
  onMoveRight?: (id: string) => void;
}

export function ArrangeToken({ 
  id, 
  label, 
  status, 
  disabled = false,
  isFirst = false,
  isLast = false,
  onSelect,
  onRemove,
  onMoveLeft,
  onMoveRight
}: ArrangeTokenProps) {
  
  if (status === 'available') {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(id)}
        disabled={disabled}
        className={`touch-target px-6 py-4 rounded-xl border-2 text-xl font-bold font-display transition-all ${
          disabled 
            ? 'opacity-50 cursor-not-allowed bg-surface border-surface-raised text-text-muted'
            : 'bg-white border-surface-raised text-text hover:border-primary-300 hover:bg-primary-50 focus-visible:ring-primary-500 shadow-sm'
        }`}
        lang="ta"
        aria-label={`Select ${label}`}
      >
        {label}
      </button>
    );
  }

  // Selected state
  return (
    <div className={`relative flex items-center group bg-primary-100 border-2 border-primary-300 rounded-xl overflow-hidden shadow-sm ${disabled ? 'opacity-70' : ''}`}>
      {!disabled && onMoveLeft && (
        <button
          type="button"
          onClick={() => onMoveLeft(id)}
          disabled={isFirst}
          className="p-3 text-primary-700 hover:bg-primary-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus-visible:bg-primary-200"
          aria-label={`Move ${label} left`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}
      
      <span className="px-4 py-3 text-xl font-bold font-display text-primary-900" lang="ta">
        {label}
      </span>

      {!disabled && onMoveRight && (
        <button
          type="button"
          onClick={() => onMoveRight(id)}
          disabled={isLast}
          className="p-3 text-primary-700 hover:bg-primary-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors focus-visible:bg-primary-200"
          aria-label={`Move ${label} right`}
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      )}

      {!disabled && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(id)}
          className="p-3 text-error hover:bg-error/10 border-l border-primary-200 transition-colors focus-visible:bg-error/10"
          aria-label={`Remove ${label}`}
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
