# Time Log

Electron + React scaffolding for turning Obsidian Markdown daily notes and worked-hour spans into a weekly time log draft.

## Run locally

```sh
npm install
npm run dev
```

`npm run build` builds the React renderer. Packaging and signing are intentionally left for a later step.

## Current workflow

1. Select the Obsidian daily-notes folder with **Notes Directory**. The path is saved locally and can be changed by choosing another folder. The app reads files matching `YYYY-MM-DD.md` for the selected week.
2. Choose a date in the **Week of** control. It always snaps to Monday and displays Monday through Sunday; weekend hours are disabled.
3. Type each span's start and end times (see **Entering time** below).
4. Review and copy the draft summary.
5. Optionally **Import** or **Export** hours (see **Import and export** below).

The app is a single-user local desktop tool. The draft includes imported note contents and follows the `/time-log` output sections, but it does not allocate note items to ticket time yet. Review and complete allocations and assumptions using the global Claude `/time-log` skill before treating it as a timesheet. The skill is not bundled with this app and is not invoked automatically.

Folder selection happens in Electron's main process. The selected folder path is stored in Electron's local user data, and note contents are read from that directory through the preload bridge.

## Entering time

Start and end fields are plain text boxes, so you can type and Tab straight through a day. Times are normalized to 24-hour `HH:MM` when you leave the field or press Enter; Escape discards what you typed.

| Typed | Becomes |
| --- | --- |
| `9`, `09`, `9:00` | `09:00` |
| `930`, `0930`, `9:30` | `09:30` |
| `1415` | `14:15` |
| `9a`, `9am` | `09:00` |
| `5p`, `5 pm`, `12:30pm` | `17:00`, `17:00`, `12:30` |
| `12a` / `12p` | `00:00` / `12:00` |

Bare numbers are 24-hour (`5` is `05:00`; type `5p` for the afternoon). Unrecognized text snaps back to the previous value, as do edits that would make a span end before it starts or overlap its neighbour.

## Navigation and layout

- Clicking a day in the left sidebar opens its week, scrolls to that day, highlights it briefly, and focuses its first time field so you can start typing.
- The **Changes** panel on the right collapses to a slim rail with the panel's hide/show button. The choice is remembered between launches (browser `localStorage`).

## Import and export

**Export** saves your hours with a native save dialog in the chosen format; **Import** opens a file and loads it. Both only handle days you have edited, like the saved data file (untouched `08:00-18:00` placeholders are not exported).

| Format | Export | Import |
| --- | --- | --- |
| CSV | `date,start,end,hours` with one row per span | Needs `date`, `start`, `end` columns (any order, extra columns ignored); headerless files are read as date, start, end |
| Markdown | A `# Time Log` table of `Date / Start / End / Hours` | That table, or a copied draft from this app (`*2026-10-19*` ... `**8.00h worked (09:00-17:00)**`) |
| JSON | `{ "version": 1, "days": { "2026-10-19": [{ "start", "end" }] } }` | The same shape, or a bare `days` object |

- Imported times may use the shorthand above (`9`, `5p`). Rows with an invalid date, an unreadable time, or an end at or before the start are skipped.
- Importing **replaces** every day present in the file; other days are untouched. Each replaced day is one entry in the Changes panel, so an import can be undone day by day.
- Files over 5 MB are rejected. The format is chosen by file extension, falling back to the contents.

## Data storage

Worked spans are saved automatically to a single JSON file in Electron's user data directory (on macOS, `~/Library/Application Support/Time Log/spans.json`), next to `notes-directory.json`. Nothing leaves your machine, and your Obsidian notes are never written to.

```json
{
  "version": 1,
  "days": {
    "2026-10-19": [{ "id": "1729350000000-ab12cd", "start": "09:00", "end": "12:00" }]
  }
}
```

- **Only edited days are saved.** Days still showing the placeholder `08:00-18:00` weekday default are omitted, so reloading never mistakes a placeholder for real data.
- **When it saves.** About 300 ms after your last edit, and again when the window hides or closes. Saving is disabled until the file has loaded successfully, so a failed read can't overwrite existing data.
- **Safe writes.** Each save writes `spans.json.tmp` and renames it over `spans.json`, and saves are queued so they can't interleave.
- **Corrupt or unsupported files** are moved aside to `spans.json.corrupt-<timestamp>` and the app starts empty. Individual malformed days or spans are dropped on load.
- **Undo/redo history is not saved.** It resets on each launch.
- **Backups and sync.** The file is plain JSON, so you can copy it, diff it, or edit it by hand while the app is closed.
- **Use a different location.** Set `TIME_LOG_USER_DATA` to a directory before launching to keep all local data (spans and notes folder) there. The e2e tests use this to stay isolated from your real data. `TIME_LOG_USE_DIST=1` makes an unpackaged Electron load the built `dist/` instead of the Vite dev server.

## Testing

```sh
npm test              # unit + integration (Vitest)
npm run test:unit     # src/lib and electron/spans-store only
npm run test:e2e      # builds the renderer and drives the real Electron app (Playwright)
npm run test:all
```

- **Unit** (`tests/unit`) — pure logic: time parsing and typed-time shorthand, import/export formats, dates, span rules and undo/redo transitions, grouping, change detection, and the spans file store (against a temp directory).
- **Integration** (`tests/integration`) — React hooks and the full `App` in jsdom with a fake `window.timeLog` bridge, plus the IPC handlers (spans, notes, import/export dialogs) in `electron/main.cjs` against a mocked Electron.
- **E2E** (`tests/e2e`) — launches Electron with a throwaway `TIME_LOG_USER_DATA`, edits hours (including typed shorthand), restarts the app, and checks the data came back.

## Structure

- `electron/main.cjs` — Electron window, secure file-picker IPC, and import/export dialogs
- `electron/spans-store.cjs` — atomic JSON persistence for worked spans
- `electron/preload.cjs` — context-isolated renderer API
- `src/ui` — React interface
- `src/lib/time-log.js` — time parsing and draft formatting
- `src/lib/time-entry.js` — typed-time shorthand parser
- `src/lib/exchange.js` — CSV / Markdown / JSON import and export
- `src/lib/persistence.js` — decides which days are worth saving
- `src/ui/hooks/useSpanStorage.js` — load on mount, debounced save
