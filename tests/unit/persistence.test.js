import { describe, expect, it } from 'vitest';
import { editedDays, isDefaultDay } from '../../src/lib/persistence.js';

const rows = (...pairs) => pairs.map(([start, end], i) => ({ id: `s${i}`, start, end }));

describe('isDefaultDay', () => {
  it('treats the untouched weekday placeholder as default regardless of ids', () => {
    expect(isDefaultDay('2026-10-19', rows(['08:00', '18:00']))).toBe(true); // Monday
    expect(isDefaultDay('2026-10-23', rows(['08:00', '18:00']))).toBe(true); // Friday
  });

  it('treats an empty weekend as default', () => {
    expect(isDefaultDay('2026-10-24', [])).toBe(true);
    expect(isDefaultDay('2026-10-25', [])).toBe(true);
  });

  it('flags changed days', () => {
    expect(isDefaultDay('2026-10-19', rows(['09:00', '17:00']))).toBe(false);
    expect(isDefaultDay('2026-10-19', rows(['08:00', '12:00'], ['13:00', '18:00']))).toBe(false);
    expect(isDefaultDay('2026-10-19', rows(['', '']))).toBe(false); // cleared
    expect(isDefaultDay('2026-10-19', [])).toBe(false);
    expect(isDefaultDay('2026-10-24', rows(['09:00', '10:00']))).toBe(false); // weekend work
    expect(isDefaultDay('2026-10-24', rows(['08:00', '18:00']))).toBe(false); // weekend is not a workday default
  });
});

describe('editedDays', () => {
  it('keeps only non-default days', () => {
    const state = {
      '2026-10-19': rows(['08:00', '18:00']),
      '2026-10-20': rows(['09:00', '12:00']),
      '2026-10-24': [],
    };
    expect(editedDays(state)).toEqual({ '2026-10-20': state['2026-10-20'] });
  });
});
