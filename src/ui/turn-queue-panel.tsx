// TurnQueuePanel — projected upcoming events from the CT scheduler.
//
// Shows the next N entries from `projectUpcoming`. Each row is the
// entity (unit name or "charged: AbilityName"), team color, and how
// many ticks away it is from triggering. The first entry is the
// currently-active turn when one is in progress (ticksFromNow = 0).
//
// v1 only — projection is based on the "assumed full Move + Act"
// constant from the ruleset (ADR-0003). When the active unit's choice
// would skew their own subsequent turn (e.g., "Wait" costs less CT
// than the assumed full turn), the projection past their current turn
// is approximate. Documented in ct-system.md.

import type { CSSProperties, ReactElement } from 'react';
import {
  projectUpcoming,
  type Catalog,
  type GameState,
  type ProjectedEvent,
  type TeamId,
} from '@engine/index.ts';

// Mirrors the renderer's TEAM_COLORS so the queue indicator matches
// the on-canvas color. Renderer-as-source-of-truth would be cleaner,
// but the renderer module returns Pixi numbers (0xRRGGBB) and React
// styles want CSS strings; duplicating two entries is the lowest-cost
// path. If a third team arrives, this and constants.ts both grow.
const TEAM_DOT_COLORS: Readonly<Record<string, string>> = {
  team_a: '#4a90e2',
  team_b: '#d0533d',
};
const TEAM_DOT_FALLBACK = '#aaaaaa';

export interface TurnQueuePanelProps {
  readonly state: GameState | null;
  readonly catalog: Catalog;
  readonly count?: number;
}

export function TurnQueuePanel(props: TurnQueuePanelProps): ReactElement {
  const { state, catalog, count = 5 } = props;

  if (state === null) {
    return (
      <div style={panelStyle}>
        <div style={panelHeaderStyle}>Up Next</div>
      </div>
    );
  }

  const events = projectUpcoming(state, count, catalog);
  return (
    <div style={panelStyle}>
      <div style={panelHeaderStyle}>Up Next</div>
      {events.length === 0 ? (
        <div style={emptyStyle}>(no upcoming events)</div>
      ) : (
        <ol style={listStyle}>
          {events.map((event, i) => (
            <Row key={`${event.entityKind}-${event.entityId}-${i}`} state={state} catalog={catalog} event={event} />
          ))}
        </ol>
      )}
    </div>
  );
}

function Row({
  state,
  catalog,
  event,
}: {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly event: ProjectedEvent;
}): ReactElement {
  const label = describe(state, catalog, event);
  const dot = teamDot(state, event);
  return (
    <li style={rowStyle}>
      <span style={dotStyle(dot)} />
      <span style={labelStyle}>{label}</span>
      <span style={ticksStyle}>+{event.ticksFromNow}</span>
    </li>
  );
}

function describe(state: GameState, catalog: Catalog, event: ProjectedEvent): string {
  if (event.entityKind === 'unit') {
    const unit = state.units.get(event.entityId);
    return unit?.name ?? String(event.entityId);
  }
  // charged_action — find the in-flight charged action and read its
  // ability name from the catalog.
  const charged = state.chargedActions.find((c) => c.id === event.entityId);
  if (charged === undefined) return String(event.entityId);
  const ability = catalog.getAbility(charged.abilityId);
  return `charged: ${ability.name}`;
}

function teamDot(state: GameState, event: ProjectedEvent): string {
  let team: TeamId | null = null;
  if (event.entityKind === 'unit') {
    const u = state.units.get(event.entityId);
    if (u !== undefined) team = u.team;
  } else {
    const c = state.chargedActions.find((c) => c.id === event.entityId);
    if (c !== undefined) {
      const u = state.units.get(c.casterId);
      if (u !== undefined) team = u.team;
    }
  }
  if (team === null) return TEAM_DOT_FALLBACK;
  return TEAM_DOT_COLORS[team] ?? TEAM_DOT_FALLBACK;
}

const panelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  background: '#1c1e23',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#2c2f36',
  borderRadius: 8,
  color: '#e7e9ee',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  minWidth: 200,
};
const panelHeaderStyle: CSSProperties = {
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  opacity: 0.65,
  marginBottom: 2,
};
const emptyStyle: CSSProperties = { fontSize: 13, opacity: 0.6, fontStyle: 'italic' };
const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};
const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontVariantNumeric: 'tabular-nums',
};
const labelStyle: CSSProperties = { flex: 1, fontSize: 13 };
const ticksStyle: CSSProperties = { opacity: 0.6, fontSize: 12 };
function dotStyle(color: string): CSSProperties {
  return {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: 4,
    background: color,
  };
}
