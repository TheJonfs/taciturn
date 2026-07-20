// Cartographer — the export overlay (Atlas's idiom): the generated map
// module + the wholesale-regenerated deployment-zone registry as text,
// with copy + download. The browser can't write into the repo; paste (or
// drop the downloads) over the target paths, then let tsc + the round-trip
// test vouch. The caller gates this on zero validation errors.

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import type { CartographerModel } from './model.ts';
import {
  docSlug,
  generateLineupModule,
  generateMapModule,
  generateZoneRegistryModule,
} from './codegen.ts';
import { lineupSpecFromModel } from './export-spec.ts';
import { shippedMapSpec } from './import.ts';

interface CartographerExportProps {
  readonly model: CartographerModel;
  readonly onClose: () => void;
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CartographerExport({ model, onClose }: CartographerExportProps): ReactElement {
  const files = useMemo(
    () => [
      {
        label: `src/content/maps/${docSlug(model.spec.key)}.ts`,
        text: generateMapModule(model.spec),
      },
      {
        label: 'src/content/deployment/registry.ts',
        text: generateZoneRegistryModule(model.registry),
      },
      ...(model.lineup !== null
        ? [
            {
              label: `src/content/battles/${docSlug(model.spec.key)}-battle.ts`,
              text: generateLineupModule(lineupSpecFromModel(model)),
            },
          ]
        : []),
    ],
    [model],
  );
  const [copied, setCopied] = useState<string | null>(null);

  const isNewMap = shippedMapSpec(model.spec.key) === undefined;

  const copy = (label: string, text: string): void => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      window.setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    });
  };

  return (
    <div style={overlayStyle}>
      <div style={barStyle}>
        <span style={titleStyle}>
          Export — generated modules (paste over the shipped files)
          {isNewMap && model.lineup === null &&
            ' — NEW map: to fight on it, also add a battle template + BATTLE_TEMPLATE_REGISTRY entry (same key) and, for a quick battle, a MAP_OPTIONS entry in App.tsx'}
          {model.lineup !== null &&
            ' — lineup: register the battle in BATTLE_TEMPLATE_REGISTRY (same key), and in node-content use enemies: enemiesFromLineup(<KEY>_LINEUP, catalog); add the lineup to SHIPPED_LINEUPS in cartographer/import.ts so the tool can reload it'}
        </span>
        <button type="button" style={closeStyle} onClick={onClose}>
          Close
        </button>
      </div>
      <div style={panesStyle}>
        {files.map((f) => (
          <div key={f.label} style={paneStyle}>
            <div style={paneBarStyle}>
              <code style={pathStyle}>{f.label}</code>
              <button type="button" style={buttonStyle} onClick={() => copy(f.label, f.text)}>
                {copied === f.label ? 'Copied ✓' : 'Copy'}
              </button>
              <button
                type="button"
                style={buttonStyle}
                onClick={() => download(f.label.split('/').pop()!, f.text)}
              >
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
