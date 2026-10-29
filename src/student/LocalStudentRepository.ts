import {
  StudentProfile,
  StudentSnapshot,
  STUDENT_STORAGE_KEY_V1,
  ACTIVE_STUDENT_STORAGE_KEY_V1,
  STUDENT_SCHEMA_VERSION,
} from './types';
import { StudentRepository } from './StudentRepository';

export class LocalStudentRepository implements StudentRepository {
  private readonly storageKey: string;
  private readonly activeStudentKey: string;

  constructor(
    storageKey: string = STUDENT_STORAGE_KEY_V1,
    activeStudentKey: string = ACTIVE_STUDENT_STORAGE_KEY_V1
  ) {
    this.storageKey = storageKey;
    this.activeStudentKey = activeStudentKey;
  }

  // ---------------------------------------------------------------------------
  // PRIVATE: Snapshot I/O & Validation
  // ---------------------------------------------------------------------------

  private readSnapshot(): StudentSnapshot {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return this.emptySnapshot();

      const parsed: unknown = JSON.parse(raw);
      if (!this.isValidSnapshot(parsed)) {
        return this.emptySnapshot();
      }

      // Filter and sanitize corrupted or invalid records
      const validStudents = parsed.students.filter(this.isValidStudent);

      // Deduplicate by student id (keep the last updated)
      const deduplicatedMap = new Map<string, StudentProfile>();
      for (const student of validStudents) {
        deduplicatedMap.set(student.id, student);
      }

      return {
        version: parsed.version,
        updatedAt: parsed.updatedAt,
        students: Array.from(deduplicatedMap.values()),
      };
    } catch {
      // Storage unavailable, SecurityError, quota or malformed JSON
      return this.emptySnapshot();
    }
  }

  private writeSnapshot(snapshot: StudentSnapshot): void {
    try {
      snapshot.updatedAt = new Date().toISOString();
      localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
    } catch {
      // Storage full or unavailable - fail gracefully without crashing
    }
  }

  private emptySnapshot(): StudentSnapshot {
    return {
      version: STUDENT_SCHEMA_VERSION,
      updatedAt: new Date().toISOString(),
      students: [],
    };
  }

  private isValidSnapshot(value: unknown): value is StudentSnapshot {
    if (!value || typeof value !== 'object') return false;
    const snap = value as Record<string, unknown>;
    if (typeof snap.version !== 'number' || snap.version !== STUDENT_SCHEMA_VERSION) {
      return false;
    }
    if (typeof snap.updatedAt !== 'string') return false;
    if (!Array.isArray(snap.students)) return false;
    return true;
  }

  private isValidStudent(value: unknown): value is StudentProfile {
    if (!value || typeof value !== 'object') return false;
    const s = value as Record<string, unknown>;
    return (
      typeof s.id === 'string' &&
      s.id.trim().length > 0 &&
      typeof s.name === 'string' &&
      s.name.trim().length > 0 &&
      typeof s.createdAt === 'string' &&
      typeof s.lastActiveAt === 'string'
    );
  }

  // ---------------------------------------------------------------------------
  // PUBLIC: StudentRepository Implementation
  // ---------------------------------------------------------------------------

  async getStudents(): Promise<StudentProfile[]> {
    const snapshot = this.readSnapshot();
    // Sort students by most recently active first
    return [...snapshot.students].sort((a, b) => {
      return new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime();
    });
  }

  async getStudentById(id: string): Promise<StudentProfile | null> {
    if (!id || typeof id !== 'string') return null;
    const snapshot = this.readSnapshot();
    return snapshot.students.find((s) => s.id === id) ?? null;
  }

  async saveStudent(student: StudentProfile): Promise<void> {
    if (!this.isValidStudent(student)) {
      throw new Error('Invalid student profile: Name and ID cannot be empty');
    }

    const snapshot = this.readSnapshot();
    const existingIndex = snapshot.students.findIndex((s) => s.id === student.id);

    const sanitizedStudent: StudentProfile = {
      id: student.id.trim(),
      name: student.name.trim(),
      createdAt: student.createdAt,
      lastActiveAt: student.lastActiveAt,
    };

    if (existingIndex >= 0) {
      snapshot.students[existingIndex] = sanitizedStudent;
    } else {
      snapshot.students.push(sanitizedStudent);
    }

    this.writeSnapshot(snapshot);
  }

  async updateLastActive(id: string): Promise<void> {
    if (!id) return;
    const snapshot = this.readSnapshot();
    const student = snapshot.students.find((s) => s.id === id);
    if (student) {
      student.lastActiveAt = new Date().toISOString();
      this.writeSnapshot(snapshot);
    }
  }

  async deleteStudent(id: string): Promise<void> {
    if (!id) return;
    const snapshot = this.readSnapshot();
    snapshot.students = snapshot.students.filter((s) => s.id !== id);
    this.writeSnapshot(snapshot);

    // If deleting currently active student, clear active student state
    const currentActiveId = await this.getActiveStudentId();
    if (currentActiveId === id) {
      await this.setActiveStudentId(null);
    }
  }

  async getActiveStudentId(): Promise<string | null> {
    try {
      const activeId = localStorage.getItem(this.activeStudentKey);
      if (!activeId || activeId.trim().length === 0) return null;
      return activeId.trim();
    } catch {
      return null;
    }
  }

  async setActiveStudentId(id: string | null): Promise<void> {
    try {
      if (!id) {
        localStorage.removeItem(this.activeStudentKey);
      } else {
        localStorage.setItem(this.activeStudentKey, id.trim());
      }
    } catch {
      // Storage unavailable or quota exceeded
    }
  }

  async clearAllStudents(): Promise<void> {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.activeStudentKey);
    } catch {
      // Ignore
    }
  }
}
