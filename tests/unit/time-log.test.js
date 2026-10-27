import { describe, expect, it } from 'vitest';
import { createDraft, formatDuration, isQuarterHourTime, parseWorkSpans, toMinutes } from '../../src/lib/time-log.js';

describe('time parsing', () => {
  it('converts HH:MM to minutes', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('08:30')).toBe(510);
  });

  it.each([['09:00', true], ['09:15', true], ['09:10', false], ['24:00', false], ['9:00', false]])('isQuarterHourTime(%s) = %s', (value, expected) => {
    expect(isQuarterHourTime(value)).toBe(expected);
  });

  it('parses comma separated spans', () => {
    expect(parseWorkSpans('09:00-12:00, 13:00-17:30')).toEqual([
      { start: '09:00', end: '12:00', minutes: 180 },
      { start: '13:00', end: '17:30', minutes: 270 },
    ]);
  });

  it('skips non quarter-hour and zero-length spans, and accepts 24:00', () => {
    expect(parseWorkSpans('09:10-10:00 09:00-09:00')).toEqual([]);
    expect(parseWorkSpans('22:00-24:00')).toEqual([{ start: '22:00', end: '24:00', minutes: 120 }]);
  });
});

describe('formatDuration', () => {
  it('shows hours with two decimals', () => {
    expect(formatDuration(90)).toBe('1.50h');
    expect(formatDuration(0)).toBe('0.00h');
  });
});

describe('createDraft', () => {
  const days = [
    { date: '2026-10-19', spans: [{ start: '09:00', end: '12:00', minutes: 180 }, { start: '13:00', end: '14:00', minutes: 60 }] },
    { date: '2026-10-20', spans: [] },
  ];

  it('includes notes, spans and totals', () => {
    const draft = createDraft([{ date: '2026-10-19', content: ' Did a thing \n' }], days);
    expect(draft).toContain('*2026-10-19*\n\nDid a thing');
    expect(draft).toContain('**4.00h worked (09:00-12:00, 13:00-14:00)**');
    expect(draft).toContain('**0.00h worked**');
    expect(draft).toMatch(/## Weekly total\n\n\*\*4.00h\*\*/);
  });

  it('handles an empty week', () => {
    expect(createDraft([], [])).toContain('_No days in this week._');
  });
});
