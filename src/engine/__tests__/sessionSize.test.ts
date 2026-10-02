import { describe, it, expect } from 'vitest';
import { parseSessionSize, serializeSessionSize } from '../sessionSize';

describe('sessionSize utilities', () => {
  describe('parseSessionSize', () => {
    it('parses fixed count size=5 correctly', () => {
      expect(parseSessionSize('5')).toEqual({ mode: 'fixed', count: 5 });
    });

    it('parses fixed count size=10 correctly', () => {
      expect(parseSessionSize('10')).toEqual({ mode: 'fixed', count: 10 });
    });

    it('parses size=all correctly', () => {
      expect(parseSessionSize('all')).toEqual({ mode: 'all' });
      expect(parseSessionSize('ALL')).toEqual({ mode: 'all' });
    });

    it('parses legacy size=9999 as mode: all for backward compatibility', () => {
      expect(parseSessionSize('9999')).toEqual({ mode: 'all' });
    });

    it('falls back safely to default fixed size=10 for missing parameter', () => {
      expect(parseSessionSize(null)).toEqual({ mode: 'fixed', count: 10 });
      expect(parseSessionSize(undefined)).toEqual({ mode: 'fixed', count: 10 });
      expect(parseSessionSize('')).toEqual({ mode: 'fixed', count: 10 });
    });

    it('falls back safely to default fixed size=10 for invalid non-numeric strings', () => {
      expect(parseSessionSize('abc')).toEqual({ mode: 'fixed', count: 10 });
    });

    it('falls back safely for negative numbers', () => {
      expect(parseSessionSize('-5')).toEqual({ mode: 'fixed', count: 10 });
    });

    it('falls back safely for zero', () => {
      expect(parseSessionSize('0')).toEqual({ mode: 'fixed', count: 10 });
    });

    it('falls back safely for decimal numbers', () => {
      expect(parseSessionSize('3.5')).toEqual({ mode: 'fixed', count: 10 });
    });
  });

  describe('serializeSessionSize', () => {
    it('serializes mode: all as "all"', () => {
      expect(serializeSessionSize({ mode: 'all' })).toBe('all');
    });

    it('serializes fixed mode correctly', () => {
      expect(serializeSessionSize({ mode: 'fixed', count: 5 })).toBe('5');
      expect(serializeSessionSize({ mode: 'fixed', count: 10 })).toBe('10');
    });

    it('never outputs 9999 as a serialized value', () => {
      expect(serializeSessionSize({ mode: 'all' })).not.toBe('9999');
    });
  });
});
