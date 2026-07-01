// WorldMapBeatView — the world-map choose-next beat (TABA M1 Chunk 3).
//
// A LIGHTWEIGHT, hand-authored SVG of the campaign graph: nodes as points,
// win-edges as connections. It marks the just-cleared node ("you are here")
// and highlights + makes selectable the available next nodes (the beat's
// `choices` — the cleared node's win-edges). Selecting one advances the
// interstitial with that node id, which the driver routes to.
//
// PLACEHOLDER FIDELITY IS THE POINT (taba-m1-brief): stylized structure, no
// art pipeline, easy to reskin. Topology comes from the static authored graph
// (M1_CAMPAIGN_GRAPH); the beat supplies only position + the selectable set,
// so the runner stays graph-agnostic.

import { type CSSProperties, type ReactElement } from 'react';
import { M1_CAMPAIGN_GRAPH, M1_NODES, type WorldMapChoiceBeat } from '@campaign/index.ts';
import type { BeatRendererProps } from './InterstitialRunner.tsx';

// Hand-authored node positions (viewBox units). Laid out left→right to read
// as a forward DAG: start at the left, the fork splits north/south, the side
// node hangs above the north route, the convergent terminal sits at the right.
const NODE_LAYOUT: Readonly<Record<string, { x: number; y: number }>> = {
  [M1_NODES.riverRidge]: { x: 70, y: 175 },
  [M1_NODES.stonebridge]: { x: 245, y: 85 },
  [M1_NODES.marshmoor]: { x: 245, y: 265 },
  [M1_NODES.mountainPass]: { x: 430, y: 85 },
  [M1_NODES.theReturn]: { x: 570, y: 175 },
};

export function WorldMapBeatView({ beat, onAdvance, onExitToTitle }: BeatRendererProps): ReactElement {
  if (beat.type !== 'world-map-choice') return <></>;
  const map: WorldMapChoiceBeat = beat;

  const graph = M1_CAMPAIGN_GRAPH;
  const choiceIds = new Set(map.choices.map((c) => c.id));

  return (
    <div style={rootStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>The Road Ahead</h1>
          <div style={subtitleStyle}>Choose where your company marches next.</div>
        </div>

        <svg viewBox="0 0 640 350" style={svgStyle} role="img" aria-label="Campaign map">
          {/* Edges first, so nodes draw on top. */}
          {graph.edges
            .filter((e) => e.on === 'win')
            .map((e) => {
              const a = NODE_LAYOUT[e.from];
              const b = NODE_LAYOUT[e.to];
              if (a === undefined || b === undefined) return null;
              const active = e.from === map.fromNodeId && choiceIds.has(e.to);
              return (
                <line
                  key={`${e.from}->${e.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={active ? '#5a7fb5' : '#2c2f36'}
                  strokeWidth={active ? 3 : 2}
                  strokeDasharray={active ? undefined : '4 4'}
                />
              );
            })}

          {graph.nodes.map((n) => {
            const pos = NODE_LAYOUT[n.id];
            if (pos === undefined) return null;
            const isHere = n.id === map.fromNodeId;
            const isChoice = choiceIds.has(n.id);
            return (
              <MapNode
                key={n.id}
                x={pos.x}
                y={pos.y}
                name={n.name}
                isHere={isHere}
                isChoice={isChoice}
                onSelect={isChoice ? () => onAdvance({ nextNodeId: n.id }) : undefined}
              />
            );
          })}
        </svg>

        <div style={footerStyle}>
          <span style={hintStyle}>Click a highlighted destination to continue.</span>
          <button type="button" style={secondaryStyle} onClick={onExitToTitle}>
            Quit to Title
          </button>
        </div>
      </div>
    </div>
  );
}

interface MapNodeProps {
  readonly x: number;
  readonly y: number;
  readonly name: string;
  readonly isHere: boolean;
  readonly isChoice: boolean;
  readonly onSelect?: (() => void) | undefined;
}

function MapNode({ x, y, name, isHere, isChoice, onSelect }: MapNodeProps): ReactElement {
  const fill = isHere ? '#3a4150' : isChoice ? '#243042' : '#16181d';
  const stroke = isHere ? '#9aa0ac' : isChoice ? '#5a7fb5' : '#2c2f36';
  const textColor = isHere || isChoice ? '#e7e9ee' : '#6b707b';
  const interactive = onSelect !== undefined;

  return (
    <g
      onClick={onSelect}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? `March to ${name}` : name}
    >
      {/* Selectable nodes get an outer highlight ring. */}
      {isChoice && <circle cx={x} cy={y} r={20} fill="none" stroke="#5a7fb5" strokeWidth={1.5} opacity={0.5} />}
      <circle cx={x} cy={y} r={13} fill={fill} stroke={stroke} strokeWidth={2} />
      {isHere && <circle cx={x} cy={y} r={4} fill="#9aa0ac" />}
      <text x={x} y={y + 32} textAnchor="middle" fontSize={13} fill={textColor} fontWeight={isHere || isChoice ? 600 : 400}>
        {name}
      </text>
      {isHere && (
        <text x={x} y={y - 22} textAnchor="middle" fontSize={10} fill="#9aa0ac" letterSpacing="0.1em">
          HERE
        </text>
      )}
    </g>
  );
}

// ---- styles ----

const rootStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0e0f12',
};

const panelStyle: CSSProperties = {
  width: 680,
  background: '#16181d',
  border: '1px solid #2c2f36',
  borderRadius: 8,
  overflow: 'hidden',
};

const headerStyle: CSSProperties = { padding: '16px 20px', borderBottom: '1px solid #2c2f36' };
const titleStyle: CSSProperties = { margin: 0, fontSize: 18, fontWeight: 600 };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: 13, color: '#9aa0ac' };

const svgStyle: CSSProperties = { display: 'block', width: '100%', height: 'auto', background: '#101216' };

const footerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 20px',
  borderTop: '1px solid #2c2f36',
};

const hintStyle: CSSProperties = { fontSize: 13, color: '#9aa0ac' };

const secondaryStyle: CSSProperties = {
  padding: '10px 18px',
  fontSize: 14,
  borderRadius: 5,
  borderWidth: 1,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  cursor: 'pointer',
  background: '#1c1e23',
  color: '#c7ccd6',
  borderColor: '#2c2f36',
};
