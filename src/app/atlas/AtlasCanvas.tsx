// Atlas — the pan-zoom graph canvas.
//
// An SVG over the world-map skin (same dark ground, same node idiom as
// WorldMapBeatView, plus editor chrome: chapter tints, direction arrows,
// the start crown, selection rings). Interactions:
//   - wheel            zoom about the cursor
//   - drag background  pan
//   - drag node        move (select mode) — writes rounded layout coords
//   - click node       select; in draw-edge mode, pick the edge target
// Edge editing (delete/reorder) lives in the inspector — hit-testing lines
// on a dense map is worse than a list.

import { useRef, useState, type CSSProperties, type ReactElement } from 'react';
import type { AtlasGraph, AtlasNode } from './model.ts';

export type CanvasMode = { readonly kind: 'select' } | { readonly kind: 'draw-edge'; readonly fromId: string };

interface AtlasCanvasProps {
  readonly model: AtlasGraph;
  readonly selectedId: string | null;
  readonly mode: CanvasMode;
  readonly onSelect: (id: string | null) => void;
  readonly onMove: (id: string, x: number, y: number) => void;
  readonly onDrawEdge: (fromId: string, toId: string) => void;
}

interface ViewBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// Chapter tints (node fill accents) — cycled past the palette's end.
const CHAPTER_TINTS = ['#243042', '#2b3a2e', '#3a2f42', '#42392b', '#2b3a42', '#3d2b2b'];
export const chapterTint = (chapter: number): string =>
  CHAPTER_TINTS[(Math.max(1, Math.floor(chapter)) - 1) % CHAPTER_TINTS.length]!;

function initialViewBox(model: AtlasGraph): ViewBox {
  if (model.nodes.length === 0) return { x: 0, y: 0, w: 640, h: 350 };
  const xs = model.nodes.map((n) => n.x);
  const ys = model.nodes.map((n) => n.y);
  const pad = 80;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return {
    x,
    y,
    w: Math.max(640, Math.max(...xs) + pad - x),
    h: Math.max(350, Math.max(...ys) + pad - y),
  };
}

export function AtlasCanvas({ model, selectedId, mode, onSelect, onMove, onDrawEdge }: AtlasCanvasProps): ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<ViewBox>(() => initialViewBox(model));
  // The in-flight drag: which node (or the background pan) and where it
  // started, in viewBox coordinates.
  const drag = useRef<
    | { readonly kind: 'node'; readonly id: string; moved: boolean }
    | { readonly kind: 'pan'; readonly startView: ViewBox; readonly startPt: { x: number; y: number } }
    | null
  >(null);

  const toViewPoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    if (svg === null) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((clientY - rect.top) / rect.height) * view.h,
    };
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>): void => {
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const at = toViewPoint(e.clientX, e.clientY);
    setView((v) => {
      const w = Math.min(8000, Math.max(160, v.w * factor));
      const h = (w / v.w) * v.h;
      return {
        x: at.x - ((at.x - v.x) / v.w) * w,
        y: at.y - ((at.y - v.y) / v.h) * h,
        w,
        h,
      };
    });
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>): void => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: 'pan', startView: view, startPt: { x: e.clientX, y: e.clientY } };
  };

  const onNodePointerDown = (e: React.PointerEvent, node: AtlasNode): void => {
    e.stopPropagation();
    if (mode.kind === 'draw-edge') {
      onDrawEdge(mode.fromId, node.id);
      return;
    }
    onSelect(node.id);
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { kind: 'node', id: node.id, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const d = drag.current;
    if (d === null) return;
    if (d.kind === 'node') {
      const pt = toViewPoint(e.clientX, e.clientY);
      d.moved = true;
      onMove(d.id, pt.x, pt.y);
    } else {
      const svg = svgRef.current;
      if (svg === null) return;
      const rect = svg.getBoundingClientRect();
      const dx = ((e.clientX - d.startPt.x) / rect.width) * d.startView.w;
      const dy = ((e.clientY - d.startPt.y) / rect.height) * d.startView.h;
      setView({ ...d.startView, x: d.startView.x - dx, y: d.startView.y - dy });
    }
  };

  const onPointerUp = (): void => {
    const d = drag.current;
    drag.current = null;
    // A background click (no pan movement) clears the selection; keeping
    // this in pointerup avoids deselect-on-pan.
    if (d?.kind === 'pan') return;
  };

  const onBackgroundClick = (): void => {
    if (mode.kind === 'select') onSelect(null);
  };

  const byId = new Map(model.nodes.map((n) => [n.id, n]));

  return (
    <svg
      ref={svgRef}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      style={canvasStyle}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onBackgroundClick}
      role="application"
      aria-label="Atlas graph canvas"
    >
      <defs>
        <marker id="atlas-arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#5a7fb5" />
        </marker>
        <marker id="atlas-arrow-loss" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={7} markerHeight={7} orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#8f5a5a" />
        </marker>
      </defs>

      {model.edges.map((e, i) => {
        const a = byId.get(e.from);
        const b = byId.get(e.to);
        if (a === undefined || b === undefined) return null;
        // Trim the line at the node radius so arrowheads sit on the rim.
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const ux = (b.x - a.x) / len;
        const uy = (b.y - a.y) / len;
        const r = 16;
        const loss = e.on === 'loss';
        return (
          <line
            key={`${e.from}->${e.to}:${e.on}:${i}`}
            x1={a.x + ux * r}
            y1={a.y + uy * r}
            x2={b.x - ux * r}
            y2={b.y - uy * r}
            stroke={loss ? '#8f5a5a' : '#5a7fb5'}
            strokeWidth={2}
            strokeDasharray={loss ? '4 4' : undefined}
            markerEnd={loss ? 'url(#atlas-arrow-loss)' : 'url(#atlas-arrow)'}
            opacity={0.8}
          />
        );
      })}

      {model.nodes.map((n) => {
        const isSelected = n.id === selectedId;
        const isStart = n.id === model.startId;
        const isEdgeSource = mode.kind === 'draw-edge' && mode.fromId === n.id;
        const badges = [
          ...(n.isHub === true ? ['trade'] : []),
          ...(n.farmable === true ? ['skirmish'] : []),
          // Any stand-in engagement flags the node; a queue badges its depth.
          ...(n.engagements.some((e) => e.beatsSource.kind !== 'content') ? ['placeholder'] : []),
          ...(n.engagements.length === 0 ? ['no beats'] : []),
          ...(n.engagements.length > 1 ? [`×${n.engagements.length}`] : []),
        ];
        return (
          <g
            key={n.id}
            onPointerDown={(e) => onNodePointerDown(e, n)}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: mode.kind === 'draw-edge' ? 'crosshair' : 'grab' }}
            aria-label={`Node ${n.name}`}
          >
            {isSelected && <circle cx={n.x} cy={n.y} r={22} fill="none" stroke="#d8b26c" strokeWidth={2} opacity={0.9} />}
            {isEdgeSource && <circle cx={n.x} cy={n.y} r={26} fill="none" stroke="#5a7fb5" strokeWidth={2} strokeDasharray="5 4" />}
            <circle cx={n.x} cy={n.y} r={14} fill={chapterTint(n.chapter)} stroke={isSelected ? '#d8b26c' : '#5a7fb5'} strokeWidth={2} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize={10} fill="#9aa0ac" pointerEvents="none">
              {n.chapter}
            </text>
            {isStart && (
              <text x={n.x} y={n.y - 22} textAnchor="middle" fontSize={10} fill="#d8b26c" letterSpacing="0.1em" pointerEvents="none">
                START
              </text>
            )}
            <text x={n.x} y={n.y + 32} textAnchor="middle" fontSize={13} fill="#e7e9ee" fontWeight={isSelected ? 600 : 400} pointerEvents="none">
              {n.name}
            </text>
            {badges.length > 0 && (
              <text x={n.x} y={n.y + 46} textAnchor="middle" fontSize={9} fill="#8f7644" letterSpacing="0.06em" pointerEvents="none">
                {badges.join(' · ')}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const canvasStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  background: '#101216',
  touchAction: 'none',
};
