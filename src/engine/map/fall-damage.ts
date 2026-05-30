// Shared falling-damage helper (extracted Session 53, per ADR-0026/0088).
//
// A unit that drops vertically takes `10 × dropDistance` HP of `'falling'`-
// sourced `system_damage`, but only when the drop exceeds a single level
// (dropDistance > 1 — a drop of 0 or 1 is harmless). The emission bypasses
// the damage pipeline (no variance/Faith/resistance; ADR-0027), so the
// amount is precomputed here.
//
// Two consumers share this constant + shape:
//   - `knockback.ts` — forced-movement landings (the original site).
//   - `reduceSystemTerrainChange` — terrain mutation that drops an occupied
//     tile under its occupant (Worldcraft Pit/Valley casts, and the queue's
//     LIFO revert when a raised tile drops back). A *rising* tile is not a
//     drop and emits nothing — this is exactly the blueprint's asymmetry
//     ("raises punish on revert, lowers don't") falling out of the physics
//     for free.

import type { ProposedAction, UnitId } from '../types/index.ts';

export const FALLING_DAMAGE_PER_LEVEL = 10;

// The `system_damage` ProposedAction for a fall of `dropDistance` levels, or
// `null` when the drop is harmless (≤ 1). Centralizes the `> 1` gate so both
// call sites agree on what counts as a damaging fall.
export function fallDamageAction(unitId: UnitId, dropDistance: number): ProposedAction | null {
  if (dropDistance <= 1) return null;
  return {
    type: 'system_damage',
    source: 'system',
    payload: {
      targetId: unitId,
      amount: FALLING_DAMAGE_PER_LEVEL * dropDistance,
      tags: ['physical'],
      source: { kind: 'falling', unitId, dropDistance },
    },
  };
}
