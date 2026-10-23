import { memo, useEffect, useState } from 'react';
import { Redo2, Trash2, Undo2 } from 'lucide-react';

const DELETE_DELAY_MS = 1000;
const canDelete = (entry) => entry.status === 'undone' && Date.now() - entry.undoneAt >= DELETE_DELAY_MS;

function HistoryItem({ entry, onUndo, onRedo, onRemove }) {
  const deletable = canDelete(entry);
  const deleteTitle = `Permanently Delete “${entry.label}” From Changelog`;
  const deleteLabel = deletable ? deleteTitle : `${deleteTitle} (Available 1 Second After Undo)`;
  const undoTitle = `Undo “${entry.label}”`;
  const redoTitle = `Redo “${entry.label}”`;
  return <div className={`history-item ${entry.status === 'undone' ? 'undone' : ''}`}>
    <span className="history-label">{entry.label}</span>
    {entry.status === 'active'
      ? <button className="history-action" title={undoTitle} aria-label={undoTitle} onClick={() => onUndo(entry)}><Undo2 size={14} /></button>
      : <><button className="history-action" title={deleteLabel} aria-label={deleteLabel} disabled={!deletable} onClick={() => onRemove(entry)}><Trash2 size={14} /></button>
        <button className="history-action" title={redoTitle} aria-label={redoTitle} onClick={() => onRedo(entry)}><Redo2 size={14} /></button></>}
  </div>;
}

function HistorySidebar({ changeLog, canUndo, canRedo, onUndo, onRedo, onUndoEntry, onRedoEntry, onRemove }) {
  const [, setTick] = useState(0);

  // Re-render once the newest undone entry becomes deletable.
  useEffect(() => {
    const newest = Math.max(0, ...changeLog.filter((entry) => entry.status === 'undone').map((entry) => entry.undoneAt));
    const wait = newest + DELETE_DELAY_MS + 50 - Date.now();
    if (!newest || wait <= 0) return undefined;
    const timer = setTimeout(() => setTick((tick) => tick + 1), wait);
    return () => clearTimeout(timer);
  }, [changeLog]);

  return <aside className="history-sidebar">
    <div className="history-heading"><h2>Changes ({changeLog.length})</h2><div className="history-tools">
      <button title="Undo" aria-label="Undo" disabled={!canUndo} onClick={onUndo}><Undo2 size={16} /></button>
      <button title="Redo" aria-label="Redo" disabled={!canRedo} onClick={onRedo}><Redo2 size={16} /></button>
    </div></div>
    <div className="history-list">{changeLog.length
      ? [...changeLog].reverse().map((entry) => <HistoryItem key={entry.id} entry={entry} onUndo={onUndoEntry} onRedo={onRedoEntry} onRemove={onRemove} />)
      : <p className="history-empty">Changes appear here.</p>}</div>
  </aside>;
}

export default memo(HistorySidebar);
