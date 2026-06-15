// ForecastTooltip — compact cursor-following tooltip showing the per-tile
// preview during target-select. Complements the fixed ForecastPanel
// (which shows the full density-rich payload); the tooltip is the "what
// would happen to *this* unit right under the cursor?" inline read.
//
// Drawn as an absolutely-positioned div anchored to the cursor's
// last-known screen position. Re-renders cheaply on every hover-target
// change (sub-100ms target per the design doc).

import type { CSSProperties, ReactElement } from 'react';
import type { Catalog } from '@engine/index.ts';
import type { Forecast } from './forecast-compose.ts';

export interface ForecastTooltipProps {
  readonly forecast: Forecast | null;
  readonly catalog: Catalog;
  // Cursor position on the page (clientX/clientY). The tooltip
  // positions itself near here with a small offset.
  readonly cursor: { readonly x: number; readonly y: number } | null;
}

const CURSOR_OFFSET_X = 16;
const CURSOR_OFFSET_Y = 16;

export function ForecastTooltip({ forecast, catalog, cursor }: ForecastTooltipProps): ReactElement | null {
  if (forecast === null || cursor === null) return null;
  // Find the affected target at the anchor (the row the cursor sits on).
  const row = forecast.targets.find(
    (t) =>
      t.position.x === forecast.anchor.x &&
      t.position.y === forecast.anchor.y &&
      t.position.layer === forecast.anchor.layer,
  );
  if (row === undefined || !row.affected) return null;

  const targetName = row.unit?.name ?? `(${row.position.x},${row.position.y})`;
  const dmg = row.damage;

  return (
    <div
      style={{
        ...tooltipStyle,
        left: cursor.x + CURSOR_OFFSET_X,
        top: cursor.y + CURSOR_OFFSET_Y,
      }}
    >
      <div style={titleStyle}>{targetName}</div>
      {dmg !== undefined && (
        <div style={lineStyle}>
          {dmg.min === dmg.max ? `${dmg.expected} dmg` : `${dmg.min}–${dmg.max} dmg`}
        </div>
      )}
      {row.statusChances.map((s) => {
        const statusType =
          s.statusTypeId !== undefined && catalog.hasStatusType(s.statusTypeId)
            ? catalog.getStatusType(s.statusTypeId)
            : null;
        // Prefer an explicit label (Steal Buffs has no status to name);
        // otherwise the applied status's name.
        const name = s.label ?? statusType?.name ?? String(s.statusTypeId);
        return (
          <div key={s.label ?? String(s.statusTypeId)} style={lineStyle}>
            {name} {Math.round(s.chance * 100)}%
          </div>
        );
      })}
    </div>
  );
}

const tooltipStyle: CSSProperties = {
  position: 'fixed',
  pointerEvents: 'none',
  background: 'rgba(20, 22, 28, 0.95)',
  border: '1px solid #2c2f36',
  borderRadius: 6,
  padding: '6px 10px',
  fontFamily: 'system-ui, sans-serif',
  color: '#e7e9ee',
  fontSize: 11,
  zIndex: 50,
  minWidth: 120,
};

const titleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  marginBottom: 4,
};

const lineStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.85,
  fontVariantNumeric: 'tabular-nums',
};
