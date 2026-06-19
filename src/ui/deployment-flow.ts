// Deployment-flow state machine — pure reducer driving the player's
// unit-placement experience during the deployment phase. Sibling to
// `turn-flow.ts`; same shape (a phase discriminant + pure `transition`),
// different semantics.
//
// Session 35 (Phase E). The deployment phase sits between battle setup
// and the battle proper: the player places their team's units onto the
// map's deployment-zone tiles, choosing a facing for each, then commits.
//
// The interaction loop is tile-first:
//
//   idle           — nothing selected. Map shows the deployment zone,
//                    the placed units, and the available roster.
//   tile_selected  — an eligible empty zone tile is selected; the
//                    roster panel is now a unit picker.
//   unit_selected  — a roster unit was picked; the facing picker (four
//                    cardinal arrows) is shown around the selected tile.
//   (commit)       — a facing was picked; the unit is placed and the
//                    phase returns to idle.
//
// Cancelable transitions:
//   tile_selected  → idle           (cancel / click off-zone)
//   unit_selected  → tile_selected  (back out of the facing picker)
//
// Re-placement (lift-and-replace, per the Session 35 brief): a
// `liftUnit` event removes a unit from `placements` and selects its
// prior tile, so the player lands back in `tile_selected` ready to
// re-place — the common "I wanted them facing east" iteration costs one
// extra click, not a full re-pick.
//
// Team-parameterized: `currentTeam` is carried on the state so the
// future pass-and-play extension (deploy team A, then team B) is
// mechanical — nothing here hardcodes Blue.
//
// The reducer is pure: it knows nothing about the renderer, the engine,
// or the map. Tile eligibility (is this an empty in-zone tile?) and
// occupant lookup (is there a placed unit here? — emit `liftUnit`
// instead of `selectTile`) are the *caller's* job; the `use-deployment-
// flow` hook resolves a raw tile click into the right event. The state
// machine trusts that `selectTile` only ever carries an eligible empty
// tile and `pickUnit` only ever carries an un-placed roster unit.

import {
  subZoneIndexForTile,
  zoneForTeam,
  type DeploymentZoneConfig,
  type Direction,
  type Position,
  type TeamId,
  type UnitId,
} from '@engine/index.ts';

// A committed placement: where a unit stands and which way it faces.
// The unit-placement-equivalent the pipeline consumes downstream.
export interface DeploymentPlacement {
  readonly position: Position;
  readonly facing: Direction;
}

export type DeploymentPhase =
  | { readonly kind: 'idle' }
  | { readonly kind: 'tile_selected'; readonly tile: Position }
  | {
      readonly kind: 'unit_selected';
      readonly tile: Position;
      readonly unitId: UnitId;
    };

export interface DeploymentState {
  // Whose deployment this is. The roster panel, zone tint, validation,
  // and commit logic all key off this — Blue this session, but the
  // parameter makes pass-and-play a routing change, not a refactor.
  readonly currentTeam: TeamId;
  readonly phase: DeploymentPhase;
  // unitId → placement. The deployment accumulated so far. A unit is
  // "placed" iff it has an entry here; "available" (in the roster)
  // otherwise.
  readonly placements: ReadonlyMap<UnitId, DeploymentPlacement>;
}

export type DeploymentEvent =
  // An eligible empty zone tile was clicked.
  | { readonly kind: 'selectTile'; readonly tile: Position }
  // A roster unit was picked while a tile is selected.
  | { readonly kind: 'pickUnit'; readonly unitId: UnitId }
  // A facing was chosen while a unit is selected — commits the placement.
  | { readonly kind: 'pickFacing'; readonly facing: Direction }
  // An already-placed unit was clicked — lift it back to the roster and
  // select its prior tile (re-placement).
  | { readonly kind: 'liftUnit'; readonly unitId: UnitId }
  // Back out one step (Escape / click off-zone / picker back-arrow).
  | { readonly kind: 'cancel' };

export function createDeploymentState(currentTeam: TeamId): DeploymentState {
  return {
    currentTeam,
    phase: { kind: 'idle' },
    placements: new Map(),
  };
}

// The unit currently placed on `tile`, if any. The hook uses this to
// resolve a raw tile click: an occupied tile means `liftUnit`, an empty
// eligible tile means `selectTile`.
export function unitPlacedOn(
  state: DeploymentState,
  tile: Position,
): UnitId | null {
  for (const [unitId, placement] of state.placements) {
    if (
      placement.position.x === tile.x &&
      placement.position.y === tile.y &&
      placement.position.layer === tile.layer
    ) {
      return unitId;
    }
  }
  return null;
}

// ===== Per-sub-zone cap helpers (S70) =====
//
// A split zone caps how many units may deploy into each sub-zone. These
// pure helpers read the current placements against the zone config so the
// hook can (a) reject over-cap placement and (b) dim full sub-zones. A
// single uncapped zone (the three original maps) has no full sub-zones
// and admits every in-zone tile, so these are no-ops there.

function posKey(p: Position): string {
  return `${p.x},${p.y},${p.layer}`;
}

// How many placed units fall in each of `team`'s sub-zones, indexed by
// sub-zone order. Empty array if the team has no zone.
export function subZoneUsage(
  zones: DeploymentZoneConfig,
  team: TeamId,
  placements: ReadonlyMap<UnitId, DeploymentPlacement>,
): number[] {
  const zone = zoneForTeam(zones, team);
  if (zone === undefined) return [];
  const used = zone.subZones.map(() => 0);
  for (const { position } of placements.values()) {
    const idx = subZoneIndexForTile(zones, team, position);
    if (idx !== null) used[idx] = used[idx]! + 1;
  }
  return used;
}

// May a unit be placed on `pos`? True iff the tile is in `team`'s zone and
// the sub-zone it belongs to is uncapped or below its cap. The caller
// checks lift (re-placement) first, so an occupied tile never reaches here.
export function canPlaceInZone(
  zones: DeploymentZoneConfig,
  team: TeamId,
  pos: Position,
  placements: ReadonlyMap<UnitId, DeploymentPlacement>,
): boolean {
  const idx = subZoneIndexForTile(zones, team, pos);
  if (idx === null) return false;
  const subZone = zoneForTeam(zones, team)!.subZones[idx]!;
  if (subZone.cap === undefined) return true;
  return subZoneUsage(zones, team, placements)[idx]! < subZone.cap;
}

// Position keys of every tile belonging to an at-capacity sub-zone — the
// tiles to render "locked" (no remaining capacity).
export function lockedZoneTileKeys(
  zones: DeploymentZoneConfig,
  team: TeamId,
  placements: ReadonlyMap<UnitId, DeploymentPlacement>,
): ReadonlySet<string> {
  const zone = zoneForTeam(zones, team);
  const keys = new Set<string>();
  if (zone === undefined) return keys;
  const used = subZoneUsage(zones, team, placements);
  zone.subZones.forEach((sz, idx) => {
    if (sz.cap !== undefined && used[idx]! >= sz.cap) {
      for (const t of sz.tiles) keys.add(posKey(t));
    }
  });
  return keys;
}

// True once every roster unit has a placement. Drives the "Start Battle"
// affordance — the caller passes the full roster id list for the team.
export function isDeploymentComplete(
  state: DeploymentState,
  rosterUnitIds: ReadonlyArray<UnitId>,
): boolean {
  return rosterUnitIds.every((id) => state.placements.has(id));
}

// Remove a unit's placement, returning a fresh placements map. Internal
// helper — `transition` is the only caller.
function withoutUnit(
  placements: ReadonlyMap<UnitId, DeploymentPlacement>,
  unitId: UnitId,
): ReadonlyMap<UnitId, DeploymentPlacement> {
  const next = new Map(placements);
  next.delete(unitId);
  return next;
}

export function transition(
  state: DeploymentState,
  event: DeploymentEvent,
): DeploymentState {
  // `liftUnit` overrides the current phase regardless of where we are:
  // clicking a placed unit always lifts it and selects its prior tile.
  // (No-op if the unit isn't actually placed — a defensive identity.)
  if (event.kind === 'liftUnit') {
    const placement = state.placements.get(event.unitId);
    if (placement === undefined) return state;
    return {
      ...state,
      phase: { kind: 'tile_selected', tile: placement.position },
      placements: withoutUnit(state.placements, event.unitId),
    };
  }

  switch (state.phase.kind) {
    case 'idle':
      if (event.kind === 'selectTile') {
        return { ...state, phase: { kind: 'tile_selected', tile: event.tile } };
      }
      // pickUnit / pickFacing / cancel do nothing while idle.
      return state;

    case 'tile_selected':
      if (event.kind === 'cancel') {
        return { ...state, phase: { kind: 'idle' } };
      }
      if (event.kind === 'selectTile') {
        // Re-select: clicking a different eligible tile moves the
        // selection rather than requiring a cancel first.
        return { ...state, phase: { kind: 'tile_selected', tile: event.tile } };
      }
      if (event.kind === 'pickUnit') {
        return {
          ...state,
          phase: {
            kind: 'unit_selected',
            tile: state.phase.tile,
            unitId: event.unitId,
          },
        };
      }
      // pickFacing does nothing — no unit selected yet.
      return state;

    case 'unit_selected':
      if (event.kind === 'cancel') {
        // Back out of the facing picker to the tile selection — the
        // unit returns to the roster (it was never committed).
        return { ...state, phase: { kind: 'tile_selected', tile: state.phase.tile } };
      }
      if (event.kind === 'pickFacing') {
        // Commit: the unit is placed on the selected tile with the
        // chosen facing; the phase returns to idle.
        const next = new Map(state.placements);
        next.set(state.phase.unitId, {
          position: state.phase.tile,
          facing: event.facing,
        });
        return { ...state, phase: { kind: 'idle' }, placements: next };
      }
      // selectTile / pickUnit do nothing — finish or cancel the facing
      // pick first.
      return state;
  }
}
