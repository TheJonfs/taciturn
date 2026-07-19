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
import { CANONICAL_PROBE_BATTLE } from './probe-battle.ts';
import { probeUnitStats } from './snapshot-fold.ts';
import type { CampaignUnit } from './types.ts';

// Effective max HP/MP for a unit as constructed in `state`. Mirrors the
// engine's vitals-fill exactly (floor, non-negative) so a unit healed here
// matches one that walked in with `vitals` omitted.
// S96 (Ch1 playtest): re-normalize a durable unit's stored vitals to its
// CURRENT effective full. The between-battles invariant is "roster units
// are at effective full" (apply-back heals; the fold only clamps DOWN) —
// but any out-of-battle change that moves the max (equip/unequip a
// +MaxMP/+MaxHP piece, reclass onto a different stat curve) left the
// stored vitals at the OLD full, so a unit arrived at battle under-full
// (Chris's Padded Jacket repro: +15 MaxMP, still 6 current MP). Every
// such mutation seam calls this after the change. Probes against the
// canonical field (the numbers are template-independent). A unit whose
// loadout is mid-edit invalid can't be probed — returned unchanged; the
// fold's clamp + the next valid-edit refill catch it up (same contract
// as debugGrantLevel). NOTE for future attrition-carry: this refill
// assumes the full-heal model; if wounds ever persist between battles,
// these seams are where "gear swap must not heal" gets decided.
export function refillVitalsToEffectiveFull(unit: CampaignUnit, catalog: Catalog): CampaignUnit {
  const { template, playerTeam } = CANONICAL_PROBE_BATTLE;
  const stats = probeUnitStats(template, unit, playerTeam, catalog);
  if (stats === null) return unit;
  return { ...unit, vitals: { hp: stats.maxHp, mp: stats.maxMp } };
}

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
