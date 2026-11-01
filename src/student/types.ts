export interface StudentProfile {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
  avatar?: string;
  classId?: string;
  schoolId?: string;
}

export const STUDENT_STORAGE_KEY_V1 = 'sa.students.v1';
export const ACTIVE_STUDENT_STORAGE_KEY_V1 = 'sa.activeStudentId.v1';
export const STUDENT_SCHEMA_VERSION = 1;

export interface StudentSnapshot {
  version: number;
  updatedAt: string;
  students: StudentProfile[];
}
