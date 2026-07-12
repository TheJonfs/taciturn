// Atlas — the DEV-gated campaign graph editor (`?atlas`, structural tier).
//
// Authors the campaign SKELETON on a pan-zoom canvas over the world-map
// skin: nodes, win-edges (order = map choice order), chapters, capabilities
// (hub/farmable/offset), placeholder battle templates, drag-to-place
// layout. Live validation runs the substrate §2 checklist; preview renders
// the REAL WorldMapBeatView; export emits the two generated modules
// (node.ts + node-layout.ts) as type-checked TS. Draft persists in
// localStorage; "Reset to shipped" re-imports the checked-in graph.
// Beat/scene/enemy and economy-bundle authoring are later tiers.

import { useEffect, useMemo, useState, type CSSProperties, type ReactElement } from 'react';
import { M1_CAMPAIGN_GRAPH } from '@campaign/index.ts';
import { NODE_LAYOUT } from '../interstitial/node-layout.ts';
import type { AtlasEdge, AtlasGraph, AtlasNode } from './model.ts';
import { fromCampaignGraph } from './import.ts';
import { validateAtlasGraph } from './validate.ts';
import { addEdge, addNode, deleteEdge, deleteNode, freshNodeId, moveNode, renameNodeId, reorderEdge, setStart, updateNode } from './edit.ts';
import { clearDraft, loadDraft, saveDraft } from './storage.ts';
import { AtlasCanvas, type CanvasMode } from './AtlasCanvas.tsx';
import { AtlasInspector } from './AtlasInspector.tsx';
import { AtlasPreview } from './AtlasPreview.tsx';
import { AtlasExport } from './AtlasExport.tsx';

const shippedModel = (): AtlasGraph => fromCampaignGraph(M1_CAMPAIGN_GRAPH, NODE_LAYOUT);

export function AtlasApp(): ReactElement {
  const [model, setModel] = useState<AtlasGraph>(() => loadDraft() ?? shippedModel());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<CanvasMode>({ kind: 'select' });
  const [overlay, setOverlay] = useState<'preview' | 'export' | null>(null);

  useEffect(() => saveDraft(model), [model]);

  const findings = useMemo(() => validateAtlasGraph(model), [model]);
  const errors = findings.filter((f) => f.level === 'error');
  const selected: AtlasNode | null = model.nodes.find((n) => n.id === selectedId) ?? null;

  const handleAddNode = (): void => {
    // Place near the last node so the new node lands in view, offset enough
    // to clear the layout-separation warning.
    const last = model.nodes[model.nodes.length - 1];
    const chapter = selected?.chapter ?? last?.chapter ?? 1;
    const id = freshNodeId(model, 'New Node');
    const next = addNode(model, {
      id,
      name: 'New Node',
      chapter,
      x: (last?.x ?? 100) + 80,
      y: (last?.y ?? 100) + 50,
    });
    setModel(next);
    setSelectedId(id);
  };

  const handleDrawEdge = (fromId: string, toId: string): void => {
    if (fromId !== toId) setModel((m) => addEdge(m, fromId, toId));
    setMode({ kind: 'select' });
    setSelectedId(toId);
  };

  const handleReset = (): void => {
    if (!window.confirm('Discard the draft and re-import the shipped campaign graph?')) return;
    clearDraft();
    setModel(shippedModel());
    setSelectedId(null);
    setMode({ kind: 'select' });
  };

  return (
    <div style={rootStyle}>
      <div style={toolbarStyle}>
        <span style={brandStyle}>Atlas</span>
        <span style={subbrandStyle}>campaign graph editor — structural tier</span>
        <button type="button" style={buttonStyle} onClick={handleAddNode}>
          + Add node
        </button>
        {mode.kind === 'draw-edge' && (
          <button type="button" style={activeButtonStyle} onClick={() => setMode({ kind: 'select' })}>
            Drawing edge — click a target (esc)
          </button>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          style={buttonStyle}
          disabled={errors.length > 0}
          title={errors.length > 0 ? 'Fix validation errors first' : 'Preview the draft on the real world map'}
          onClick={() => setOverlay('preview')}
        >
          Preview
        </button>
        <button
          type="button"
          style={primaryStyle}
          disabled={errors.length > 0}
          title={errors.length > 0 ? 'Fix validation errors first' : 'Generate node.ts + node-layout.ts'}
          onClick={() => setOverlay('export')}
        >
          Export{errors.length > 0 ? ` (${errors.length} error${errors.length === 1 ? '' : 's'})` : ''}
        </button>
        <button type="button" style={buttonStyle} onClick={handleReset}>
          Reset to shipped
        </button>
      </div>

      <div style={mainStyle}>
        <div
          style={canvasWrapStyle}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setMode({ kind: 'select' });
          }}
          tabIndex={-1}
        >
          <AtlasCanvas
            model={model}
            selectedId={selectedId}
            mode={mode}
            onSelect={setSelectedId}
            onMove={(id, x, y) => setModel((m) => moveNode(m, id, x, y))}
            onDrawEdge={handleDrawEdge}
          />
        </div>
        {selected !== null && (
          <AtlasInspector
            model={model}
            node={selected}
            onUpdate={(patch) => setModel((m) => updateNode(m, selected.id, patch))}
            onRenameId={(newId) => {
              setModel((m) => renameNodeId(m, selected.id, newId));
              setSelectedId(newId);
            }}
            onDelete={() => {
              setModel((m) => deleteNode(m, selected.id));
              setSelectedId(null);
            }}
            onSetStart={() => setModel((m) => setStart(m, selected.id))}
            onStartDrawEdge={() => setMode({ kind: 'draw-edge', fromId: selected.id })}
            onDeleteEdge={(edge: AtlasEdge) => setModel((m) => deleteEdge(m, edge))}
            onReorderEdge={(edge, dir) => setModel((m) => reorderEdge(m, edge, dir))}
            onSelect={setSelectedId}
          />
        )}
      </div>

      <div style={validationStyle}>
        {findings.length === 0 ? (
          <span style={okStyle}>✓ Valid — runtime-walkable skeleton</span>
        ) : (
          findings.map((f, i) => (
            <button
              key={`${f.rule}-${f.nodeId ?? ''}-${i}`}
              type="button"
              style={f.level === 'error' ? findingErrorStyle : findingWarnStyle}
              onClick={() => {
                if (f.nodeId !== undefined) setSelectedId(f.nodeId);
              }}
            >
              {f.level === 'error' ? '✕' : '△'} {f.message}
            </button>
          ))
        )}
      </div>

      {overlay === 'preview' && <AtlasPreview model={model} onClose={() => setOverlay(null)} />}
      {overlay === 'export' && <AtlasExport model={model} onClose={() => setOverlay(null)} />}
    </div>
  );
}

// ---- styles ----

const rootStyle: CSSProperties = {
  position: 'relative',
  width: '100vw',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#0e0f12',
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  overflow: 'hidden',
};

const toolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 16px',
  borderBottom: '1px solid #2c2f36',
  background: '#16181d',
};

const brandStyle: CSSProperties = { fontSize: 16, fontWeight: 700, color: '#d8b26c' };
const subbrandStyle: CSSProperties = { fontSize: 12, color: '#6b707b' };

const buttonStyle: CSSProperties = {
  padding: '7px 12px',
  fontSize: 13,
  borderRadius: 4,
  border: '1px solid #2c2f36',
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#1c1e23',
  color: '#c7ccd6',
};

const activeButtonStyle: CSSProperties = { ...buttonStyle, borderColor: '#5a7fb5', color: '#9db8dd' };

const primaryStyle: CSSProperties = {
  ...buttonStyle,
  background: 'rgba(216,178,108,.1)',
  color: '#d8b26c',
  borderColor: '#8f7644',
};

const mainStyle: CSSProperties = { flex: 1, display: 'flex', minHeight: 0 };
const canvasWrapStyle: CSSProperties = { flex: 1, minWidth: 0, outline: 'none' };

const validationStyle: CSSProperties = {
  maxHeight: 110,
  overflowY: 'auto',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  padding: '8px 16px',
  borderTop: '1px solid #2c2f36',
  background: '#16181d',
  fontSize: 12,
};

const okStyle: CSSProperties = { color: '#7fb58a' };

const findingBaseStyle: CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
  borderRadius: 4,
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: 'transparent',
  textAlign: 'left',
};

const findingErrorStyle: CSSProperties = { ...findingBaseStyle, color: '#d88f8f', border: '1px solid #5a3535' };
const findingWarnStyle: CSSProperties = { ...findingBaseStyle, color: '#d8b26c', border: '1px solid #8f7644' };
