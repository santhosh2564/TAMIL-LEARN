import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStudentRepository } from '../LocalStudentRepository';
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

  /** Writes an old local-only profile the way the removed "+ New Student" flow did. */
  async function seedLocalProfile(repo: LocalStudentRepository, id: string, name: string, lastActiveAt: string) {
    await repo.saveStudent({ id, name, createdAt: lastActiveAt, lastActiveAt });
  }

  describe('Reading existing local profiles', () => {
    it('lists profiles ordered by lastActiveAt descending', async () => {
      const repo = new LocalStudentRepository();
      await seedLocalProfile(repo, 'a', 'A', '2026-10-01T00:00:00Z');
      await seedLocalProfile(repo, 'b', 'B', '2026-10-02T00:00:00Z');
      const list = await new StudentService(repo).listStudents();
      expect(list.map((s) => s.id)).toEqual(['b', 'a']);
    });

    it('retrieves a profile by id, null for unknown or empty ids', async () => {
      const repo = new LocalStudentRepository();
      await seedLocalProfile(repo, 'k1', 'Kavitha', '2026-10-01T00:00:00Z');
      const service = new StudentService(repo);
      expect((await service.getStudent('k1'))?.name).toBe('Kavitha');
      expect(await service.getStudent('invalid-id')).toBeNull();
      expect(await service.getStudent('')).toBeNull();
    });

    it('returns the stored active profile, and clears a dangling active id', async () => {
      const repo = new LocalStudentRepository();
      await seedLocalProfile(repo, 'k1', 'Kavitha', '2026-10-01T00:00:00Z');
      const service = new StudentService(repo);

      store[ACTIVE_STUDENT_STORAGE_KEY_V1] = 'k1';
      expect((await service.getActiveStudent())?.id).toBe('k1');
      expect(await service.getActiveStudentId()).toBe('k1');

      store[ACTIVE_STUDENT_STORAGE_KEY_V1] = 'gone';
      expect(await service.getActiveStudent()).toBeNull();
      expect(await service.getActiveStudentId()).toBeNull();
    });

    it('has no way to create, select or delete a local student', () => {
      const proto = StudentService.prototype as unknown as Record<string, unknown>;
      for (const method of ['createStudent', 'setActiveStudent', 'deleteStudent', 'clearAllStudents']) {
        expect(proto[method], method).toBeUndefined();
      }
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
