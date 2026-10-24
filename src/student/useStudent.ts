import { useContext } from 'react';
import { StudentContext, StudentContextValue } from './StudentContextInstance';

export function useStudent(): StudentContextValue {
  const context = useContext(StudentContext);
  if (!context) {
    return {
      activeStudent: null,
      activeStudentId: null,
      students: [],
      isLoading: false,
      selectStudent: async () => {},
      createAndSelectStudent: async (name: string) => ({
        id: 'test-student-id',
        name,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
      }),
      clearActiveStudent: async () => {},
      deleteStudent: async () => {},
      clearActiveStudentProgress: async () => {},
      clearAllStudentsData: async () => {},
      refreshStudents: async () => {},
    };
  }
  return context;
}
