// Status application chance formula — BMG "Status application chance":
//
//   hit_chance = base_chance × Faith_factor × MA_factor
//              × (1 - target_resistance / 100) × ∏modifiers
//
// where:
//   - base_chance is per-ability, expressed [0, 100] in StatusEffectSpec
//     and normalized to [0, 1] here.
//   - Faith_factor = (Faith_caster / 100) × (Faith_target / 100). Same
//     symmetric Faith as damage and healing.
//   - MA_factor = 0.9 + MA_caster / 10. The BMG-specified shape:
//       MA  1 → factor ~1.0
//       MA 10 → factor 1.9
//       MA 20 → factor 2.9
//   - target_resistance is the signed-max composition across the
//     status's resistance tags (today the type's `resistanceTag` field
//     when set; empty set when unset → resistance 0).
//   - ∏modifiers is the multiplicative product of any
//     `modifyStatusApplicationChance` hook returns (Earth Communion
//     × 1.25, etc.).
//
// The result is clamped to [0, 1] and rolled against the action seed's
// status-chance sub-stream. Returns `{ chance, applied, roll }` so
// callers can record both the chance and the roll on the outcome (lets
// authors and tests reason about why a roll missed).

import type { Catalog, StatusEffectType } from '../catalog/index.ts';
import { runModifyStatQuery, runModifyStatusApplicationChance } from '../hooks/runners.ts';
import type { ActiveAbilityDefinition, GameState, Unit } from '../types/index.ts';
import { computeFaithFactor } from '../damage/handlers.ts';

// Sub-stream constant for the status-chance roll. Distinct from
// variance (0), evasion (1), and the brave reaction roll (2). Keeps
// each random subsystem on its own stream so a change in one doesn't
// shift the others.
const STATUS_CHANCE_SUB_STREAM = 3;

export interface StatusChanceArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly caster: Unit;
  readonly target: Unit;
  readonly statusType: StatusEffectType;
  // null when the application is not driven by an ability (e.g., a
  // status applied by an environmental effect or a system action). The
  // hook still fires; the `ability` arg lets handlers gate on tags,
  // but the absence is honest.
  readonly ability: ActiveAbilityDefinition | null;
  readonly baseChance: number; // [0, 100]
  readonly seed: number;
  // When an ability declares multiple status effects, each effect
  // rolls independently. The caller passes its 0-indexed position;
  // the roll mixes the index into the seed so Earth Curse (Blind +
  // Silence, two effects) doesn't end up with both effects tied to
  // the same coin flip. Defaults to 0 for the single-effect case.
  readonly effectIndex?: number;
}

export interface StatusChanceResult {
  readonly chance: number; // post-modifier, clamped [0, 1]
  readonly roll: number;   // unit float drawn from the seed
  readonly applied: boolean;
}

export function rollStatusChance(args: StatusChanceArgs): StatusChanceResult {
  const baseFraction = Math.max(0, args.baseChance / 100);
  const faithFactor = computeFaithFactor({
    state: args.state,
    catalog: args.catalog,
    attacker: args.caster,
    target: args.target,
  });
  const ma = runModifyStatQuery(args.state, args.catalog, {
    unit: args.caster,
    statName: 'ma',
    baseValue: args.caster.baseStats.ma,
  });
  const maFactor = 0.9 + ma / 10;
  const resistance = lookupStatusResistance(args.statusType, args.target);
  const resistanceFactor = (100 - Math.min(100, resistance)) / 100;

  const preModifier = baseFraction * faithFactor * maFactor * resistanceFactor;

  // Modifier hooks (Earth Communion × 1.25, etc.) compose
  // multiplicatively against the caster's hooks.
  const postModifier = runModifyStatusApplicationChance(args.state, args.catalog, {
    caster: args.caster,
    target: args.target,
    statusType: args.statusType,
    ability: args.ability,
    baseChance: preModifier,
  });

  const chance = Math.max(0, Math.min(1, postModifier));
  const subIndex = STATUS_CHANCE_SUB_STREAM + (args.effectIndex ?? 0);
  const roll = unitFloatFromSeed(args.seed, subIndex);
  return { chance, roll, applied: roll < chance };
}

// Look up the target's resistance against the status type's primary
// resistance tag (the type's declared `resistanceTag`). Missing tag
// means resistance 0 — the status can't be resisted. Multi-tag
// status resistance is future work; this single-tag shape keeps v1
// scope tight.
function lookupStatusResistance(type: StatusEffectType, target: Unit): number {
  if (type.resistanceTag === undefined) return 0;
  const value = target.resistances.get(type.resistanceTag);
  return value ?? 0;
}

// mulberry32-style mixer matching engine/damage/handlers.ts. Returns a
// unit float in [0, 1).
function unitFloatFromSeed(seed: number, subIndex: number): number {
  let s = (seed ^ subIndex) >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
