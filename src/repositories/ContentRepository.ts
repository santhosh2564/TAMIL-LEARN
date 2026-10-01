import { Activity, ContentManifest, ActivityQuery } from '../types';

export interface ContentRepository {
  /**
   * Retrieves the manifest for the content package, detailing versions and supported categories.
   */
  getManifest(): Promise<ContentManifest>;

  /**
   * Retrieves activities optionally matching a query.
   */
  getActivities(query?: ActivityQuery): Promise<Activity[]>;

  /**
   * Retrieves a single activity by its ID.
   * Returns null if not found.
   */
  getActivityById(id: string): Promise<Activity | null>;

  /**
   * Gets the total count of activities, optionally filtered by a query.
   */
  getActivityCount(query?: ActivityQuery): Promise<number>;
}
