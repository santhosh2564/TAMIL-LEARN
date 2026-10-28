import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetResolver } from '../AssetResolver';
import { AssetReference } from '../types';

// Mock the manifest module
vi.mock('../../../content/class-3/tamil/term-1/assets.json', () => ({
  default: {
    'valid-image': {
      type: 'image',
      source: 'local',
      path: '/assets/images/valid.webp',
      alt: 'A valid image'
    },
    'valid-remote-image': {
      type: 'image',
      source: 'remote',
      path: 'https://example.com/image.jpg',
      alt: 'A remote image'
    },
    'invalid-remote': {
      type: 'image',
      source: 'remote',
      path: 'http://example.com/image.jpg', // HTTP not HTTPS
      alt: 'Invalid remote'
    },
    'unsafe-local': {
      type: 'image',
      source: 'local',
      path: '/assets/../images/unsafe.webp'
    },
    'wrong-type': {
      type: 'audio',
      source: 'local',
      path: '/assets/audio/sound.mp3'
    }
  }
}));

describe('AssetResolver', () => {
  let resolver: AssetResolver;

  beforeEach(() => {
    resolver = new AssetResolver();
  });

  it('resolves a valid local asset', () => {
    const ref: AssetReference = { id: 'valid-image', type: 'image' };
    const res = resolver.resolve(ref);
    expect(res.status).toBe('resolved');
    if (res.status === 'resolved') {
      expect(res.asset.path).toBe('/assets/images/valid.webp');
      expect(res.asset.alt).toBe('A valid image');
    }
  });

  it('resolves a valid remote asset', () => {
    const ref: AssetReference = { id: 'valid-remote-image', type: 'image' };
    const res = resolver.resolve(ref);
    expect(res.status).toBe('resolved');
    if (res.status === 'resolved') {
      expect(res.asset.path).toBe('https://example.com/image.jpg');
    }
  });

  it('returns missing for unknown asset', () => {
    const ref: AssetReference = { id: 'unknown-image', type: 'image' };
    const res = resolver.resolve(ref);
    expect(res.status).toBe('missing');
  });

  it('rejects unsafe ID traversal', () => {
    const ref: AssetReference = { id: '../valid-image', type: 'image' };
    const res = resolver.resolve(ref);
    expect(res.status).toBe('invalid');
  });

  it('rejects type mismatch', () => {
    const ref: AssetReference = { id: 'wrong-type', type: 'image' };
    const res = resolver.resolve(ref);
    expect(res.status).toBe('invalid');
  });

  it('rejects unsafe paths in manifest', () => {
    const ref: AssetReference = { id: 'unsafe-local', type: 'image' };
    const res = resolver.resolve(ref);
    expect(res.status).toBe('invalid');
  });

  it('rejects non-https remote sources', () => {
    const ref: AssetReference = { id: 'invalid-remote', type: 'image' };
    const res = resolver.resolve(ref);
    expect(res.status).toBe('invalid');
  });

  it('normalizes case when resolving asset ID', () => {
    const ref: AssetReference = { id: 'VALID-IMAGE', type: 'image' };
    const res = resolver.resolve(ref);
    expect(res.status).toBe('resolved');
  });

  it('resolves discrete Source ID alias from class3-tamil-picture-<id>', () => {
    const customResolver = new AssetResolver({
      'class3-tamil-picture-fts0014': {
        type: 'image',
        source: 'local',
        path: '/images/tamil-vocabulary/FTS0014.jpg',
        alt: 'அணில்'
      }
    });

    const res1 = customResolver.resolve({ id: 'class3-tamil-picture-FTS0014', type: 'image' });
    expect(res1.status).toBe('resolved');
    if (res1.status === 'resolved') {
      expect(res1.asset.path).toBe('/images/tamil-vocabulary/FTS0014.jpg');
    }

    const res2 = customResolver.resolve({ id: 'FTS0014', type: 'image' });
    expect(res2.status).toBe('resolved');

    const resMissing = customResolver.resolve({ id: 'FTS9999', type: 'image' });
    expect(resMissing.status).toBe('missing');
  });
});
