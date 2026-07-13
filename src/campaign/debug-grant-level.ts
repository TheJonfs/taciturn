// TABA S94 — the dev level grant (the difficulty-curve playtest unblocker).
//
// The XP economy levels units far too slowly to walk Chapter 1's whole
// difficulty curve in a manual playtest (the finale expects ~L10+; earning
// that honestly is hours of battles). One press: every ACTIVE roster unit
// gains +1 level, XP reset to the new level's floor, and vitals re-probed
// to the unit's new effective full (stats are computed-from-inputs — rule
// 5 — so bumping the stored `level` is the entire mutation; the fold
// recomputes `baseStats` at battle entry).
//
// Deliberately repeatable, like the JP chip: press N times to stage the
// party at any rung of the enemy curve. Vitals for a unit whose loadout is
// currently INVALID (surface-and-block, S86) can't be probed — that unit
// levels but keeps its old vitals (clamped to the new max at its next
// fold/apply-back).
//
// Local-only: sole caller is the dev chip on the campaign's manage screen,
// gated on `import.meta.env.DEV` — unreachable in production builds.

import type { Catalog } from '@engine/index.ts';
import type { CampaignNode } from './graph.ts';
import { probeBattleFor } from './probe-battle.ts';
import { probeUnitStats } from './snapshot-fold.ts';
import type { CampaignState, CampaignUnit } from './types.ts';

export const DEBUG_LEVEL_GRANT = 1;

// One press: +DEBUG_LEVEL_GRANT to every active unit, healed to the new
// effective full (probed against `node`'s battlefield, or the canonical
// probe field for a battle-less hub — the same sizing every other
// heal-to-full uses).
export function debugGrantLevel(
  state: CampaignState,
  node: CampaignNode,
  catalog: Catalog,
): CampaignState {
  const probe = probeBattleFor(node);
  const roster = state.roster.map((unit): CampaignUnit => {
    if (unit.fate !== 'active') return unit;
    const leveled: CampaignUnit = { ...unit, level: unit.level + DEBUG_LEVEL_GRANT, xp: 0 };
    const stats = probeUnitStats(probe.template, leveled, probe.playerTeam, catalog);
    // Invalid loadout → stats unavailable; level anyway, vitals catch up
    // at the next fold (they clamp to the recomputed max).
    return stats === null ? leveled : { ...leveled, vitals: { hp: stats.maxHp, mp: stats.maxMp } };
  });
  return { ...state, roster };
}
