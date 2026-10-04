import { describe, it, expect, beforeEach } from 'vitest';
import { LocalContentRepository } from '../implementations/LocalContentRepository';

describe('LocalContentRepository', () => {
  let repo: LocalContentRepository;

  beforeEach(() => {
    repo = new LocalContentRepository();
  });

  it('should initialize and load manifest', async () => {
    const manifest = await repo.getManifest();
    expect(manifest).toBeDefined();
    expect(manifest.classLevel).toBe(3);
    expect(manifest.subject).toBe('Tamil');
    expect(manifest.activityCount).toBe(144);
  });

  it('should get all activities', async () => {
    const activities = await repo.getActivities();
    expect(activities.length).toBe(144);
    
    const count = await repo.getActivityCount();
    expect(count).toBe(144);
  });

  it('should get activity by id', async () => {
    const activity = await repo.getActivityById('Q001'); 
    expect(activity).toBeDefined();
    expect(activity?.id).toBe('Q001');
    expect(activity?.targetWord).toBe('முயல்');
  });

  it('should return null for missing id', async () => {
    const activity = await repo.getActivityById('999999');
    expect(activity).toBeNull();
  });

  it('should filter by category', async () => {
    const activities = await repo.getActivities({ category: 'picture-recognition' });
    expect(activities.length).toBe(21);
    expect(activities[0].category).toBe('picture-recognition');
    
    const count = await repo.getActivityCount({ category: 'picture-recognition' });
    expect(count).toBe(21);
  });

  it('should filter by level', async () => {
    const level1Activities = await repo.getActivities({ level: 1 });
    expect(level1Activities.length).toBe(57);
    level1Activities.forEach(a => {
      expect(a.level).toBe(1);
    });
  });

  it('should filter by class and subject', async () => {
    const activities = await repo.getActivities({ classLevel: 3, subject: 'Tamil' });
    expect(activities.length).toBe(144);
    
    const wrongClass = await repo.getActivities({ classLevel: 4 });
    expect(wrongClass.length).toBe(0);
  });

  it('should filter by combinations', async () => {
    const activities = await repo.getActivities({ 
      classLevel: 3, 
      subject: 'Tamil', 
      level: 1, 
      category: 'picture-recognition' 
    });
    
    // There should be a specific subset matching this
    expect(activities.length).toBeGreaterThan(0);
    activities.forEach(a => {
      expect(a.classLevel).toBe(3);
      expect(a.subject).toBe('Tamil');
      expect(a.level).toBe(1);
      expect(a.category).toBe('picture-recognition');
    });
  });

  it('should guarantee immutability of returned activities', async () => {
    const originalActivity = await repo.getActivityById('Q001');
    expect(originalActivity).not.toBeNull();
    
    if (originalActivity) {
      // Modify the returned object
      originalActivity.targetWord = 'MUTATED';
      if (originalActivity.options && originalActivity.options.length > 0) {
        originalActivity.options[0].label = 'MUTATED';
      }
      
      // Fetch again
      const newFetch = await repo.getActivityById('Q001');
      expect(newFetch?.targetWord).not.toBe('MUTATED');
      expect(newFetch?.targetWord).toBe('முயல்');
      if (newFetch?.options && newFetch.options.length > 0) {
        expect(newFetch.options[0].label).not.toBe('MUTATED');
      }
    }
  });

  describe('English Curriculum and Module Manifests', () => {
    it('should return the full English curriculum manifest', async () => {
      const manifest = await repo.getEnglishCurriculumManifest();
      expect(manifest).toBeDefined();
      expect(manifest.classLevel).toBe(3);
      expect(manifest.subject).toBe('English');
      expect(manifest.totalUniqueWords).toBe(958);
      expect(manifest.totalReviewInstances).toBe(280);
      expect(manifest.totalActivities).toBe(1238);
      expect(manifest.moduleCount).toBe(8);
      expect(manifest.modules.length).toBe(8);
    });

    it('should retrieve individual English module manifests', async () => {
      const m1 = await repo.getEnglishModuleManifest(1);
      expect(m1).toBeDefined();
      expect(m1?.module).toBe(1);
      expect(m1?.newWordCount).toBe(120);
      expect(m1?.reviewWordCount).toBe(0);
      expect(m1?.totalActivities).toBe(120);
      expect(m1?.days.length).toBe(5);
      m1?.days.forEach(d => {
        expect(d.totalCount).toBe(24);
      });

      const m8 = await repo.getEnglishModuleManifest(8);
      expect(m8).toBeDefined();
      expect(m8?.module).toBe(8);
      expect(m8?.newWordCount).toBe(118);
      expect(m8?.reviewWordCount).toBe(40);
      expect(m8?.totalActivities).toBe(158);
    });

    it('should return null for non-existent module manifests', async () => {
      const m0 = await repo.getEnglishModuleManifest(0);
      expect(m0).toBeNull();

      const m9 = await repo.getEnglishModuleManifest(9);
      expect(m9).toBeNull();
    });

    it('should query English activities deterministically by module and day', async () => {
      // Module 1 Day 1: 24 activities
      const m1d1 = await repo.getActivities({ subject: 'English', module: 1, day: 1 });
      expect(m1d1.length).toBe(24);
      m1d1.forEach(a => {
        expect(a.module).toBe(1);
        expect(a.day).toBe(1);
        expect(a.subject).toBe('English');
      });

      // Module 2 Day 1: 32 activities (24 new, 8 review)
      const m2d1 = await repo.getActivities({ subject: 'English', module: 2, day: 1 });
      expect(m2d1.length).toBe(32);
      expect(m2d1.filter(a => a.role === 'new').length).toBe(24);
      expect(m2d1.filter(a => a.role === 'review').length).toBe(8);

      // Module 8 Day 4: 31 activities (23 new, 8 review)
      const m8d4 = await repo.getActivities({ subject: 'English', module: 8, day: 4 });
      expect(m8d4.length).toBe(31);
      expect(m8d4.filter(a => a.role === 'new').length).toBe(23);
      expect(m8d4.filter(a => a.role === 'review').length).toBe(8);
    });

    it('should retrieve English activity by ID', async () => {
      const act = await repo.getActivityById('ENG-M2-EW001');
      expect(act).toBeDefined();
      expect(act?.id).toBe('ENG-M2-EW001');
      expect(act?.targetWord).toBe('about');
      expect(act?.subject).toBe('English');
    });
  });
});
