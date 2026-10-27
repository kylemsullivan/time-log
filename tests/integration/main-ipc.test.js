// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Module, { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const MAIN = require.resolve('../../electron/main.cjs');

let userData;
let handlers;
let originalLoad;

// Loads electron/main.cjs against a stand-in `electron` module and captures its IPC handlers.
function loadMain({ openDialog, saveDialog } = {}) {
  handlers = {};
  const electron = {
    app: { setName() {}, setPath(_name, value) { userData = value; }, getPath: () => userData, isPackaged: true, whenReady: () => new Promise(() => {}), on() {} },
    BrowserWindow: Object.assign(function BrowserWindow() {}, { fromWebContents: () => null, getAllWindows: () => [] }),
    dialog: {
      showOpenDialog: async () => openDialog ?? { canceled: true, filePaths: [] },
      showSaveDialog: async () => saveDialog ?? { canceled: true },
    },
    ipcMain: { handle: (channel, fn) => { handlers[channel] = fn; } },
    Menu: {},
    nativeImage: {},
  };
  originalLoad = Module._load;
  Module._load = function patched(request, ...rest) { return request === 'electron' ? electron : originalLoad.call(this, request, ...rest); };
  delete require.cache[MAIN];
  require(MAIN);
}

beforeEach(async () => { userData = await fs.mkdtemp(path.join(os.tmpdir(), 'main-ipc-')); delete process.env.TIME_LOG_USER_DATA; });
afterEach(async () => { Module._load = originalLoad; delete require.cache[MAIN]; await fs.rm(userData, { recursive: true, force: true }); });

describe('spans IPC', () => {
  it('registers load/save handlers', () => {
    loadMain();
    expect(Object.keys(handlers)).toEqual(expect.arrayContaining(['spans:load', 'spans:save']));
  });

  it('saves to and loads from userData/spans.json', async () => {
    loadMain();
    const days = { '2026-10-19': [{ id: 'a', start: '09:00', end: '12:00' }] };
    expect(await handlers['spans:load']()).toEqual({});
    await handlers['spans:save']({}, days);
    expect(await handlers['spans:load']()).toEqual(days);
    expect(JSON.parse(await fs.readFile(path.join(userData, 'spans.json'), 'utf8')).days).toEqual(days);
  });
});

describe('notes IPC', () => {
  it('persists the chosen notes directory and returns it', async () => {
    const notes = path.join(userData, 'vault');
    await fs.mkdir(notes);
    loadMain({ openDialog: { canceled: false, filePaths: [notes] } });
    expect(await handlers['notes:get-directory']()).toBeNull();
    expect(await handlers['notes:directory']({ sender: {} })).toEqual({ directory: notes });
    expect(await handlers['notes:get-directory']()).toBe(notes);
  });

  it('returns null when the picker is cancelled', async () => {
    loadMain();
    expect(await handlers['notes:directory']({ sender: {} })).toBeNull();
  });

  it('lists and reads dated markdown files recursively, skipping dot folders', async () => {
    const vault = path.join(userData, 'vault');
    await fs.mkdir(path.join(vault, 'daily'), { recursive: true });
    await fs.mkdir(path.join(vault, '.obsidian'));
    await fs.writeFile(path.join(vault, 'daily', '2026-10-19.md'), 'Monday notes');
    await fs.writeFile(path.join(vault, '2026-10-27.md'), 'later');
    await fs.writeFile(path.join(vault, '.obsidian', '2026-10-20.md'), 'hidden');
    await fs.writeFile(path.join(vault, 'readme.md'), 'no date');
    loadMain();
    expect(await handlers['notes:list-dates']({}, vault)).toEqual(['2026-10-19', '2026-10-27']);
    const week = await handlers['notes:read-week']({}, { directory: vault, startDate: '2026-10-19', endDate: '2026-10-25' });
    expect(week).toEqual([expect.objectContaining({ date: '2026-10-19', content: 'Monday notes' })]);
    expect(await handlers['notes:list-dates']({}, '')).toEqual([]);
  });
});

describe('file import/export IPC', () => {
  it('writes the exported content to the chosen path', async () => {
    const filePath = path.join(userData, 'out.csv');
    loadMain({ saveDialog: { canceled: false, filePath } });
    expect(await handlers['files:export']({ sender: {} }, { defaultName: 'time-log.csv', extension: 'csv', content: 'a,b\n' })).toEqual({ path: filePath });
    expect(await fs.readFile(filePath, 'utf8')).toBe('a,b\n');
  });

  it('writes nothing when the save dialog is cancelled', async () => {
    loadMain();
    expect(await handlers['files:export']({ sender: {} }, { defaultName: 'x.csv', extension: 'csv', content: 'x' })).toBeNull();
  });

  it('reads the chosen import file and returns null when cancelled', async () => {
    const filePath = path.join(userData, 'in.csv');
    await fs.writeFile(filePath, 'date,start,end\n');
    loadMain({ openDialog: { canceled: false, filePaths: [filePath] } });
    expect(await handlers['files:import']({ sender: {} })).toEqual({ name: 'in.csv', content: 'date,start,end\n' });
    Module._load = originalLoad;
    loadMain();
    expect(await handlers['files:import']({ sender: {} })).toBeNull();
  });
});
