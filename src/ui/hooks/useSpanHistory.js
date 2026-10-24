import { useCallback, useRef, useState } from 'react';
import { dayLabel } from '../../lib/dates.js';
import { applyToRows, blankSpan, defaultRows, EMPTY_ROWS, isValidEdit, makeId, sameField } from '../../lib/spans.js';

const HISTORY_LIMIT = 150;
const without = (list, id) => list.filter((item) => item !== id);

// Owns the per-day time spans plus an undo/redo change log. All returned actions are stable,
// so memoized children don't re-render when unrelated state changes.
export function useSpanHistory(initialSpans) {
  const [spansByDate, setSpansByDate] = useState(initialSpans);
  const [changeLog, setChangeLog] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const latest = useRef({});
  latest.current = { spansByDate, changeLog, undoStack, redoStack };

  const ensureDates = useCallback((dates) => {
    setSpansByDate((current) => {
      const missing = dates.filter((date) => !(date in current));
      if (!missing.length) return current;
      const next = { ...current };
      dates.forEach((date, index) => { if (!(date in next)) next[date] = defaultRows(index); });
      return next;
    });
  }, []);

  // Layers saved days over whatever is in memory (defaults for the visible week).
  const restoreSpans = useCallback((saved) => {
    if (saved && Object.keys(saved).length) setSpansByDate((current) => ({ ...current, ...saved }));
  }, []);

  const applyAction = useCallback((action, forward) => {
    setSpansByDate((current) => ({ ...current, [action.date]: applyToRows(current[action.date] || EMPTY_ROWS, action, forward) }));
  }, []);

  // Field edits are replayed from the whole field history so out-of-order undo/redo stays consistent.
  const replayField = useCallback((entry, history) => {
    const fieldActions = history.filter((item) => sameField(item, entry));
    const projected = fieldActions.filter((item) => item.status === 'active').at(-1);
    const value = projected?.nextValue ?? fieldActions[0]?.baseValue ?? entry.baseValue ?? '';
    setSpansByDate((current) => {
      const rows = [...(current[entry.date] || EMPTY_ROWS)];
      const index = rows.findIndex((span) => span.id === entry.spanId);
      if (index < 0) return current;
      rows[index] = { ...rows[index], [entry.side]: value };
      return { ...current, [entry.date]: rows };
    });
  }, []);

  const recordAction = useCallback((action, label) => {
    const priorField = action.kind === 'field' ? [...latest.current.changeLog].reverse().find((item) => sameField(item, action)) : null;
    const baseValue = action.kind === 'field' ? { baseValue: priorField?.baseValue ?? action.previousValue } : {};
    const entry = { ...action, ...baseValue, label, id: makeId(), status: 'active', undoneAt: null };
    applyAction(entry, true);
    setChangeLog((current) => [...current, entry].slice(-HISTORY_LIMIT));
    setUndoStack((current) => [...current, entry.id].slice(-HISTORY_LIMIT));
  }, [applyAction]);

  const updateSpan = useCallback((date, span, side, nextValue) => {
    if (span[side] === nextValue) return;
    if (!isValidEdit(latest.current.spansByDate[date] || EMPTY_ROWS, span, side, nextValue)) return;
    recordAction({ kind: 'field', date, spanId: span.id, side, previousValue: span[side], nextValue }, `${dayLabel(date)} · ${side} time`);
  }, [recordAction]);

  const addSpan = useCallback((date) => {
    const rows = latest.current.spansByDate[date] || EMPTY_ROWS;
    recordAction({ kind: 'insert', date, span: blankSpan(rows.at(-1)?.end || '', ''), index: rows.length }, `${dayLabel(date)} · added span`);
  }, [recordAction]);

  const removeSpan = useCallback((date, span) => {
    const rows = latest.current.spansByDate[date] || EMPTY_ROWS;
    if (rows.length <= 1) {
      recordAction({ kind: 'replace', date, spanId: span.id, previousSpan: span, nextSpan: { ...span, start: '', end: '' } }, `${dayLabel(date)} · cleared span`);
    } else {
      recordAction({ kind: 'remove', date, span, index: rows.findIndex((row) => row.id === span.id) }, `${dayLabel(date)} · removed span`);
    }
  }, [recordAction]);

  const undoEntry = useCallback((entry) => {
    if (entry.kind !== 'field') applyAction(entry, false);
    const nextLog = latest.current.changeLog.map((item) => (item.id === entry.id ? { ...entry, status: 'undone', undoneAt: Date.now() } : item));
    setChangeLog(nextLog);
    if (entry.kind === 'field') replayField(entry, nextLog);
    setUndoStack((current) => without(current, entry.id));
    setRedoStack((current) => [...without(current, entry.id), entry.id]);
  }, [applyAction, replayField]);

  const redoEntry = useCallback((entry) => {
    if (entry.kind !== 'field') applyAction(entry, true);
    const nextLog = latest.current.changeLog.map((item) => (item.id === entry.id ? { ...entry, status: 'active', undoneAt: null } : item));
    setChangeLog(nextLog);
    if (entry.kind === 'field') replayField(entry, nextLog);
    setRedoStack((current) => without(current, entry.id));
    setUndoStack((current) => [...without(current, entry.id), entry.id]);
  }, [applyAction, replayField]);

  const undo = useCallback(() => {
    const { undoStack: stack, changeLog: log } = latest.current;
    const entry = log.find((item) => item.id === stack.at(-1) && item.status === 'active');
    if (entry) undoEntry(entry);
  }, [undoEntry]);

  const redo = useCallback(() => {
    const { redoStack: stack, changeLog: log } = latest.current;
    const entry = log.find((item) => item.id === stack.at(-1) && item.status === 'undone');
    if (entry) redoEntry(entry);
  }, [redoEntry]);

  const removeChange = useCallback((entry) => {
    if (entry.status !== 'undone' || Date.now() - entry.undoneAt < 1000) return;
    setChangeLog((current) => current.filter((item) => item.id !== entry.id));
    setRedoStack((current) => without(current, entry.id));
  }, []);

  return {
    spansByDate, changeLog, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0,
    ensureDates, restoreSpans, updateSpan, addSpan, removeSpan, undo, redo, undoEntry, redoEntry, removeChange,
  };
}
