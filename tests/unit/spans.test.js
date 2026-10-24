import { describe, expect, it } from 'vitest';
import { applyToRows, blankSpan, defaultRows, isValidEdit, sameField, spanMinutes, totalFor } from '../../src/lib/spans.js';

const span = (id, start, end) => ({ id, start, end });

describe('span math', () => {
  it('counts minutes and ignores incomplete spans', () => {
    expect(spanMinutes(span('a', '09:00', '10:30'))).toBe(90);
    expect(spanMinutes(span('a', '09:00', ''))).toBe(0);
    expect(spanMinutes(span('a', '10:00', '09:00'))).toBe(0);
  });

  it('totals a day', () => {
    expect(totalFor([span('a', '09:00', '10:00'), span('b', '11:00', '12:30')])).toBe(150);
    expect(totalFor()).toBe(0);
  });

  it('defaults weekdays to 08:00-18:00 and weekends to empty', () => {
    expect(defaultRows(0)).toMatchObject([{ start: '08:00', end: '18:00' }]);
    expect(defaultRows(4)).toHaveLength(1);
    expect(defaultRows(5)).toEqual([]);
  });

  it('generates unique ids', () => {
    expect(blankSpan().id).not.toBe(blankSpan().id);
  });
});

describe('isValidEdit', () => {
  const rows = [span('a', '08:00', '10:00'), span('b', '11:00', '12:00')];

  it('allows clearing a value', () => { expect(isValidEdit(rows, rows[0], 'end', '')).toBe(true); });
  it('rejects start at or after end', () => { expect(isValidEdit(rows, rows[0], 'start', '10:00')).toBe(false); });
  it('rejects end at or before start', () => { expect(isValidEdit(rows, rows[0], 'end', '08:00')).toBe(false); });
  it('rejects overlap with the previous span', () => { expect(isValidEdit(rows, rows[1], 'start', '09:30')).toBe(false); });
  it('rejects overlap with the next span', () => { expect(isValidEdit(rows, rows[0], 'end', '11:30')).toBe(false); });
  it('accepts a valid change', () => { expect(isValidEdit(rows, rows[0], 'end', '10:45')).toBe(true); });
});

describe('applyToRows', () => {
  const base = [span('a', '08:00', '10:00'), span('b', '11:00', '12:00')];

  it('applies and reverts a field edit', () => {
    const action = { kind: 'field', spanId: 'a', side: 'end', previousValue: '10:00', nextValue: '10:30' };
    const forward = applyToRows(base, action, true);
    expect(forward[0].end).toBe('10:30');
    expect(applyToRows(forward, action, false)[0].end).toBe('10:00');
    expect(base[0].end).toBe('10:00'); // input not mutated
  });

  it('inserts and removes', () => {
    const insert = { kind: 'insert', span: span('c', '13:00', ''), index: 2 };
    const added = applyToRows(base, insert, true);
    expect(added.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(applyToRows(added, insert, true)).toHaveLength(3); // idempotent
    expect(applyToRows(added, insert, false).map((s) => s.id)).toEqual(['a', 'b']);

    const remove = { kind: 'remove', span: base[0], index: 0 };
    const removed = applyToRows(base, remove, true);
    expect(removed.map((s) => s.id)).toEqual(['b']);
    expect(applyToRows(removed, remove, false).map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('replaces', () => {
    const action = { kind: 'replace', spanId: 'a', previousSpan: base[0], nextSpan: span('a', '', '') };
    expect(applyToRows(base, action, true)[0]).toEqual(span('a', '', ''));
    expect(applyToRows(applyToRows(base, action, true), action, false)[0]).toEqual(base[0]);
  });

  it('ignores unknown actions', () => { expect(applyToRows(base, { kind: 'nope' }, true)).toEqual(base); });
});

describe('sameField', () => {
  const a = { kind: 'field', date: 'd', spanId: 's', side: 'start' };
  it('matches the same field only', () => {
    expect(sameField(a, { ...a })).toBe(true);
    expect(sameField(a, { ...a, side: 'end' })).toBe(false);
    expect(sameField(a, { ...a, kind: 'insert' })).toBe(false);
  });
});
