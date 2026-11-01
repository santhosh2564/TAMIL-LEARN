import { StudentProfile } from './types';
import { StudentRepository } from './StudentRepository';
import { LocalStudentRepository } from './LocalStudentRepository';

/**
 * Read-only access to student profiles stored on this device (used by the local admin
 * progress views). Students are created only on the server, via POST /api/admin/students;
 * old local-only profiles are kept as they are but can no longer be created or selected.
 */
export class StudentService {
  constructor(private readonly repository: StudentRepository = new LocalStudentRepository()) {}

  /**
   * Retrieves all student profiles, ordered with most recently active first.
   */
  async listStudents(): Promise<StudentProfile[]> {
    return this.repository.getStudents();
  }

  /**
   * Retrieves a student profile by ID.
   */
  async getStudent(id: string): Promise<StudentProfile | null> {
    if (!id || typeof id !== 'string') return null;
    return this.repository.getStudentById(id);
  }

  /**
   * Retrieves the current active student profile, or null if none active.
   */
  async getActiveStudent(): Promise<StudentProfile | null> {
    const activeId = await this.repository.getActiveStudentId();
    if (!activeId) return null;
    const student = await this.repository.getStudentById(activeId);
    if (!student) {
      // Stored ID was deleted or invalid; clear it
      await this.repository.setActiveStudentId(null);
      return null;
    }
    return student;
  }

  /**
   * Retrieves the raw ID of the current active student.
   */
  async getActiveStudentId(): Promise<string | null> {
    return this.repository.getActiveStudentId();
  }
}
