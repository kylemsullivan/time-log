// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const { createSpansStore, sanitizeDays } = createRequire(import.meta.url)('../../electron/spans-store.cjs');

let dir;
let file;
beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'spans-store-')); file = path.join(dir, 'nested', 'spans.json'); });
afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

const day = [{ id: 'a', start: '09:00', end: '12:00' }];

describe('sanitizeDays', () => {
  it('drops malformed dates, rows and times', () => {
    expect(sanitizeDays({
      '2026-10-19': [{ id: 'a', start: '09:00', end: '12:00', extra: 1 }, { id: '', start: '09:00', end: '10:00' }, { id: 'b', start: '9am', end: '' }, null],
      'nope': day,
      '2026-10-20': 'not an array',
    })).toEqual({ '2026-10-19': [{ id: 'a', start: '09:00', end: '12:00' }] });
  });

  it('allows blank times (a cleared span)', () => {
    expect(sanitizeDays({ '2026-10-19': [{ id: 'a', start: '', end: '' }] })).toEqual({ '2026-10-19': [{ id: 'a', start: '', end: '' }] });
  });

  it.each([null, undefined, [], 'x', 4])('returns {} for %j', (value) => { expect(sanitizeDays(value)).toEqual({}); });
});

describe('createSpansStore', () => {
  it('loads {} when nothing has been saved', async () => {
    expect(await createSpansStore(file).load()).toEqual({});
  });

  it('round-trips data, creating the directory and a versioned file', async () => {
    const store = createSpansStore(file);
    await store.save({ '2026-10-19': day });
    expect(await store.load()).toEqual({ '2026-10-19': day });
    expect(JSON.parse(await fs.readFile(file, 'utf8'))).toEqual({ version: 1, days: { '2026-10-19': day } });
    expect(await fs.readdir(path.dirname(file))).toEqual(['spans.json']); // no leftover temp file
  });

  it('replaces the whole file on save (removed days disappear)', async () => {
    const store = createSpansStore(file);
    await store.save({ '2026-10-19': day, '2026-10-20': day });
    await store.save({ '2026-10-20': day });
    expect(Object.keys(await store.load())).toEqual(['2026-10-20']);
  });

  it('applies concurrent saves in order', async () => {
    const store = createSpansStore(file);
    const saves = Array.from({ length: 20 }, (_, i) => store.save({ '2026-10-19': [{ id: `r${i}`, start: '09:00', end: '10:00' }] }));
    await Promise.all(saves);
    expect((await store.load())['2026-10-19'][0].id).toBe('r19');
  });

  it('keeps working after a failed save', async () => {
    const blocked = path.join(dir, 'blocker');
    await fs.writeFile(blocked, 'x');
    const bad = createSpansStore(path.join(blocked, 'spans.json'));
    await expect(bad.save({})).rejects.toThrow();
    await expect(bad.save({})).rejects.toThrow(); // still rejects cleanly rather than hanging
  });

  it.each([
    ['invalid JSON', '{ not json'],
    ['an unsupported version', JSON.stringify({ version: 99, days: {} })],
    ['a non-object', '[]'],
  ])('moves aside a file with %s and starts empty', async (_name, contents) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
    expect(await createSpansStore(file).load()).toEqual({});
    const names = await fs.readdir(path.dirname(file));
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^spans\.json\.corrupt-\d+$/);
    expect(await fs.readFile(path.join(path.dirname(file), names[0]), 'utf8')).toBe(contents);
  });

  it('rethrows unexpected read errors instead of treating them as empty', async () => {
    await fs.mkdir(file, { recursive: true }); // a directory where the file should be -> EISDIR
    await expect(createSpansStore(file).load()).rejects.toThrow();
  });

  it('salvages valid days from a partially bad file', async () => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify({ version: 1, days: { '2026-10-19': day, bogus: day } }));
    expect(await createSpansStore(file).load()).toEqual({ '2026-10-19': day });
  });
});
