import { StudentProfile } from './types';

export interface StudentRepository {
  /**
   * Retrieves all registered student profiles.
   */
  getStudents(): Promise<StudentProfile[]>;

  /**
   * Retrieves a single student profile by its stable ID.
   */
  getStudentById(id: string): Promise<StudentProfile | null>;

  /**
   * Saves or updates a student profile.
   */
  saveStudent(student: StudentProfile): Promise<void>;

  /**
   * Updates the lastActiveAt timestamp for the given student ID.
   */
  updateLastActive(id: string): Promise<void>;

  /**
   * Removes a student profile by ID.
   */
  deleteStudent(id: string): Promise<void>;

  /**
   * Retrieves the active student ID for this device session.
   */
  getActiveStudentId(): Promise<string | null>;

  /**
   * Sets or clears the active student ID for this device session.
   */
  setActiveStudentId(id: string | null): Promise<void>;

  /**
   * Clears all student profiles from local storage.
   */
  clearAllStudents(): Promise<void>;
}
