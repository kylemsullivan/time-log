import { memo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatDuration } from '../../lib/time-log.js';
import { shortDate } from '../../lib/dates.js';
import { spanMinutes, totalFor } from '../../lib/spans.js';
import TimeInput from './TimeInput.jsx';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function DayRow({ date, index, rows, highlighted, onUpdate, onAdd, onRemove }) {
  const day = DAYS[index];
  return <div id={`hours-${date}`} className={`week-day-row ${index > 4 ? 'weekend' : ''} ${highlighted ? 'highlighted' : ''}`}>
    <div className="weekday-name"><strong>{day}</strong><span className="date-label">{shortDate(date)}</span></div>
    <div className="span-editor">{rows.map((span, spanIndex) => {
      const label = `${day} Span ${spanIndex + 1}`;
      return <div className="span-controls" key={span.id}>
        <TimeInput value={span.start} label={`${label} Start Time`} onCommit={(next) => onUpdate(date, span, 'start', next)} />
        <span className="range-dash">–</span>
        <TimeInput value={span.end} label={`${label} End Time`} onCommit={(next) => onUpdate(date, span, 'end', next)} />
        <span className="entry-duration">{formatDuration(spanMinutes(span))}</span>
        <button className="span-action" title={`Delete ${label}`} aria-label={`Delete ${label}`} onClick={() => onRemove(date, span)}><Trash2 size={14} /></button>
      </div>;
    })}<button className="add-span" title={`Add ${day} Span`} aria-label={`Add ${day} Span`} onClick={() => onAdd(date)}><Plus size={15} /></button></div>
    <span className="day-total"><strong>{formatDuration(totalFor(rows))}</strong></span>
  </div>;
}

export default memo(DayRow);
