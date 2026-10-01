interface WordCompletionDisplayProps {
  prompt: string;
}

export function WordCompletionDisplay({ prompt }: WordCompletionDisplayProps) {
  // Clean stray unbracketed blanks from context sentences, then split on bracketed equation blanks
  const cleanedPrompt = prompt.replace(/(?<!\[)_{2,}\.?\s*/g, '');
  const displayParts = cleanedPrompt.split(/\[(?:blank|_{2,})\]/g);

  return (
    <h2 className="text-2xl md:text-4xl font-bold font-display text-text text-center px-4 w-full flex items-center justify-center flex-wrap gap-2 leading-relaxed" lang="ta">
      {displayParts.map((part, index) => {
        const isLast = index === displayParts.length - 1;
        return (
          <span key={index} className="flex items-center">
            <span>{part}</span>
            {!isLast && (
              <span className="inline-block mx-2 w-16 h-12 md:w-20 md:h-16 rounded-xl border-4 border-dashed border-primary-200 bg-surface-raised flex items-center justify-center" aria-label="blank">
                <span className="sr-only">blank space</span>
              </span>
            )}
          </span>
        );
      })}
    </h2>
  );
}
