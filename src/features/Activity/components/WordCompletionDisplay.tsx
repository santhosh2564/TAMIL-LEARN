interface WordCompletionDisplayProps {
  prompt: string;
}

export function WordCompletionDisplay({ prompt }: WordCompletionDisplayProps) {
  // Normalize bracketed blanks like [____] or [blank] to [blank]
  const normalizedBlanks = prompt.replace(/\[_+\]/g, '[blank]');
  // Clean stray unbracketed blanks from context sentences, then split on bracketed equation blanks
  const cleanedPrompt = normalizedBlanks.replace(/_{2,}\.?\s*/g, '');
  const displayParts = cleanedPrompt.split(/\[blank\]/g);

  return (
    <h2 className="text-2xl md:text-4xl font-bold font-display text-text text-center px-4 w-full flex items-center justify-center flex-wrap gap-x-3 gap-y-2 leading-relaxed" lang="ta">
      {displayParts.map((part, index) => {
        const isLast = index === displayParts.length - 1;
        const colonIndex = part.indexOf(':');
        const prefix = colonIndex !== -1 ? part.slice(0, colonIndex + 1) : '';
        const remainder = colonIndex !== -1 ? part.slice(colonIndex + 1).trimStart() : part;

        return (
          <span key={index} className="inline-flex items-center flex-wrap justify-center gap-2">
            {prefix && <span className="mr-1">{prefix}</span>}
            <span className="inline-flex items-center whitespace-nowrap">
              <span>{remainder}</span>
              {!isLast && (
                <span className="inline-flex mx-2 w-16 h-12 md:w-20 md:h-16 rounded-xl border-4 border-dashed border-primary-200 bg-surface-raised items-center justify-center" aria-label="blank">
                  <span className="sr-only">blank space</span>
                </span>
              )}
            </span>
          </span>
        );
      })}
    </h2>
  );
}
