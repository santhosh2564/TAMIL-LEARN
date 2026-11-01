import { createContext } from 'react';
import { StudentProfile } from './types';

export interface StudentContextValue {
  /** The student of the current server session, or null. */
  activeStudent: StudentProfile | null;
  activeStudentId: string | null;
  isLoading: boolean;
  selectStudent: (
    schoolOrClassId: string,
    studentId: string,
    pin?: string[]
  ) => Promise<{ success: boolean; student?: StudentProfile; error?: string }>;
  clearActiveStudentProgress: () => Promise<void>;
  logout: () => Promise<void>;
  setActiveStudentFromServer: (student: StudentProfile) => void;
}

export const StudentContext = createContext<StudentContextValue | undefined>(undefined);
