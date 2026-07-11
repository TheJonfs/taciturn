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
import { M1_CAMPAIGN_GRAPH, M1_NODES, type TravelChoice, type WorldMapChoiceBeat } from '@campaign/index.ts';
import type { BeatRendererProps } from './InterstitialRunner.tsx';

// Hand-authored node positions (viewBox units). Laid out left→right to read
// as a forward DAG: start at the left, the fork splits north/south, the side
// node hangs above the north route, the convergent terminal sits at the right.
const NODE_LAYOUT: Readonly<Record<string, { x: number; y: number }>> = {
  [M1_NODES.riverRidge]: { x: 70, y: 175 },
  [M1_NODES.stonebridge]: { x: 245, y: 85 },
  [M1_NODES.marshmoor]: { x: 245, y: 265 },
  [M1_NODES.theCrossing]: { x: 430, y: 265 },
  [M1_NODES.mountainPass]: { x: 430, y: 85 },
  [M1_NODES.theReturn]: { x: 570, y: 175 },
};

export function WorldMapBeatView({ beat, onAdvance, onExitToTitle, onManageRoster }: BeatRendererProps): ReactElement {
  if (beat.type !== 'world-map-choice') return <></>;
  const map: WorldMapChoiceBeat = beat;

  const graph = M1_CAMPAIGN_GRAPH;
  const choiceById = new Map(map.choices.map((c) => [c.id, c]));

  return (
    <div style={rootStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>The Road Ahead</h1>
            <div style={subtitleStyle}>Choose where your company marches next.</div>
          </div>
          {/* The party purse (M3 economy Stage 0). */}
          <div style={purseStyle} aria-label="Party gil">
            {map.gil} gil
          </div>
        </div>

        <svg viewBox="0 0 640 350" style={svgStyle} role="img" aria-label="Campaign map">
          {/* Edges first, so nodes draw on top. Solid-blue = an edge into a
              frontier destination (forward progress); the rest stay dashed. */}
          {graph.edges
            .filter((e) => e.on === 'win')
            .map((e) => {
              const a = NODE_LAYOUT[e.from];
              const b = NODE_LAYOUT[e.to];
              if (a === undefined || b === undefined) return null;
              const active = choiceById.get(e.to)?.kind === 'advance';
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
            const choice = choiceById.get(n.id);
            return (
              <MapNode
                key={n.id}
                x={pos.x}
                y={pos.y}
                name={n.name}
                isHere={isHere}
                choice={choice}
                onSelect={choice !== undefined ? () => onAdvance({ nextNodeId: n.id }) : undefined}
              />
            );
          })}
        </svg>

        <div style={footerStyle}>
          <span style={hintStyle}>Click a highlighted destination to continue.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {onManageRoster ? (
              <button type="button" style={primaryStyle} onClick={onManageRoster}>
                Manage Roster
              </button>
            ) : null}
            <button type="button" style={secondaryStyle} onClick={onExitToTitle}>
              Quit to Title
            </button>
          </div>
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
  // The travel choice this node represents (undefined = not selectable).
  // 'advance' renders frontier-blue; 'revisit' renders return-gold, with
  // small badges for what the place offers (skirmish / trade).
  readonly choice?: TravelChoice | undefined;
  readonly onSelect?: (() => void) | undefined;
}

const FRONTIER = '#5a7fb5';
const RETURN_GOLD = '#8f7644';

function MapNode({ x, y, name, isHere, choice, onSelect }: MapNodeProps): ReactElement {
  const isChoice = choice !== undefined;
  const ring = choice?.kind === 'revisit' ? RETURN_GOLD : FRONTIER;
  const fill = isHere ? '#3a4150' : isChoice ? '#243042' : '#16181d';
  const stroke = isHere ? '#9aa0ac' : isChoice ? ring : '#2c2f36';
  const textColor = isHere || isChoice ? '#e7e9ee' : '#6b707b';
  const interactive = onSelect !== undefined;

  const badges = choice === undefined
    ? []
    : [...(choice.farmable ? ['skirmish'] : []), ...(choice.hub ? ['trade'] : [])];

  return (
    <g
      onClick={onSelect}
      style={{ cursor: interactive ? 'pointer' : 'default' }}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? `March to ${name}` : name}
    >
      {/* Selectable nodes get an outer highlight ring (blue = frontier,
          gold = returnable). */}
      {isChoice && <circle cx={x} cy={y} r={20} fill="none" stroke={ring} strokeWidth={1.5} opacity={0.6} />}
      <circle cx={x} cy={y} r={13} fill={fill} stroke={stroke} strokeWidth={2} />
      {isHere && <circle cx={x} cy={y} r={4} fill="#9aa0ac" />}
      <text x={x} y={y + 32} textAnchor="middle" fontSize={13} fill={textColor} fontWeight={isHere || isChoice ? 600 : 400}>
        {name}
      </text>
      {badges.length > 0 && (
        <text x={x} y={y + 46} textAnchor="middle" fontSize={10} fill="#d8b26c" letterSpacing="0.06em">
          {badges.join(' · ')}
        </text>
      )}
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

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #2c2f36',
};

const purseStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#d8b26c',
  whiteSpace: 'nowrap',
};
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

const primaryStyle: CSSProperties = {
  ...secondaryStyle,
  background: 'rgba(216,178,108,.1)',
  color: '#d8b26c',
  borderColor: '#8f7644',
};
