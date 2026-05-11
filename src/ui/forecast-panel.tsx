// ForecastPanel — fixed-slot density-rich preview of what an ability
// will do, shown during target-select and await-confirm.
//
// Reads the Forecast payload produced by `composeForecast` and renders
// per-target damage range, hit chance (implicit via the projection's
// evasion fold), status application probabilities, AoE per-target
// preview, MP delta, and end-of-turn CT.
//
// Sits in the bottom-right of the 4-region HUD shell (Session 23 left
// that slot empty for this addition).

import type { CSSProperties, ReactElement } from 'react';
import type { Catalog } from '@engine/index.ts';
import type { Forecast } from './forecast-compose.ts';

export interface ForecastPanelProps {
  readonly forecast: Forecast | null;
  readonly catalog: Catalog;
}

export function ForecastPanel({ forecast, catalog }: ForecastPanelProps): ReactElement {
  if (forecast === null) {
    return (
      <aside style={panelStyle} aria-label="Forecast">
        <div style={headerStyle}>Forecast</div>
        <div style={emptyStyle}>Hover a target to preview</div>
      </aside>
    );
  }

  const { ability, caster, casterMpAfter, endOfTurnCt, targets, chargedTiming } = forecast;
  const affected = targets.filter((t) => t.affected);
  return (
    <aside style={panelStyle} aria-label="Forecast">
      <div style={headerStyle}>{ability.name}</div>
      <div style={subHeaderStyle}>
        from {caster.name}
        {ability.actionSpeed > 0 && (
          <span style={chargedTagStyle}>charged · {ability.actionSpeed} CT</span>
        )}
      </div>
      {chargedTiming !== null && (
        <div style={timingSectionStyle}>
          <div style={timingTitleStyle}>Timing</div>
          <div style={timingRowStyle}>
            <span style={timingLabelStyle}>resolves in</span>
            <span style={timingValueStyle}>
              ~{chargedTiming.ticksToResolve} ticks
              {chargedTiming.eventsBeforeResolve > 0 &&
                ` (after ${chargedTiming.eventsBeforeResolve} event${chargedTiming.eventsBeforeResolve === 1 ? '' : 's'})`}
            </span>
          </div>
          {chargedTiming.targetNextTurn !== null && chargedTiming.resolvesBeforeTargetTurn !== null && (
            <div style={timingRowStyle}>
              <span style={timingLabelStyle}>vs target's next</span>
              <span
                style={chargedTiming.resolvesBeforeTargetTurn ? timingGoodStyle : timingBadStyle}
              >
                {chargedTiming.resolvesBeforeTargetTurn ? '✓ resolves before' : '✗ resolves after'}
              </span>
            </div>
          )}
        </div>
      )}
      {affected.length === 0 ? (
        <div style={emptyStyle}>No targets in footprint</div>
      ) : (
        <div style={tableStyle}>
          {affected.map((row) => {
            const targetName = row.unit?.name ?? `(${row.position.x},${row.position.y})`;
            const dmg = row.damage;
            return (
              <div key={`${row.position.x},${row.position.y},${row.position.layer}`} style={rowStyle}>
                <div style={targetNameStyle}>{targetName}</div>
                {dmg !== undefined && (
                  <div style={dmgRowStyle}>
                    <span style={dmgLabelStyle}>dmg</span>
                    <span style={dmgValueStyle}>
                      {dmg.min === dmg.max
                        ? `${dmg.expected}`
                        : `${dmg.min}–${dmg.max} (${dmg.expected})`}
                    </span>
                  </div>
                )}
                {row.statusChances.map((s) => {
                  const statusType = catalog.hasStatusType(s.statusTypeId)
                    ? catalog.getStatusType(s.statusTypeId)
                    : null;
                  const name = statusType?.name ?? String(s.statusTypeId);
                  return (
                    <div key={String(s.statusTypeId)} style={statusRowStyle}>
                      <span style={statusLabelStyle}>{name}</span>
                      <span style={statusValueStyle}>{Math.round(s.chance * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      <div style={footerStyle}>
        <div style={footerRowStyle}>
          <span style={footerLabelStyle}>MP</span>
          <span style={footerValueStyle}>
            {caster.vitals.mp} → {casterMpAfter}
          </span>
        </div>
        <div style={footerRowStyle}>
          <span style={footerLabelStyle}>end CT</span>
          <span style={footerValueStyle}>{endOfTurnCt}</span>
        </div>
      </div>
    </aside>
  );
}

// ---- styles ----

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  height: '100%',
  pointerEvents: 'auto',
  fontFamily: 'system-ui, sans-serif',
  color: '#e7e9ee',
  fontSize: 12,
};

const headerStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.05em',
};

const subHeaderStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
  display: 'flex',
  gap: 8,
};

const chargedTagStyle: CSSProperties = {
  background: '#3a4150',
  color: '#f6e5a8',
  padding: '1px 6px',
  borderRadius: 8,
  fontSize: 10,
};

const tableStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  marginTop: 6,
  marginBottom: 6,
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
};

const rowStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  borderRadius: 4,
  padding: '4px 6px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const targetNameStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
};

const dmgRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 11,
};

const dmgLabelStyle: CSSProperties = { opacity: 0.65 };
const dmgValueStyle: CSSProperties = { fontWeight: 500 };

const statusRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
};

const statusLabelStyle: CSSProperties = { opacity: 0.65 };
const statusValueStyle: CSSProperties = { fontWeight: 500 };

const emptyStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.5,
  fontStyle: 'italic',
  paddingTop: 8,
};

const timingSectionStyle: CSSProperties = {
  marginTop: 6,
  marginBottom: 4,
  padding: '4px 6px',
  background: 'rgba(255,229,168,0.05)',
  borderLeft: '2px solid #f6e5a8',
  borderRadius: 3,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const timingTitleStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  opacity: 0.65,
  marginBottom: 2,
};

const timingRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
};

const timingLabelStyle: CSSProperties = { opacity: 0.65 };
const timingValueStyle: CSSProperties = { fontWeight: 500 };
const timingGoodStyle: CSSProperties = { color: '#6dc66d', fontWeight: 500 };
const timingBadStyle: CSSProperties = { color: '#e67865', fontWeight: 500 };

const footerStyle: CSSProperties = {
  borderTop: '1px solid #2c2f36',
  paddingTop: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const footerRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
};

const footerLabelStyle: CSSProperties = { opacity: 0.65 };
const footerValueStyle: CSSProperties = { fontWeight: 500 };
