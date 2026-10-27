import { describe, expect, it } from 'vitest';
import { EXPORT_FORMATS, parseImport } from '../../src/lib/exchange.js';
import { createDraft } from '../../src/lib/time-log.js';

const days = {
  '2026-10-20': [{ id: 'b', start: '13:00', end: '17:30' }, { id: 'c', start: '', end: '' }],
  '2026-10-19': [{ id: 'a', start: '09:00', end: '12:00' }],
  '2026-10-21': [{ id: 'd', start: '', end: '' }],
};
const normalized = { '2026-10-19': [{ start: '09:00', end: '12:00' }], '2026-10-20': [{ start: '13:00', end: '17:30' }] };

describe('export', () => {
  it('writes sorted CSV with hours, skipping incomplete spans', () => {
    expect(EXPORT_FORMATS.csv.serialize(days)).toBe('date,start,end,hours\n2026-10-19,09:00,12:00,3.00\n2026-10-20,13:00,17:30,4.50\n');
  });
  it('writes a Markdown table', () => {
    expect(EXPORT_FORMATS.md.serialize(days)).toBe('# Time Log\n\n| Date | Start | End | Hours |\n| --- | --- | --- | --- |\n| 2026-10-19 | 09:00 | 12:00 | 3.00 |\n| 2026-10-20 | 13:00 | 17:30 | 4.50 |\n');
  });
  it('writes JSON in the saved-spans shape without ids', () => {
    expect(JSON.parse(EXPORT_FORMATS.json.serialize(days))).toEqual({ version: 1, days: normalized });
  });
  it('exports an empty table when there are no spans', () => {
    expect(EXPORT_FORMATS.csv.serialize({})).toBe('date,start,end,hours\n');
  });
});

describe('import round trips', () => {
  for (const key of ['csv', 'md', 'json']) {
    it(`re-imports ${key} exports`, () => {
      const { extension, serialize } = EXPORT_FORMATS[key];
      expect(parseImport(serialize(days), `log.${extension}`)).toEqual({ days: normalized, spanCount: 2 });
    });
  }
});

describe('import parsing', () => {
  it('reads CSV with reordered columns, quotes, CRLF and typed times', () => {
    const csv = 'Notes,End,Date,Start\r\n"a, b",5p,2026-10-19,9\r\n';
    expect(parseImport(csv, 'x.csv').days).toEqual({ '2026-10-19': [{ start: '09:00', end: '17:00' }] });
  });
  it('reads headerless CSV as date,start,end', () => {
    expect(parseImport('2026-10-19,09:00,10:00\n', 'x.csv').days).toEqual({ '2026-10-19': [{ start: '09:00', end: '10:00' }] });
  });
  it('reads a copied draft', () => {
    const draft = createDraft([], [{ date: '2026-10-19', spans: [{ start: '09:00', end: '12:00', minutes: 180 }, { start: '13:00', end: '17:00', minutes: 240 }] }]);
    expect(parseImport(draft, 'draft.md').days).toEqual({ '2026-10-19': [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }] });
  });
  it('reads a bare JSON days object and sniffs the format without an extension', () => {
    expect(parseImport('{"2026-10-19":[{"start":"09:00","end":"10:00"}]}').days).toEqual({ '2026-10-19': [{ start: '09:00', end: '10:00' }] });
  });
  it('skips invalid rows but keeps valid ones', () => {
    const csv = 'date,start,end\nnot-a-date,09:00,10:00\n2026-10-19,10:00,09:00\n2026-10-19,xx,11:00\n2026-10-19,08:00,09:00\n';
    expect(parseImport(csv, 'x.csv')).toEqual({ days: { '2026-10-19': [{ start: '08:00', end: '09:00' }] }, spanCount: 1 });
  });
  it('throws when nothing usable is found or the JSON is broken', () => {
    expect(() => parseImport('hello', 'x.csv')).toThrow(/No time spans found/);
    expect(() => parseImport('{ nope', 'x.json')).toThrow(/could not be read/);
  });
});
