// Speed computation.
// See docs/design/ct-system.md and ADR-0004 (catalog injection) /
// ADR-0008 (ruleset surface).
//
// Computed on read, not stored. Pulls baseStats.spd through the
// modifyStatQuery hook chain so statuses (Haste, Slow), and eventually
// equipment, class traits, and equipped passives, can modify it. The
// speed floor (Stop, etc.) is read from the active ruleset's
// `speedBounds.floor` so an alternate ruleset can change it.

import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import { runModifyActionSpeed, runModifyStatQuery } from '../hooks/index.ts';
import { getUnit, type ChargedAction, type GameState, type Unit, type UnitId } from '../types/index.ts';

export function computeSpeed(state: GameState, unitId: UnitId, catalog: Catalog): number {
  const unit = getUnit(state, unitId);
  const modified = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'spd',
    baseValue: unit.baseStats.spd,
  });
  const ruleset = catalog.getRuleset(state.ruleset.id);
  // Floor to integer so the CT accumulator stays whole. Haste's ×1.5
  // multiplier against odd base Speed (e.g., 11 → 16.5) would otherwise
  // produce fractional CT progression — surfaced in S38 playtest with
  // Boots of Haste (Auto-Haste). FFT canonical reads use integer Speed;
  // floor matches that. The speed-floor clamp runs after the floor so
  // the floor doesn't push a positive ruleset.floor (>1) down.
  return Math.max(ruleset.speedBounds.floor, Math.floor(modified));
}

// Compute the committed Action Speed for an ability about to be cast.
// Reads `ability.actionSpeed`, threads it through the `modifyActionSpeed`
// hook chain (additive; equipment / status / passive contributors fire
// against the caster's hooks), clamps so a positive-speed ability stays
// positive (Math.max(1, modified) when base > 0). The clamp preserves
// the line-264 charged-vs-instant gate's invariant — equipment can't
// flip an instant ability into a charged one or vice versa. The
// resulting value is what `commitCharged` stores on `ChargedAction.speed`;
// per ADR-0056, that stored value is the canonical commit-time read.
// Per ADR-0056 (Session 27).
export function computeBaseActionSpeed(
  state: GameState,
  catalog: Catalog,
  unit: Unit,
  ability: ActiveAbilityDefinition,
): number {
  const modified = runModifyActionSpeed(state, catalog, {
    unit,
    ability,
    baseActionSpeed: ability.actionSpeed,
  });
  if (ability.actionSpeed > 0) return Math.max(1, modified);
  return Math.max(0, modified);
}

// Action Speed is stored on the ChargedAction (ADR-0003) and modified
// by abilities that mutate it directly (Hasten Charge, Slow Action).
// No hook chain at read time — the field is the canonical value baked
// in at commit (per ADR-0056; equipment / status modifiers compose at
// commit via `computeBaseActionSpeed`).
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
