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
  BattleConfig,
  Catalog,
  TeamId,
  UnitId,
  UnitPlacement,
  Vitals,
} from '@engine/index.ts';
import type { CampaignUnit } from './types.ts';
import {
  usableActiveIds,
  usableItemIds,
  usableMathParameterIds,
  usableMathValueIds,
} from './progression/index.ts';

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
  const slots = playerSlots(template, playerTeam);
  if (selected.length > slots.length) {
    throw new Error(
      `foldCampaignRoster: ${selected.length} units selected but template team ` +
        `${JSON.stringify(playerTeam)} authors only ${slots.length} slot(s)`,
    );
  }

  // Probe the effective (equipment/class/passive-composed) max for each
  // selected unit, then supply carried vitals EXPLICITLY (D-E), clamped to
  // that max. M0 heals to full so the clamp is a no-op today; the explicit
  // supply exercises the carry path either way.
  const maxes = probeEffectiveMaxes(template, selected, playerTeam, catalog);
  const others = template.units.filter((u) => u.team !== playerTeam);
  const placements = selected.map((unit, i) => {
    const max = maxes.get(unit.id)!;
    const vitals: Vitals = {
      hp: Math.min(unit.vitals.hp, max.hp),
      mp: Math.min(unit.vitals.mp, max.mp),
    };
    return campaignPlacement(unit, slots[i]!, playerTeam, vitals, catalog);
  });
  return { ...template, units: [...placements, ...others] };
}

// Effective max vitals (HP/MP, equipment-composed) for each unit, keyed by
// stable id. Built by running probe placements (vitals OMITTED, so
// `createInitialState` fills each unit to its effective max — the same
// throwaway-state trick `computeAiDeploymentResult` uses) through the
// unchanged engine. Chunked by the template's player-slot count so each
// probe unit gets a distinct placeholder tile — lets the campaign-start
// bootstrap probe a full roster larger than one node's slot count.
//
// Reused by the fold (clamp carried vitals) and the campaign-start
// bootstrap (heal the roster to effective full). Throws if the template
// authors no player slots.
export function probeEffectiveMaxes(
  template: BattleConfig,
  units: ReadonlyArray<CampaignUnit>,
  playerTeam: TeamId,
  catalog: Catalog,
): Map<UnitId, Vitals> {
  const slots = playerSlots(template, playerTeam);
  if (slots.length === 0) {
    throw new Error(
      `probeEffectiveMaxes: template team ${JSON.stringify(playerTeam)} authors no slots`,
    );
  }
  const others = template.units.filter((u) => u.team !== playerTeam);
  const maxes = new Map<UnitId, Vitals>();
  for (let start = 0; start < units.length; start += slots.length) {
    const chunk = units.slice(start, start + slots.length);
    const probes = chunk.map((unit, i) => campaignPlacement(unit, slots[i]!, playerTeam, undefined, catalog));
    const state = createInitialState({ ...template, units: [...probes, ...others] }, catalog);
    for (const unit of chunk) {
      const live = state.units.get(unit.id);
      if (live === undefined) {
        throw new Error(`probeEffectiveMaxes: probe state missing unit ${JSON.stringify(unit.id)}`);
      }
      maxes.set(unit.id, { hp: live.vitals.hp, mp: live.vitals.mp });
    }
  }
  return maxes;
}

function playerSlots(template: BattleConfig, playerTeam: TeamId): ReadonlyArray<UnitPlacement> {
  return template.units.filter((u) => u.team === playerTeam);
}

// How many levels above the current one to precompute for mid-battle level-up
// (TABA M2, ADR-0139). The engine can't run the stat curve, so the fold hands
// it the next few levels' `BaseStats`; a unit gaining more than this in ONE
// battle stops leveling and carries the surplus XP to the boundary. A unit
// earns ~0–1 levels/battle, so 3 is ample headroom. PARAMETERIZED so it can be
// dialed up cheaply if a use appears (e.g. an in-battle level-manipulation
// effect). Precompute cost is a few `buildBaseStats` calls per deployed unit.
export const LEVELUP_PRECOMPUTE_DEPTH = 3;

// Build one `UnitPlacement` from a durable unit. Injects the unit's OWN
// stable id (D-B, not the slot id) and RECOMPUTES baseStats from inputs
// (D-A). `vitals === undefined` produces a probe placement (engine
// auto-fills to effective max); a supplied `vitals` is the real,
// carry-exercising placement.
function campaignPlacement(
  unit: CampaignUnit,
  slot: UnitPlacement,
  team: TeamId,
  vitals: Vitals | undefined,
  catalog: Catalog,
): UnitPlacement {
  const base = {
    id: unit.id, // stable campaign id (D-B), NOT slot.id
    name: unit.name,
    team,
    classId: unit.classId,
    position: slot.position, // placeholder; deployment overwrites
    facing: slot.facing,
    baseStats: buildBaseStats(unit.classId, unit.brave, unit.faith, unit.level), // recomputed (D-A)
    loadout: unit.loadout,
    equipment: unit.equipment,
    level: unit.level,
    // TABA M2 mid-battle XP: carry the XP remainder + precompute the next few
    // levels' stats (the engine can't run the curve). Consecutive from
    // level+1; presence opts the unit into leveling.
    xp: unit.xp,
    statsByLevel: Array.from({ length: LEVELUP_PRECOMPUTE_DEPTH }, (_, i) =>
      buildBaseStats(unit.classId, unit.brave, unit.faith, unit.level + 1 + i),
    ),
    // TABA M2 gating LIVE: project the durable `unlocks` into the battle-facing
    // usable-ability allowlists. A locked component is now genuinely unusable in
    // battle (menu greyed / picker filtered). Authored units are seeded from
    // their loadout at campaign start so their kit is usable (see
    // `seedRosterStartingKits`). Mage War never folds through here, so it stays
    // ungated (its `Unit.usable*` remain undefined ⇒ all usable).
    usableActives: usableActiveIds(unit, catalog),
    usableItems: usableItemIds(unit),
    usableMathParameters: usableMathParameterIds(unit),
    usableMathValues: usableMathValueIds(unit),
  } satisfies UnitPlacement;

  // exactOptionalPropertyTypes: attach optional fields only when present.
  const withVitals: UnitPlacement = vitals !== undefined ? { ...base, vitals } : base;
  return unit.gender !== undefined ? { ...withVitals, gender: unit.gender } : withVitals;
}
