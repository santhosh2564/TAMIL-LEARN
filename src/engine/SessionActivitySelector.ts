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

    // Shuffle valid activities (creates a new array)
    const shuffled = this.shuffle(loadedActivities);

    // Apply session size constraints
    if (config.size.mode === 'fixed') {
      return shuffled.slice(0, config.size.count);
    }
    
    // mode === 'all'
    return shuffled;
  }
}
