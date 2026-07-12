// Atlas — the live map preview overlay: a STATEFUL WALK.
//
// Renders the REAL WorldMapBeatView over the draft graph + layout (the
// anti-drift payoff: what you preview is what ships). The preview holds an
// actual play-through (preview.ts): each destination pick travels there and
// wins whatever engagement is armed, so multi-visit shapes — a camp whose
// second story arms after a mission elsewhere and opens a different road —
// are walkable exactly as they will ship. Restart rewinds to the start.

import { useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { WorldMapBeatView } from '../interstitial/WorldMapBeatView.tsx';
import type { AtlasGraph } from './model.ts';
import { toCampaignGraph, toNodeLayout } from './model.ts';
import { previewWorldMapBeat, startWalk, walkTo, type PreviewWalk } from './preview.ts';

interface AtlasPreviewProps {
  readonly model: AtlasGraph;
  readonly onClose: () => void;
}

export function AtlasPreview({ model, onClose }: AtlasPreviewProps): ReactElement {
  // The caller gates preview on zero validation errors, so resolution here
  // cannot throw; memo because resolution touches content/registries.
  const graph = useMemo(() => toCampaignGraph(model), [model]);
  const layout = useMemo(() => toNodeLayout(model), [model]);
  const [walk, setWalk] = useState<PreviewWalk>(() => startWalk(graph));
  const beat = useMemo(() => previewWorldMapBeat(graph, walk), [graph, walk]);

  return (
    <div style={overlayStyle}>
      <div style={barStyle}>
        <span style={titleStyle}>Live preview — a real walk on your draft (each visit wins what's armed there)</span>
        <span style={walkReadoutStyle}>
          {walk.clearedStoryBeats.length} beat{walk.clearedStoryBeats.length === 1 ? '' : 's'} cleared
          {walk.lastCleared !== undefined ? ` · last: ${walk.lastCleared}` : ''}
        </span>
        <button type="button" style={restartStyle} onClick={() => setWalk(startWalk(graph))}>
          ⟲ Restart walk
        </button>
        <button type="button" style={closeStyle} onClick={onClose}>
          Close preview
        </button>
      </div>
      <div style={mapStyle}>
        <WorldMapBeatView
          // Remount per walk step: the shipped runner unmounts the map after
          // each march (march state is never reset internally), so a stateful
          // multi-hop walk must do the same or the first march sticks.
          key={`${walk.atId}:${walk.clearedStoryBeats.length}`}
          beat={beat}
          graph={graph}
          layout={layout}
          onAdvance={(output) => {
            if (output?.nextNodeId !== undefined) setWalk((w) => walkTo(graph, w, output.nextNodeId!));
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
const walkReadoutStyle: CSSProperties = { color: '#7fb58a', fontSize: 12 };

const restartStyle: CSSProperties = {
  padding: '7px 12px',
  fontSize: 13,
  borderRadius: 4,
  border: '1px solid #2c2f36',
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#1c1e23',
  color: '#c7ccd6',
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
