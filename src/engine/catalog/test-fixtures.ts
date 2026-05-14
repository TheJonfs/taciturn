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
  BUCKET_SECONDARY_COMMAND_SETS,
  BUCKET_SUPPORT,
} from '../abilities/constants.ts';
import {
  DEFAULT_HOOK_SOURCE_TIER_ORDER,
  rulesetId,
  statusTypeId,
  type BucketId,
  type DamageHandlerRef,
  type DamageStage,
  type RulesetDefinition,
  type RulesetId,
  type StatusTypeId,
} from '../types/index.ts';

const TEST_BUCKET_CAPACITIES: ReadonlyMap<BucketId, number> = new Map([
  [BUCKET_FIRST_ACTION, 1],
  [BUCKET_SECONDARY_COMMAND_SETS, 1],
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
  postFinalize: [],
};

// V1 default-equivalent stage list, exported for damage-flow tests
// that want to exercise the real pipeline without importing content.
// Mirrors `src/content/rulesets/default.ts`'s DEFAULT_DAMAGE_PIPELINE.
//
// Session 14 added magical_ma_power (base), evasion_check + resistance_check
// (target). Target order matters: evasion_check first per ADR-0019,
// then resistance_check, then onDamageReceived hooks. Session 20 adds
// crit_roll at the variance stage (per ADR-0032). Pre-session-20
// fixtures with crit_chance 0 are unaffected — the handler short-
// circuits.
//
// Session 32: `postFinalize` stage added to mirror production. Pre-32 the
// test fixture was missing this stage entirely — divergence that let
// bug 4 (proc-on-miss) slip through the test surface (see ADR-0069
// + S31.5 handoff). A structural-equivalence test now enforces
// shape parity with `DEFAULT_DAMAGE_PIPELINE`.
export const DEFAULT_TEST_DAMAGE_PIPELINE: Readonly<
  Record<DamageStage, ReadonlyArray<DamageHandlerRef>>
> = {
  base: ['physical_pa_wp', 'magical_ma_power', 'healing_base'],
  // Session 31.5 / ADR-0069: `fire_on_damage_dealt` moved to the target
  // stage so the contributor sees the post-evasion `ctx.hit`. Mirrors
  // the production ruleset (`src/content/rulesets/default.ts`).
  attacker: [],
  target: ['evasion_check', 'fire_on_damage_dealt', 'resistance_check', 'fire_on_damage_received'],
  environment: [],
  variance: ['variance_roll', 'crit_roll'],
  cap: ['clamp_min_max'],
  finalize: ['finalize'],
  postFinalize: ['fire_on_final_damage'],
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
  readonly chargingStatusTypeId?: StatusTypeId;
  readonly pausingStatusTypeIds?: ReadonlyArray<StatusTypeId>;
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
      // Session 33 (ADR-0073): mirror production water costs so tests
      // that compose movement profiles against water terrains see the
      // documented defaults. Benign for tests that don't touch water.
      defaultTerrainCosts: new Map<string, number>([
        ['water_shallow', 2],
        ['water_deep', 3],
      ]),
    },
    terrain: {
      // Session 33 (ADR-0073): water-tag registration mirrors
      // production. Empty registry would make Tidewalker / Float
      // no-op in tests that exercise them.
      tags: new Map<string, ReadonlySet<string>>([
        ['ground', new Set(['land'])],
        ['water_shallow', new Set(['water', 'shallow'])],
        ['water_deep', new Set(['water', 'deep'])],
      ]),
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
    chargedActions: {
      chargingStatusTypeId: overrides?.chargingStatusTypeId ?? statusTypeId('charging'),
      pausingStatusTypeIds: overrides?.pausingStatusTypeIds ?? [statusTypeId('stop')],
    },
  };
}

// Convenience: a single-element rulesets array for tests that don't
// need more than the default. The id is `rulesetId('default')` so it
// matches the default state built by `makeGameState`.
export const defaultTestRulesets: ReadonlyArray<RulesetDefinition> = [makeTestRuleset()];
