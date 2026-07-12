// Atlas — the live map preview overlay.
//
// Renders the REAL WorldMapBeatView over the draft graph + layout (the
// anti-drift payoff: what you preview is what ships), standing at a
// selectable node with the road there cleared. Picking a destination on
// the previewed map MOVES the stand-point — the preview is walkable, march
// animation included.

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { WorldMapBeatView } from '../interstitial/WorldMapBeatView.tsx';
import type { AtlasGraph } from './model.ts';
import { toCampaignGraph, toNodeLayout } from './model.ts';
import { previewWorldMapBeat } from './preview.ts';

interface AtlasPreviewProps {
  readonly model: AtlasGraph;
  readonly onClose: () => void;
}

export function AtlasPreview({ model, onClose }: AtlasPreviewProps): ReactElement {
  const [atId, setAtId] = useState(model.startId);
  // The caller gates preview on zero validation errors, so resolution here
  // cannot throw; memo because resolution touches content/registries.
  const graph = useMemo(() => toCampaignGraph(model), [model]);
  const layout = useMemo(() => toNodeLayout(model), [model]);
  const beat = useMemo(() => previewWorldMapBeat(graph, atId), [graph, atId]);

  return (
    <div style={overlayStyle}>
      <div style={barStyle}>
        <span style={titleStyle}>Live preview — the shipped world map, on your draft</span>
        <label style={standStyle}>
          Stand at
          <select style={selectStyle} value={atId} onChange={(e) => setAtId(e.target.value)}>
            {model.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" style={closeStyle} onClick={onClose}>
          Close preview
        </button>
      </div>
      <div style={mapStyle}>
        <WorldMapBeatView
          beat={beat}
          graph={graph}
          layout={layout}
          onAdvance={(output) => {
            if (output?.nextNodeId !== undefined) setAtId(output.nextNodeId);
          }}
          onExitToTitle={onClose}
        />
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
  color: '#c7ccd6',
  fontSize: 13,
};

const titleStyle: CSSProperties = { flex: 1, color: '#9aa0ac' };
const standStyle: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center' };

const selectStyle: CSSProperties = {
  padding: '5px 8px',
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#1c1e23',
  color: '#e7e9ee',
  border: '1px solid #2c2f36',
  borderRadius: 4,
};

const closeStyle: CSSProperties = {
  padding: '7px 12px',
  fontSize: 13,
  borderRadius: 4,
  border: '1px solid #8f7644',
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: 'rgba(216,178,108,.1)',
  color: '#d8b26c',
};

const mapStyle: CSSProperties = { flex: 1, minHeight: 0 };
