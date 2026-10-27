import { parseTime } from './time-entry.js';
import { spanMinutes } from './spans.js';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const hoursOf = (span) => (spanMinutes(span) / 60).toFixed(2);

// Sorted [date, spans] pairs, keeping only complete spans with a positive length.
function exportRows(days) {
  return Object.entries(days)
    .map(([date, spans]) => [date, spans.filter((span) => span.start && span.end && spanMinutes(span) > 0)])
    .filter(([, spans]) => spans.length)
    .sort(([a], [b]) => a.localeCompare(b));
}

const csvCell = (value) => (/[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

function toCsv(days) {
  const lines = exportRows(days).flatMap(([date, spans]) => spans.map((span) => [date, span.start, span.end, hoursOf(span)].join(',')));
  return `${['date,start,end,hours', ...lines].join('\n')}\n`;
}

function toMarkdown(days) {
  const lines = exportRows(days).flatMap(([date, spans]) => spans.map((span) => `| ${date} | ${span.start} | ${span.end} | ${hoursOf(span)} |`));
  return `# Time Log\n\n| Date | Start | End | Hours |\n| --- | --- | --- | --- |\n${lines.join('\n')}\n`;
}

function toJson(days) {
  const clean = Object.fromEntries(exportRows(days).map(([date, spans]) => [date, spans.map(({ start, end }) => ({ start, end }))]));
  return `${JSON.stringify({ version: 1, days: clean }, null, 2)}\n`;
}

export const EXPORT_FORMATS = {
  csv: { label: 'CSV', extension: 'csv', serialize: toCsv },
  md: { label: 'Markdown', extension: 'md', serialize: toMarkdown },
  json: { label: 'JSON', extension: 'json', serialize: toJson },
};

// Collects { date: [{ start, end }] }, ignoring spans that aren't valid ordered times.
function collector() {
  const days = {};
  return {
    add(date, start, end) {
      const from = parseTime(start);
      const to = parseTime(end);
      if (!DATE.test(date) || !from || !to || from >= to) return;
      (days[date] ??= []).push({ start: from, end: to });
    },
    days,
  };
}

function splitCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') { cell += '"'; i += 1; } else if (char === '"') quoted = false; else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { cells.push(cell.trim()); cell = ''; } else cell += char;
  }
  return [...cells, cell.trim()];
}

function fromCsv(text) {
  const { add, days } = collector();
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const header = splitCsvLine(lines[0] ?? '').map((name) => name.toLowerCase());
  const hasHeader = header.includes('date');
  const columns = hasHeader ? ['date', 'start', 'end'].map((name) => header.indexOf(name)) : [0, 1, 2];
  lines.slice(hasHeader ? 1 : 0).forEach((line) => {
    const cells = splitCsvLine(line);
    add(cells[columns[0]], cells[columns[1]], cells[columns[2]]);
  });
  return days;
}

// Reads either the exported table or a copied draft ("*2026-10-19*" ... "**8.00h worked (09:00-17:00)**").
function fromMarkdown(text) {
  const { add, days } = collector();
  let current = null;
  text.split(/\r?\n/).forEach((line) => {
    const row = line.trim();
    const heading = /^\*(\d{4}-\d{2}-\d{2})\*$/.exec(row);
    if (heading) { current = heading[1]; return; }
    if (row.startsWith('|')) {
      const [date, start, end] = row.split('|').slice(1, -1).map((cell) => cell.trim());
      add(date, start, end);
      return;
    }
    const spans = /worked\s*\(([^)]*)\)/.exec(row);
    if (current && spans) for (const [, start, end] of spans[1].matchAll(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/g)) add(current, start, end);
  });
  return days;
}

function fromJson(text) {
  const { add, days } = collector();
  const parsed = JSON.parse(text);
  const source = parsed?.days && typeof parsed.days === 'object' ? parsed.days : parsed;
  Object.entries(source ?? {}).forEach(([date, spans]) => {
    if (Array.isArray(spans)) spans.forEach((span) => add(date, span?.start, span?.end));
  });
  return days;
}

function detectFormat(text, fileName = '') {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  if (extension === 'json') return 'json';
  if (extension === 'csv') return 'csv';
  if (['md', 'markdown', 'txt'].includes(extension)) return 'md';
  if (/^\s*[{[]/.test(text)) return 'json';
  return /^\s*(#|\||\*)/.test(text) ? 'md' : 'csv';
}

// Parses an imported file into { days: { date: [{ start, end }] }, spanCount }. Throws when nothing usable is found.
export function parseImport(text, fileName) {
  const parse = { csv: fromCsv, md: fromMarkdown, json: fromJson }[detectFormat(text, fileName)];
  let days;
  try { days = parse(text); } catch { throw new Error('That file could not be read. Expected CSV, Markdown or JSON from Time Log.'); }
  const spanCount = Object.values(days).reduce((sum, spans) => sum + spans.length, 0);
  if (!spanCount) throw new Error('No time spans found. Each span needs a YYYY-MM-DD date plus start and end times.');
  return { days, spanCount };
}
