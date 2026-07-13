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
import { createInitialState, runModifyStatQuery } from '@engine/index.ts';
import type {
  BattleConfig,
  Catalog,
  StatName,
  TeamId,
  UnitId,
  UnitPlacement,
  Vitals,
} from '@engine/index.ts';
import type { CampaignUnit } from './types.ts';
import type { NodeBattle } from './sequence.ts';
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
  // "Others" = everyone the fold leaves as-authored: the enemy team AND
  // guest allies (Ch1 substrate WI4 — player-team placements flagged
  // `guest` are fixed authored units, never deploy slots).
  const others = template.units.filter((u) => u.team !== playerTeam || u.guest === true);
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

// Fold a whole battle beat into a launch-ready config: the deployed player
// selection into the player slots, and — if the beat authors progressed enemies
// — those specs onto the enemy team (`foldEnemyTeam`). The single entry point
// the driver calls; keeps the player+enemy fold composition pure and testable
// rather than inline in the React handler.
export function foldBattle(
  battle: NodeBattle,
  selected: ReadonlyArray<CampaignUnit>,
  catalog: Catalog,
): BattleConfig {
  const withPlayers = foldCampaignRoster(battle.template, selected, battle.playerTeam, catalog);
  const withGuests =
    battle.guests === undefined
      ? withPlayers
      : foldGuestTeam(withPlayers, battle.guests, battle.playerTeam, catalog);
  if (battle.enemies === undefined) return withGuests;
  const enemyTeam = battle.template.units.find((u) => u.team !== battle.playerTeam)?.team;
  if (enemyTeam === undefined) {
    throw new Error('foldBattle: beat authors enemies but the template has no non-player team');
  }
  return foldEnemyTeam(withGuests, battle.enemies, enemyTeam, catalog);
}

// Fold authored ENEMY progression specs onto a battle config's enemy slots
// (TABA M2). The team-agnostic sibling of the player fold: it re-skins the
// `enemyTeam` placements with `campaignPlacement`, so each authored enemy gets
// curve-correct `baseStats` at its level, `statsByLevel` (it can LEVEL
// mid-battle — the XP mechanism is team-agnostic), and the `usable*` masks (its
// kit is GATED to its authored `unlocks`). Positions/facing come from the
// template's enemy slots (enemies don't deploy); the spec supplies who stands
// there. Vitals are omitted so the engine fills each enemy to effective full.
//
// `enemies` must not exceed the enemy-slot count; it re-skins the first N slots
// and leaves any extra authored slots untouched (raw/ungated) — so a battle can
// mix progressed and plain enemies. Called AFTER the player fold, on its output.
export function foldEnemyTeam(
  config: BattleConfig,
  enemies: ReadonlyArray<CampaignUnit>,
  enemyTeam: TeamId,
  catalog: Catalog,
): BattleConfig {
  const slots = config.units.filter((u) => u.team === enemyTeam);
  if (enemies.length > slots.length) {
    throw new Error(
      `foldEnemyTeam: ${enemies.length} enemy specs but team ` +
        `${JSON.stringify(enemyTeam)} authors only ${slots.length} slot(s)`,
    );
  }
  const others = config.units.filter((u) => u.team !== enemyTeam);
  const folded = enemies.map((enemy, i) => campaignPlacement(enemy, slots[i]!, enemyTeam, undefined, catalog));
  const keptSlots = slots.slice(enemies.length); // extra authored enemies, unchanged
  return { ...config, units: [...others, ...folded, ...keptSlots] };
}

// Fold authored GUEST specs onto a config's guest slots (Ch1 substrate
// WI4) — the guest sibling of `foldEnemyTeam`: the template authors
// player-team placements flagged `guest` (position/facing + a stand-in
// statline), and the beat's `guests` re-skin the first N of them with
// real durable units (curve stats, leveling table, gated kit — Sera as a
// guest is Sera the plot unit). Vitals are omitted so each guest enters
// at effective full. Called after the player fold, on its output.
export function foldGuestTeam(
  config: BattleConfig,
  guests: ReadonlyArray<CampaignUnit>,
  playerTeam: TeamId,
  catalog: Catalog,
): BattleConfig {
  const slots = config.units.filter((u) => u.team === playerTeam && u.guest === true);
  if (guests.length > slots.length) {
    throw new Error(
      `foldGuestTeam: ${guests.length} guest specs but the template authors only ` +
        `${slots.length} guest slot(s) on team ${JSON.stringify(playerTeam)}`,
    );
  }
  const others = config.units.filter((u) => !(u.team === playerTeam && u.guest === true));
  const folded = guests.map((guest, i) => campaignPlacement(guest, slots[i]!, playerTeam, undefined, catalog));
  const keptSlots = slots.slice(guests.length); // extra authored guests, unchanged
  return { ...config, units: [...others, ...folded, ...keptSlots] };
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
  // Guest placements are NOT slots (WI4): they are fixed authored units
  // on the player's team; the deployed selection never replaces them and
  // they never count against the deploy cap.
  return template.units.filter((u) => u.team === playerTeam && u.guest !== true);
}

// The full effective stat block the Formation UI displays (M3 Stage 3):
// equipment/passive/class-composed, exactly what battle entry produces.
export interface EffectiveUnitStats {
  readonly maxHp: number;
  readonly maxMp: number;
  readonly pa: number;
  readonly ma: number;
  readonly spd: number;
  readonly moveRange: number;
  readonly jump: number;
}

// Probe ONE unit's effective stats through the real fold + engine — the
// campaign twin of the Team Builder's `computeDraftUnitStats`. Folds the
// unit onto the template's first player slot via `campaignPlacement`
// (the SAME path battle entry takes, so the numbers can't drift from
// what a deploy produces), builds the throwaway state, and reads every
// stat through `runModifyStatQuery`. Returns null when the unit's
// current loadout is invalid — `createInitialState` throws on it, and
// mid-edit a loadout is legitimately allowed to be invalid (the UI
// shows "—" + the cause banner instead of numbers that would be lies).
export function probeUnitStats(
  template: BattleConfig,
  unit: CampaignUnit,
  playerTeam: TeamId,
  catalog: Catalog,
): EffectiveUnitStats | null {
  const slot = playerSlots(template, playerTeam)[0];
  if (slot === undefined) {
    throw new Error(
      `probeUnitStats: template team ${JSON.stringify(playerTeam)} authors no slots`,
    );
  }
  const others = template.units.filter((u) => u.team !== playerTeam);
  const probe = campaignPlacement(unit, slot, playerTeam, undefined, catalog);

  let state;
  try {
    state = createInitialState({ ...template, units: [probe, ...others] }, catalog);
  } catch {
    // Invalid loadout (over-capacity / illegal gear, mid-edit). The
    // Loadout view surfaces the cause; stats read as unavailable.
    return null;
  }

  const live = state.units.get(unit.id);
  if (live === undefined) {
    throw new Error(`probeUnitStats: probe state missing unit ${JSON.stringify(unit.id)}`);
  }
  const movement = catalog.getClass(unit.classId).movement;
  const query = (statName: StatName, baseValue: number): number =>
    runModifyStatQuery(state, catalog, { unit: live, statName, baseValue });
  return {
    // `createInitialState` filled vitals from the composed maxes (the
    // probe placement omits explicit vitals).
    maxHp: live.vitals.hp,
    maxMp: live.vitals.mp,
    pa: query('pa', live.baseStats.pa),
    ma: query('ma', live.baseStats.ma),
    spd: query('spd', live.baseStats.spd),
    moveRange: query('moveRange', movement.moveRange),
    jump: query('jump', movement.jump),
  };
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
  const withGender: UnitPlacement =
    unit.gender !== undefined ? { ...withVitals, gender: unit.gender } : withVitals;
  // A guest SLOT re-skinned with a durable unit stays a guest (WI4).
  const withGuest: UnitPlacement =
    slot.guest === true ? { ...withGender, guest: true } : withGender;
  // A death-protected SLOT re-skinned with a durable unit stays protected
  // (WI1 — Ch1 authoring: the boss placement authors the flag; the fold
  // must not strip it when an authored enemy spec supplies who stands there).
  const withProtection: UnitPlacement =
    slot.deathProtected === true ? { ...withGuest, deathProtected: true } : withGuest;
  // TABA (ADR-0136 completion): carry the enduring portrait override into battle.
  return unit.portrait !== undefined ? { ...withProtection, portrait: unit.portrait } : withProtection;
}
