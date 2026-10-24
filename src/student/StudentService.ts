import { StudentProfile } from './types';
import { StudentRepository } from './StudentRepository';
import { LocalStudentRepository, generateStudentId } from './LocalStudentRepository';
import { neonSync } from '../services/NeonSyncService';

export interface StudentServiceCleanupDelegate {
  onStudentDeleted?(studentId: string): Promise<void>;
}

export class StudentService {
  constructor(
    private readonly repository: StudentRepository = new LocalStudentRepository(),
    private readonly cleanupDelegate?: StudentServiceCleanupDelegate
  ) {}

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
   * Creates a new student profile with a validated name.
   * Trims whitespace and rejects empty names.
   * Stable collision-resistant unique ID is generated.
   * Sets newly created student as the active student.
   */
  async createStudent(rawName: string): Promise<StudentProfile> {
    if (typeof rawName !== 'string') {
      throw new Error('Student name must be a string');
    }

    const name = rawName.trim();
    if (name.length === 0) {
      throw new Error('Student name cannot be empty');
    }

    const now = new Date().toISOString();
    const student: StudentProfile = {
      id: generateStudentId(),
      name,
      createdAt: now,
      lastActiveAt: now,
    };

    await this.repository.saveStudent(student);
    await this.repository.setActiveStudentId(student.id);
    neonSync.syncStudent(student).catch(() => {});

    return student;
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

  /**
   * Sets the active student by ID and touches their lastActiveAt timestamp.
   */
  async setActiveStudent(id: string): Promise<StudentProfile | null> {
    const student = await this.repository.getStudentById(id);
    if (!student) {
      throw new Error(`Student with id "${id}" does not exist`);
    }

    await this.repository.setActiveStudentId(student.id);
    await this.repository.updateLastActive(student.id);
    student.lastActiveAt = new Date().toISOString();
    return student;
  }

  /**
   * Clears the active student (e.g. logging out to student selection).
   */
  async clearActiveStudent(): Promise<void> {
    await this.repository.setActiveStudentId(null);
  }

  /**
   * Touches the active student's lastActiveAt timestamp.
   */
  async touchActiveStudent(): Promise<void> {
    const activeId = await this.repository.getActiveStudentId();
    if (activeId) {
      await this.repository.updateLastActive(activeId);
    }
  }

  /**
   * Deletes a student and executes cleanup (e.g. progress and attempt records).
   */
  async deleteStudent(id: string): Promise<void> {
    if (!id) return;

    if (this.cleanupDelegate?.onStudentDeleted) {
      await this.cleanupDelegate.onStudentDeleted(id);
    }

    await this.repository.deleteStudent(id);
    neonSync.deleteStudent(id).catch(() => {});
  }

  /**
   * Clears all students from this device.
   */
  async clearAllStudents(): Promise<void> {
    await this.repository.clearAllStudents();
  }
}
