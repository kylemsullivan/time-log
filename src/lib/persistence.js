import { defaultRows } from './spans.js';

const sameTimes = (a, b) => a.length === b.length && a.every((span, index) => span.start === b[index].start && span.end === b[index].end);

// Weekday index (Monday = 0) for an ISO date.
const dayIndexOf = (date) => (new Date(`${date}T12:00:00`).getDay() + 6) % 7;

// True when a day still holds the untouched placeholder rows, so there is nothing worth saving.
export const isDefaultDay = (date, rows) => sameTimes(rows, defaultRows(dayIndexOf(date)));

// The subset of days that should be written to disk: only days the user has changed.
export function editedDays(spansByDate) {
  return Object.fromEntries(Object.entries(spansByDate).filter(([date, rows]) => !isDefaultDay(date, rows)));
}
