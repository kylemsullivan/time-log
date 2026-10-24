import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { createDraft, formatDuration } from '../lib/time-log.js';
import { fullDate, localISO, mondayOf, shiftDate, weekDates } from '../lib/dates.js';
import { defaultRows, EMPTY_ROWS, spanMinutes, totalFor } from '../lib/spans.js';
import { groupDatesByYear } from '../lib/grouping.js';
import { useSpanHistory } from './hooks/useSpanHistory.js';
import { useHistoryShortcuts } from './hooks/useHistoryShortcuts.js';
import { useSpanStorage } from './hooks/useSpanStorage.js';
import { useNotes } from './hooks/useNotes.js';
import Sidebar from './components/Sidebar.jsx';
import DayRow from './components/DayRow.jsx';
import PreviewPanel from './components/PreviewPanel.jsx';
import HistorySidebar from './components/HistorySidebar.jsx';

const initialMonday = mondayOf(localISO(new Date()));
const initialSpans = () => Object.fromEntries(weekDates(initialMonday).map((date, index) => [date, defaultRows(index)]));

export default function App() {
  const [weekStart, setWeekStart] = useState(initialMonday);
  const history = useSpanHistory(initialSpans);
  const { spansByDate, ensureDates, restoreSpans, undo, redo } = history;
  const { storageError } = useSpanStorage(spansByDate, restoreSpans);
  const { notes, noteDates, notesDirectory, directoryError, chooseNotesDirectory } = useNotes(weekStart);
  const datePickerRef = useRef(null);
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
  const goToDate = useCallback((monday, date) => {
    selectWeek(monday);
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById(`hours-${date}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })));
  }, [selectWeek]);
  const openDatePicker = () => { const picker = datePickerRef.current; if (picker?.showPicker) picker.showPicker(); else picker?.focus(); };

  const previousWeek = `Week of ${fullDate(shiftDate(weekStart, -7))}`;
  const nextWeek = `Week of ${fullDate(shiftDate(weekStart, 7))}`;

  return <div className="app-shell">
    <Sidebar years={years} weekStart={weekStart} dayTotals={dayTotals} onSelectWeek={selectWeek} onGoToDate={goToDate} />

    <main className="main-content">
      <div className="content-wrap">
        <div className="page-heading"><div><div className="eyebrow">WEEKLY TIMESHEET</div><h1>Time Log</h1></div><button type="button" title={notesDirectory ?? 'Choose Obsidian Notes Folder'} className={`button secondary directory-button ${notesDirectory ? 'is-set' : ''}`} onClick={chooseNotesDirectory}><FolderOpen size={16} /><span>Change</span></button></div>
        {(directoryError || storageError) && <div className="directory-error" role="alert">{directoryError || storageError}</div>}
        <div className="week-strip">
          <button className="week-arrow" title={previousWeek} aria-label={previousWeek} onClick={() => selectWeek(shiftDate(weekStart, -7))}><ChevronLeft size={17} /></button>
          <button type="button" className="picker-label" title="Choose Week" onClick={openDatePicker}><CalendarDays size={17} /><span>Week of</span></button>
          <input ref={datePickerRef} id="week-picker" title="Choose Week" aria-label="Choose Week" type="date" value={weekStart} onChange={(event) => event.target.value && selectWeek(event.target.value)} />
          <div className="week-stat"><span>WORKED</span><strong>{formatDuration(totalMinutes)}</strong></div>
          <button className="week-arrow next-week" title={nextWeek} aria-label={nextWeek} onClick={() => selectWeek(shiftDate(weekStart, 7))}><ChevronRight size={17} /></button>
        </div>

        <section className="panel hours-panel"><div className="panel-heading"><div className="panel-title"><div className="step">1</div><div><h2>Enter your worked hours</h2></div></div></div>
          <div className="week-day-list">{dates.map((date, index) => <DayRow key={date} date={date} index={index} rows={spansByDate[date] || EMPTY_ROWS} onUpdate={history.updateSpan} onAdd={history.addSpan} onRemove={history.removeSpan} />)}</div>
        </section>

        <PreviewPanel draft={draft} />
      </div>
    </main>

    <HistorySidebar changeLog={history.changeLog} canUndo={history.canUndo} canRedo={history.canRedo} onUndo={undo} onRedo={redo} onUndoEntry={history.undoEntry} onRedoEntry={history.redoEntry} onRemove={history.removeChange} />
  </div>;
}
