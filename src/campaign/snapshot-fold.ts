// TABA campaign — the snapshot-fold (campaign roster → battle config).
//
// The third sibling to `buildTeamBattleConfig` / `buildDeployedBattleConfig`
// (taba-m0-findings §B). It folds the deployed roster selection (K of N
// durable `CampaignUnit`s) into a node's `BattleConfig` template, producing
// an ordinary `BattleConfig` that `createInitialState` consumes unchanged.
//
// What it injects, and why it differs from the Mage War fold:
//   - The unit's OWN stable id (D-B) — NOT the template slot's id. This is
//     the load-bearing identity change: "the same unit across battles."
//   - RECOMPUTED `baseStats` via `buildBaseStats(...)` (D-A) — the durable
//     unit stores inputs, never the derived stats.
//   - Carried `vitals` supplied EXPLICITLY (D-E), clamped to the recomputed
//     effective max (equipment/level may differ between nodes). M0 heals to
//     full so the clamp is a no-op today, but the carry path is exercised so
//     attrition-carry later is a one-line apply-back change, not new plumbing.
//
// The player slots in the template supply only placeholder position/facing
// (overwritten by the deployment phase downstream). Enemy/other-team
// placements are left untouched — the durable machinery is player-side only.

import { buildBaseStats } from '@content/teams/index.ts';
import { createInitialState } from '@engine/index.ts';
import type {
  BaseStats,
  BattleConfig,
  Catalog,
  TeamId,
  UnitPlacement,
  Vitals,
} from '@engine/index.ts';
import type { CampaignUnit } from './types.ts';

// Fold a deployed roster selection into a node template. `selected` is the
// K units chosen for THIS node (Formation output); they map by index onto
// the template's authored player slots for `playerTeam` (placeholder
// positions). Throws if more units are selected than the template authors
// slots for — loud, like the sibling folds.
export function foldCampaignRoster(
  template: BattleConfig,
  selected: ReadonlyArray<CampaignUnit>,
  playerTeam: TeamId,
  catalog: Catalog,
): BattleConfig {
  const slots = template.units.filter((u) => u.team === playerTeam);
  if (selected.length > slots.length) {
    throw new Error(
      `foldCampaignRoster: ${selected.length} units selected but template team ` +
        `${JSON.stringify(playerTeam)} authors only ${slots.length} slot(s)`,
    );
  }

  // baseStats recomputed once per unit (D-A) — reused across both passes.
  const recomputed = selected.map((unit) => ({
    unit,
    baseStats: buildBaseStats(unit.classId, unit.brave, unit.faith, unit.level),
  }));

  const others = template.units.filter((u) => u.team !== playerTeam);

  // Pass 1 — probe. Build placements with vitals OMITTED so
  // `createInitialState` fills each unit's effective max (equipment/class/
  // passive-composed). We read those maxes back to clamp carried vitals.
  // This is the same throwaway-state trick `computeAiDeploymentResult` uses.
  const probePlacements = recomputed.map(({ unit, baseStats }, i) =>
    placementFor(unit, baseStats, slots[i]!, playerTeam, undefined),
  );
  const probeState = createInitialState({ ...template, units: [...probePlacements, ...others] }, catalog);

  // Pass 2 — final. Supply carried vitals EXPLICITLY (D-E), clamped to the
  // probed effective max.
  const finalPlacements = recomputed.map(({ unit, baseStats }, i) => {
    const max = probeState.units.get(unit.id);
    if (max === undefined) {
      // Shouldn't happen — we keyed the probe by these exact ids. Fail loud.
      throw new Error(
        `foldCampaignRoster: probe state missing unit ${JSON.stringify(unit.id)}`,
      );
    }
    const vitals: Vitals = {
      hp: Math.min(unit.vitals.hp, max.vitals.hp),
      mp: Math.min(unit.vitals.mp, max.vitals.mp),
    };
    return placementFor(unit, baseStats, slots[i]!, playerTeam, vitals);
  });

  return { ...template, units: [...finalPlacements, ...others] };
}

// Build one `UnitPlacement` from a durable unit. `vitals === undefined`
// produces the probe placement (engine auto-fills to effective max); a
// supplied `vitals` is the real, carry-exercising placement.
function placementFor(
  unit: CampaignUnit,
  baseStats: BaseStats,
  slot: UnitPlacement,
  team: TeamId,
  vitals: Vitals | undefined,
): UnitPlacement {
  const base = {
    id: unit.id, // stable campaign id (D-B), NOT slot.id
    name: unit.name,
    team,
    classId: unit.classId,
    position: slot.position, // placeholder; deployment overwrites
    facing: slot.facing,
    baseStats,
    loadout: unit.loadout,
    equipment: unit.equipment,
    level: unit.level,
  } satisfies UnitPlacement;

  // exactOptionalPropertyTypes: attach optional fields only when present.
  const withVitals: UnitPlacement = vitals !== undefined ? { ...base, vitals } : base;
  return unit.gender !== undefined ? { ...withVitals, gender: unit.gender } : withVitals;
}
