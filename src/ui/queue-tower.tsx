// QueueTower — the left-side column of the battle UI per
// `docs/twentyOneDesign/battle-ui-architecture.md` ("Projection Column
// / Queue Tower"). A unified vertical column with two halves:
//
//   - Bottom anchor: the active-unit panel (Tier 1.5 disclosure —
//     compact essentials about whoever's turn it is).
//   - Above it: upcoming-event mini-cards, ordered nearest event at
//     the bottom, furthest at the top. "Looking up the column is
//     looking forward in time."
//
// Session 24: full 20-event horizon with scrolling. Hover a mini-card
// to light the canvas counterpart; click to open the unit-detail panel.
// Column auto-snaps to bottom on a new turn (the new active unit anchor
// re-appears at the visible row).
//
// The component reads engine state through the existing public surface:
//   - `projectUpcoming(state, count, catalog)` for the upcoming-event
//     mini-cards.
//   - `state.turnState?.unitId` for the active unit.
//   - `computeSpeed` and `runModifyStatQuery` for derived stats.

import { useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import {
  computeSpeed,
  projectUpcoming,
  runModifyStatQuery,
  type Catalog,
  type GameState,
  type ProjectedEvent,
  type TeamId,
  type Unit,
  type UnitId,
} from '@engine/index.ts';

// Number of upcoming-event mini-cards rendered above the active unit
// panel. Per the design doc's "20-event horizon"; the scrollable inner
// container shows ~5-7 at a time at default sizing.
const VISIBLE_UPCOMING_EVENTS = 20;

// Mirrors the renderer's TEAM_COLORS so card borders match the on-canvas
// color. Renderer-as-source-of-truth would be cleaner, but the renderer
// returns Pixi numbers (0xRRGGBB) and React styles want CSS strings;
// duplicating two entries is the lowest-cost path.
const TEAM_BORDER_COLORS: Readonly<Record<string, string>> = {
  team_a: '#4a90e2',
  team_b: '#d0533d',
};
const TEAM_BORDER_FALLBACK = '#aaaaaa';

export interface QueueTowerProps {
  readonly state: GameState | null;
  readonly catalog: Catalog;
  // Hover-counterpart callback — when the player hovers a mini-card,
  // the corresponding unit (or charged action's caster) is reported so
  // the canvas can pulse it.
  readonly onHoverParticipants?: (ids: ReadonlyArray<UnitId>) => void;
  // Click-through to the unit detail panel.
  readonly onOpenUnitDetail?: (unitId: UnitId) => void;
}

export function QueueTower({ state, catalog, onHoverParticipants, onOpenUnitDetail }: QueueTowerProps): ReactElement {
  const activeUnit = state !== null && state.turnState !== null
    ? state.units.get(state.turnState.unitId) ?? null
    : null;
  const events = state === null
    ? []
    : projectUpcoming(state, VISIBLE_UPCOMING_EVENTS, catalog);

  // Auto-snap back to the active anchor when a new turn begins (the
  // active unit's id changes). Without this, the player who's scrolled
  // up to see future events would stay scrolled when the next turn
  // fires — disorienting.
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastActiveIdRef = useRef<string | null>(null);
  const currentActiveId = activeUnit?.id ?? null;
  useEffect(() => {
    if (listRef.current === null) return;
    const last = lastActiveIdRef.current;
    if (last !== null && currentActiveId !== last) {
      // Scroll so the active anchor is in view. Because the list is
      // column-reverse (nearest at bottom), the bottom corresponds to
      // scrollTop = scrollHeight - clientHeight.
      const el = listRef.current;
      el.scrollTop = el.scrollHeight;
    }
    lastActiveIdRef.current = currentActiveId !== null ? String(currentActiveId) : null;
  }, [currentActiveId]);

  return (
    <aside style={towerStyle} aria-label="Turn queue">
      <div style={miniCardListStyle} ref={listRef}>
        {/* Render in natural order (event 1 first, event 20 last); the
            container's `column-reverse` flexDirection visually stacks
            event 1 at the bottom (closest to the active anchor) and
            event 20 at the top. "Looking up the column is looking
            forward in time." */}
        {events.map((event, idx) => (
          <MiniCard
            key={`${event.entityKind}-${event.entityId}-${idx}`}
            event={event}
            // Position number = how many events away from now (1 = next).
            position={idx + 1}
            state={state!}
            catalog={catalog}
            onHoverParticipants={onHoverParticipants}
            onOpenUnitDetail={onOpenUnitDetail}
          />
        ))}
      </div>
      <ActiveUnitAnchor
        unit={activeUnit}
        state={state}
        catalog={catalog}
        onOpenUnitDetail={onOpenUnitDetail}
      />
    </aside>
  );
}

// A single upcoming-event mini-card. Per the design doc: position
// number, portrait placeholder, team border, name + class. No HP/MP/
// status detail.
function MiniCard(props: {
  readonly event: ProjectedEvent;
  readonly position: number;
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly onHoverParticipants?: (ids: ReadonlyArray<UnitId>) => void;
  readonly onOpenUnitDetail?: (unitId: UnitId) => void;
}): ReactElement {
  const { event, position, state, catalog, onHoverParticipants, onOpenUnitDetail } = props;
  const { label, sublabel, teamId, isCharged, primaryUnitId } = describeEvent(event, state, catalog);
  const borderColor = teamColor(teamId);
  const clickable = primaryUnitId !== null && onOpenUnitDetail !== undefined;
  return (
    <div
      style={miniCardStyle(borderColor, clickable)}
      onMouseEnter={() => {
        if (onHoverParticipants !== undefined && primaryUnitId !== null) {
          onHoverParticipants([primaryUnitId]);
        }
      }}
      onMouseLeave={() => {
        if (onHoverParticipants !== undefined) onHoverParticipants([]);
      }}
      onClick={() => {
        if (clickable && primaryUnitId !== null && onOpenUnitDetail !== undefined) {
          onOpenUnitDetail(primaryUnitId);
        }
      }}
    >
      <div style={miniCardPositionStyle}>{position}</div>
      <div style={miniCardPortraitStyle}>
        {/* Placeholder portrait — colored block. Real art is post-MVP. */}
        <div style={miniCardPortraitFillStyle(borderColor, isCharged)} />
      </div>
      <div style={miniCardLabelColStyle}>
        <div style={miniCardNameStyle}>{label}</div>
        <div style={miniCardSubStyle}>{sublabel}</div>
      </div>
      <div style={miniCardTicksStyle}>+{event.ticksFromNow}</div>
    </div>
  );
}

// The bottom anchor — Tier 1.5 active unit panel. Compact essentials.
function ActiveUnitAnchor(props: {
  readonly unit: Unit | null;
  readonly state: GameState | null;
  readonly catalog: Catalog;
  readonly onOpenUnitDetail?: (unitId: UnitId) => void;
}): ReactElement {
  const { unit, state, catalog, onOpenUnitDetail } = props;

  if (unit === null || state === null) {
    return (
      <div style={anchorStyle('#2c2f36')}>
        <div style={anchorHeaderStyle}>Active Unit</div>
        <div style={anchorEmptyStyle}>(between turns)</div>
      </div>
    );
  }

  const cls = catalog.getClass(unit.classState.currentClass);
  const speed = computeSpeed(state, unit.id, catalog);
  const maxHp = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'maxHp',
    baseValue: unit.baseStats.maxHpBase,
  });
  const borderColor = teamColor(unit.team);

  return (
    <div style={anchorStyle(borderColor)}>
      <div style={anchorHeaderStyle}>Active Unit</div>
      <div style={anchorTitleRowStyle}>
        <div style={anchorPortraitStyle(borderColor)} />
        <div>
          <div style={anchorNameStyle}>{unit.name}</div>
          <div style={anchorSubStyle}>{cls.name}</div>
        </div>
      </div>
      <Stat label="HP" current={unit.vitals.hp} max={maxHp} />
      <Stat label="MP" current={unit.vitals.mp} />
      <div style={anchorMiniRowStyle}>
        <Stat label="SPD" current={speed} compact />
        <Stat label="CT" current={unit.ct} compact />
      </div>
      <StatusStrip unit={unit} />
      {onOpenUnitDetail !== undefined && (
        <button
          type="button"
          style={anchorDetailButtonStyle}
          onClick={() => onOpenUnitDetail(unit.id)}
        >
          Open full details
        </button>
      )}
    </div>
  );
}

function Stat(props: {
  readonly label: string;
  readonly current: number;
  readonly max?: number;
  readonly compact?: boolean;
}): ReactElement {
  const { label, current, max, compact } = props;
  return (
    <div style={compact ? statRowCompactStyle : statRowStyle}>
      <span style={statLabelStyle}>{label}</span>
      <span style={statValueStyle}>
        {current}
        {max !== undefined && <span style={statMaxStyle}>/{max}</span>}
      </span>
    </div>
  );
}

function StatusStrip({ unit }: { readonly unit: Unit }): ReactElement | null {
  if (unit.statuses.length === 0) return null;
  return (
    <div style={statusStripStyle}>
      {unit.statuses.map((s, i) => {
        const stacks = s.stacks ?? 1;
        return (
          <span key={`${s.typeId}-${i}`} style={statusChipStyle}>
            {s.typeId}
            {stacks > 1 && <span style={statusStackStyle}>×{stacks}</span>}
          </span>
        );
      })}
    </div>
  );
}

// ---- helpers ----

interface EventDescription {
  readonly label: string;
  readonly sublabel: string;
  readonly teamId: TeamId | null;
  readonly isCharged: boolean;
  // The unit the player would want to inspect when clicking through —
  // either the upcoming unit, or the charged spell's caster.
  readonly primaryUnitId: UnitId | null;
}

function describeEvent(
  event: ProjectedEvent,
  state: GameState,
  catalog: Catalog,
): EventDescription {
  if (event.entityKind === 'unit') {
    const unit = state.units.get(event.entityId);
    if (unit === undefined) {
      return {
        label: String(event.entityId),
        sublabel: '',
        teamId: null,
        isCharged: false,
        primaryUnitId: null,
      };
    }
    const cls = catalog.getClass(unit.classState.currentClass);
    return {
      label: unit.name,
      sublabel: cls.name,
      teamId: unit.team,
      isCharged: false,
      primaryUnitId: unit.id,
    };
  }
  // charged_action — find the in-flight charged action and read its
  // ability + caster + target from the catalog/state. The sublabel
  // includes the target so the player can see "Brunhilde → Sparky"
  // directly on the mini-card without opening a tooltip.
  const charged = state.chargedActions.find((c) => c.id === event.entityId);
  if (charged === undefined) {
    return {
      label: String(event.entityId),
      sublabel: 'charged',
      teamId: null,
      isCharged: true,
      primaryUnitId: null,
    };
  }
  const ability = catalog.getAbility(charged.abilityId);
  const caster = state.units.get(charged.casterId);
  const targetLabel = describeChargedTarget(charged.targets, state);
  const sublabel = targetLabel === null
    ? caster?.name ?? 'unknown caster'
    : `${caster?.name ?? '?'} → ${targetLabel}`;
  return {
    label: ability.name,
    sublabel,
    teamId: caster?.team ?? null,
    isCharged: true,
    primaryUnitId: caster?.id ?? null,
  };
}

// Render a charged action's target list as a short, single-line label.
// Multi-target charges are summarized by the first target plus the
// count of others ("Sparky +2").
function describeChargedTarget(
  targets: ReadonlyArray<{
    readonly kind: 'unit' | 'tile';
    readonly unitId?: import('@engine/index.ts').UnitId;
    readonly position?: import('@engine/index.ts').Position;
  }>,
  state: GameState,
): string | null {
  if (targets.length === 0) return null;
  const first = targets[0]!;
  const firstLabel = first.kind === 'unit' && first.unitId !== undefined
    ? state.units.get(first.unitId)?.name ?? String(first.unitId)
    : first.position !== undefined
      ? `(${first.position.x},${first.position.y})`
      : '?';
  if (targets.length === 1) return firstLabel;
  return `${firstLabel} +${targets.length - 1}`;
}

function teamColor(team: TeamId | null): string {
  if (team === null) return TEAM_BORDER_FALLBACK;
  return TEAM_BORDER_COLORS[team] ?? TEAM_BORDER_FALLBACK;
}

// ---- styles ----

const towerStyle: CSSProperties = {
  position: 'absolute',
  top: 36,
  left: 12,
  bottom: 12,
  width: 280,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  pointerEvents: 'auto',
  fontFamily: 'system-ui, sans-serif',
  color: '#e7e9ee',
};

const miniCardListStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column-reverse', // nearest event sits closest to anchor
  gap: 6,
  overflowY: 'auto',
  justifyContent: 'flex-start',
  minHeight: 0,
  paddingRight: 4,
};

const miniCardStyle = (borderColor: string, clickable: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '6px 8px',
  background: '#1c1e23',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor,
  borderRadius: 6,
  fontSize: 13,
  minHeight: 56,
  cursor: clickable ? 'pointer' : 'default',
});

const miniCardPositionStyle: CSSProperties = {
  width: 22,
  textAlign: 'center',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 600,
  opacity: 0.8,
};

const miniCardPortraitStyle: CSSProperties = {
  width: 40,
  height: 40,
  background: '#0e0f12',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const miniCardPortraitFillStyle = (color: string, charged: boolean): CSSProperties => ({
  width: 30,
  height: 30,
  borderRadius: charged ? '50%' : 4,
  background: color,
  opacity: charged ? 0.7 : 0.85,
  // Charged-action visual signal — circular vs square fills, plus a
  // dashed border. Placeholder stand-in for the spell-circle overlay
  // the design doc prescribes; iconography lands later.
  borderWidth: charged ? 1 : 0,
  borderStyle: charged ? 'dashed' : 'solid',
  borderColor: '#f6e5a8',
});

const miniCardLabelColStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  gap: 1,
};

const miniCardNameStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const miniCardSubStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.65,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const miniCardTicksStyle: CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
  fontVariantNumeric: 'tabular-nums',
};

const anchorStyle = (borderColor: string): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  background: '#1c1e23',
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor,
  borderRadius: 8,
  fontSize: 14,
});

const anchorHeaderStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.65,
  marginBottom: 2,
};

const anchorEmptyStyle: CSSProperties = {
  fontSize: 13,
  opacity: 0.55,
  fontStyle: 'italic',
};

const anchorTitleRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginBottom: 4,
};

const anchorPortraitStyle = (color: string): CSSProperties => ({
  width: 44,
  height: 44,
  borderRadius: 6,
  background: color,
  flexShrink: 0,
  opacity: 0.9,
});

const anchorNameStyle: CSSProperties = { fontSize: 16, fontWeight: 600 };

const anchorSubStyle: CSSProperties = { fontSize: 12, opacity: 0.7 };

const anchorMiniRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
};

const statRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  fontVariantNumeric: 'tabular-nums',
};

const statRowCompactStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  fontVariantNumeric: 'tabular-nums',
  fontSize: 13,
};

const statLabelStyle: CSSProperties = { opacity: 0.7 };

const statValueStyle: CSSProperties = { fontWeight: 500 };

const statMaxStyle: CSSProperties = { opacity: 0.55, marginLeft: 1 };

const statusStripStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  marginTop: 6,
};

const statusChipStyle: CSSProperties = {
  fontSize: 11,
  padding: '2px 6px',
  background: '#2a3140',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 4,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
};

const statusStackStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.75,
  fontVariantNumeric: 'tabular-nums',
};

const anchorDetailButtonStyle: CSSProperties = {
  marginTop: 8,
  padding: '4px 8px',
  fontSize: 11,
  background: '#2a3140',
  color: '#bcc1cb',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 4,
  cursor: 'pointer',
  textAlign: 'center',
  fontFamily: 'inherit',
};
