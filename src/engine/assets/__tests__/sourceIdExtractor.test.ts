import { describe, it, expect } from 'vitest';
import { extractSourceId, matchesSourceId } from '../sourceIdExtractor';

describe('Source ID Extractor & Matcher', () => {
  it('extracts bare FTS filename (FTS0549.jpg -> FTS0549)', () => {
    expect(extractSourceId('FTS0549.jpg')).toBe('FTS0549');
    expect(matchesSourceId('FTS0549.jpg', 'FTS0549')).toBe(true);
  });

  it('extracts prefix FTS filename (Picture_04_FTS0014.jpg -> FTS0014)', () => {
    expect(extractSourceId('Picture_04_FTS0014.jpg')).toBe('FTS0014');
    expect(matchesSourceId('Picture_04_FTS0014.jpg', 'FTS0014')).toBe(true);
  });

  it('extracts suffix FTS filename (FTS1039_Veliyoor.jpg -> FTS1039)', () => {
    expect(extractSourceId('FTS1039_Veliyoor.jpg')).toBe('FTS1039');
    expect(matchesSourceId('FTS1039_Veliyoor.jpg', 'FTS1039')).toBe(true);
  });

  it('extracts earlier Q filename (Q001_Muyal.jpg -> Q001)', () => {
    expect(extractSourceId('Q001_Muyal.jpg')).toBe('Q001');
    expect(matchesSourceId('Q001_Muyal.jpg', 'Q001')).toBe(true);
  });

  it('prevents false substring match: FTS103 must NOT match FTS1039', () => {
    expect(matchesSourceId('FTS1039.jpg', 'FTS103')).toBe(false);
    expect(extractSourceId('FTS103.jpg')).toBe(null); // FTS requires 4 digits
  });

  it('prevents false substring match: FTS10390 must NOT match FTS1039', () => {
    expect(matchesSourceId('FTS10390.jpg', 'FTS1039')).toBe(false);
    expect(extractSourceId('FTS10390.jpg')).toBe(null); // 5 digits
  });

  it('handles lowercase input and normalizes consistently (fts0014 -> FTS0014)', () => {
    expect(extractSourceId('picture_04_fts0014.jpg')).toBe('FTS0014');
    expect(matchesSourceId('picture_04_fts0014.jpg', 'fts0014')).toBe(true);
    expect(matchesSourceId('Picture_04_FTS0014.jpg', 'fts0014')).toBe(true);
    expect(matchesSourceId('Picture_04_FTS0014.jpg', 'FTS0014')).toBe(true);
  });

  it('returns null for unindexed UUID filenames', () => {
    expect(extractSourceId('15c12610-e4dc-407a-acba-8b57b7e1176a.png')).toBe(null);
    expect(extractSourceId('f27fab07-acd4-48ef-99f9-427ecb51e7fe.png')).toBe(null);
  });

  it('handles full file paths and extracts the basename source ID', () => {
    expect(extractSourceId('public/images/tamil-vocabulary/Picture_04_FTS0014.jpg')).toBe('FTS0014');
    expect(extractSourceId('C:\\Users\\Desktop\\Tamil spelling images\\picture set 21\\FTS1039_Veliyoor.jpg')).toBe('FTS1039');
  });

  it('returns false for missing or non-existent IDs', () => {
    expect(matchesSourceId('FTS0014.jpg', 'FTS9999')).toBe(false);
    expect(matchesSourceId('', 'FTS0014')).toBe(false);
    expect(matchesSourceId('random_image.jpg', 'FTS0014')).toBe(false);
  });
});

