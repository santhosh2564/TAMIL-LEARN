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
});
