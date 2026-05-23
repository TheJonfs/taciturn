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
import { tileAt, unitAt, type Catalog, type GameState, type Position, type Unit } from '@engine/index.ts';
import { badgeStyleFor } from './status-polarity.ts';
import { DetailHover } from './detail-hover.tsx';
import { formatStatusDetail } from './detail-text.ts';

export interface TileInfoPanelProps {
  readonly state: GameState | null;
  readonly catalog: Catalog;
  readonly cursorTile: Position | null;
}

export function TileInfoPanel({ state, catalog, cursorTile }: TileInfoPanelProps): ReactElement {
  const fields = resolveFields(state, cursorTile);
  const hoveredUnit = resolveHoveredUnit(state, cursorTile);
  return (
    <header style={panelStyle} aria-label="Tile info">
      <Field label="X" value={fields.x} />
      <Field label="Y" value={fields.y} />
      <Field label="Elev" value={fields.elevation} />
      <Field label="Terrain" value={fields.terrain} />
      {/* Session 31.5 polish #2: when a unit occupies the hovered tile,
          render its active statuses as polarity-tinted chips. Empty for
          tiles without a unit or when no tile is hovered. */}
      <div style={iconSlotStyle} aria-hidden={hoveredUnit === null}>
        {hoveredUnit !== null &&
          hoveredUnit.statuses.map((s, i) => {
            const type = catalog.hasStatusType(s.typeId) ? catalog.getStatusType(s.typeId) : null;
            const csName =
              s.customState !== undefined &&
              typeof (s.customState as { displayName?: unknown }).displayName === 'string'
                ? ((s.customState as { displayName: string }).displayName)
                : null;
            const name = csName ?? type?.name ?? String(s.typeId);
            const badge = badgeStyleFor(type);
            const chipStyle: CSSProperties = {
              ...chipBaseStyle,
              background: badge.background,
              color: badge.color,
              border: `1px solid ${badge.borderColor}`,
            };
            // Session 31.5 extension: chip carries the same DetailHover
            // tooltip surface as the unit detail panel. The `title`
            // attribute is dropped in favor of the rich tooltip — the
            // browser's native tooltip and the DetailHover would
            // otherwise both appear on hover.
            const detail = type !== null
              ? formatStatusDetail(type, s)
              : { title: String(s.typeId), lines: ['(unknown status type)'] };
            return (
              <DetailHover key={`${String(s.typeId)}-${i}`} content={detail} style={chipHoverWrapperStyle}>
                <span style={chipStyle}>{name}</span>
              </DetailHover>
            );
          })}
      </div>
    </header>
  );
}

function resolveHoveredUnit(state: GameState | null, pos: Position | null): Unit | null {
  if (state === null || pos === null) return null;
  try {
    return unitAt(state, pos.x, pos.y, pos.layer) ?? null;
  } catch {
    // Out-of-bounds cursor — defensive; cursor signal is normally
    // clamped, but ignore the rare race during map switches.
    return null;
  }
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
  // S46: small top offset so the bar isn't flush against the viewport
  // top — pre-S46 the bar ran into the edge and felt clipped, esp. on
  // browser tabs with narrow chrome.
  top: 12,
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

const chipBaseStyle: CSSProperties = {
  padding: '1px 7px',
  borderRadius: 8,
  fontSize: 10,
  letterSpacing: '0.02em',
  textTransform: 'none',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};

// DetailHover wrapper affordance for the tile-info effect chips.
const chipHoverWrapperStyle: CSSProperties = {
  cursor: 'help',
};
