// The v1 default ruleset. Carries every baseline parameter the engine
// reads through the ruleset surface. Alternate rulesets (a hardcore mode,
// a tournament mode, etc.) ship as separate files specifying overrides
// once the partial-override authoring shape lands.
//
// Comments here cite the design doc that fixes each field's value. When
// a value changes, the design doc is the source of truth.

import {
  BUCKET_FIRST_ACTION,
  BUCKET_MOVEMENT,
  BUCKET_REACTION,
  BUCKET_SECOND_ACTION,
  BUCKET_SUPPORT,
  DEFAULT_HOOK_SOURCE_TIER_ORDER,
  rulesetId,
  type BucketId,
  type DamageHandlerRef,
  type DamageStage,
  type RulesetDefinition,
} from '@engine/index.ts';

// v1 baseline capacities — the 1/1/3/3/3 from session 5's
// `BASELINE_BUCKET_CAPACITIES`. Sourced here so an alternate ruleset can
// override (e.g., hardcore mode might give 4-capacity Movement).
const DEFAULT_BUCKET_CAPACITIES: ReadonlyMap<BucketId, number> = new Map([
  [BUCKET_FIRST_ACTION, 1],
  [BUCKET_SECOND_ACTION, 1],
  [BUCKET_REACTION, 3],
  [BUCKET_SUPPORT, 3],
  [BUCKET_MOVEMENT, 3],
]);

// Stage list with empty handler arrays. Session 8 fills these in with the
// FFT-flavored damage formulas per docs/design/action-resolution.md.
const EMPTY_DAMAGE_PIPELINE: Readonly<Record<DamageStage, ReadonlyArray<DamageHandlerRef>>> = {
  base: [],
  attacker: [],
  target: [],
  environment: [],
  variance: [],
  cap: [],
  finalize: [],
};

export const defaultRuleset: RulesetDefinition = {
  id: rulesetId('default'),
  name: 'Default',

  // CT costs from docs/design/ct-system.md ("Parameterizable elements").
  // moveOnly / actOnly / wait / defend are tuning placeholders within
  // the design's documented bands; the precise values stabilize as
  // gameplay testing accumulates.
  ctCosts: {
    moveOnly: 50,
    actOnly: 70,
    moveAndAct: 100,
    wait: 20,
    defend: 20,
  },

  // Speed floor at 0 (Stop). Ceiling unset for v1 — flagged in the
  // design doc as a tuning question.
  speedBounds: {
    floor: 0,
    ceiling: null,
  },

  // FFT default budget: one Move and one Act per turn.
  defaultTurnBudget: {
    movesAvailable: 1,
    actsAvailable: 1,
  },

  // Range defaults from docs/design/map-and-battlefield.md
  // ("v1 starting parameters").
  rangeDefaults: {
    meleeHorizontal: 1,
    meleeVertical: 3,
    minHorizontal: 0,
    aoeVerticalTolerance: 1,
  },

  // Pathfinding global defaults. Per-class movement baselines override
  // per-terrain; the ruleset's defaults are the unannotated fallbacks.
  pathfinding: {
    defaultStepCost: 1,
    defaultTerrainCosts: new Map(),
  },

  // FFT defaults. Friendly pass-through on, friendly fire on (AoE
  // doesn't discriminate), units don't block straight-line LoS.
  behaviors: {
    friendlyFire: true,
    friendlyPassThrough: true,
    unitsBlockLineOfSight: false,
  },

  // Chain caps from action-resolution.md ("Chain termination").
  chainTermination: {
    perUnitPerTurnReactions: 1,
    chainDepthCap: 8,
  },

  // Hook ordering: Equipment → Class → Passive → Status. Same as the
  // DEFAULT_HOOK_SOURCE_TIER_ORDER constant — the ruleset is the
  // authoritative source; the constant is the v1 default for it.
  hookOrdering: {
    sourceTiers: DEFAULT_HOOK_SOURCE_TIER_ORDER,
  },

  damagePipeline: {
    stages: EMPTY_DAMAGE_PIPELINE,
  },

  // v1 simplest plausible formula: every unit starts at CT 0. The
  // design doc's speed-based + variance formula lands as another
  // discriminant when its tuning settles.
  initialCT: { kind: 'fixed', value: 0 },

  bucketCapacities: DEFAULT_BUCKET_CAPACITIES,
};
