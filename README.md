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
3. Enter weekday spans using 24-hour time with quarter-hour boundaries, such as `09:00-12:00, 13:00-17:00`.
4. Review and copy the draft summary.

The app is a single-user local desktop tool. The draft includes imported note contents and follows the `/time-log` output sections, but it does not allocate note items to ticket time yet. Review and complete allocations and assumptions using the global Claude `/time-log` skill before treating it as a timesheet. The skill is not bundled with this app and is not invoked automatically.

Folder selection happens in Electron's main process. The selected folder path is stored in Electron's local user data, and note contents are read from that directory through the preload bridge.

## Structure

- `electron/main.cjs` — Electron window and secure file-picker IPC
- `electron/preload.cjs` — context-isolated renderer API
- `src/ui` — React interface
- `src/lib/time-log.js` — time parsing and draft formatting
