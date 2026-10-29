import { LocalContentRepository } from '../repositories/implementations/LocalContentRepository';
import { Activity } from '../types';
import { SessionConfig } from './types';

export class SessionActivitySelector {
  private repository: LocalContentRepository;

  constructor(repository: LocalContentRepository = new LocalContentRepository()) {
    this.repository = repository;
  }

  // Simple Fisher-Yates shuffle (does not mutate original array)
  private shuffle<T>(array: T[]): T[] {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Fetches, filters, shuffles, and sizes the activities based on the config.
   */
  async selectActivities(config: SessionConfig): Promise<Activity[]> {
    if (config.activityId) {
      const direct = await this.repository.getActivityById(config.activityId);
      if (direct) {
        return [direct];
      }
    }

    const isEnglish = config.subjectId === 'english' || config.subjectId === 'English';
    const loadedActivities = await this.repository.getActivities({
      classLevel: Number(config.classId),
      subject: config.subjectId === 'tamil' ? 'Tamil' : (isEnglish ? 'English' : config.subjectId),
      category: config.category || undefined,
      level: config.level,
      module: config.module,
      day: config.day,
    });

    if (loadedActivities.length === 0) {
      return [];
    }


    // For curriculum module / day sessions, preserve curriculum sequence (Position in Module / Day order).
    // For freeform practice or category drills (no module specified), shuffle for varied practice.
    const shouldShuffle = config.module === undefined && config.day === undefined;
    const activities = shouldShuffle ? this.shuffle(loadedActivities) : [...loadedActivities];

    // Apply session size constraints
    if (config.size.mode === 'fixed') {
      return activities.slice(0, config.size.count);
    }
    
    // mode === 'all'
    return activities;
  }

  /**
   * Resumes a session by loading the exact ordered activities by ID.
   */
  async selectActivitiesByIds(activityIds: string[]): Promise<Activity[]> {
    const list: Activity[] = [];
    for (const id of activityIds) {
      const act = await this.repository.getActivityById(id);
      if (act) {
        list.push(act);
      }
    }
    return list;
  }
}
