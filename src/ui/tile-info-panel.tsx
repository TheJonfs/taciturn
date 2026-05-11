// TileInfoPanel — top-bar replacement that surfaces metadata about the
// tile under the cursor (session 26.5 / item #1). Replaces the prior
// Turn-T#### readout, which is redundant with the action log's per-turn
// T-numbering (live since session 25).
//
// Fields: X / Y / Elevation / Terrain. Reserved icon area on the right
// for future tile-effect chips (Burn-trails, frozen tiles, etc.) — the
// slot is rendered empty in v1 but the layout already carves it out so
// adding icons later doesn't reflow the bar.
//
// Empty state: "—" placeholders across the four fields when no tile is
// hovered. The bar height stays constant so the HUD shell doesn't jump.
//
// Data source: persistent cursor-tile signal from `useTurnFlow`.
// Looks up the actual tile metadata via `tileAt`. Defensive null-state
// for pre-mount and between-battles renders.

import type { CSSProperties, ReactElement } from 'react';
import { tileAt, type GameState, type Position } from '@engine/index.ts';

export interface TileInfoPanelProps {
  readonly state: GameState | null;
  readonly cursorTile: Position | null;
}

export function TileInfoPanel({ state, cursorTile }: TileInfoPanelProps): ReactElement {
  const fields = resolveFields(state, cursorTile);
  return (
    <header style={panelStyle} aria-label="Tile info">
      <Field label="X" value={fields.x} />
      <Field label="Y" value={fields.y} />
      <Field label="Elev" value={fields.elevation} />
      <Field label="Terrain" value={fields.terrain} />
      {/* Reserved slot for future tile-effect icons. Empty in v1. */}
      <div style={iconSlotStyle} aria-hidden="true" />
    </header>
  );
}

interface ResolvedFields {
  readonly x: string;
  readonly y: string;
  readonly elevation: string;
  readonly terrain: string;
}

function resolveFields(state: GameState | null, pos: Position | null): ResolvedFields {
  if (state === null || pos === null) {
    return { x: '—', y: '—', elevation: '—', terrain: '—' };
  }
  const tile = tileAt(state.map, pos.x, pos.y, pos.layer);
  if (tile === undefined) {
    // Tile gone (rare — would imply the cursor reports a position the
    // engine no longer recognizes). Fall back to placeholders for the
    // metadata while still surfacing the coordinates so the player
    // sees the disagreement.
    return {
      x: String(pos.x),
      y: String(pos.y),
      elevation: '—',
      terrain: '—',
    };
  }
  return {
    x: String(tile.x),
    y: String(tile.y),
    elevation: String(tile.elevation),
    terrain: titleCase(tile.terrain),
  };
}

function titleCase(s: string): string {
  if (s.length === 0) return s;
  return s[0]!.toUpperCase() + s.slice(1).toLowerCase();
}

function Field({ label, value }: { readonly label: string; readonly value: string }): ReactElement {
  return (
    <div style={fieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      <span style={fieldValueStyle}>{value}</span>
    </div>
  );
}

// ---- styles ----

const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  gap: 18,
  padding: '0 14px',
  background: 'rgba(28, 30, 35, 0.85)',
  borderBottom: '1px solid #2c2f36',
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 12,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  pointerEvents: 'auto',
  fontVariantNumeric: 'tabular-nums',
};

const fieldStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 6,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.6,
  letterSpacing: '0.08em',
};

const fieldValueStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '0.02em',
  textTransform: 'none',
};

const iconSlotStyle: CSSProperties = {
  marginLeft: 'auto',
  minWidth: 80,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  justifyContent: 'flex-end',
};
