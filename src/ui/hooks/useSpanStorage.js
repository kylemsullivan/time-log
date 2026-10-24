import { useEffect, useRef, useState } from 'react';
import { editedDays } from '../../lib/persistence.js';

export const SAVE_DELAY_MS = 300;

// Loads saved spans once on mount, then writes edited days back to disk (debounced) after every change.
// Saving stays disabled until the load succeeds so a failed read can never overwrite existing data.
export function useSpanStorage(spansByDate, restoreSpans) {
  const [status, setStatus] = useState({ ready: false, error: '' });
  const pending = useRef(null);
  const lastSaved = useRef(null);
  const bridge = window.timeLog?.loadSpans && window.timeLog?.saveSpans ? window.timeLog : null;

  useEffect(() => {
    if (!bridge) { setStatus({ ready: false, error: '' }); return undefined; }
    let cancelled = false;
    bridge.loadSpans()
      .then((saved) => { if (cancelled) return; restoreSpans(saved); setStatus({ ready: true, error: '' }); })
      .catch((error) => { if (!cancelled) setStatus({ ready: false, error: `Could not load saved hours: ${error.message}` }); });
    return () => { cancelled = true; };
  }, [bridge, restoreSpans]);

  useEffect(() => {
    if (!status.ready) return undefined;
    const days = editedDays(spansByDate);
    const serialized = JSON.stringify(days);
    // The first state after loading matches what is already on disk, and week navigation only adds
    // placeholder days, so skip writes that wouldn't change the saved file.
    if (lastSaved.current === null) { lastSaved.current = serialized; return undefined; }
    if (serialized === lastSaved.current) { pending.current = null; return undefined; }
    pending.current = days;
    const write = () => {
      if (pending.current !== days) return;
      pending.current = null;
      bridge.saveSpans(days)
        .then(() => { lastSaved.current = serialized; setStatus((current) => (current.error ? { ...current, error: '' } : current)); })
        .catch((error) => setStatus((current) => ({ ...current, error: `Could not save hours: ${error.message}` })));
    };
    const timer = setTimeout(write, SAVE_DELAY_MS);
    const flush = () => { clearTimeout(timer); write(); };
    window.addEventListener('pagehide', flush);
    return () => { clearTimeout(timer); window.removeEventListener('pagehide', flush); };
  }, [status.ready, spansByDate, bridge]);

  return { storageError: status.error };
}
