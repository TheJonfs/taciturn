// WorldMapBeatView — the world-map choose-next beat (TABA M1 Chunk 3).
//
// A LIGHTWEIGHT, hand-authored SVG of the campaign graph: nodes as points,
// win-edges as connections. It marks where the company stands (the party
// banner), highlights + makes selectable every travel destination (the
// beat's `choices` — frontier + returnable, see travel.ts), and — before
// advancing — MARCHES the banner along the road to the picked destination
// (the FFT world-map beat: you watch the party walk, then the place opens).
// The march is pure presentation: `onAdvance` fires with the chosen node id
// exactly as before, just after the walk completes. Reduced-motion (and
// environments without rAF, e.g. tests) skip straight to the advance.
//
// PLACEHOLDER FIDELITY IS THE POINT (taba-m1-brief): stylized structure, no
// art pipeline, easy to reskin. Topology comes from the static authored graph
// (CAMPAIGN_GRAPH); the beat supplies only position + the selectable set,
// so the runner stays graph-agnostic.

import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import {
  CAMPAIGN_GRAPH,
  type CampaignGraph,
  type TravelChoice,
  type WorldMapChoiceBeat,
} from '@campaign/index.ts';
import { NODE_LAYOUT, type NodePosition } from './node-layout.ts';
import type { BeatRendererProps } from './InterstitialRunner.tsx';

type NodeLayout = Readonly<Record<string, NodePosition>>;

// The runner passes plain BeatRendererProps (shipped graph + layout); the
// Atlas editor's live preview injects its draft graph + layout through the
// same component — what you preview is what ships.
export interface WorldMapBeatViewProps extends BeatRendererProps {
  readonly graph?: CampaignGraph;
  readonly layout?: NodeLayout;
}

// The map frame: the hand-tuned 640×350 viewBox is the FLOOR; a layout that
// outgrows it (multi-chapter skeletons) expands the frame to its bounds so
// nothing clips. The shipped six-node layout stays pixel-identical.
const FRAME_W = 640;
const FRAME_H = 350;
const FRAME_PAD = 60;

function viewBoxFor(layout: NodeLayout): string {
  const points = Object.values(layout);
  if (points.length === 0) return `0 0 ${FRAME_W} ${FRAME_H}`;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(0, Math.min(...xs) - FRAME_PAD);
  const y0 = Math.min(0, Math.min(...ys) - FRAME_PAD);
  const x1 = Math.max(FRAME_W, Math.max(...xs) + FRAME_PAD);
  const y1 = Math.max(FRAME_H, Math.max(...ys) + FRAME_PAD);
  return `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
}

type Point = { readonly x: number; readonly y: number };

// The in-flight march: where we're headed and the road there (polyline of
// node positions, starting at the current node).
interface MarchState {
  readonly toId: string;
  readonly waypoints: ReadonlyArray<Point>;
}

// Marching pace, in ms per road segment (clamped overall so a long return
// trip doesn't drag). Zero/absent rAF ⇒ no animation (tests, SSR).
const MARCH_MS_PER_SEGMENT = 550;
const MARCH_MS_MIN = 450;
const MARCH_MS_MAX = 1600;

// The road between two locations: BFS over the authored win-edges treated as
// UNDIRECTED (roads run both ways even though progress doesn't), so a return
// trip marches back through the places actually between here and there.
// Falls back to a straight line if the layout/graph can't supply a road.
function roadBetween(graph: CampaignGraph, layout: NodeLayout, fromId: string, toId: string): ReadonlyArray<Point> {
  const from = layout[fromId];
  const to = layout[toId];
  if (from === undefined || to === undefined) return [];
  if (fromId === toId) return [from];

  const neighbors = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.on !== 'win') continue;
    (neighbors.get(e.from) ?? neighbors.set(e.from, []).get(e.from)!).push(e.to);
    (neighbors.get(e.to) ?? neighbors.set(e.to, []).get(e.to)!).push(e.from);
  }

  const cameFrom = new Map<string, string>([[fromId, fromId]]);
  const queue = [fromId];
  while (queue.length > 0) {
    const at = queue.shift()!;
    if (at === toId) break;
    for (const next of neighbors.get(at) ?? []) {
      if (cameFrom.has(next)) continue;
      cameFrom.set(next, at);
      queue.push(next);
    }
  }
  if (!cameFrom.has(toId)) return [from, to]; // disconnected: straight line

  const ids: string[] = [];
  for (let at = toId; at !== fromId; at = cameFrom.get(at)!) ids.unshift(at);
  ids.unshift(fromId);
  const points = ids.map((id) => layout[id]).filter((p): p is Point => p !== undefined);
  return points.length >= 2 ? points : [from, to];
}

// The point a fraction `f` (0..1 of total length) along a polyline.
function pointAlong(waypoints: ReadonlyArray<Point>, f: number): Point {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < waypoints.length; i += 1) {
    const len = Math.hypot(waypoints[i]!.x - waypoints[i - 1]!.x, waypoints[i]!.y - waypoints[i - 1]!.y);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return waypoints[0]!;
  let remaining = f * total;
  for (let i = 0; i < lengths.length; i += 1) {
    if (remaining <= lengths[i]! || i === lengths.length - 1) {
      const t = lengths[i]! === 0 ? 0 : Math.min(1, remaining / lengths[i]!);
      const a = waypoints[i]!;
      const b = waypoints[i + 1]!;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    remaining -= lengths[i]!;
  }
  return waypoints[waypoints.length - 1]!;
}

const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - (1 - t) * (2 - 2 * t));

// Should the march animate at all? Skipped under an OS reduced-motion
// preference, where rAF is missing, and in the test environment (the march
// is pure choreography — routing tests assert the advance, not the walk).
// The behavior is identical either way: onAdvance fires with the same id.
function marchAnimates(): boolean {
  if (import.meta.env.MODE === 'test') return false;
  if (typeof requestAnimationFrame !== 'function') return false;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  }
  return true;
}

export function WorldMapBeatView({ beat, onAdvance, onExitToTitle, onManageRoster, graph: graphProp, layout: layoutProp }: WorldMapBeatViewProps): ReactElement {
  // March state must precede the beat-type guard (rules of hooks); it only
  // ever holds a value while this IS the world-map beat.
  const [march, setMarch] = useState<MarchState | null>(null);
  const [marchPos, setMarchPos] = useState<Point | null>(null);

  useEffect(() => {
    if (march === null) return undefined;
    const segments = march.waypoints.length - 1;
    const total = Math.min(MARCH_MS_MAX, Math.max(MARCH_MS_MIN, segments * MARCH_MS_PER_SEGMENT));
    const start = performance.now();
    let raf = 0;
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      onAdvance({ nextNodeId: march.toId });
    };
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / total);
      const p = pointAlong(march.waypoints, easeInOut(t));
      // The marching bob: a small vertical sway, two cycles per segment.
      const bob = Math.sin(t * segments * Math.PI * 2) * 2.5;
      setMarchPos({ x: p.x, y: p.y + bob });
      if (t < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    raf = requestAnimationFrame(step);
    // Failsafe: rAF freezes in hidden/backgrounded tabs — the march must
    // still ARRIVE (the advance is the real behavior; the walk is garnish).
    const failsafe = window.setTimeout(finish, total + 600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(failsafe);
    };
    // march is the only trigger; onAdvance is stable for the runner's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [march]);

  if (beat.type !== 'world-map-choice') return <></>;
  const map: WorldMapChoiceBeat = beat;

  const graph = graphProp ?? CAMPAIGN_GRAPH;
  const layout = layoutProp ?? NODE_LAYOUT;
  const choiceById = new Map(map.choices.map((c) => [c.id, c]));
  const marching = march !== null;

  // Progressive reveal (S94, Chris): the map shows only where the party has
  // been, where it can go next, and the authored always-visible teases (Old
  // Ordal + Viura — the destination on the horizon). A beat with no
  // `visited` (the Atlas preview's authoring view) shows everything. Edges
  // draw only between two visible endpoints, so hidden roads stay hidden.
  const revealed =
    map.visited === undefined
      ? undefined
      : new Set([map.fromNodeId, ...map.visited, ...map.choices.map((c) => c.id)]);
  const isVisible = (nodeId: string): boolean => {
    if (revealed === undefined) return true;
    if (revealed.has(nodeId)) return true;
    return graph.nodes.find((n) => n.id === nodeId)?.alwaysVisible === true;
  };

  const select = (toId: string): void => {
    if (marching) return; // one march at a time; clicks ignored en route
    const waypoints = roadBetween(graph, layout, map.fromNodeId, toId);
    if (!marchAnimates() || waypoints.length < 2) {
      onAdvance({ nextNodeId: toId }); // self re-entry / reduced motion / tests
      return;
    }
    setMarch({ toId, waypoints });
  };

  const herePos = layout[map.fromNodeId];
  const bannerPos = marchPos ?? herePos;

  return (
    <div style={rootStyle}>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div>
            <h1 style={titleStyle}>The Road Ahead</h1>
            <div style={subtitleStyle}>
              {marching ? 'The company is on the march…' : 'Choose where your company marches next.'}
            </div>
          </div>
          {/* The party purse (M3 economy Stage 0). */}
          <div style={purseStyle} aria-label="Party gil">
            {map.gil} gil
          </div>
        </div>

        <svg viewBox={viewBoxFor(layout)} style={svgStyle} role="img" aria-label="Campaign map">
          {/* Edges first, so nodes draw on top. Solid-blue = an edge into a
              frontier destination (forward progress); the rest stay dashed. */}
          {graph.edges
            .filter((e) => e.on === 'win' && isVisible(e.from) && isVisible(e.to))
            .map((e) => {
              const a = layout[e.from];
              const b = layout[e.to];
              if (a === undefined || b === undefined) return null;
              const active = !marching && choiceById.get(e.to)?.kind === 'advance';
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
            const pos = layout[n.id];
            if (pos === undefined || !isVisible(n.id)) return null;
            const isHere = n.id === map.fromNodeId;
            const choice = marching ? undefined : choiceById.get(n.id);
            return (
              <MapNode
                key={n.id}
                x={pos.x}
                y={pos.y}
                name={n.name}
                isHere={isHere && !marching}
                choice={choice}
                phantom={n.phantom === true}
                onSelect={choice !== undefined ? () => select(n.id) : undefined}
              />
            );
          })}

          {/* The party banner — standing at the current node, or marching
              along the road. Drawn last so it walks OVER nodes and edges. */}
          {bannerPos !== undefined && <PartyBanner x={bannerPos.x} y={bannerPos.y} marching={marching} />}
        </svg>

        <div style={footerStyle}>
          <span style={hintStyle}>
            {marching ? ' ' : 'Click a highlighted destination to continue.'}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {onManageRoster && !marching ? (
              <button type="button" style={primaryStyle} onClick={onManageRoster}>
                Manage Roster
              </button>
            ) : null}
            <button type="button" style={secondaryStyle} onClick={onExitToTitle} disabled={marching}>
              Quit to Title
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// The party's map presence: a gold standard (pole + pennant) planted beside
// the node, with a soft ground shadow. Placeholder-fidelity art — a sprite
// can replace this <g> wholesale later without touching the march machinery.
function PartyBanner({ x, y, marching }: { readonly x: number; readonly y: number; readonly marching: boolean }): ReactElement {
  return (
    <g transform={`translate(${x}, ${y})`} aria-label={marching ? 'The company, marching' : 'The company'}>
      <ellipse cx={0} cy={1} rx={7} ry={2.5} fill="#000" opacity={0.45} />
      {/* pole */}
      <line x1={0} y1={0} x2={0} y2={-20} stroke="#d8b26c" strokeWidth={2} strokeLinecap="round" />
      {/* pennant */}
      <path d="M 1 -20 L 14 -16.5 L 1 -13 Z" fill="#d8b26c" stroke="#8f7644" strokeWidth={0.8} />
      {/* the company at the pole's foot */}
      <circle cx={0} cy={-2} r={3.2} fill="#e7e9ee" stroke="#8f7644" strokeWidth={1} />
    </g>
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
  // Ch1 substrate (WI3): a phantom destination — drawn as a ghost (dashed
  // outline, faded label). Never selectable; travelChoices can't offer it.
  readonly phantom?: boolean;
  readonly onSelect?: (() => void) | undefined;
}

const FRONTIER = '#5a7fb5';
const RETURN_GOLD = '#8f7644';

function MapNode({ x, y, name, isHere, choice, phantom, onSelect }: MapNodeProps): ReactElement {
  const isChoice = choice !== undefined;
  const ring = choice?.kind === 'revisit' ? RETURN_GOLD : FRONTIER;
  const fill = isHere ? '#3a4150' : isChoice ? '#243042' : '#16181d';
  const stroke = isHere ? '#9aa0ac' : isChoice ? ring : '#2c2f36';
  const textColor = isHere || isChoice ? '#e7e9ee' : phantom === true ? '#565b66' : '#6b707b';
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
      <circle
        cx={x}
        cy={y}
        r={13}
        fill={fill}
        stroke={stroke}
        strokeWidth={2}
        strokeDasharray={phantom === true ? '3 3' : undefined}
        opacity={phantom === true ? 0.75 : undefined}
      />
      <text x={x} y={y + 32} textAnchor="middle" fontSize={13} fill={textColor} fontWeight={isHere || isChoice ? 600 : 400}>
        {name}
      </text>
      {badges.length > 0 && (
        <text x={x} y={y + 46} textAnchor="middle" fontSize={10} fill="#d8b26c" letterSpacing="0.06em">
          {badges.join(' · ')}
        </text>
      )}
      {isHere && (
        <text x={x} y={y - 28} textAnchor="middle" fontSize={10} fill="#9aa0ac" letterSpacing="0.1em">
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
