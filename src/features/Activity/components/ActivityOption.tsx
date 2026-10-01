interface ActivityOptionProps {
  id: string;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect: (id: string) => void;
}

export function ActivityOption({ id, label, selected = false, disabled = false, onSelect }: ActivityOptionProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      disabled={disabled}
      aria-pressed={selected}
      className={`touch-target p-4 rounded-xl border-2 text-lg md:text-xl font-bold font-display transition-all ${
        selected
          ? 'bg-primary-50 border-primary-500 text-primary-700 shadow-sm'
          : 'bg-white border-surface-raised text-text hover:border-primary-200 hover:bg-primary-50 focus-visible:ring-primary-500'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      lang="ta"
    >
      {label}
    </button>
  );
}
