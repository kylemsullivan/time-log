import { describe, expect, it } from 'vitest';
import { localISO, mondayOf, monthKey, shiftDate, weekDates } from '../../src/lib/dates.js';

describe('dates', () => {
  it('formats local dates as ISO', () => {
    expect(localISO(new Date(2026, 9, 24, 23, 59))).toBe('2026-10-24');
  });

  it('shifts across month and year boundaries', () => {
    expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('snaps any day to its Monday', () => {
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
    expect(mondayOf('2026-10-25')).toBe('2026-10-19'); // Sunday
    expect(mondayOf('2026-10-21')).toBe('2026-10-19');
  });

  it('lists seven days from Monday', () => {
    const week = weekDates('2026-10-19');
    expect(week).toHaveLength(7);
    expect(week[0]).toBe('2026-10-19');
    expect(week[6]).toBe('2026-10-25');
  });

  it('derives month keys', () => { expect(monthKey('2026-10-19')).toBe('2026-10'); });
});
