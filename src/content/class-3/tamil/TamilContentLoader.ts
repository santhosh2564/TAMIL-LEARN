import { Activity, ContentManifest } from '../../../types';
import tamilActivities from './activities.json';
import tamilManifest from './manifest.json';
import tamilAssetManifest from './asset-manifest.json';

export class TamilContentLoader {
  /**
   * Loads all normalized Tamil activities directly from the verified dataset.
   */
  loadActivities(): Activity[] {
    return tamilActivities as Activity[];
  }

  /**
   * Loads the curriculum manifest for Tamil Class 3.
   */
  loadManifest(): ContentManifest {
    return (tamilManifest as unknown) as ContentManifest;
  }

  /**
   * Loads the asset manifest for Tamil Class 3 images.
   */
  loadAssetManifest(): Record<string, { type: 'image' | 'audio'; source: 'local'; path: string; alt?: string }> {
    return tamilAssetManifest as Record<string, { type: 'image' | 'audio'; source: 'local'; path: string; alt?: string }>;
  }
}
