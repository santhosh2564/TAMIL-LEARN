interface ActivityPromptProps {
  prompt: string;
}

export function ActivityPrompt({ prompt }: ActivityPromptProps) {
  return (
    <h2 className="text-xl md:text-2xl font-bold font-display text-text text-center px-4 w-full" 
        lang="ta">
      {prompt}
    </h2>
  );
}
