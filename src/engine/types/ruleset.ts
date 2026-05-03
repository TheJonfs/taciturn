// RulesetDefinition — the bundle of configurable engine parameters.
// See docs/architecture/architecture-overview.md ("Rulesets and content")
// and ADR-0008.
//
// The ruleset captures "the rules of the game" as data, separate from
// per-battle content (BattleConfig) and per-kind content (Catalog).
// Engine functions resolve the active ruleset by looking up
// `state.ruleset.id` in the catalog (per ADR-0004).
//
// v1 ships a single fully-specified `default` ruleset. Authoring shapes
// for partial overrides (per the architecture doc's "Partial overrides")
// land when a second ruleset is introduced; today every field is
// required so the resolved type matches what the engine actually reads.
//
// Damage-pipeline handler refs and the initial-CT formula intentionally
// ship as minimal shapes: empty handler arrays for v1 (session 8 fills
// them) and a `kind: 'fixed'` initial-CT variant (turn-structure.md's
// speed-based + variance formula lands as another variant later).

import type { BucketId, RulesetId } from './ids.ts';
import type { TerrainType } from './tile.ts';
import type { HookSourceTier } from './hook-source.ts';

// CT subtracted from a unit at turn_end, keyed by what the turn consumed.
// See docs/design/turn-structure.md ("Turn end") and docs/design/ct-system.md
// ("Parameterizable elements"). `defend` is reserved for the future Defend
// action — same shape as `wait` in v1, separated so a future ruleset can
// distinguish them without a shape change.
export interface RulesetCTCosts {
  readonly moveOnly: number;
  readonly actOnly: number;
  readonly moveAndAct: number;
  readonly wait: number;
  readonly defend: number;
}

// Speed bounds applied after the modifyStatQuery hook chain. `floor` is
// inclusive (Stop sets effective Speed to floor); `ceiling` is `null`
// in v1 (no cap on Haste stacking) — the ceiling tuning question is
// flagged in docs/design/ct-system.md.
export interface RulesetSpeedBounds {
  readonly floor: number;
  readonly ceiling: number | null;
}

// Per-turn budget at turn_start, before any modifier hooks fire.
// Statuses / passives / equipment can grant additional moves or acts
// (or zero them out — Stop sets both to 0). Action types declare which
// budget field they consume; new action-economy mechanics extend the
// vocabulary without touching the validator. See action-resolution.md
// ("Per-turn budgets").
export interface RulesetTurnBudget {
  readonly movesAvailable: number;
  readonly actsAvailable: number;
}

// Targeting / range defaults read by ability authors and validation.
// Specific abilities override per-field; these are the unannotated
// fallbacks. See map-and-battlefield.md ("v1 starting parameters").
export interface RulesetRangeDefaults {
  readonly meleeHorizontal: number;
  readonly meleeVertical: number;
  // Minimum horizontal range; abilities that need an offset (artillery
  // abilities) override per-ability.
  readonly minHorizontal: number;
  // Default vertical tolerance for AoE shapes when an ability doesn't
  // specify its own. Per-ability override is expected for vertical
  // tolerance to matter, but the default keeps unannotated abilities
  // sensible.
  readonly aoeVerticalTolerance: number;
}

// Pathfinding-level defaults. Per-terrain step costs are layered:
// the ruleset declares the global default (typically 1), the class
// movement baseline overrides per-terrain, and movement-bucket
// abilities (modifyTerrainCosts) compose on top.
export interface RulesetPathfinding {
  // Default per-step cost when no per-terrain cost is specified. v1: 1.
  readonly defaultStepCost: number;
  // Optional global per-terrain costs. Empty in the default ruleset
  // (every terrain costs `defaultStepCost`); a difficult-terrain
  // ruleset might set water = 2 globally.
  readonly defaultTerrainCosts: ReadonlyMap<TerrainType, number>;
}

// Engine-level behavior toggles. Each is a yes/no game-feel knob
// addressable by the ruleset.
export interface RulesetBehaviors {
  // FFT default: yes. Friendly units in an AoE are valid targets.
  // Per-ability flags (e.g., "ignores allies") compose on top.
  readonly friendlyFire: boolean;
  // FFT default: yes. Allied units do not block movement during a Move
  // action's path, though a unit cannot end on an allied tile.
  readonly friendlyPassThrough: boolean;
  // FFT default: no. Units do not block straight-line LoS by default;
  // ability flags `pierces_units` / `blocked_by_units` override.
  readonly unitsBlockLineOfSight: boolean;
}

// Reaction chain caps. See action-resolution.md ("Chain termination").
export interface RulesetChainTermination {
  // Reactions cannot themselves trigger reactions of the same kind
  // (handled by isReaction flag in session 7). These two are the
  // numeric caps that complement that rule.
  readonly perUnitPerTurnReactions: number;
  readonly chainDepthCap: number;
}

// Hook-firing order. Tier ordering ranks the four source kinds; the
// ruleset can reorder them for variant-game-feel (e.g., Statuses-first
// for a "raw effects dominate gear" ruleset). Per-handler priority
// breaks ties within a tier; equip/application order within a source
// breaks ties within a priority.
export interface RulesetHookOrdering {
  readonly sourceTiers: ReadonlyArray<HookSourceTier>;
}

// Damage pipeline stages — the seven named stages in
// action-resolution.md ("Damage pipeline"). Each stage names which
// damage-handler refs run (resolved against a session-8 registry).
// v1 ships empty arrays; session 8 specifies the default ordering.
export type DamageStage =
  | 'base'
  | 'attacker'
  | 'target'
  | 'environment'
  | 'variance'
  | 'cap'
  | 'finalize';

// String-keyed reference to a damage handler. Handlers themselves
// register with the (session-8) damage-handler registry; the ruleset
// names which run at which stage and in what order. The string form
// keeps rulesets serializable / authorable.
export type DamageHandlerRef = string;

export interface RulesetDamagePipeline {
  readonly stages: Readonly<Record<DamageStage, ReadonlyArray<DamageHandlerRef>>>;
}

// Initial-CT formula for battle start. v1 ships only the `fixed` variant
// (every unit starts at the named CT). turn-structure.md describes a
// speed-based + variance formula as the eventual default; that lands as
// an additional discriminant when its tuning is decided.
export type RulesetInitialCT = { readonly kind: 'fixed'; readonly value: number };

// Per-bucket capacity baseline. The capacity *floor* — equipment, status,
// and class traits with capacity-modifier hooks compose on top at query
// time (those hook surfaces land alongside their consumers). v1 keys
// every BucketId in `ALL_BUCKET_IDS` with a non-negative integer.
export type RulesetBucketCapacities = ReadonlyMap<BucketId, number>;

export interface RulesetDefinition {
  readonly id: RulesetId;
  readonly name: string;

  readonly ctCosts: RulesetCTCosts;
  readonly speedBounds: RulesetSpeedBounds;
  readonly defaultTurnBudget: RulesetTurnBudget;
  readonly rangeDefaults: RulesetRangeDefaults;
  readonly pathfinding: RulesetPathfinding;
  readonly behaviors: RulesetBehaviors;
  readonly chainTermination: RulesetChainTermination;
  readonly hookOrdering: RulesetHookOrdering;
  readonly damagePipeline: RulesetDamagePipeline;
  readonly initialCT: RulesetInitialCT;
  readonly bucketCapacities: RulesetBucketCapacities;
}
