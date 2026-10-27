import { describe, expect, it } from 'vitest';
import { parseTime } from '../../src/lib/time-entry.js';

describe('parseTime', () => {
  it.each([
    ['9', '09:00'], ['09', '09:00'], ['17', '17:00'], ['930', '09:30'], ['0930', '09:30'], ['1415', '14:15'],
    ['9:30', '09:30'], ['9:05', '09:05'], ['0:00', '00:00'], [' 8 ', '08:00'],
    ['9a', '09:00'], ['9am', '09:00'], ['5p', '17:00'], ['5 PM', '17:00'], ['12a', '00:00'], ['12p', '12:00'], ['12:30pm', '12:30'], ['5 p.m.', '17:00'],
  ])('parses %j as %s', (text, expected) => expect(parseTime(text)).toBe(expected));

  it('returns an empty string for blank input', () => {
    expect(parseTime('')).toBe('');
    expect(parseTime('   ')).toBe('');
    expect(parseTime(undefined)).toBe('');
  });

  it.each(['abc', '24', '25:00', '9:60', '1260', '13p', '0a', '12345', '9:5', '9:30:00', '-1'])('rejects %j', (text) => expect(parseTime(text)).toBeNull());
});
