import React from 'react';

export type DecorationVariant = 'playful' | 'ambient' | 'calm' | 'celebration';

interface FloatingDecorationsProps {
  variant?: DecorationVariant;
}

export const FloatingDecorations: React.FC<FloatingDecorationsProps> = ({ variant = 'playful' }) => {
  // In calm mode (e.g. during an active activity question), omit floating shapes for full focus
  if (variant === 'calm') {
    return null;
  }

  if (variant === 'celebration') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        {/* Celebration golden stars and confetti shapes */}
        <div className="absolute top-8 left-[10%] text-accent-400 text-3xl animate-bounce-gentle">⭐</div>
        <div className="absolute top-16 right-[12%] text-primary-400 text-4xl animate-pulse-subtle">✨</div>
        <div className="absolute top-32 left-[25%] text-secondary-400 text-2xl animate-float-fast">🎉</div>
        <div className="absolute top-24 right-[28%] text-accent-500 text-3xl animate-bounce-gentle">🌟</div>
        <div className="absolute bottom-20 left-[15%] text-primary-500 text-4xl animate-float-medium">🎈</div>
        <div className="absolute bottom-16 right-[18%] text-secondary-500 text-3xl animate-float-slow">🏆</div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* Gentle Floating Educational Elements */}
      <div className="absolute top-[8%] left-[6%] w-12 h-12 text-primary-300/30 animate-float-slow motion-reduce:animate-none">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>

      <div className="absolute top-[18%] right-[8%] w-16 h-16 text-secondary-300/25 animate-float-medium motion-reduce:animate-none">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
        </svg>
      </div>

      <div className="absolute bottom-[20%] left-[8%] w-10 h-10 text-accent-400/25 animate-float-fast motion-reduce:animate-none">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </div>

      <div className="absolute bottom-[28%] right-[10%] w-14 h-14 text-primary-400/20 animate-float-slow motion-reduce:animate-none">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>

      {variant === 'playful' && (
        <>
          {/* Playful Math and Alphabet Icons */}
          <div className="absolute top-[45%] left-[3%] text-2xl font-black font-display text-primary-400/25 animate-pulse-subtle motion-reduce:animate-none">
            அ
          </div>
          <div className="absolute top-[52%] right-[4%] text-2xl font-black font-display text-secondary-400/25 animate-pulse-subtle motion-reduce:animate-none">
            A
          </div>
          <div className="absolute top-[68%] left-[12%] text-2xl font-black font-display text-accent-500/25 animate-float-medium motion-reduce:animate-none">
            1 2 3
          </div>
        </>
      )}
    </div>
  );
};

