import { memo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { formatDuration } from '../../lib/time-log.js';
import { shortDate } from '../../lib/dates.js';
import { spanMinutes, totalFor } from '../../lib/spans.js';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function DayRow({ date, index, rows, onUpdate, onAdd, onRemove }) {
  const day = DAYS[index];
  return <div id={`hours-${date}`} className={`week-day-row ${index > 4 ? 'weekend' : ''}`}>
    <div className="weekday-name"><strong>{day}</strong><span className="date-label">{shortDate(date)}</span></div>
    <div className="span-editor">{rows.map((span, spanIndex) => {
      const label = `${day} Span ${spanIndex + 1}`;
      return <div className="span-controls" key={span.id}>
        <input className="time-input" type="time" step="900" value={span.start} title={`${label} Start Time`} aria-label={`${label} Start Time`} onChange={(event) => onUpdate(date, span, 'start', event.target.value)} />
        <span className="range-dash">–</span>
        <input className="time-input" type="time" step="900" value={span.end} title={`${label} End Time`} aria-label={`${label} End Time`} onChange={(event) => onUpdate(date, span, 'end', event.target.value)} />
        <span className="entry-duration">{formatDuration(spanMinutes(span))}</span>
        <button className="span-action" title={`Delete ${label}`} aria-label={`Delete ${label}`} onClick={() => onRemove(date, span)}><Trash2 size={14} /></button>
      </div>;
    })}<button className="add-span" title={`Add ${day} Span`} aria-label={`Add ${day} Span`} onClick={() => onAdd(date)}><Plus size={15} /></button></div>
    <span className="day-total"><strong>{formatDuration(totalFor(rows))}</strong></span>
  </div>;
}

export default memo(DayRow);
