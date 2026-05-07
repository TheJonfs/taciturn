// Speed computation.
// See docs/design/ct-system.md and ADR-0004 (catalog injection) /
// ADR-0008 (ruleset surface).
//
// Computed on read, not stored. Pulls baseStats.spd through the
// modifyStatQuery hook chain so statuses (Haste, Slow), and eventually
// equipment, class traits, and equipped passives, can modify it. The
// speed floor (Stop, etc.) is read from the active ruleset's
// `speedBounds.floor` so an alternate ruleset can change it.

import type { Catalog } from '../catalog/index.ts';
import { runModifyStatQuery } from '../hooks/index.ts';
import { getUnit, type ChargedAction, type GameState, type UnitId } from '../types/index.ts';

export function computeSpeed(state: GameState, unitId: UnitId, catalog: Catalog): number {
  const unit = getUnit(state, unitId);
  const modified = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'spd',
    baseValue: unit.baseStats.spd,
  });
  const ruleset = catalog.getRuleset(state.ruleset.id);
  return Math.max(ruleset.speedBounds.floor, modified);
}

// Action Speed is stored on the ChargedAction (ADR-0003) and modified
// by abilities that mutate it directly (Hasten Charge, Slow Action).
// No hook chain at read time — the field is the canonical value.
// Floored against the same ruleset speed floor as unit Speed for
// consistency.
//
// Stop pause: per the Battle Mechanics Guide ("Pause mechanic for
// Stop") and ADR-0023, an in-flight charge whose caster has any status
// listed in `ruleset.chargedActions.pausingStatusTypeIds` returns 0
// here — the charged action sits at its current CT in the projection
// queue until the pausing status clears. The check is derived (no
// stored `paused` flag) so apply/remove of Stop don't need side-effect
// state mutation; the projection sees the right value on every read.
//
// Edge case (Quick-style ability pushes a paused charge's CT past 100)
// is out of v1 scope — no v1 ability targets ChargedActions for CT push.
// When such content ships, the scheduler may need to suppress the
// triggered-but-paused case (today the scheduler's ct >= threshold
// shortcut would still fire it).
export function computeActionSpeed(
  state: GameState,
  action: ChargedAction,
  catalog: Catalog,
): number {
  const ruleset = catalog.getRuleset(state.ruleset.id);
  const caster = state.units.get(action.casterId);
  if (caster !== undefined) {
    const pausingIds = ruleset.chargedActions.pausingStatusTypeIds;
    if (pausingIds.length > 0) {
      for (const status of caster.statuses) {
        for (const pausingId of pausingIds) {
          if (status.typeId === pausingId) return 0;
        }
      }
    }
  }
  return Math.max(ruleset.speedBounds.floor, action.speed);
}
