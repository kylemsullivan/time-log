import { memo, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Clock3 } from 'lucide-react';
import { formatDuration } from '../../lib/time-log.js';
import { dayLabel, monthKey, weekDates, weekLabel } from '../../lib/dates.js';

const Chevron = ({ open }) => (open ? <ChevronDown size={15} /> : <ChevronRight size={15} />);

function Sidebar({ years, weekStart, dayTotals, onSelectWeek, onGoToDate }) {
  const [expandedYears, setExpandedYears] = useState({});
  const [expandedMonths, setExpandedMonths] = useState({});
  const toggle = (setter, key) => setter((current) => ({ ...current, [key]: !current[key] }));

  // Keep the selected week visible, however it was selected.
  useEffect(() => {
    setExpandedMonths((current) => (current[monthKey(weekStart)] ? current : { ...current, [monthKey(weekStart)]: true }));
    setExpandedYears((current) => (current[weekStart.slice(0, 4)] ? current : { ...current, [weekStart.slice(0, 4)]: true }));
  }, [weekStart]);

  const weekTotal = (monday) => weekDates(monday).reduce((sum, date) => sum + (dayTotals[date] || 0), 0);

  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark"><Clock3 size={19} strokeWidth={2.5} /></div><span>Time Log</span></div>
    <div className="month-list">{years.map(([year, months]) => <section className="year-group" key={year}>
      <button className={`year-toggle ${expandedYears[year] ? 'expanded' : ''}`} title={`${expandedYears[year] ? 'Collapse' : 'Expand'} ${year}`} onClick={() => toggle(setExpandedYears, year)}><Chevron open={expandedYears[year]} /><span>{year}</span></button>
      {expandedYears[year] && months.map(([key, month]) => <section className="month-group" key={key}>
        <button title={`${expandedMonths[key] ? 'Collapse' : 'Expand'} ${month.label}`} className={`month-toggle ${monthKey(weekStart) === key ? 'selected' : ''}`} onClick={() => toggle(setExpandedMonths, key)}><Chevron open={expandedMonths[key]} /><span>{month.label.split(' ')[0]}</span></button>
        {expandedMonths[key] && <div className="month-weeks">{month.weeks.map(([monday, weekDays]) => <div className="sidebar-week" key={monday}>
          <button title={`Open ${weekLabel(monday)}`} className={`week-link ${monday === weekStart ? 'active' : ''}`} onClick={() => onSelectWeek(monday)}>{weekLabel(monday)} <span>({formatDuration(weekTotal(monday))})</span></button>
          {weekDays.map((date) => <button className="sidebar-date" key={date} title={`Go To ${dayLabel(date)}`} onClick={() => onGoToDate(monday, date)}>{dayLabel(date)} <span>({formatDuration(dayTotals[date] || 0)})</span></button>)}
        </div>)}</div>}
      </section>)}
    </section>)}</div>
  </aside>;
}

export default memo(Sidebar);
