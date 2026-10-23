const noon = (value) => new Date(`${value}T12:00:00`);
const format = (value, options) => noon(value).toLocaleDateString(undefined, options);

export function localISO(date) { return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
export function shiftDate(value, amount) { const date = noon(value); date.setDate(date.getDate() + amount); return localISO(date); }
export function mondayOf(value) { const date = noon(value); return shiftDate(value, -((date.getDay() + 6) % 7)); }
export function weekDates(monday) { return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index)); }
export function monthKey(value) { return value.slice(0, 7); }
export function monthName(key) { return format(`${key}-01`, { month: 'long', year: 'numeric' }); }
export function fullDate(value) { return format(value, { month: 'long', day: 'numeric', year: 'numeric' }); }
export function weekLabel(value) { return `Week of ${format(value, { month: 'short', day: 'numeric' })}`; }
export function dayLabel(value) { return format(value, { weekday: 'short', month: 'short', day: 'numeric' }); }
export function shortDate(value) { return format(value, { month: 'short', day: 'numeric' }); }
