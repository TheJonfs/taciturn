// TABA Ch1 substrate (WI4) — the plot-unit join: a named character enters
// the durable roster mid-campaign (Sera after the Ordal Canyon battle).
//
// The runtime sibling of the authoring-time seed (plot units to date are
// members of the INITIAL roster — roster.ts): same durable-unit shape,
// but appended at a story beat. Parallels `hireGeneric`'s append minus
// the commerce: no gil debit, no starter-gear purchase — the unit
// arrives with its authored gear, which is GRANDFATHERED into the party
// inventory (owned counts rise to cover it, so unequipping it later
// returns it to the pool instead of vanishing — the join caller
// `bootstrapInventory` anticipated).
//
// Guest ≠ join: fighting alongside the party as a guest (the battle-long
// AI-driven ally) and joining the roster are separate mechanisms. The
// driver calls this explicitly at the authored beat; the guest system
// knows nothing about it.

import type { Catalog } from '@engine/index.ts';
import type { CampaignNode } from './graph.ts';
import type { CampaignState, CampaignUnit } from './types.ts';
import { bootstrapInventory } from './inventory.ts';
import { probeBattleFor } from './probe-battle.ts';
import { probeEffectiveMaxes } from './snapshot-fold.ts';

// Append `unit` to the roster at effective-full vitals (probed against
// `node`'s battlefield, or the canonical probe field for a battle-less
// node). Throws on a duplicate id — joining twice is an authoring bug.
export function joinPlotUnit(
  state: CampaignState,
  node: CampaignNode,
  unit: CampaignUnit,
  catalog: Catalog,
): CampaignState {
  if (state.roster.some((u) => u.id === unit.id)) {
    throw new Error(`joinPlotUnit: unit ${JSON.stringify(String(unit.id))} is already on the roster`);
  }

  const probe = probeBattleFor(node);
  const maxes = probeEffectiveMaxes(probe.template, [unit], probe.playerTeam, catalog);
  const healed: CampaignUnit = { ...unit, vitals: maxes.get(unit.id)!, fate: 'active' };
  const roster = [...state.roster, healed];

  return {
    ...state,
    roster,
    // The arrival's gear becomes party-owned (receipt via grandfather).
    inventory: bootstrapInventory(state.inventory, roster),
  };
}
