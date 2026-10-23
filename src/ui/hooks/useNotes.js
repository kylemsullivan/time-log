import { useCallback, useEffect, useState } from 'react';
import { shiftDate } from '../../lib/dates.js';

// Loads the Obsidian notes folder, the dates that have notes, and the notes for the visible week.
export function useNotes(weekStart) {
  const [notes, setNotes] = useState([]);
  const [noteDates, setNoteDates] = useState([]);
  const [notesDirectory, setNotesDirectory] = useState(null);
  const [directoryError, setDirectoryError] = useState('');

  useEffect(() => { window.timeLog?.getNotesDirectory?.().then(setNotesDirectory).catch(console.error); }, []);

  useEffect(() => {
    if (!notesDirectory || !window.timeLog?.listNoteDates) { setNoteDates([]); return undefined; }
    let cancelled = false;
    window.timeLog.listNoteDates(notesDirectory)
      .then((dates) => { if (!cancelled) setNoteDates(dates); })
      .catch((error) => { if (!cancelled) { setDirectoryError(`Could not list dated notes: ${error.message}`); setNoteDates([]); } });
    return () => { cancelled = true; };
  }, [notesDirectory]);

  useEffect(() => {
    if (!notesDirectory || !window.timeLog?.readWeekNotes) { setNotes([]); return undefined; }
    let cancelled = false;
    window.timeLog.readWeekNotes({ directory: notesDirectory, startDate: weekStart, endDate: shiftDate(weekStart, 6) })
      .then((result) => { if (!cancelled) { setNotes(result); setDirectoryError(''); } })
      .catch((error) => {
        if (cancelled) return;
        console.error('Unable to read notes folder', error);
        setNotes([]);
        setDirectoryError(`Could not read the selected folder: ${error.message || 'check folder access and try another directory.'}`);
      });
    return () => { cancelled = true; };
  }, [notesDirectory, weekStart]);

  const chooseNotesDirectory = useCallback(async () => {
    setDirectoryError('');
    try {
      if (!window.timeLog?.chooseNotesDirectory) throw new Error('The folder picker is unavailable. Quit Time Log completely, then restart it with npm run dev so Electron reloads its preload bridge.');
      const result = await window.timeLog.chooseNotesDirectory();
      if (!result) return;
      const directory = typeof result === 'string' ? result : result.directory;
      if (!directory) throw new Error('The folder picker returned no folder path. Please try again.');
      setNotesDirectory(directory);
    } catch (error) { console.error('Unable to select notes folder', error); setDirectoryError(error.message || 'Could not select that folder.'); }
  }, []);

  return { notes, noteDates, notesDirectory, directoryError, chooseNotesDirectory };
}
