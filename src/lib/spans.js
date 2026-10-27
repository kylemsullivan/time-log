import { toMinutes } from './time-log.js';

export const EMPTY_ROWS = Object.freeze([]);
export const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const blankSpan = (start = '', end = '') => ({ id: makeId(), start, end });
export const defaultRows = (dayIndex) => (dayIndex < 5 ? [blankSpan('08:00', '18:00')] : []);

const optionalMinutes = (time) => (time ? toMinutes(time) : null);

export function spanMinutes(span) {
  const start = optionalMinutes(span.start);
  const end = optionalMinutes(span.end);
  return start === null || end === null ? 0 : Math.max(0, end - start);
}
export function totalFor(spans = EMPTY_ROWS) { return spans.reduce((sum, span) => sum + spanMinutes(span), 0); }

// A start/end edit is valid when it keeps the span ordered and doesn't overlap its neighbours.
export function isValidEdit(rows, span, side, nextValue) {
  const selected = optionalMinutes(nextValue);
  if (selected === null) return true;
  const other = optionalMinutes(span[side === 'start' ? 'end' : 'start']);
  if (other !== null && (side === 'start' ? selected >= other : selected <= other)) return false;
  const index = rows.findIndex((item) => item.id === span.id);
  const previousEnd = rows[index - 1]?.end;
  const nextStart = rows[index + 1]?.start;
  if (side === 'start' && previousEnd && selected < toMinutes(previousEnd)) return false;
  if (side === 'end' && nextStart && selected > toMinutes(nextStart)) return false;
  return true;
}

// Pure transition of one day's rows for a history action, forward (do/redo) or backward (undo).
export function applyToRows(current, action, forward) {
  const rows = [...current];
  const at = (id) => rows.findIndex((span) => span.id === id);
  const without = (id) => rows.filter((span) => span.id !== id);
  switch (action.kind) {
    case 'field': {
      const index = at(action.spanId);
      if (index >= 0) rows[index] = { ...rows[index], [action.side]: forward ? action.nextValue : action.previousValue };
      return rows;
    }
    case 'insert':
      if (!forward) return without(action.span.id);
      if (at(action.span.id) < 0) rows.splice(Math.min(action.index, rows.length), 0, action.span);
      return rows;
    case 'remove':
      if (forward) return without(action.span.id);
      if (at(action.span.id) < 0) rows.splice(Math.min(action.index, rows.length), 0, action.span);
      return rows;
    case 'replace': {
      const index = at(action.spanId);
      if (index >= 0) rows[index] = forward ? action.nextSpan : action.previousSpan;
      return rows;
    }
    case 'rows':
      return [...(forward ? action.nextRows : action.previousRows)];
    default:
      return rows;
  }
}

export function sameField(a, b) { return a.kind === 'field' && b.kind === 'field' && a.date === b.date && a.spanId === b.spanId && a.side === b.side; }
