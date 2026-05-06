// Test-only catalog fixtures, including a minimal-but-complete test
// ruleset. Does not match Vitest's pattern so it's not collected as a
// test file. Used by per-subsystem test-fixtures.ts files that need a
// catalog with a ruleset matching `state.ruleset.id`.
//
// The test ruleset duplicates the shape (not the tuning) of the v1
// default ruleset in `src/content/rulesets/default.ts`. Engine tests
// stay isolated from content tuning by building their own ruleset
// rather than importing the content one. Test assertions then read
// only from values they themselves set.

import {
  BUCKET_FIRST_ACTION,
  BUCKET_MOVEMENT,
  BUCKET_REACTION,
  BUCKET_SECOND_ACTION,
  BUCKET_SUPPORT,
} from '../abilities/constants.ts';
import {
  DEFAULT_HOOK_SOURCE_TIER_ORDER,
  rulesetId,
  type BucketId,
  type DamageHandlerRef,
  type DamageStage,
  type RulesetDefinition,
  type RulesetId,
} from '../types/index.ts';

const TEST_BUCKET_CAPACITIES: ReadonlyMap<BucketId, number> = new Map([
  [BUCKET_FIRST_ACTION, 1],
  [BUCKET_SECOND_ACTION, 1],
  [BUCKET_REACTION, 3],
  [BUCKET_SUPPORT, 3],
  [BUCKET_MOVEMENT, 3],
]);

const EMPTY_DAMAGE_PIPELINE: Readonly<Record<DamageStage, ReadonlyArray<DamageHandlerRef>>> = {
  base: [],
  attacker: [],
  target: [],
  environment: [],
  variance: [],
  cap: [],
  finalize: [],
};

// V1 default-equivalent stage list, exported for damage-flow tests
// that want to exercise the real pipeline without importing content.
// Mirrors `src/content/rulesets/default.ts`'s DEFAULT_DAMAGE_PIPELINE.
//
// Session 14 added magical_ma_power (base), evasion_check + resistance_check
// (target). Target order matters: evasion_check first per ADR-0019,
// then resistance_check, then onDamageReceived hooks.
export const DEFAULT_TEST_DAMAGE_PIPELINE: Readonly<
  Record<DamageStage, ReadonlyArray<DamageHandlerRef>>
> = {
  base: ['physical_pa_wp', 'magical_ma_power', 'healing_base'],
  attacker: ['fire_on_damage_dealt'],
  target: ['evasion_check', 'resistance_check', 'fire_on_damage_received'],
  environment: [],
  variance: ['variance_roll'],
  cap: ['clamp_min_max'],
  finalize: ['finalize'],
};

export function makeTestRuleset(overrides?: {
  readonly id?: RulesetId;
  readonly friendlyPassThrough?: boolean;
  readonly friendlyFire?: boolean;
  readonly speedFloor?: number;
  readonly moveAndActCost?: number;
  readonly bucketCapacities?: ReadonlyMap<BucketId, number>;
  readonly damagePipelineStages?: Readonly<
    Record<DamageStage, ReadonlyArray<DamageHandlerRef>>
  >;
  readonly perUnitPerTurnReactions?: number;
}): RulesetDefinition {
  return {
    id: overrides?.id ?? rulesetId('default'),
    name: 'Test Ruleset',
    ctCosts: {
      moveOnly: 50,
      actOnly: 70,
      moveAndAct: overrides?.moveAndActCost ?? 100,
      wait: 20,
      defend: 20,
    },
    speedBounds: {
      floor: overrides?.speedFloor ?? 0,
      ceiling: null,
    },
    defaultTurnBudget: { movesAvailable: 1, actsAvailable: 1 },
    rangeDefaults: {
      meleeHorizontal: 1,
      meleeVertical: 3,
      minHorizontal: 0,
      aoeVerticalTolerance: 1,
    },
    pathfinding: {
      defaultStepCost: 1,
      defaultTerrainCosts: new Map(),
    },
    behaviors: {
      friendlyFire: overrides?.friendlyFire ?? true,
      friendlyPassThrough: overrides?.friendlyPassThrough ?? true,
      unitsBlockLineOfSight: false,
    },
    chainTermination: {
      perUnitPerTurnReactions: overrides?.perUnitPerTurnReactions ?? 1,
      chainDepthCap: 8,
    },
    hookOrdering: {
      sourceTiers: DEFAULT_HOOK_SOURCE_TIER_ORDER,
    },
    damagePipeline: { stages: overrides?.damagePipelineStages ?? EMPTY_DAMAGE_PIPELINE },
    initialCT: { kind: 'fixed', value: 0 },
    bucketCapacities: overrides?.bucketCapacities ?? TEST_BUCKET_CAPACITIES,
  };
}

// Convenience: a single-element rulesets array for tests that don't
// need more than the default. The id is `rulesetId('default')` so it
// matches the default state built by `makeGameState`.
export const defaultTestRulesets: ReadonlyArray<RulesetDefinition> = [makeTestRuleset()];
