const fs = require('node:fs/promises');
const path = require('node:path');

const VERSION = 1;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const isTime = (value) => value === '' || (typeof value === 'string' && TIME.test(value));

// Returns clean { date: [{ id, start, end }] }, dropping anything malformed instead of failing the whole file.
function sanitizeDays(days) {
  const clean = {};
  if (!days || typeof days !== 'object' || Array.isArray(days)) return clean;
  for (const [date, rows] of Object.entries(days)) {
    if (!DATE.test(date) || !Array.isArray(rows)) continue;
    clean[date] = rows
      .filter((row) => row && typeof row.id === 'string' && row.id && isTime(row.start) && isTime(row.end))
      .map(({ id, start, end }) => ({ id, start, end }));
  }
  return clean;
}

// Persists worked spans as one JSON file. Writes are serialized and atomic (temp file + rename),
// and an unreadable file is moved aside rather than overwritten.
function createSpansStore(filePath) {
  let queue = Promise.resolve();

  async function load() {
    let text;
    try {
      text = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return {};
      throw error;
    }
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || parsed.version !== VERSION) throw new Error('Unsupported spans file');
      return sanitizeDays(parsed.days);
    } catch {
      await fs.rename(filePath, `${filePath}.corrupt-${Date.now()}`);
      return {};
    }
  }

  function save(days) {
    const payload = JSON.stringify({ version: VERSION, days: sanitizeDays(days) }, null, 2);
    const write = async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      const temp = `${filePath}.tmp`;
      await fs.writeFile(temp, payload, 'utf8');
      await fs.rename(temp, filePath);
    };
    const result = queue.then(write);
    queue = result.catch(() => {});
    return result;
  }

  return { load, save };
}

module.exports = { createSpansStore, sanitizeDays, VERSION };
