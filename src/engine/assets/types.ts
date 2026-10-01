export type AssetType = 'image' | 'audio';

export interface AssetReference {
  id: string;
  type: AssetType;
}

export interface ResolvedAsset {
  id: string;
  type: AssetType;
  source: 'local' | 'remote';
  path: string;
  alt?: string;
}

export type AssetResolutionState = 
  | { status: 'resolved'; asset: ResolvedAsset }
  | { status: 'missing'; id: string }
  | { status: 'invalid'; id: string; reason: string }
  | { status: 'unavailable'; id: string };

export interface AssetManifestEntry {
  type: string;
  source: string;
  path: string;
  alt?: string;
}

export interface AssetManifest {
  [id: string]: AssetManifestEntry;
}
