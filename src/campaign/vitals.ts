// TABA campaign — effective max-vitals helper.
//
// "Heal to full" and "clamp carried vitals" both mean the *effective* max
// (HP/MP after equipment / class / passive contributions compose), not the
// stored base. The engine already computes this in `fillVitalsFromComputed-
// Maxes` via `runModifyStatQuery`; this helper is the same computation
// exposed for the campaign's fold (clamp) and apply-back (heal), reading a
// constructed unit out of a `GameState`. Single source of truth — no
// duplicated max formula.

import { runModifyStatQuery } from '@engine/index.ts';
import type { Catalog, GameState, Unit, Vitals } from '@engine/index.ts';

// Effective max HP/MP for a unit as constructed in `state`. Mirrors the
// engine's vitals-fill exactly (floor, non-negative) so a unit healed here
// matches one that walked in with `vitals` omitted.
export function effectiveMaxVitals(state: GameState, catalog: Catalog, unit: Unit): Vitals {
  const hp = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'maxHp',
    baseValue: unit.baseStats.maxHpBase,
  });
  const mp = runModifyStatQuery(state, catalog, {
    unit,
    statName: 'maxMp',
    baseValue: unit.baseStats.maxMpBase,
  });
  return { hp: Math.max(0, Math.floor(hp)), mp: Math.max(0, Math.floor(mp)) };
}
