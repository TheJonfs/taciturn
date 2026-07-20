// Cartographer — the pan-zoom tile canvas.
//
// An SVG grid (Atlas's viewBox idiom): each tile is a rect filled with its
// terrain's renderer fallback color (same table the battle renderer uses,
// lightened by elevation so relief reads at a glance), the elevation digit
// on top, zone tint strokes, property/override glyphs, and inset deck
// chips for stacked cells. Interactions:
//   - wheel               zoom about the cursor
//   - drag (inspect)      pan; click selects a tile
//   - drag (any brush)    paint the tiles crossed (toggle brushes apply
//                         once per tile per stroke)
//   - middle-drag         pan regardless of brush
// Painting is coordinate-derived (floor of the view point), not
// element-hit — robust at any zoom and under fast drags.

import { useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { TERRAIN_COLORS, TERRAIN_FALLBACK_COLOR } from '@renderer/index.ts';
import type { CartographerModel, ZoneTeamKey } from './model.ts';
import { defaultZoneConfig, effectiveTerrain, zoneMembership } from './edit.ts';

export type Brush =
  | { readonly kind: 'inspect' }
  | { readonly kind: 'elevation'; readonly value: number }
  | { readonly kind: 'elevation-nudge'; readonly delta: 1 | -1 }
  | { readonly kind: 'terrain'; readonly terrain: string }
  | { readonly kind: 'terrain-clear' }
  | { readonly kind: 'property'; readonly property: string }
  | { readonly kind: 'zone'; readonly team: ZoneTeamKey; readonly subZone: number }
  | { readonly kind: 'zone-erase' }
  | { readonly kind: 'deck-toggle' };

// Brushes that should apply at most once per tile per stroke (toggles and
// increments — repeat application while the pointer sits on a tile would
// flicker or run away).
const ONCE_PER_STROKE: ReadonlySet<Brush['kind']> = new Set([
  'elevation-nudge',
  'property',
  'deck-toggle',
]);

interface CartographerCanvasProps {
  readonly model: CartographerModel;
  readonly brush: Brush;
  readonly selected: { readonly x: number; readonly y: number } | null;
  readonly onPaint: (x: number, y: number) => void;
  readonly onSelectTile: (tile: { x: number; y: number } | null) => void;
}

interface ViewBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const TILE = 32;

const ZONE_STROKE: Readonly<Record<ZoneTeamKey, string>> = {
  team_a: '#5a7fb5',
  team_b: '#b55a5a',
};

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

// The renderer's flat fill, lightened by elevation (~4%/step toward
// white) so relief is visible without the real cliff shading.
function tileFill(terrain: string, elevation: number): string {
  const base = TERRAIN_COLORS[terrain] ?? TERRAIN_FALLBACK_COLOR;
  const t = Math.min(0.55, elevation * 0.04);
  const channel = (shift: number): number => {
    const c = (base >> shift) & 0xff;
    return Math.round(c + (255 - c) * t);
  };
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}

function initialViewBox(width: number, height: number): ViewBox {
  const pad = TILE * 1.5;
  return { x: -pad, y: -pad, w: width * TILE + pad * 2, h: height * TILE + pad * 2 };
}

export function CartographerCanvas({
  model,
  brush,
  selected,
  onPaint,
  onSelectTile,
}: CartographerCanvasProps): ReactElement {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [view, setView] = useState<ViewBox>(() =>
    initialViewBox(model.spec.width, model.spec.height),
  );
  const drag = useRef<
    | {
        readonly kind: 'pan';
        readonly startView: ViewBox;
        readonly startPt: { x: number; y: number };
        // px-per-viewBox-unit at drag start (CTM scale) — deltas divide by
        // this; rect-proportional deltas would repeat the letterbox drift.
        readonly startScale: number;
        moved: boolean;
      }
    | { readonly kind: 'paint'; readonly painted: Set<string> }
    | null
  >(null);

  const spec = model.spec;
  const config = defaultZoneConfig(model);

  // Client → viewBox via the SVG's own screen matrix. A linear map over
  // getBoundingClientRect (the Atlas idiom) is WRONG here: with
  // preserveAspectRatio="meet" the viewBox letterboxes inside the element
  // whenever aspects differ, so a rect-proportional mapping drifts by
  // whole tiles toward the left/right edges (S98 Chris bug report). The
  // CTM accounts for the letterbox exactly.
  const toViewPoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (svg === null || ctm === null || ctm === undefined) return { x: 0, y: 0 };
    const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: pt.x, y: pt.y };
  };

  const tileAtClient = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const pt = toViewPoint(clientX, clientY);
    const x = Math.floor(pt.x / TILE);
    const y = Math.floor(pt.y / TILE);
    return x >= 0 && x < spec.width && y >= 0 && y < spec.height ? { x, y } : null;
  };

  const applyBrush = (clientX: number, clientY: number): void => {
    const d = drag.current;
    if (d === null || d.kind !== 'paint') return;
    const tile = tileAtClient(clientX, clientY);
    if (tile === null) return;
    const key = `${tile.x},${tile.y}`;
    if (ONCE_PER_STROKE.has(brush.kind) && d.painted.has(key)) return;
    d.painted.add(key);
    onPaint(tile.x, tile.y);
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>): void => {
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const at = toViewPoint(e.clientX, e.clientY);
    setView((v) => {
      const w = Math.min(TILE * 220, Math.max(TILE * 4, v.w * factor));
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
    const panning = brush.kind === 'inspect' || e.button === 1;
    if (panning) {
      drag.current = {
        kind: 'pan',
        startView: view,
        startPt: { x: e.clientX, y: e.clientY },
        startScale: svgRef.current?.getScreenCTM()?.a ?? 1,
        moved: false,
      };
      return;
    }
    drag.current = { kind: 'paint', painted: new Set() };
    applyBrush(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>): void => {
    const d = drag.current;
    if (d === null) return;
    if (d.kind === 'pan') {
      const dx = (e.clientX - d.startPt.x) / d.startScale;
      const dy = (e.clientY - d.startPt.y) / d.startScale;
      if (Math.abs(e.clientX - d.startPt.x) + Math.abs(e.clientY - d.startPt.y) > 3) d.moved = true;
      setView({ ...d.startView, x: d.startView.x - dx, y: d.startView.y - dy });
    } else {
      applyBrush(e.clientX, e.clientY);
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>): void => {
    const d = drag.current;
    drag.current = null;
    if (d?.kind === 'pan' && !d.moved) {
      onSelectTile(tileAtClient(e.clientX, e.clientY));
    }
  };

  const tiles: ReactElement[] = [];
  for (let y = 0; y < spec.height; y++) {
    for (let x = 0; x < spec.width; x++) {
      const elevation = spec.elevation[y]![x]!;
      const terrain = effectiveTerrain(spec, x, y);
      const hasOverride = spec.terrainOverrides.some((o) => o.x === x && o.y === y);
      const tag = spec.properties.find((p) => p.x === x && p.y === y);
      const deck = spec.decks.find((d) => d.x === x && d.y === y);
      const zone = zoneMembership(config, x, y);
      const px = x * TILE;
      const py = y * TILE;
      const isSelected = selected !== null && selected.x === x && selected.y === y;
      tiles.push(
        <g key={`${x},${y}`}>
          <rect
            x={px}
            y={py}
            width={TILE}
            height={TILE}
            fill={tileFill(terrain, elevation)}
            stroke="#00000055"
            strokeWidth={0.6}
          />
          {zone !== undefined && (
            <rect
              x={px + 1.4}
              y={py + 1.4}
              width={TILE - 2.8}
              height={TILE - 2.8}
              fill={ZONE_STROKE[zone.team]}
              fillOpacity={0.16}
              stroke={ZONE_STROKE[zone.team]}
              strokeWidth={1.6}
            />
          )}
          <text
            x={px + TILE / 2}
            y={py + TILE / 2 + 4}
            textAnchor="middle"
            fontSize={11}
            fill="#ffffffcc"
            pointerEvents="none"
          >
            {elevation}
          </text>
          {hasOverride && (
            <path d={`M ${px} ${py} l 7 0 l -7 7 z`} fill="#d8b26c" opacity={0.95} />
          )}
          {tag !== undefined && tag.properties.length > 0 && (
            <text x={px + TILE - 4} y={py + TILE - 3} textAnchor="end" fontSize={8} fill="#8fd0d8" pointerEvents="none">
              {tag.properties.map((p) => (p === 'blocks_los' ? 'L' : p === 'bridge_ramp' ? 'R' : '?')).join('')}
            </text>
          )}
          {deck !== undefined && (
            <g pointerEvents="none">
              <rect
                x={px + 5}
                y={py + 5}
                width={TILE - 10}
                height={TILE - 10}
                fill={hex(TERRAIN_COLORS[deck.terrain] ?? TERRAIN_FALLBACK_COLOR)}
                stroke="#e7e9ee"
                strokeWidth={1.2}
                rx={2}
              />
              <text x={px + TILE / 2} y={py + TILE / 2 + 3.5} textAnchor="middle" fontSize={9} fill="#1b1b1b" fontWeight={700}>
                {deck.elevation}
              </text>
            </g>
          )}
          {isSelected && (
            <rect
              x={px + 0.8}
              y={py + 0.8}
              width={TILE - 1.6}
              height={TILE - 1.6}
              fill="none"
              stroke="#d8b26c"
              strokeWidth={2}
            />
          )}
        </g>,
      );
    }
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      style={canvasStyle}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      role="application"
      aria-label="Cartographer tile canvas"
    >
      {tiles}
      {/* Map frame */}
      <rect
        x={0}
        y={0}
        width={spec.width * TILE}
        height={spec.height * TILE}
        fill="none"
        stroke="#2c2f36"
        strokeWidth={2}
      />
    </svg>
  );
}

const canvasStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
  background: '#101216',
  touchAction: 'none',
  cursor: 'crosshair',
};
