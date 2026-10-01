import { describe, it, expect, vi, beforeEach, Mocked } from 'vitest';
import { SessionActivitySelector } from '../SessionActivitySelector';
import { SessionConfig } from '../types';
import { LocalContentRepository } from '../../repositories/implementations/LocalContentRepository';
import { Activity } from '../../types';

// Mock the repository
vi.mock('../../repositories/implementations/LocalContentRepository');

describe('SessionActivitySelector', () => {
  let selector: SessionActivitySelector;
  let mockRepo: Mocked<LocalContentRepository>;

  beforeEach(() => {
    mockRepo = new LocalContentRepository() as Mocked<LocalContentRepository>;
    selector = new SessionActivitySelector(mockRepo);
  });

  const mockActivities = Array.from({ length: 20 }, (_, i) => ({
    id: `A${i}`,
    category: 'picture-recognition',
    variant: 'select',
    classLevel: 3,
    subject: 'Tamil'
  })) as Activity[];

  it('selects exactly the requested number of activities when mode is fixed', async () => {
    mockRepo.getActivities.mockResolvedValue(mockActivities);
    
    const config: SessionConfig = {
      classId: '3',
      subjectId: 'tamil',
      category: null,
      size: { mode: 'fixed', count: 5 }
    };

    const selected = await selector.selectActivities(config);
    expect(selected.length).toBe(5);
    // Ensure no duplicates
    const ids = new Set(selected.map(a => a.id));
    expect(ids.size).toBe(5);
  });

  it('returns all available activities when mode is all', async () => {
    mockRepo.getActivities.mockResolvedValue(mockActivities);
    
    const config: SessionConfig = {
      classId: '3',
      subjectId: 'tamil',
      category: null,
      size: { mode: 'all' }
    };

    const selected = await selector.selectActivities(config);
    expect(selected.length).toBe(20);
    // Ensure no duplicates
    const ids = new Set(selected.map(a => a.id));
    expect(ids.size).toBe(20);
  });

  it('returns fewer activities gracefully if repo has insufficient content', async () => {
    mockRepo.getActivities.mockResolvedValue(mockActivities.slice(0, 3));
    
    const config: SessionConfig = {
      classId: '3',
      subjectId: 'tamil',
      category: null,
      size: { mode: 'fixed', count: 10 }
    };

    const selected = await selector.selectActivities(config);
    expect(selected.length).toBe(3);
  });

  it('does not mutate original repository data order', async () => {
    const original = [...mockActivities];
    mockRepo.getActivities.mockResolvedValue(original);
    
    const config: SessionConfig = {
      classId: '3',
      subjectId: 'tamil',
      category: null,
      size: { mode: 'fixed', count: 5 }
    };

    await selector.selectActivities(config);
    
    // Original array must not be altered by Fisher-Yates
    expect(original.map(a => a.id)).toEqual(mockActivities.map(a => a.id));
  });
});
