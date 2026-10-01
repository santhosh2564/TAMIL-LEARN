import { ContentRepository } from '../ContentRepository';
import { Activity, ActivityQuery, ContentManifest } from '../../types';
import class3TamilTerm1 from '../../content/class-3/tamil/term-1/activities.json';
import manifestTerm1 from '../../content/class-3/tamil/term-1/manifest.json';

export class LocalContentRepository implements ContentRepository {
  private activities: Activity[];
  private activityIndex: Map<string, Activity>;
  private manifest: ContentManifest;

  constructor() {
    this.manifest = manifestTerm1 as ContentManifest;
    this.activities = class3TamilTerm1 as Activity[];
    
    // Index for O(1) lookups
    this.activityIndex = new Map();
    for (const activity of this.activities) {
      this.activityIndex.set(activity.id, activity);
    }
  }

  /**
   * Helper to deep clone objects to guarantee immutability.
   * If structuredClone is available (modern environments), use it.
   * Otherwise fallback to JSON parse/stringify.
   */
  private clone<T>(obj: T): T {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
  }

  private filterActivities(query?: ActivityQuery): Activity[] {
    if (!query) {
      return this.activities;
    }

    return this.activities.filter(a => {
      if (query.classLevel !== undefined && a.classLevel !== query.classLevel) return false;
      if (query.subject !== undefined && a.subject !== query.subject) return false;
      if (query.term !== undefined && a.term !== query.term) return false;
      if (query.category !== undefined && a.category !== query.category) return false;
      if (query.variant !== undefined && a.variant !== query.variant) return false;
      if (query.level !== undefined && a.level !== query.level) return false;
      return true;
    });
  }

  async getManifest(): Promise<ContentManifest> {
    return Promise.resolve(this.clone(this.manifest));
  }

  async getActivities(query?: ActivityQuery): Promise<Activity[]> {
    const result = this.filterActivities(query);
    return Promise.resolve(this.clone(result));
  }

  async getActivityById(id: string): Promise<Activity | null> {
    const activity = this.activityIndex.get(id);
    if (!activity) {
      return Promise.resolve(null);
    }
    return Promise.resolve(this.clone(activity));
  }

  async getActivityCount(query?: ActivityQuery): Promise<number> {
    const result = this.filterActivities(query);
    return Promise.resolve(result.length);
  }
}
