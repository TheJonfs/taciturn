// Atlas — the export overlay: the two generated modules as text, with
// copy + download. The browser can't write into the repo; paste (or drop
// the downloads) over src/campaign/node.ts and
// src/app/interstitial/node-layout.ts, then let tsc + the round-trip test
// vouch for the result. The caller gates this on zero validation errors.

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { AtlasGraph } from './model.ts';
import { generateLayoutModule, generateNodeModule } from './codegen.ts';

interface AtlasExportProps {
  readonly model: AtlasGraph;
  readonly onClose: () => void;
}

const FILES = [
  { label: 'src/campaign/node.ts', generate: generateNodeModule },
  { label: 'src/app/interstitial/node-layout.ts', generate: generateLayoutModule },
] as const;

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AtlasExport({ model, onClose }: AtlasExportProps): ReactElement {
  const sources = useMemo(() => FILES.map((f) => ({ ...f, text: f.generate(model) })), [model]);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (label: string, text: string): void => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    });
  };

  return (
    <div style={overlayStyle}>
      <div style={barStyle}>
        <span style={titleStyle}>Export — generated modules (paste over the shipped files)</span>
        <button type="button" style={closeStyle} onClick={onClose}>
          Close
        </button>
      </div>
      <div style={panesStyle}>
        {sources.map((f) => (
          <div key={f.label} style={paneStyle}>
            <div style={paneBarStyle}>
              <code style={pathStyle}>{f.label}</code>
              <button type="button" style={buttonStyle} onClick={() => copy(f.label, f.text)}>
                {copied === f.label ? 'Copied ✓' : 'Copy'}
              </button>
              <button type="button" style={buttonStyle} onClick={() => download(f.label.split('/').pop()!, f.text)}>
                Download
              </button>
            </div>
            <textarea style={textStyle} readOnly value={f.text} spellCheck={false} />
          </div>
        ))}
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: '#0e0f12',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 10,
};

const barStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '10px 16px',
  borderBottom: '1px solid #2c2f36',
  fontSize: 13,
};

const titleStyle: CSSProperties = { flex: 1, color: '#9aa0ac' };

const panesStyle: CSSProperties = { flex: 1, display: 'flex', gap: 12, padding: 12, minHeight: 0 };
const paneStyle: CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 };
const paneBarStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const pathStyle: CSSProperties = { flex: 1, fontSize: 12, color: '#d8b26c' };

const textStyle: CSSProperties = {
  flex: 1,
  resize: 'none',
  padding: 10,
  fontSize: 11.5,
  lineHeight: 1.45,
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  background: '#101216',
  color: '#c7ccd6',
  border: '1px solid #2c2f36',
  borderRadius: 4,
  whiteSpace: 'pre',
};

const buttonStyle: CSSProperties = {
  padding: '5px 10px',
  fontSize: 12,
  borderRadius: 4,
  border: '1px solid #2c2f36',
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#1c1e23',
  color: '#c7ccd6',
};

const closeStyle: CSSProperties = {
  ...buttonStyle,
  border: '1px solid #8f7644',
  background: 'rgba(216,178,108,.1)',
  color: '#d8b26c',
};
