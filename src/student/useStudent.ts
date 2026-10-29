import { useContext } from 'react';
import { StudentContext, StudentContextValue } from './StudentContextInstance';

export function useStudent(): StudentContextValue {
  const context = useContext(StudentContext);
  if (!context) {
    return {
      activeStudent: null,
      activeStudentId: null,
      isLoading: false,
      clearActiveStudentProgress: async () => {},
      logout: async () => {},
      setActiveStudentFromServer: () => {},
    };
  }
  return context;
}
