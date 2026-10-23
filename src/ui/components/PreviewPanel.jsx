import { memo } from 'react';
import { Copy } from 'lucide-react';

function PreviewPanel({ draft }) {
  return <section className="panel preview-panel">
    <div className="panel-heading preview-heading"><div className="panel-title"><div className="step">2</div><div><h2>Review your time log</h2></div></div><button title="Copy Summary" className="button primary" onClick={() => navigator.clipboard.writeText(draft)}><Copy size={15} />Copy</button></div>
    <pre className="summary-preview">{draft}</pre>
  </section>;
}

export default memo(PreviewPanel);
