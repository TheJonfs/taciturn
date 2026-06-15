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
import type { Catalog, GameState, ProjectedEvent, TeamId } from '@engine/index.ts';
import { TEAM_PALETTE, TEAM_PALETTE_FALLBACK_CSS } from '@renderer/index.ts';
import type { ChargedTiming, Forecast } from './forecast-compose.ts';

export interface ForecastPanelProps {
  readonly forecast: Forecast | null;
  readonly catalog: Catalog;
  // Engine state, used by the mini-timeline to resolve team color and
  // unit names for chip rendering. `null` between turns; the panel
  // gracefully degrades to no chips in that case.
  readonly state: GameState | null;
}

export function ForecastPanel({ forecast, catalog, state }: ForecastPanelProps): ReactElement {
  if (forecast === null) {
    return (
      <aside style={panelStyle} aria-label="Forecast">
        <div style={headerStyle}>Forecast</div>
        <div style={emptyStyle}>Hover a target to preview</div>
      </aside>
    );
  }

  const { ability, caster, casterMpAfter, endOfTurnCt, targets, chargedTiming, effectiveRange } =
    forecast;
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
      <div style={accuracyStripStyle}>
        <span style={accuracyEntryStyle}>
          <span style={accuracyLabelStyle}>Range</span>
          <span style={accuracyValueStyle}>
            {effectiveRange.horizontal}H · {effectiveRange.vertical}V
          </span>
        </span>
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
          {state !== null && chargedTiming.surroundingEvents.length > 0 && (
            <MiniTimeline timing={chargedTiming} state={state} catalog={catalog} />
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
                {row.hp !== null && (
                  <div style={hpRowStyle}>
                    <span style={hpLabelStyle}>HP</span>
                    <span style={hpValueStyle}>
                      {row.hp.current}
                      <span style={hpMaxStyle}>/{row.hp.max}</span>
                    </span>
                  </div>
                )}
                {dmg !== undefined && (
                  <div style={dmgRowStyle}>
                    <span style={dmgLabelStyle}>
                      {dmg.regime === 'heal' ? 'heal' : dmg.regime === 'absorbed' ? 'absorb' : 'dmg'}
                    </span>
                    <span style={dmgValueStyle}>
                      {dmg.min === dmg.max
                        ? `${dmg.expected}`
                        : `${dmg.min}–${dmg.max} (${dmg.expected})`}
                    </span>
                  </div>
                )}
                {row.hitChance !== undefined && (
                  <div style={dmgRowStyle}>
                    <span style={dmgLabelStyle}>hit</span>
                    <span style={dmgValueStyle}>
                      {Math.round(row.hitChance * 100)}%
                    </span>
                  </div>
                )}
                {row.statusChances.map((s) => {
                  const statusType =
                    s.statusTypeId !== undefined && catalog.hasStatusType(s.statusTypeId)
                      ? catalog.getStatusType(s.statusTypeId)
                      : null;
                  const name = s.label ?? statusType?.name ?? String(s.statusTypeId);
                  return (
                    <div key={s.label ?? String(s.statusTypeId)} style={statusRowStyle}>
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

// Mini-timeline visualization for the forecast Timing subsection (item
// #7, session 26.5). Renders the ~7-event window from
// `ChargedTiming.surroundingEvents` as a horizontal strip of chips:
// unit-turns in team color, the charged resolve highlighted gold, the
// target's next turn outlined with the comparison accent. Ticks-from-
// now labels sit under each chip.
function MiniTimeline(props: {
  readonly timing: ChargedTiming;
  readonly state: GameState;
  readonly catalog: Catalog;
}): ReactElement {
  const { timing, state, catalog } = props;
  const targetEventTicks = timing.targetNextTurn?.event.ticksFromNow ?? null;
  return (
    <div style={timelineStyle} aria-label="Charged-action timing strip">
      <div style={timelineRowStyle}>
        {timing.surroundingEvents.map((ev, i) => {
          const isResolve = i === timing.resolutionIndex;
          const isTarget =
            targetEventTicks !== null &&
            ev.entityKind === 'unit' &&
            ev.ticksFromNow === targetEventTicks &&
            ev.entityId === timing.targetNextTurn!.event.entityId;
          return (
            <TimelineChip
              key={`${ev.entityKind}-${String(ev.entityId)}-${i}`}
              event={ev}
              state={state}
              catalog={catalog}
              isResolve={isResolve}
              isTarget={isTarget}
            />
          );
        })}
      </div>
    </div>
  );
}

function TimelineChip(props: {
  readonly event: ProjectedEvent;
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly isResolve: boolean;
  readonly isTarget: boolean;
}): ReactElement {
  const { event, state, catalog, isResolve, isTarget } = props;
  const label = chipLabel(event, state, catalog);
  const team = chipTeam(event, state);
  const bg = isResolve
    ? '#f6e5a8'
    : event.entityKind === 'charged_action'
      ? '#3a4150'
      : teamChipColor(team);
  const border = isTarget ? '#9adfff' : 'transparent';
  const color = isResolve ? '#1c1e23' : '#e7e9ee';
  return (
    <div
      style={{
        ...chipStyle,
        background: bg,
        borderColor: border,
        color,
      }}
      title={chipTitle(event, state, catalog, isResolve, isTarget)}
    >
      <span style={chipLabelStyle}>{label}</span>
      <span style={chipTickStyle}>+{event.ticksFromNow}</span>
    </div>
  );
}

function chipLabel(event: ProjectedEvent, state: GameState, catalog: Catalog): string {
  if (event.entityKind === 'charged_action') {
    // Resolve chip — show '✦' (spell glyph). Other charged-action chips
    // would carry the ability glyph but the surrounding window currently
    // only contains the hypothetical sentinel resolve at the highlighted
    // index. Future enhancement: render the ability initial letter.
    const charged = state.chargedActions.find((c) => c.id === event.entityId);
    if (charged !== undefined && catalog.hasAbility(charged.abilityId)) {
      const ability = catalog.getAbility(charged.abilityId);
      return ability.name.slice(0, 1).toUpperCase();
    }
    return '✦';
  }
  const unit = state.units.get(event.entityId);
  if (unit === undefined) return '?';
  return unit.name.slice(0, 1).toUpperCase();
}

function chipTeam(event: ProjectedEvent, state: GameState): TeamId | null {
  if (event.entityKind === 'unit') {
    return state.units.get(event.entityId)?.team ?? null;
  }
  const charged = state.chargedActions.find((c) => c.id === event.entityId);
  if (charged === undefined) return null;
  return state.units.get(charged.casterId)?.team ?? null;
}

function teamChipColor(team: TeamId | null): string {
  if (team === null) return TEAM_PALETTE_FALLBACK_CSS;
  return TEAM_PALETTE.get(team)?.css ?? TEAM_PALETTE_FALLBACK_CSS;
}

function chipTitle(
  event: ProjectedEvent,
  state: GameState,
  catalog: Catalog,
  isResolve: boolean,
  isTarget: boolean,
): string {
  let label: string;
  if (event.entityKind === 'unit') {
    label = state.units.get(event.entityId)?.name ?? String(event.entityId);
  } else {
    const charged = state.chargedActions.find((c) => c.id === event.entityId);
    if (charged !== undefined && catalog.hasAbility(charged.abilityId)) {
      label = catalog.getAbility(charged.abilityId).name;
    } else {
      label = isResolve ? 'Charged resolve' : 'Charged action';
    }
  }
  const ticks = `+${event.ticksFromNow} ticks`;
  const tags: string[] = [];
  if (isResolve) tags.push('resolve');
  if (isTarget) tags.push("target's turn");
  return tags.length > 0 ? `${label} (${ticks}) — ${tags.join(', ')}` : `${label} (${ticks})`;
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

// Range strip — sits between the sub-header and the per-target table.
// One-line summary of effective range for this cast (post equipment /
// status modifiers via `computeAbilityRange`). Per-target hit chance
// rows render inside each target card below.
const accuracyStripStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 4,
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
};

const accuracyEntryStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  alignItems: 'baseline',
};

const accuracyLabelStyle: CSSProperties = { opacity: 0.65 };
const accuracyValueStyle: CSSProperties = { fontWeight: 500 };

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

const hpRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 11,
};
const hpLabelStyle: CSSProperties = { opacity: 0.65 };
const hpValueStyle: CSSProperties = { fontWeight: 500 };
const hpMaxStyle: CSSProperties = { opacity: 0.55, marginLeft: 1 };

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

const timelineStyle: CSSProperties = {
  marginTop: 4,
};

const timelineRowStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  alignItems: 'stretch',
  overflowX: 'auto',
};

const chipStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 28,
  padding: '2px 4px',
  borderRadius: 4,
  borderWidth: 2,
  borderStyle: 'solid',
  fontFamily: 'inherit',
  flexShrink: 0,
};

const chipLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
};

const chipTickStyle: CSSProperties = {
  fontSize: 9,
  opacity: 0.75,
  fontVariantNumeric: 'tabular-nums',
  marginTop: 1,
};

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
