import { useEffect } from 'react';

// Wires Cmd/Ctrl+Z, Shift+Z / Y and the Electron menu's undo/redo to the given stable handlers.
export function useHistoryShortcuts(undo, redo) {
  useEffect(() => {
    const unsubscribe = window.timeLog?.onHistoryAction?.((action) => (action === 'undo' ? undo() : redo()));
    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [undo, redo]);

  useEffect(() => {
    function handleKeydown(event) {
      if ((!event.metaKey && !event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if ((key === 'z' && event.shiftKey) || key === 'y') { event.preventDefault(); redo(); }
      else if (key === 'z') { event.preventDefault(); undo(); }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [undo, redo]);
}
