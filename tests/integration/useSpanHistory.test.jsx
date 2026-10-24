import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { weekDates } from '../../src/lib/dates.js';
import { useSpanHistory } from '../../src/ui/hooks/useSpanHistory.js';

const DATE = '2026-10-19';
const setup = (rows = [{ id: 'a', start: '08:00', end: '12:00' }]) => renderHook(() => useSpanHistory(() => ({ [DATE]: rows })));

describe('useSpanHistory', () => {
  it('edits a field and records it in the change log', () => {
    const { result } = setup();
    act(() => result.current.updateSpan(DATE, result.current.spansByDate[DATE][0], 'end', '13:00'));
    expect(result.current.spansByDate[DATE][0].end).toBe('13:00');
    expect(result.current.changeLog).toHaveLength(1);
    expect(result.current.canUndo).toBe(true);
  });

  it('ignores no-op and invalid edits', () => {
    const { result } = setup();
    const span = result.current.spansByDate[DATE][0];
    act(() => result.current.updateSpan(DATE, span, 'end', '12:00'));
    act(() => result.current.updateSpan(DATE, span, 'end', '07:00'));
    expect(result.current.changeLog).toHaveLength(0);
  });

  it('undoes and redoes through the stacks', () => {
    const { result } = setup();
    act(() => result.current.updateSpan(DATE, result.current.spansByDate[DATE][0], 'end', '13:00'));
    act(() => result.current.undo());
    expect(result.current.spansByDate[DATE][0].end).toBe('12:00');
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.spansByDate[DATE][0].end).toBe('13:00');
  });

  it('adds a span starting where the last one ended, and undoes it', () => {
    const { result } = setup();
    act(() => result.current.addSpan(DATE));
    expect(result.current.spansByDate[DATE]).toHaveLength(2);
    expect(result.current.spansByDate[DATE][1]).toMatchObject({ start: '12:00', end: '' });
    act(() => result.current.undo());
    expect(result.current.spansByDate[DATE]).toHaveLength(1);
  });

  it('removes a span, but clears (not removes) the last remaining one', () => {
    const { result } = setup([{ id: 'a', start: '08:00', end: '10:00' }, { id: 'b', start: '11:00', end: '12:00' }]);
    act(() => result.current.removeSpan(DATE, result.current.spansByDate[DATE][1]));
    expect(result.current.spansByDate[DATE].map((s) => s.id)).toEqual(['a']);
    act(() => result.current.removeSpan(DATE, result.current.spansByDate[DATE][0]));
    expect(result.current.spansByDate[DATE]).toEqual([{ id: 'a', start: '', end: '' }]);
  });

  it('fills defaults only for missing dates', () => {
    const { result } = setup();
    act(() => result.current.ensureDates(weekDates(DATE)));
    expect(result.current.spansByDate[DATE]).toHaveLength(1);
    expect(result.current.spansByDate['2026-10-20']).toMatchObject([{ start: '08:00', end: '18:00' }]);
    expect(result.current.spansByDate['2026-10-24']).toEqual([]);
  });

  it('restoreSpans layers saved days over existing ones and ignores empty input', () => {
    const { result } = setup();
    const saved = { [DATE]: [{ id: 'z', start: '09:00', end: '10:00' }], '2026-01-05': [{ id: 'y', start: '10:00', end: '11:00' }] };
    act(() => result.current.restoreSpans(saved));
    expect(result.current.spansByDate).toEqual(saved);
    act(() => result.current.restoreSpans({}));
    act(() => result.current.restoreSpans(null));
    expect(result.current.spansByDate).toEqual(saved);
    expect(result.current.changeLog).toHaveLength(0); // restoring is not an undoable edit
  });
});
