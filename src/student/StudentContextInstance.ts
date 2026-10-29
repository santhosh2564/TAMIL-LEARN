import { createContext } from 'react';
import { StudentProfile } from './types';

export interface StudentContextValue {
  activeStudent: StudentProfile | null;
  activeStudentId: string | null;
  students: StudentProfile[];
  isLoading: boolean;
  selectStudent: (id: string) => Promise<void>;
  createAndSelectStudent: (name: string) => Promise<StudentProfile>;
  clearActiveStudent: () => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  clearActiveStudentProgress: () => Promise<void>;
  clearAllStudentsData: () => Promise<void>;
  refreshStudents: () => Promise<void>;
}

export const StudentContext = createContext<StudentContextValue | undefined>(undefined);
