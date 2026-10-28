// @vitest-environment node
/**
 * Tests for class code generation and ambiguous character exclusion.
 */
import { describe, it, expect } from 'vitest';
import { generateClassCode, isValidClassCode, UNAMBIGUOUS_CHARSET } from '../classCode';

describe('Class Code Generation and Validation', () => {
  it('generates codes of requested length (exactly 6 characters)', () => {
    const code = generateClassCode();
    expect(code.length).toBe(6);
    expect(generateClassCode(6).length).toBe(6);
  });

  it('throws for invalid code length (!== 6)', () => {
    expect(() => generateClassCode(4)).toThrow();
    expect(() => generateClassCode(5)).toThrow();
    expect(() => generateClassCode(7)).toThrow();
  });

  it('never contains ambiguous characters: 0, O, 1, I, L across 1000 generated codes', () => {
    const ambiguousChars = ['0', 'O', '1', 'I', 'L'];
    for (let i = 0; i < 1000; i++) {
      const code = generateClassCode();
      expect(code.length).toBe(6);
      for (const amb of ambiguousChars) {
        expect(code).not.toContain(amb);
      }
      expect(isValidClassCode(code)).toBe(true);
    }
  });

  it('UNAMBIGUOUS_CHARSET explicitly omits 0, O, 1, I, L', () => {
    expect(UNAMBIGUOUS_CHARSET).not.toContain('0');
    expect(UNAMBIGUOUS_CHARSET).not.toContain('O');
    expect(UNAMBIGUOUS_CHARSET).not.toContain('1');
    expect(UNAMBIGUOUS_CHARSET).not.toContain('I');
    expect(UNAMBIGUOUS_CHARSET).not.toContain('L');
  });

  it('rejects codes containing ambiguous characters or incorrect length in validator', () => {
    expect(isValidClassCode('7B0K23')).toBe(false); // contains 0
    expect(isValidClassCode('7BOK23')).toBe(false); // contains O
    expect(isValidClassCode('7B1K23')).toBe(false); // contains 1
    expect(isValidClassCode('7BIK23')).toBe(false); // contains I
    expect(isValidClassCode('7BLK23')).toBe(false); // contains L
    expect(isValidClassCode('7B3K')).toBe(false);   // wrong length (4 instead of 6)
    expect(isValidClassCode('7B3K9A')).toBe(true);  // unambiguous 6-char
  });
});

