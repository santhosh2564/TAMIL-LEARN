import { AssetReference, AssetResolutionState, AssetManifest } from './types';
import class3TamilTerm1Assets from '../../content/class-3/tamil/term-1/assets.json';
import class3EnglishAssets from '../../content/class-3/english/asset-manifest.json';

const getDefaultManifest = (): AssetManifest => {
  return {
    ...(class3TamilTerm1Assets as AssetManifest),
    ...(class3EnglishAssets as AssetManifest)
  };
};

export class AssetResolver {
  private customManifest?: AssetManifest;

  constructor(customManifest?: AssetManifest) {
    this.customManifest = customManifest;
  }

  resolve(ref: AssetReference): AssetResolutionState {
    if (!ref || !ref.id || typeof ref.id !== 'string') {
      return { status: 'invalid', id: ref?.id || 'unknown', reason: 'Invalid asset ID format' };
    }

    // Security check: reject paths/traversals
    if (ref.id.includes('..') || ref.id.includes('/') || ref.id.includes('\\')) {
      return { status: 'invalid', id: ref.id, reason: 'Unsafe characters in asset ID' };
    }

    const manifest = this.customManifest || getDefaultManifest();
    const entry = manifest[ref.id];

    if (!entry) {
      return { status: 'missing', id: ref.id };
    }

    if (entry.type !== ref.type) {
      return { status: 'invalid', id: ref.id, reason: `Asset type mismatch. Expected ${ref.type}, got ${entry.type}` };
    }

    const rawPath = entry.path || '';
    if (rawPath.includes('..') || rawPath.startsWith('javascript:')) {
      return { status: 'invalid', id: ref.id, reason: 'Unsafe path in manifest' };
    }
    
    // We strictly only support local and valid remote (https)
    if (entry.source === 'remote' && !rawPath.startsWith('https://')) {
      return { status: 'invalid', id: ref.id, reason: 'Remote source must use https protocol' };
    }

    return {
      status: 'resolved',
      asset: {
        id: ref.id,
        type: entry.type as 'image' | 'audio',
        source: entry.source as 'local' | 'remote',
        path: rawPath,
        alt: entry.alt
      }
    };
  }
}
