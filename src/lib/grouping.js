import { mondayOf, monthKey, monthName } from './dates.js';

// Groups active dates as [year, [[monthKey, { label, weeks: [[monday, dates]] }]]]
// with years/months newest-first and weeks/dates oldest-first.
export function groupDatesByYear(activeDates) {
  const months = new Map();
  [...new Set(activeDates)].sort().forEach((date) => {
    const monday = mondayOf(date);
    const key = monthKey(monday);
    if (!months.has(key)) months.set(key, { label: monthName(key), weeks: new Map() });
    const { weeks } = months.get(key);
    if (!weeks.has(monday)) weeks.set(monday, []);
    weeks.get(monday).push(date);
  });
  const years = new Map();
  [...months.entries()].sort(([a], [b]) => b.localeCompare(a)).forEach(([key, month]) => {
    const year = key.slice(0, 4);
    if (!years.has(year)) years.set(year, []);
    years.get(year).push([key, { label: month.label, weeks: [...month.weeks.entries()] }]);
  });
  return [...years.entries()].sort(([a], [b]) => b.localeCompare(a));
}
