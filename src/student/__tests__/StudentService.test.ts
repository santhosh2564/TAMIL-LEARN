import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStudentRepository, generateStudentId } from '../LocalStudentRepository';
import { StudentService } from '../StudentService';
import { STUDENT_STORAGE_KEY_V1, ACTIVE_STUDENT_STORAGE_KEY_V1 } from '../types';

describe('Student Domain & StudentService', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    Object.keys(store).forEach((k) => delete store[k]);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
    });
  });

  describe('ID Generation', () => {
    it('generates unique collision-resistant IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const id = generateStudentId();
        expect(ids.has(id)).toBe(false);
        ids.add(id);
      }
    });

    it('works when crypto.randomUUID is not available', () => {
      const originalCrypto = globalThis.crypto;
      // Temporarily remove randomUUID
      // @ts-expect-error - testing fallback
      delete globalThis.crypto;

      const id = generateStudentId();
      expect(typeof id).toBe('string');
      expect(id.startsWith('stu_')).toBe(true);

      globalThis.crypto = originalCrypto;
    });
  });

  describe('Student Creation & Validation', () => {
    it('creates a student and sets as active', async () => {
      const repo = new LocalStudentRepository();
      const service = new StudentService(repo);

      const student = await service.createStudent('Arjun');
      expect(student.id).toBeDefined();
      expect(student.name).toBe('Arjun');
      expect(student.createdAt).toBeDefined();
      expect(student.lastActiveAt).toBeDefined();

      const active = await service.getActiveStudent();
      expect(active?.id).toBe(student.id);
      expect(active?.name).toBe('Arjun');
    });

    it('trims leading and trailing whitespace from names', async () => {
      const service = new StudentService(new LocalStudentRepository());
      const student = await service.createStudent('   Priya   ');
      expect(student.name).toBe('Priya');
    });

    it('rejects empty names or whitespace-only names', async () => {
      const service = new StudentService(new LocalStudentRepository());
      await expect(service.createStudent('')).rejects.toThrow('Student name cannot be empty');
      await expect(service.createStudent('    ')).rejects.toThrow('Student name cannot be empty');
    });

    it('allows duplicate student names with unique distinct IDs', async () => {
      const service = new StudentService(new LocalStudentRepository());
      const student1 = await service.createStudent('Kumar');
      const student2 = await service.createStudent('Kumar');

      expect(student1.name).toBe('Kumar');
      expect(student2.name).toBe('Kumar');
      expect(student1.id).not.toBe(student2.id);

      const list = await service.listStudents();
      expect(list.length).toBe(2);
      expect(list.map((s) => s.id)).toContain(student1.id);
      expect(list.map((s) => s.id)).toContain(student2.id);
    });
  });

  describe('Student Retrieval & Active State', () => {
    it('retrieves student by ID', async () => {
      const service = new StudentService(new LocalStudentRepository());
      const created = await service.createStudent('Kavitha');

      const retrieved = await service.getStudent(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Kavitha');

      const nonExistent = await service.getStudent('invalid-id');
      expect(nonExistent).toBeNull();
    });

    it('switches active student and updates lastActiveAt', async () => {
      const service = new StudentService(new LocalStudentRepository());
      const studentA = await service.createStudent('Student A');
      const studentB = await service.createStudent('Student B');

      // Created B last, so B is currently active
      expect((await service.getActiveStudent())?.id).toBe(studentB.id);

      // Switch to A
      await service.setActiveStudent(studentA.id);
      expect((await service.getActiveStudent())?.id).toBe(studentA.id);
    });

    it('clears active student', async () => {
      const service = new StudentService(new LocalStudentRepository());
      await service.createStudent('Arjun');
      expect(await service.getActiveStudent()).not.toBeNull();

      await service.clearActiveStudent();
      expect(await service.getActiveStudent()).toBeNull();
    });

    it('orders student list by lastActiveAt descending', async () => {
      const service = new StudentService(new LocalStudentRepository());
      const a = await service.createStudent('A');
      await new Promise((r) => setTimeout(r, 10));
      const b = await service.createStudent('B');

      let list = await service.listStudents();
      expect(list[0].id).toBe(b.id);
      expect(list[1].id).toBe(a.id);

      // Now activate A again
      await new Promise((r) => setTimeout(r, 10));
      await service.setActiveStudent(a.id);

      list = await service.listStudents();
      expect(list[0].id).toBe(a.id);
      expect(list[1].id).toBe(b.id);
    });
  });

  describe('Student Deletion & Cleanup', () => {
    it('deletes student and clears active state if the active student was deleted', async () => {
      const service = new StudentService(new LocalStudentRepository());
      const student = await service.createStudent('Arjun');
      expect(await service.getActiveStudentId()).toBe(student.id);

      await service.deleteStudent(student.id);

      const list = await service.listStudents();
      expect(list.length).toBe(0);
      expect(await service.getActiveStudentId()).toBeNull();
    });

    it('triggers cleanup delegate when student is deleted', async () => {
      let cleanedId: string | null = null;
      const service = new StudentService(new LocalStudentRepository(), {
        onStudentDeleted: async (id) => {
          cleanedId = id;
        },
      });

      const student = await service.createStudent('Priya');
      await service.deleteStudent(student.id);

      expect(cleanedId).toBe(student.id);
    });

    it('clearAllStudents clears all storage', async () => {
      const service = new StudentService(new LocalStudentRepository());
      await service.createStudent('A');
      await service.createStudent('B');

      await service.clearAllStudents();

      expect(await service.listStudents()).toEqual([]);
      expect(await service.getActiveStudent()).toBeNull();
    });
  });

  describe('Resilience & Safe Handling', () => {
    it('handles malformed JSON in localStorage gracefully without crashing', async () => {
      store[STUDENT_STORAGE_KEY_V1] = 'invalid json {{{';
      store[ACTIVE_STUDENT_STORAGE_KEY_V1] = 'some-id';

      const repo = new LocalStudentRepository();
      const service = new StudentService(repo);

      const list = await service.listStudents();
      expect(list).toEqual([]);
      expect(await service.getActiveStudent()).toBeNull();
    });

    it('filters out corrupted or invalid student records in storage', async () => {
      store[STUDENT_STORAGE_KEY_V1] = JSON.stringify({
        version: 1,
        updatedAt: new Date().toISOString(),
        students: [
          { id: 'valid-1', name: 'Valid Student', createdAt: '2026-01-01', lastActiveAt: '2026-01-01' },
          { id: '', name: 'Empty ID', createdAt: '2026-01-01', lastActiveAt: '2026-01-01' },
          { id: 'no-name', name: '', createdAt: '2026-01-01', lastActiveAt: '2026-01-01' },
          null,
          'not-an-object',
        ],
      });

      const service = new StudentService(new LocalStudentRepository());
      const list = await service.listStudents();
      expect(list.length).toBe(1);
      expect(list[0].id).toBe('valid-1');
    });

    it('handles storage quota or write failure gracefully', async () => {
      const failingRepo = new LocalStudentRepository();
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {},
      });

      // Saving should not crash the app
      await expect(
        failingRepo.saveStudent({
          id: 's1',
          name: 'Student',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
        })
      ).resolves.not.toThrow();
    });
  });
});
