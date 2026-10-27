import { memo, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { EXPORT_FORMATS } from '../../lib/exchange.js';

function DataMenu({ onImport, onExport }) {
  const [format, setFormat] = useState('csv');
  return <div className="data-menu">
    <button type="button" className="button secondary" title="Import Hours From CSV, Markdown Or JSON" onClick={onImport}><Upload size={15} /><span>Import</span></button>
    <select className="format-select" title="Export Format" aria-label="Export Format" value={format} onChange={(event) => setFormat(event.target.value)}>
      {Object.entries(EXPORT_FORMATS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
    </select>
    <button type="button" className="button secondary" title="Export Hours" onClick={() => onExport(format)}><Download size={15} /><span>Export</span></button>
  </div>;
}

export default memo(DataMenu);
