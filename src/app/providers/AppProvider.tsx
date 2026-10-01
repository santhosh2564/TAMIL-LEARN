import { ReactNode } from 'react';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider = ({ children }: AppProviderProps) => {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
};

