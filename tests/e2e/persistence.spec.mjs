import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
let userData;

test.beforeEach(async () => { userData = await fs.mkdtemp(path.join(os.tmpdir(), 'time-log-e2e-')); });
test.afterEach(async () => { await fs.rm(userData, { recursive: true, force: true }); });

// Launches the app with the built renderer (dist/ via file://) with isolated user data.
async function launch() {
  const app = await electron.launch({ args: [root], env: { ...process.env, TIME_LOG_USER_DATA: userData, TIME_LOG_USE_DIST: '1' } });
  const page = await app.firstWindow();
  await page.getByRole('heading', { name: 'Time Log', exact: true }).waitFor();
  return { app, page };
}

const spansFile = () => path.join(userData, 'spans.json');
const readSpans = async () => JSON.parse(await fs.readFile(spansFile(), 'utf8'));
// For polling while the app is still writing: a missing/partial file counts as "no data yet".
const readSpansOrEmpty = () => readSpans().catch(() => ({ version: 0, days: {} }));

test('hours survive quitting and relaunching the app', async () => {
  let { app, page } = await launch();
  await expect(page.getByLabel('Monday Span 1 End Time')).toHaveValue('18:00');

  await page.getByLabel('Monday Span 1 Start Time').fill('09:00');
  await page.getByLabel('Monday Span 1 End Time').fill('12:00');
  await page.getByRole('button', { name: 'Add Monday Span' }).click();
  await page.getByLabel('Monday Span 2 End Time').fill('17:00');

  await expect.poll(async () => Object.values((await readSpansOrEmpty()).days)[0]?.[1]?.end).toBe('17:00');
  await app.close();

  const saved = await readSpans();
  expect(saved.version).toBe(1);
  const [[date, rows]] = Object.entries(saved.days);
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(rows.map(({ start, end }) => [start, end])).toEqual([['09:00', '12:00'], ['12:00', '17:00']]);

  ({ app, page } = await launch());
  await expect(page.getByLabel('Monday Span 1 Start Time')).toHaveValue('09:00');
  await expect(page.getByLabel('Monday Span 1 End Time')).toHaveValue('12:00');
  await expect(page.getByLabel('Monday Span 2 End Time')).toHaveValue('17:00');
  await expect(page.locator('.week-stat strong')).toHaveText('48.00h'); // 8h edited Monday + four 10h placeholder weekdays
  await app.close();
});

test('a fresh install writes nothing until hours are edited', async () => {
  const { app, page } = await launch();
  await page.waitForTimeout(800);
  await expect(fs.access(spansFile())).rejects.toThrow();
  await expect(page.locator('.week-stat strong')).toHaveText('50.00h'); // five default 10h weekdays
  await app.close();
});

test('removed edits go back to placeholders after relaunch', async () => {
  let { app, page } = await launch();
  await page.getByLabel('Monday Span 1 End Time').fill('12:00');
  await expect.poll(async () => Object.keys((await readSpansOrEmpty()).days).length).toBe(1);
  await page.getByLabel('Monday Span 1 End Time').fill('18:00'); // back to the placeholder value
  await expect.poll(async () => Object.keys((await readSpans()).days).length).toBe(0);
  await app.close();

  ({ app, page } = await launch());
  await expect(page.getByLabel('Monday Span 1 End Time')).toHaveValue('18:00');
  await app.close();
});

test('a corrupt spans file is set aside and the app still starts', async () => {
  await fs.writeFile(spansFile(), '{ definitely not json');
  const { app, page } = await launch();
  await expect(page.getByLabel('Monday Span 1 End Time')).toHaveValue('18:00');
  await page.getByLabel('Monday Span 1 End Time').fill('12:00');
  await expect.poll(async () => (await readSpansOrEmpty()).version).toBe(1);
  const names = await fs.readdir(userData);
  expect(names.some((name) => name.startsWith('spans.json.corrupt-'))).toBe(true);
  await app.close();
});

test('saved days from other weeks are restored', async () => {
  await fs.writeFile(spansFile(), JSON.stringify({ version: 1, days: { '2025-03-03': [{ id: 'old', start: '10:00', end: '14:30' }] } }));
  const { app, page } = await launch();
  await page.getByLabel('Choose Week').fill('2025-03-03');
  await expect(page.getByLabel('Monday Span 1 Start Time')).toHaveValue('10:00');
  await expect(page.getByLabel('Monday Span 1 End Time')).toHaveValue('14:30');
  await app.close();
});
