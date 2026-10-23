import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock3, Copy, FolderOpen, Plus, Redo2, Trash2, Undo2 } from 'lucide-react';
import { createDraft, formatDuration } from '../lib/time-log.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const blankSpan = (start = '', end = '') => ({ id: makeId(), start, end });
const defaultSpans = (week) => Object.fromEntries(week.map((date, index) => [date, index < 5 ? [blankSpan('08:00', '18:00')] : []]));

function localISO(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function mondayOf(value) { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return localISO(date); }
function shiftDate(value, amount) { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + amount); return localISO(date); }
function weekDates(monday) { return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index)); }
function monthKey(value) { return value.slice(0, 7); }
function monthName(value) { return new Date(`${value}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }
function fullDate(value) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }); }
function weekLabel(value) { return `Week of ${new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`; }
function dayLabel(value) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }); }
function minutesAt(time) { if (!time) return null; const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; }
function spanMinutes(span) { const start = minutesAt(span.start); const end = minutesAt(span.end); return start === null || end === null ? 0 : Math.max(0, end - start); }
function totalFor(spans = []) { return spans.reduce((sum, span) => sum + spanMinutes(span), 0); }
function sameField(a, b) { return a.kind === 'field' && b.kind === 'field' && a.date === b.date && a.spanId === b.spanId && a.side === b.side; }
function minuteValue(time) { if (!time) return null; const [hours, minutes] = time.split(':').map(Number); return hours * 60 + minutes; }

export default function App() {
  const initialMonday = mondayOf(localISO(new Date()));
  const [weekStart, setWeekStart] = useState(initialMonday);
  const [spansByDate, setSpansByDate] = useState(() => defaultSpans(weekDates(initialMonday)));
  const [notes, setNotes] = useState([]);
  const [noteDates, setNoteDates] = useState([]);
  const [notesDirectory, setNotesDirectory] = useState(null);
  const [directoryError, setDirectoryError] = useState('');
  const [changeLog, setChangeLog] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [clockTick, setClockTick] = useState(0);
  const [expandedMonths, setExpandedMonths] = useState({ [monthKey(initialMonday)]: true });
  const [expandedYears, setExpandedYears] = useState({ [initialMonday.slice(0, 4)]: true });
  const datePickerRef = useRef(null);
  const dates = useMemo(() => weekDates(weekStart), [weekStart]);

  useEffect(() => {
    setSpansByDate((current) => {
      const next = { ...current };
      dates.forEach((date, index) => { if (!(date in next)) next[date] = index < 5 ? [blankSpan('08:00', '18:00')] : []; });
      return next;
    });
  }, [dates]);

  const datesByMonth = useMemo(() => {
    const activeDates = new Set([...Object.keys(spansByDate).filter((date) => totalFor(spansByDate[date]) > 0), ...noteDates]);
    const grouped = {};
    [...activeDates].sort().forEach((date) => {
      const monday = mondayOf(date);
      const key = monthKey(monday);
      grouped[key] ??= { label: monthName(key), weeks: {} };
      grouped[key].weeks[monday] ??= [];
      grouped[key].weeks[monday].push(date);
    });
    return grouped;
  }, [spansByDate, noteDates]);
  const years = useMemo(() => {
    const grouped = {};
    Object.entries(datesByMonth).forEach(([key, month]) => {
      const year = key.slice(0, 4);
      grouped[year] ??= [];
      grouped[year].push([key, month]);
    });
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([year, months]) => [year, months.sort(([a], [b]) => b.localeCompare(a))]);
  }, [datesByMonth]);
  const totalMinutes = dates.reduce((sum, date) => sum + totalFor(spansByDate[date]), 0);
  const draftDays = dates.map((date) => ({ date, spans: (spansByDate[date] || []).map((span) => ({ ...span, minutes: spanMinutes(span) })).filter((span) => span.minutes > 0) }));
  const draft = useMemo(() => createDraft(notes, draftDays), [notes, weekStart, spansByDate]);

  function selectWeek(monday) {
    const selected = mondayOf(monday);
    setWeekStart(selected);
    setExpandedMonths((current) => ({ ...current, [monthKey(selected)]: true }));
    setExpandedYears((current) => ({ ...current, [selected.slice(0, 4)]: true }));
  }
  function applyAction(action, forward) {
    setSpansByDate((current) => {
      const rows = [...(current[action.date] || [])];
      if (action.kind === 'field') {
        const index = rows.findIndex((span) => span.id === action.spanId);
        if (index >= 0) rows[index] = { ...rows[index], [action.side]: forward ? action.nextValue : action.previousValue };
      } else if (action.kind === 'insert') {
        const exists = rows.some((span) => span.id === action.span.id);
        if (forward && !exists) rows.splice(Math.min(action.index, rows.length), 0, action.span);
        if (!forward) return { ...current, [action.date]: rows.filter((span) => span.id !== action.span.id) };
      } else if (action.kind === 'remove') {
        if (forward) return { ...current, [action.date]: rows.filter((span) => span.id !== action.span.id) };
        if (!rows.some((span) => span.id === action.span.id)) rows.splice(Math.min(action.index, rows.length), 0, action.span);
      } else if (action.kind === 'replace') {
        const index = rows.findIndex((span) => span.id === action.spanId);
        if (index >= 0) rows[index] = forward ? action.nextSpan : action.previousSpan;
      }
      return { ...current, [action.date]: rows };
    });
  }
  function recordAction(action, label) {
    const priorFieldAction = action.kind === 'field' ? [...changeLog].reverse().find((item) => sameField(item, action)) : null;
    const entry = { ...action, ...(action.kind === 'field' ? { baseValue: priorFieldAction?.baseValue ?? action.previousValue } : {}), label, id: makeId(), status: 'active', undoneAt: null };
    applyAction(entry, true);
    setChangeLog((current) => [...current, entry].slice(-150));
    setUndoStack((current) => [...current, entry.id].slice(-150));
  }
  function updateSpan(date, span, side, nextValue) {
    const previousValue = span[side];
    if (previousValue === nextValue) return;
    const selected = minuteValue(nextValue);
    const other = minuteValue(span[side === 'start' ? 'end' : 'start']);
    if (selected !== null && other !== null && (side === 'start' ? selected >= other : selected <= other)) return;
    const rows = spansByDate[date] || [];
    const index = rows.findIndex((item) => item.id === span.id);
    if (selected !== null && side === 'start' && rows[index - 1]?.end && selected < minuteValue(rows[index - 1].end)) return;
    if (selected !== null && side === 'end' && rows[index + 1]?.start && selected > minuteValue(rows[index + 1].start)) return;
    recordAction({ kind: 'field', date, spanId: span.id, side, previousValue, nextValue }, `${dayLabel(date)} · ${side} time`);
  }
  function addSpan(date) {
    const rows = spansByDate[date] || [];
    const previous = rows.at(-1);
    const start = previous?.end || '';
    const span = blankSpan(start, '');
    recordAction({ kind: 'insert', date, span, index: rows.length }, `${dayLabel(date)} · added span`);
  }
  function removeSpan(date, span) {
    const rows = spansByDate[date] || [];
    if (rows.length <= 1) {
      const nextSpan = { ...span, start: '', end: '' };
      recordAction({ kind: 'replace', date, spanId: span.id, previousSpan: span, nextSpan }, `${dayLabel(date)} · cleared span`);
    } else {
      recordAction({ kind: 'remove', date, span, index: rows.findIndex((row) => row.id === span.id) }, `${dayLabel(date)} · removed span`);
    }
  }
  function markUndone(entry) {
    const updated = { ...entry, status: 'undone', undoneAt: Date.now() };
    const nextLog = changeLog.map((item) => item.id === entry.id ? updated : item);
    setChangeLog(nextLog);
    if (entry.kind === 'field') applyFieldHistory(entry, nextLog);
    setUndoStack((current) => current.filter((id) => id !== entry.id));
    setRedoStack((current) => [...current.filter((id) => id !== entry.id), entry.id]);
    setTimeout(() => setClockTick((tick) => tick + 1), 1050);
  }
  function markRedone(entry) {
    const updated = { ...entry, status: 'active', undoneAt: null };
    const nextLog = changeLog.map((item) => item.id === entry.id ? updated : item);
    setChangeLog(nextLog);
    if (entry.kind === 'field') applyFieldHistory(entry, nextLog);
    setRedoStack((current) => current.filter((id) => id !== entry.id));
    setUndoStack((current) => [...current.filter((id) => id !== entry.id), entry.id]);
  }
  function applyFieldHistory(entry, history) {
    const fieldActions = history.filter((item) => sameField(item, entry));
    const projected = fieldActions.filter((item) => item.status === 'active').at(-1);
    const value = projected?.nextValue ?? fieldActions[0]?.baseValue ?? entry.baseValue ?? '';
    setSpansByDate((current) => {
      const rows = [...(current[entry.date] || [])];
      const index = rows.findIndex((span) => span.id === entry.spanId);
      if (index < 0) return current;
      rows[index] = { ...rows[index], [entry.side]: value };
      return { ...current, [entry.date]: rows };
    });
  }
  function undoEntry(entry) { if (entry.kind !== 'field') applyAction(entry, false); markUndone(entry); }
  function redoEntry(entry) { if (entry.kind !== 'field') applyAction(entry, true); markRedone(entry); }
  function undo() {
    const id = undoStack.at(-1);
    const entry = changeLog.find((item) => item.id === id && item.status === 'active');
    if (entry) undoEntry(entry);
  }
  function redo() {
    const id = redoStack.at(-1);
    const entry = changeLog.find((item) => item.id === id && item.status === 'undone');
    if (entry) redoEntry(entry);
  }
  function removeChange(entry) {
    if (entry.status !== 'undone' || Date.now() - entry.undoneAt < 1000) return;
    setChangeLog((current) => current.filter((item) => item.id !== entry.id));
    setRedoStack((current) => current.filter((id) => id !== entry.id));
  }

  async function refreshNotes(directory = notesDirectory, start = weekStart) {
    if (!directory || !window.timeLog?.readWeekNotes) { setNotes([]); return; }
    try { setNotes(await window.timeLog.readWeekNotes({ directory, startDate: start, endDate: shiftDate(start, 6) })); setDirectoryError(''); }
    catch (error) { console.error('Unable to read notes folder', error); setNotes([]); setDirectoryError(`Could not read the selected folder: ${error.message || 'check folder access and try another directory.'}`); }
  }
  useEffect(() => { window.timeLog?.getNotesDirectory?.().then(setNotesDirectory).catch(console.error); }, []);
  useEffect(() => {
    if (!notesDirectory || !window.timeLog?.listNoteDates) { setNoteDates([]); return; }
    window.timeLog.listNoteDates(notesDirectory).then(setNoteDates).catch((error) => { setDirectoryError(`Could not list dated notes: ${error.message}`); setNoteDates([]); });
  }, [notesDirectory]);
  useEffect(() => { refreshNotes(notesDirectory, weekStart); }, [notesDirectory, weekStart]);
  useEffect(() => {
    const unsubscribe = window.timeLog?.onHistoryAction?.((action) => action === 'undo' ? undo() : redo());
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [undoStack, redoStack, changeLog]);
  useEffect(() => {
    function handleKeydown(event) {
      if ((!event.metaKey && !event.ctrlKey) || event.altKey) return;
      if ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
      else if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [undoStack, redoStack, changeLog]);

  async function chooseNotesDirectory() {
    setDirectoryError('');
    try {
      if (!window.timeLog?.chooseNotesDirectory) throw new Error('The folder picker is unavailable. Quit Time Log completely, then restart it with npm run dev so Electron reloads its preload bridge.');
      const result = await window.timeLog.chooseNotesDirectory();
      if (!result) return;
      const directory = typeof result === 'string' ? result : result.directory;
      if (!directory) throw new Error('The folder picker returned no folder path. Please try again.');
      setNotesDirectory(directory);
    } catch (error) { console.error('Unable to select notes folder', error); setDirectoryError(error.message || 'Could not select that folder.'); }
  }
  async function copyDraft() { await navigator.clipboard.writeText(draft); }
  function openDatePicker() {
    const picker = datePickerRef.current;
    if (picker?.showPicker) picker.showPicker();
    else picker?.focus();
  }
  const monthWeekTotal = (week) => weekDates(week).reduce((sum, date) => sum + totalFor(spansByDate[date]), 0);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Clock3 size={19} strokeWidth={2.5} /></div><span>Time Log</span></div>
      <div className="month-list">{years.map(([year, months]) => <section className="year-group" key={year}>
          <button className={`year-toggle ${expandedYears[year] ? 'expanded' : ''}`} title={`${expandedYears[year] ? 'Collapse' : 'Expand'} ${year}`} onClick={() => setExpandedYears((current) => ({ ...current, [year]: !current[year] }))}>{expandedYears[year] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<span>{year}</span></button>
        {expandedYears[year] && months.map(([key, month]) => <section className="month-group" key={key}>
          <button title={`${expandedMonths[key] ? 'Collapse' : 'Expand'} ${month.label}`} className={`month-toggle ${monthKey(weekStart) === key ? 'selected' : ''}`} onClick={() => setExpandedMonths((current) => ({ ...current, [key]: !current[key] }))}>{expandedMonths[key] ? <ChevronDown size={15} /> : <ChevronRight size={15} />}<span>{month.label.split(' ')[0]}</span></button>
          {expandedMonths[key] && <div className="month-weeks">{Object.entries(month.weeks).sort(([a], [b]) => a.localeCompare(b)).map(([monday, weekDays]) => <div className="sidebar-week" key={monday}>
            <button title={`Open ${weekLabel(monday)}`} className={`week-link ${monday === weekStart ? 'active' : ''}`} onClick={() => selectWeek(monday)}>{weekLabel(monday)} <span>({formatDuration(monthWeekTotal(monday))})</span></button>
            {[...weekDays].sort().map((date) => <button className="sidebar-date" key={date} title={`Go To ${dayLabel(date)}`} onClick={() => { selectWeek(monday); requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`hours-${date}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))); }}>{dayLabel(date)} <span>({formatDuration(totalFor(spansByDate[date]))})</span></button>)}
          </div>)}</div>}
        </section>)}
      </section>)}</div>
    </aside>

    <main className="main-content">
      <div className="content-wrap">
        <div className="page-heading"><div><div className="eyebrow">WEEKLY TIMESHEET</div><h1>Time Log</h1></div><button type="button" title={notesDirectory ?? 'Choose Obsidian Notes Folder'} className={`button secondary directory-button ${notesDirectory ? 'is-set' : ''}`} onClick={chooseNotesDirectory}><FolderOpen size={16} /><span>Change</span></button></div>
        {directoryError && <div className="directory-error" role="alert">{directoryError}</div>}
        <div className="week-strip">
          <button className="week-arrow" title={`Week of ${fullDate(shiftDate(weekStart, -7))}`} aria-label={`Week of ${fullDate(shiftDate(weekStart, -7))}`} onClick={() => selectWeek(shiftDate(weekStart, -7))}><ChevronLeft size={17} /></button>
          <button type="button" className="picker-label" title="Choose Week" onClick={openDatePicker}><CalendarDays size={17} /><span>Week of</span></button>
          <input ref={datePickerRef} id="week-picker" title="Choose Week" aria-label="Choose Week" type="date" value={weekStart} onChange={(event) => selectWeek(mondayOf(event.target.value))} />
          <div className="week-stat"><span>WORKED</span><strong>{formatDuration(totalMinutes)}</strong></div>
          <button className="week-arrow next-week" title={`Week of ${fullDate(shiftDate(weekStart, 7))}`} aria-label={`Week of ${fullDate(shiftDate(weekStart, 7))}`} onClick={() => selectWeek(shiftDate(weekStart, 7))}><ChevronRight size={17} /></button>
        </div>

        <section className="panel hours-panel"><div className="panel-heading"><div className="panel-title"><div className="step">1</div><div><h2>Enter your worked hours</h2></div></div></div>
          <div className="week-day-list">{dates.map((date, index) => {
            const weekend = index > 4;
            const rows = spansByDate[date] || [];
            const dayTotal = totalFor(rows);
            return <div id={`hours-${date}`} className={`week-day-row ${weekend ? 'weekend' : ''}`} key={date}>
              <div className="weekday-name"><strong>{DAYS[index]}</strong><span className="date-label">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></div>
              <div className="span-editor">{rows.map((span, spanIndex) => <div className="span-controls" key={span.id}>
                <input className="time-input" type="time" step="900" value={span.start} title={`${DAYS[index]} Span ${spanIndex + 1} Start Time`} aria-label={`${DAYS[index]} Span ${spanIndex + 1} Start Time`} onChange={(event) => updateSpan(date, span, 'start', event.target.value)} />
                <span className="range-dash">–</span>
                <input className="time-input" type="time" step="900" value={span.end} title={`${DAYS[index]} Span ${spanIndex + 1} End Time`} aria-label={`${DAYS[index]} Span ${spanIndex + 1} End Time`} onChange={(event) => updateSpan(date, span, 'end', event.target.value)} />
                <span className="entry-duration">{formatDuration(spanMinutes(span))}</span>
                <button className="span-action" title={`Delete ${DAYS[index]} Span ${spanIndex + 1}`} aria-label={`Delete ${DAYS[index]} Span ${spanIndex + 1}`} onClick={() => removeSpan(date, span)}><Trash2 size={14} /></button>
              </div>)}<button className="add-span" title={`Add ${DAYS[index]} Span`} aria-label={`Add ${DAYS[index]} Span`} onClick={() => addSpan(date)}><Plus size={15} /></button></div>
              <span className="day-total"><strong>{formatDuration(dayTotal)}</strong></span>
            </div>;
          })}</div>
        </section>

        <section className="panel preview-panel"><div className="panel-heading preview-heading"><div className="panel-title"><div className="step">2</div><div><h2>Review your time log</h2></div></div><button title="Copy Summary" className="button primary" onClick={copyDraft}><Copy size={15} />Copy</button></div><pre className="summary-preview">{draft}</pre></section>
      </div>
    </main>
    <aside className="history-sidebar" data-history-tick={clockTick}><div className="history-heading"><h2>Changes ({changeLog.length})</h2><div className="history-tools"><button title="Undo" aria-label="Undo" disabled={!undoStack.length} onClick={undo}><Undo2 size={16} /></button><button title="Redo" aria-label="Redo" disabled={!redoStack.length} onClick={redo}><Redo2 size={16} /></button></div></div><div className="history-list">{changeLog.length ? [...changeLog].reverse().map((entry) => {
      const canDelete = entry.status === 'undone' && Date.now() - entry.undoneAt >= 1000;
      const deleteTitle = `Permanently Delete “${entry.label}” From Changelog`;
      const redoTitle = `Redo “${entry.label}”`;
      const undoTitle = `Undo “${entry.label}”`;
      return <div className={`history-item ${entry.status === 'undone' ? 'undone' : ''}`} key={entry.id}><span className="history-label">{entry.label}</span>{entry.status === 'active' ? <button className="history-action" title={undoTitle} aria-label={undoTitle} onClick={() => undoEntry(entry)}><Undo2 size={14} /></button> : <><button className="history-action" title={canDelete ? deleteTitle : `${deleteTitle} (Available 1 Second After Undo)`} aria-label={canDelete ? deleteTitle : `${deleteTitle} (Available 1 Second After Undo)`} disabled={!canDelete} onClick={() => removeChange(entry)}><Trash2 size={14} /></button><button className="history-action" title={redoTitle} aria-label={redoTitle} onClick={() => redoEntry(entry)}><Redo2 size={14} /></button></>}</div>;
    }) : <p className="history-empty">Changes appear here.</p>}</div></aside>
  </div>;
}
