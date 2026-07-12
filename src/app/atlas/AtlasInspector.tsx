// Atlas — the node inspector (right sidebar).
//
// Edits the selected node's structural fields and its outgoing edges. Every
// change routes through the pure ops in edit.ts; nothing here validates —
// the live panel below the canvas reports, export gates.

import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { hasContentBeats } from '@campaign/index.ts';
import { BATTLE_TEMPLATE_REGISTRY } from '@content/battles/registry.ts';
import type { AtlasEdge, AtlasGraph, AtlasNode } from './model.ts';
import type { AtlasNodePatch } from './edit.ts';

interface AtlasInspectorProps {
  readonly model: AtlasGraph;
  readonly node: AtlasNode;
  readonly onUpdate: (patch: AtlasNodePatch) => void;
  readonly onRenameId: (newId: string) => void;
  readonly onDelete: () => void;
  readonly onSetStart: () => void;
  readonly onStartDrawEdge: () => void;
  readonly onDeleteEdge: (edge: AtlasEdge) => void;
  readonly onReorderEdge: (edge: AtlasEdge, direction: 'up' | 'down') => void;
  readonly onSelect: (id: string) => void;
}

export function AtlasInspector(props: AtlasInspectorProps): ReactElement {
  const { model, node } = props;
  // The id field commits on blur/Enter (renames remap edges + start, too
  // heavy per keystroke); everything else commits per change.
  const [idDraft, setIdDraft] = useState(node.id);
  useEffect(() => setIdDraft(node.id), [node.id]);
  const commitId = (): void => {
    const next = idDraft.trim();
    if (next !== '' && next !== node.id) props.onRenameId(next);
    else setIdDraft(node.id);
  };

  const outEdges = model.edges.filter((e) => e.from === node.id);
  const winEdges = outEdges.filter((e) => e.on === 'win');
  const nameOf = (id: string): string => model.nodes.find((n) => n.id === id)?.name ?? id;
  const contentAvailable = hasContentBeats(node.id);

  return (
    <div style={panelStyle}>
      <div style={sectionTitleStyle}>Node</div>

      <label style={labelStyle}>
        Name
        <input style={inputStyle} value={node.name} onChange={(e) => props.onUpdate({ name: e.target.value })} />
      </label>

      <label style={labelStyle}>
        Id <span style={mutedStyle}>(identity — renames remap edges/start)</span>
        <input
          style={inputStyle}
          value={idDraft}
          onChange={(e) => setIdDraft(e.target.value)}
          onBlur={commitId}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitId();
          }}
        />
      </label>

      <div style={rowStyle}>
        <label style={{ ...labelStyle, flex: 1 }}>
          Chapter
          <input
            style={inputStyle}
            type="number"
            min={1}
            step={1}
            value={node.chapter}
            onChange={(e) => props.onUpdate({ chapter: Number(e.target.value) })}
          />
        </label>
        <label style={{ ...labelStyle, flex: 1 }}>
          Offset <span style={mutedStyle}>(blank = 0)</span>
          <input
            style={inputStyle}
            type="number"
            step={1}
            value={node.offset ?? ''}
            onChange={(e) => props.onUpdate({ offset: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
        </label>
      </div>

      <div style={rowStyle}>
        <label style={checkStyle}>
          <input type="checkbox" checked={node.isHub === true} onChange={(e) => props.onUpdate({ isHub: e.target.checked ? true : undefined })} />
          Hub (trade)
        </label>
        <label style={checkStyle}>
          <input
            type="checkbox"
            checked={node.farmable === true}
            onChange={(e) => props.onUpdate({ farmable: e.target.checked ? true : undefined })}
          />
          Farmable
        </label>
      </div>

      <div style={sectionTitleStyle}>Beats</div>
      <div style={beatRowStyle}>
        <label style={checkStyle}>
          <input
            type="radio"
            name="beats-source"
            checked={node.beatsSource.kind === 'content'}
            disabled={!contentAvailable}
            onChange={() => props.onUpdate({ beatsSource: { kind: 'content' } })}
          />
          Hand-authored content{contentAvailable ? '' : ' (none for this id)'}
        </label>
        <label style={checkStyle}>
          <input
            type="radio"
            name="beats-source"
            checked={node.beatsSource.kind === 'placeholder'}
            onChange={() => props.onUpdate({ beatsSource: { kind: 'placeholder', templateKey: 'river_ridge' } })}
          />
          Placeholder battle
        </label>
        {node.beatsSource.kind === 'placeholder' && (
          <select
            style={inputStyle}
            value={node.beatsSource.templateKey}
            onChange={(e) => props.onUpdate({ beatsSource: { kind: 'placeholder', templateKey: e.target.value } })}
          >
            {Object.entries(BATTLE_TEMPLATE_REGISTRY).map(([key, entry]) => (
              <option key={key} value={key}>
                {entry.label}
              </option>
            ))}
          </select>
        )}
        <label style={checkStyle}>
          <input
            type="radio"
            name="beats-source"
            checked={node.beatsSource.kind === 'none'}
            onChange={() => props.onUpdate({ beatsSource: { kind: 'none' } })}
          />
          None (pure town / waypoint)
        </label>
      </div>

      <div style={sectionTitleStyle}>Win-edges (choice order)</div>
      {winEdges.length === 0 && <div style={mutedStyle}>Terminal — clearing this node completes the campaign.</div>}
      {winEdges.map((e) => (
        <div key={`${e.to}`} style={edgeRowStyle}>
          <button type="button" style={edgeNameStyle} onClick={() => props.onSelect(e.to)} title="Select target">
            → {nameOf(e.to)}
          </button>
          <button type="button" style={miniStyle} onClick={() => props.onReorderEdge(e, 'up')} aria-label="Earlier">
            ↑
          </button>
          <button type="button" style={miniStyle} onClick={() => props.onReorderEdge(e, 'down')} aria-label="Later">
            ↓
          </button>
          <button type="button" style={miniStyle} onClick={() => props.onDeleteEdge(e)} aria-label="Delete edge">
            ✕
          </button>
        </div>
      ))}
      {outEdges
        .filter((e) => e.on === 'loss')
        .map((e) => (
          <div key={`loss-${e.to}`} style={edgeRowStyle}>
            <span style={{ ...edgeNameStyle, color: '#8f5a5a' }}>⇢ {nameOf(e.to)} (loss)</span>
            <button type="button" style={miniStyle} onClick={() => props.onDeleteEdge(e)} aria-label="Delete edge">
              ✕
            </button>
          </div>
        ))}
      <button type="button" style={buttonStyle} onClick={props.onStartDrawEdge}>
        Draw edge from here…
      </button>

      <div style={sectionTitleStyle}>Actions</div>
      <div style={rowStyle}>
        <button type="button" style={buttonStyle} onClick={props.onSetStart} disabled={model.startId === node.id}>
          {model.startId === node.id ? 'Is the start' : 'Set as start'}
        </button>
        <button type="button" style={dangerStyle} onClick={props.onDelete}>
          Delete node
        </button>
      </div>
    </div>
  );
}

// ---- styles (the app's dark idiom) ----

const panelStyle: CSSProperties = {
  width: 300,
  padding: 14,
  overflowY: 'auto',
  borderLeft: '1px solid #2c2f36',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  fontSize: 13,
  color: '#c7ccd6',
};

const sectionTitleStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#9aa0ac',
};

const labelStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const mutedStyle: CSSProperties = { color: '#6b707b', fontSize: 12 };
const rowStyle: CSSProperties = { display: 'flex', gap: 10, alignItems: 'center' };
const beatRowStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6 };
const checkStyle: CSSProperties = { display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' };

const inputStyle: CSSProperties = {
  padding: '6px 8px',
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#1c1e23',
  color: '#e7e9ee',
  border: '1px solid #2c2f36',
  borderRadius: 4,
};

const buttonStyle: CSSProperties = {
  padding: '7px 10px',
  fontSize: 13,
  borderRadius: 4,
  border: '1px solid #2c2f36',
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#1c1e23',
  color: '#c7ccd6',
};

const dangerStyle: CSSProperties = { ...buttonStyle, color: '#d88f8f', borderColor: '#5a3535' };

const edgeRowStyle: CSSProperties = { display: 'flex', gap: 4, alignItems: 'center' };
const edgeNameStyle: CSSProperties = {
  ...buttonStyle,
  flex: 1,
  textAlign: 'left',
  padding: '5px 8px',
  border: '1px solid transparent',
};
const miniStyle: CSSProperties = { ...buttonStyle, padding: '3px 7px' };
