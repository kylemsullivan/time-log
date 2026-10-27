import { memo, useState } from 'react';
import { parseTime } from '../../lib/time-entry.js';

// A text field that takes typed times ("9", "930", "5p", "17:15") and commits a normalized HH:MM
// on blur or Enter. Invalid text and rejected edits snap back to the current value.
function TimeInput({ value, label, onCommit }) {
  const [draft, setDraft] = useState(null);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseTime(draft);
    setDraft(null);
    if (parsed !== null && parsed !== value) onCommit(parsed);
  };
  const onKeyDown = (event) => {
    if (event.key === 'Enter') event.currentTarget.blur();
    else if (event.key === 'Escape') { setDraft(null); event.currentTarget.blur(); }
  };

  return <input className="time-input" type="text" inputMode="text" autoComplete="off" placeholder="--:--" value={draft ?? value}
    title={label} aria-label={label} onFocus={(event) => event.target.select()} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={onKeyDown} />;
}

export default memo(TimeInput);
