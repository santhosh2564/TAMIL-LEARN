interface ContextSentenceProps {
  sentence: string;
}

export function ContextSentence({ sentence }: ContextSentenceProps) {
  // We'll parse out the underscores and replace them with an accessible blank.
  // The JSON typically uses "______" or something similar.
  // Let's use a regex to find contiguous underscores (3 or more).
  const parts = sentence.split(/_{3,}/g);

  return (
    <h2 className="text-xl md:text-2xl font-bold font-display text-text text-center px-4 w-full leading-relaxed" lang="ta">
      {parts.map((part, index) => {
        const isLast = index === parts.length - 1;
        return (
          <span key={index}>
            {part}
            {!isLast && (
              <span className="inline-block mx-2 min-w-[60px] border-b-2 border-text align-baseline" aria-label="blank">
                &nbsp;
              </span>
            )}
          </span>
        );
      })}
    </h2>
  );
}
