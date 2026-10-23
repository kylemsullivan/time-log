const TIME = /^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/;
const SPAN = /(?:^|\s)([01]\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]\d|2[0-3]|24):([0-5]\d)(?=$|\s|[,;])/g;

export function isQuarterHourTime(value) { return TIME.test(value); }
export function parseWorkSpans(value) {
  const spans = [];
  for (const match of value.matchAll(SPAN)) {
    const start = `${match[1]}:${match[2]}`;
    const end = `${match[3]}:${match[4]}`;
    if (!isQuarterHourTime(start) || !(isQuarterHourTime(end) || end === '24:00')) continue;
    const minutes = (toMinutes(end) - toMinutes(start) + 1440) % 1440;
    if (minutes > 0) spans.push({ start, end, minutes });
  }
  return spans;
}
export function toMinutes(value) { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes; }
export function formatDuration(totalMinutes) { return `${(totalMinutes / 60).toFixed(2)}h`; }

export function createDraft(notes, workDays) {
  const notesByDate = new Map(notes.map((note) => [note.date, note]));
  const dayRows = workDays.map(({ date, spans }) => {
    const total = spans.reduce((sum, span) => sum + span.minutes, 0);
    const spanLabel = spans.map(({ start, end }) => `${start}-${end}`).join(', ');
    const note = notesByDate.get(date);
    const noteBody = note ? `\n\n${note.content.trim()}` : '';
    return `*${date}*${noteBody}\n\n**${formatDuration(total)} worked${spanLabel ? ` (${spanLabel})` : ''}**`;
  }).join('\n\n---\n\n');
  const weekTotal = workDays.flatMap(({ spans }) => spans).reduce((sum, span) => sum + span.minutes, 0);
  return `${dayRows || '_No days in this week._'}\n\n## Weekly total\n\n**${formatDuration(weekTotal)}**\n`;
}
