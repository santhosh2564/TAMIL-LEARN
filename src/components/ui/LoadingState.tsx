
export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center space-y-4">
      <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
      <p className="text-xl font-medium text-text-muted">{message}</p>
    </div>
  );
}
