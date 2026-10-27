import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { createDraft, formatDuration } from '../lib/time-log.js';
import { fullDate, localISO, mondayOf, shiftDate, weekDates } from '../lib/dates.js';
import { defaultRows, EMPTY_ROWS, spanMinutes, totalFor } from '../lib/spans.js';
import { groupDatesByYear } from '../lib/grouping.js';
import { EXPORT_FORMATS, parseImport } from '../lib/exchange.js';
import { editedDays } from '../lib/persistence.js';
import { useSpanHistory } from './hooks/useSpanHistory.js';
import { useHistoryShortcuts } from './hooks/useHistoryShortcuts.js';
import { useSpanStorage } from './hooks/useSpanStorage.js';
import { useNotes } from './hooks/useNotes.js';
import Sidebar from './components/Sidebar.jsx';
import DayRow from './components/DayRow.jsx';
import PreviewPanel from './components/PreviewPanel.jsx';
import HistorySidebar from './components/HistorySidebar.jsx';
import DataMenu from './components/DataMenu.jsx';

const initialMonday = mondayOf(localISO(new Date()));
const initialSpans = () => Object.fromEntries(weekDates(initialMonday).map((date, index) => [date, defaultRows(index)]));

const HISTORY_OPEN_KEY = 'time-log.historyOpen';
const HIGHLIGHT_MS = 1800;
const readHistoryOpen = () => { try { return localStorage.getItem(HISTORY_OPEN_KEY) !== 'false'; } catch { return true; } };

export default function App() {
  const [weekStart, setWeekStart] = useState(initialMonday);
  const history = useSpanHistory(initialSpans);
  const { spansByDate, ensureDates, restoreSpans, importDays, undo, redo } = history;
  const { storageError } = useSpanStorage(spansByDate, restoreSpans);
  const { notes, noteDates, notesDirectory, directoryError, chooseNotesDirectory } = useNotes(weekStart);
  const [historyOpen, setHistoryOpen] = useState(readHistoryOpen);
  const [highlightDate, setHighlightDate] = useState(null);
  const [notice, setNotice] = useState({ kind: '', text: '' });
  const datePickerRef = useRef(null);
  const highlightTimer = useRef(null);
  const latestSpans = useRef(spansByDate);
  latestSpans.current = spansByDate;
  const dates = useMemo(() => weekDates(weekStart), [weekStart]);

  useEffect(() => { ensureDates(dates); }, [dates, ensureDates]);
  useHistoryShortcuts(undo, redo);

  const dayTotals = useMemo(() => Object.fromEntries(Object.entries(spansByDate).map(([date, rows]) => [date, totalFor(rows)])), [spansByDate]);
  const years = useMemo(() => groupDatesByYear([...Object.keys(dayTotals).filter((date) => dayTotals[date] > 0), ...noteDates]), [dayTotals, noteDates]);
  const totalMinutes = dates.reduce((sum, date) => sum + (dayTotals[date] || 0), 0);
  const draft = useMemo(() => createDraft(notes, dates.map((date) => ({
    date,
    spans: (spansByDate[date] || EMPTY_ROWS).map((span) => ({ ...span, minutes: spanMinutes(span) })).filter((span) => span.minutes > 0),
  }))), [notes, dates, spansByDate]);

  const selectWeek = useCallback((value) => setWeekStart(mondayOf(value)), []);
  // Opens the day's week, scrolls its row into view, highlights it and focuses its first time field.
  const goToDate = useCallback((monday, date) => {
    selectWeek(monday);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = document.getElementById(`hours-${date}`);
      if (!row) return;
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.querySelector('input')?.focus({ preventScroll: true });
      setHighlightDate(date);
      clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightDate(null), HIGHLIGHT_MS);
    }));
  }, [selectWeek]);
  useEffect(() => () => clearTimeout(highlightTimer.current), []);

  const toggleHistory = useCallback(() => setHistoryOpen((open) => {
    try { localStorage.setItem(HISTORY_OPEN_KEY, String(!open)); } catch { /* preference just won't persist */ }
    return !open;
  }), []);

  const importHours = useCallback(async () => {
    try {
      if (!window.timeLog?.importFile) throw new Error('Importing needs the desktop app. Restart Time Log so Electron reloads its preload bridge.');
      const file = await window.timeLog.importFile();
      if (!file) return;
      const { days, spanCount } = parseImport(file.content, file.name);
      const changed = importDays(days);
      const dayCount = Object.keys(days).length;
      setNotice({ kind: 'info', text: `Imported ${spanCount} span${spanCount === 1 ? '' : 's'} across ${dayCount} day${dayCount === 1 ? '' : 's'} from ${file.name}${changed < dayCount ? ` (${dayCount - changed} already matched)` : ''}.` });
    } catch (error) { setNotice({ kind: 'error', text: error.message || 'Could not import that file.' }); }
  }, [importDays]);

  const exportHours = useCallback(async (key) => {
    try {
      if (!window.timeLog?.exportFile) throw new Error('Exporting needs the desktop app. Restart Time Log so Electron reloads its preload bridge.');
      const { extension, serialize } = EXPORT_FORMATS[key];
      const saved = await window.timeLog.exportFile({ defaultName: `time-log.${extension}`, extension, content: serialize(editedDays(latestSpans.current)) });
      if (saved) setNotice({ kind: 'info', text: `Exported to ${saved.path}.` });
    } catch (error) { setNotice({ kind: 'error', text: error.message || 'Could not export hours.' }); }
  }, []);
  const openDatePicker = () => { const picker = datePickerRef.current; if (picker?.showPicker) picker.showPicker(); else picker?.focus(); };

  const previousWeek = `Week of ${fullDate(shiftDate(weekStart, -7))}`;
  const nextWeek = `Week of ${fullDate(shiftDate(weekStart, 7))}`;

  return <div className={`app-shell ${historyOpen ? '' : 'history-collapsed'}`}>
    <Sidebar years={years} weekStart={weekStart} dayTotals={dayTotals} onSelectWeek={selectWeek} onGoToDate={goToDate} />

    <main className="main-content">
      <div className="content-wrap">
        <div className="page-heading"><div><div className="eyebrow">WEEKLY TIMESHEET</div><h1>Time Log</h1></div><button type="button" title={notesDirectory ?? 'Choose Obsidian Notes Folder'} className={`button secondary directory-button ${notesDirectory ? 'is-set' : ''}`} onClick={chooseNotesDirectory}><FolderOpen size={16} /><span>Change</span></button></div>
        <DataMenu onImport={importHours} onExport={exportHours} />
        {(directoryError || storageError || notice.kind === 'error') && <div className="directory-error" role="alert">{directoryError || storageError || notice.text}</div>}
        {notice.kind === 'info' && <div className="notice" role="status">{notice.text}</div>}
        <div className="week-strip">
          <button className="week-arrow" title={previousWeek} aria-label={previousWeek} onClick={() => selectWeek(shiftDate(weekStart, -7))}><ChevronLeft size={17} /></button>
          <button type="button" className="picker-label" title="Choose Week" onClick={openDatePicker}><CalendarDays size={17} /><span>Week of</span></button>
          <input ref={datePickerRef} id="week-picker" title="Choose Week" aria-label="Choose Week" type="date" value={weekStart} onChange={(event) => event.target.value && selectWeek(event.target.value)} />
          <div className="week-stat"><span>WORKED</span><strong>{formatDuration(totalMinutes)}</strong></div>
          <button className="week-arrow next-week" title={nextWeek} aria-label={nextWeek} onClick={() => selectWeek(shiftDate(weekStart, 7))}><ChevronRight size={17} /></button>
        </div>

        <section className="panel hours-panel"><div className="panel-heading"><div className="panel-title"><div className="step">1</div><div><h2>Enter your worked hours</h2></div></div></div>
          <div className="week-day-list">{dates.map((date, index) => <DayRow key={date} date={date} index={index} highlighted={highlightDate === date} rows={spansByDate[date] || EMPTY_ROWS} onUpdate={history.updateSpan} onAdd={history.addSpan} onRemove={history.removeSpan} />)}</div>
        </section>

        <PreviewPanel draft={draft} />
      </div>
    </main>

    <HistorySidebar changeLog={history.changeLog} collapsed={!historyOpen} onToggle={toggleHistory} canUndo={history.canUndo} canRedo={history.canRedo} onUndo={undo} onRedo={redo} onUndoEntry={history.undoEntry} onRedoEntry={history.redoEntry} onRemove={history.removeChange} />
  </div>;
}
