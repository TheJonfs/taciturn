// Chain-runner helpers — fire a chain hook against every active handler
// for a unit, threading a value through each handler's return.
//
// These runners are source-agnostic: they consume the uniform
// `CollectedHandler<K>` produced by the collector and don't know which
// kind of source registered the handler. Single-source event runners
// (e.g., status-specific `fireOnApply`) live with their owning lifecycle
// instead.

import type { ActiveAbilityDefinition, Catalog, StatusEffectType } from '../catalog/index.ts';
import type {
  AoeShape,
  BucketId,
  DamageContext,
  DamageTag,
  GameState,
  GeneratedReaction,
  MovementProfile,
  ProposedAction,
  StatName,
  StatusTag,
  StatusTypeId,
  SystemDamageSource,
  TerrainType,
  Unit,
} from '../types/index.ts';
import { collectActiveHandlers } from './collector.ts';
import type { ActionAttemptResult, TurnSkipResult } from './hooks.ts';

export function runModifyStatQuery(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; statName: StatName; baseValue: number },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyStatQuery');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, statName: args.statName, baseValue: value });
  }
  return value;
}

// Multiplicative chain over hit-chance modifiers. Each handler returns
// a multiplier (1.0 = no change). The product is then folded into the
// BMG hit_chance formula by `evasion_check`. The base value passed in
// is the formula's value before the modifier product (typically 1.0;
// the caller multiplies the returned product into the running chance).
export function runModifyHitChance(
  state: GameState,
  catalog: Catalog,
  args: {
    target: Unit;
    attacker: Unit;
    ability: ActiveAbilityDefinition;
    baseHitChance: number;
  },
): number {
  // Hooks fire against the *target's* registrations — Blind, etc., live
  // on the target. (Concentration on the attacker would fire on a
  // separate handler against the attacker's hooks; the chain here
  // composes target-side modifiers.)
  const handlers = collectActiveHandlers(state, args.target.id, catalog, 'modifyHitChance');
  let value = args.baseHitChance;
  for (const h of handlers) {
    value = h.invoke({
      unit: args.target,
      attacker: args.attacker,
      ability: args.ability,
      baseHitChance: value,
    });
  }
  return value;
}

// Additive chain over per-facing evasion. Each handler receives the
// running evasion value and the attacker / facing context, and returns
// the next value. Hooks fire against the *defender's* registrations —
// Bulwark Stance lives on the defender. Composition is additive
// (handlers return `baseEvasion + delta`), which keeps Bulwark Stance's
// flat +10 front evade composing intuitively with future evasion-
// modifying content.
//
// Result is read into the BMG hit formula's
// `(1 - target_evasion[facing] / 100)` term inside `evasionCheck`.
// Negative results are valid (a "Concentration" support reducing
// target evasion would land them); the formula's `Math.max(0.05, ...)`
// floor keeps damage probabilistic even if a handler over-applies.
export function runModifyEvasion(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    attacker: Unit;
    baseEvasion: number;
    facing: 'front' | 'side' | 'back';
  },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyEvasion');
  let value = args.baseEvasion;
  for (const h of handlers) {
    value = h.invoke({
      unit: args.unit,
      attacker: args.attacker,
      baseEvasion: value,
      facing: args.facing,
    });
  }
  return value;
}

// Multiplicative chain over status-application-chance modifiers. Each
// handler returns a multiplier (1.0 = no change). Hooks fire against
// the *caster's* registrations — Earth Communion lives on the caster.
export function runModifyStatusApplicationChance(
  state: GameState,
  catalog: Catalog,
  args: {
    caster: Unit;
    target: Unit;
    statusType: StatusEffectType;
    ability: ActiveAbilityDefinition | null;
    baseChance: number;
  },
): number {
  const handlers = collectActiveHandlers(
    state,
    args.caster.id,
    catalog,
    'modifyStatusApplicationChance',
  );
  let value = args.baseChance;
  for (const h of handlers) {
    value = h.invoke({
      unit: args.caster,
      target: args.target,
      statusType: args.statusType,
      ability: args.ability,
      baseChance: value,
    });
  }
  return value;
}

// Target-side variant — fires against the *target's* hooks so the
// recipient's gear / statuses can resist incoming status applications.
// Composes multiplicatively after the caster-side chain in
// computeStatusChance: `final = base × ∏casterHooks × ∏targetHooks`.
// The final probability is clamped to [0, 1] at the call site.
export function runModifyIncomingStatusApplicationChance(
  state: GameState,
  catalog: Catalog,
  args: {
    target: Unit;
    caster: Unit;
    statusType: StatusEffectType;
    ability: ActiveAbilityDefinition | null;
    baseChance: number;
  },
): number {
  const handlers = collectActiveHandlers(
    state,
    args.target.id,
    catalog,
    'modifyIncomingStatusApplicationChance',
  );
  let value = args.baseChance;
  for (const h of handlers) {
    value = h.invoke({
      unit: args.target,
      caster: args.caster,
      statusType: args.statusType,
      ability: args.ability,
      baseChance: value,
    });
  }
  return value;
}

// Multiplicative chain over MP-cost modifiers. Handlers fire against the
// caster's registrations. Each handler returns the next-running cost
// (handler shape: `args.baseCost * factor`, mirroring modifyHitChance).
// `computeMpCost` is the single chokepoint — reducer / validator / AI
// route through it; this runner is its low-level engine.
export function runModifyMpCost(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    ability: ActiveAbilityDefinition;
    baseCost: number;
  },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyMpCost');
  let value = args.baseCost;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, ability: args.ability, baseCost: value });
  }
  return value;
}

// Additive chain over action-speed modifiers. Handlers fire against the
// caster's registrations. Each handler receives the running base speed
// and returns the next (handler shape: `args.baseActionSpeed + delta`,
// mirroring modifyStatQuery). Tag-conditional gating happens inside the
// handler — the contributor inspects `args.ability` to decide whether
// to apply. Called by `computeBaseActionSpeed` at commit time and by
// the forecast's hypothetical-state construction.
export function runModifyActionSpeed(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    ability: ActiveAbilityDefinition;
    baseActionSpeed: number;
  },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyActionSpeed');
  let value = args.baseActionSpeed;
  for (const h of handlers) {
    value = h.invoke({
      unit: args.unit,
      ability: args.ability,
      baseActionSpeed: value,
    });
  }
  return value;
}

// Additive chain over per-tag resistance modifiers. Handlers fire
// against the *target's* (resistance owner's) registrations — Capacitor
// Ring (+50 Lightning) lives on the wearer. Called per damage tag by
// composeResistance (damage pipeline) and once per status's
// resistanceTag by lookupStatusResistance. The chain is uncapped — the
// cap-at-100 was lifted to activate the absorption path per ADR-0057.
export function runModifyResistance(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    tag: DamageTag;
    baseValue: number;
  },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyResistance');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, tag: args.tag, baseValue: value });
  }
  return value;
}

// Outgoing-healing multiplier (Session 62, Emissary / ADR-0101). Queried
// against the healer for a multiplicative factor on healing they apply;
// `baseValue` is the running multiplier (caller seeds 1.0). Mirrors
// `runModifyResistance`'s fold shape but composes multiplicatively.
export function runModifyOutgoingHealing(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; baseValue: number },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyOutgoingHealing');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value });
  }
  return value;
}

export function runModifyCanEnter(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; baseValue: ReadonlySet<TerrainType> },
): ReadonlySet<TerrainType> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyCanEnter');
  const terrainRegistry = catalog.getRuleset(state.ruleset.id).terrain.tags;
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value, terrainRegistry });
  }
  return value;
}

export function runModifyTerrainCosts(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; baseValue: ReadonlyMap<TerrainType, number> },
): ReadonlyMap<TerrainType, number> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyTerrainCosts');
  const terrainRegistry = catalog.getRuleset(state.ruleset.id).terrain.tags;
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value, terrainRegistry });
  }
  return value;
}

export function runModifySpecialMovement(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; baseValue: MovementProfile['specialMovement'] },
): MovementProfile['specialMovement'] {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifySpecialMovement');
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value });
  }
  return value;
}

// Boolean OR-chain over dual-wield capability (Session 42). Base `false`;
// any handler returning `true` flips it on (Two Weapons Support). Once
// true it stays true — a later handler can't revoke it. Consumed by
// `attackingWeaponSlots` to decide whether the off-hand weapon swings.
export function runModifyDualWield(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit },
): boolean {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyDualWield');
  let value = false;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value }) || value;
  }
  return value;
}

// Multiplicative chain over swings-per-weapon (the second multi-swing
// axis, ADR-0080). Base `1`; The Offering accessory returns
// `baseValue × 2`. Consumed by `attackingWeaponSlots`, which then floors
// and applies it only to the basic Attack command (non-reaction).
export function runModifySwingsPerWeapon(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifySwingsPerWeapon');
  let value = 1;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, baseValue: value });
  }
  return value;
}

// AoE shape modifier — fires against the caster's hooks just before
// `resolveAbilityTargets` computes the affected footprint. Each handler
// transforms the running shape; the chain composes in source-tier and
// per-handler priority order. v1 has no consumer; Fire Mage's "larger
// AoE" rider in session 19 is the planned first user.
export function runModifyAoeShape(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; ability: ActiveAbilityDefinition; baseShape: AoeShape },
): AoeShape {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyAoeShape');
  let shape = args.baseShape;
  for (const h of handlers) {
    shape = h.invoke({ unit: args.unit, ability: args.ability, baseShape: shape });
  }
  return shape;
}

// AoE vertical-tolerance modifier (S47) — fires against the caster's
// hooks at the same site as `modifyAoeShape`. Additive chain over the
// effective vertical tolerance. Aether Bloom is the first consumer
// (+1 on magical-tagged AoEs). See ADR-0085.
export function runModifyAoeVerticalTolerance(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; ability: ActiveAbilityDefinition; baseValue: number },
): number {
  const handlers = collectActiveHandlers(
    state,
    args.unit.id,
    catalog,
    'modifyAoeVerticalTolerance',
  );
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, ability: args.ability, baseValue: value });
  }
  return value;
}

// Additive chain over bucket-capacity modifiers. Handlers fire against
// the unit's registrations (Steel Helm +1 R, Augmentor +1 S, Magus Crown
// +1 active). Each handler returns the next running capacity (shape:
// `args.baseCapacity + delta`); per-bucket gating happens inside the
// handler (`if (args.bucket !== 'reaction') return args.baseCapacity`).
// Called by `getCapacity`; the helper floors the final value at 0.
// Per ADR-0059.
export function runModifyBucketCapacity(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    bucket: BucketId;
    baseCapacity: number;
  },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyBucketCapacity');
  let value = args.baseCapacity;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, bucket: args.bucket, baseCapacity: value });
  }
  return value;
}

// Additive chain over per-axis ability range. Caster-side. Wand of
// Depths' +1 horizontal/+1 vertical on Water-tagged spells composes
// through here; future status/passive contributors compose additively
// per axis. Handlers gate on the ability internally (e.g. checking
// `args.ability.effects.damage?.tags`); the runner just threads.
// Per Session 29.
export function runModifyAbilityRange(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    ability: ActiveAbilityDefinition;
    baseHorizontal: number;
    baseVertical: number;
  },
): { readonly horizontal: number; readonly vertical: number } {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyAbilityRange');
  let horizontal = args.baseHorizontal;
  let vertical = args.baseVertical;
  for (const h of handlers) {
    const out = h.invoke({
      unit: args.unit,
      ability: args.ability,
      baseHorizontal: horizontal,
      baseVertical: vertical,
    });
    horizontal = out.horizontal;
    vertical = out.vertical;
  }
  return { horizontal, vertical };
}

// Multiplicative chain over caster-side outgoing hit-chance modifiers.
// Mirror of `runModifyHitChance` (target-side). Arcane Lens (×1.10)
// composes here. The caller multiplies the result into the running
// chance after the target-side chain; final clamp happens at the
// existing `evasionCheck` exit. Per Session 29.
export function runModifyOutgoingHitChance(
  state: GameState,
  catalog: Catalog,
  args: {
    attacker: Unit;
    target: Unit;
    ability: ActiveAbilityDefinition;
    baseHitChance: number;
  },
): number {
  const handlers = collectActiveHandlers(state, args.attacker.id, catalog, 'modifyOutgoingHitChance');
  let value = args.baseHitChance;
  for (const h of handlers) {
    value = h.invoke({
      attacker: args.attacker,
      target: args.target,
      ability: args.ability,
      baseHitChance: value,
    });
  }
  return value;
}

// Multiplicative chain over status-tick-amount modifiers. Handlers fire
// against the unit-being-ticked's registrations (Purifier ×2 on
// `negative`-tagged statuses). Each handler receives the running
// baseAmount (default 1) and returns the next (shape:
// `args.baseAmount * factor`). Per-tag / per-type gating happens inside
// the handler. Called once per tick by `reduceStatusTick` (standard
// duration mode) and once by Burn's onTick (custom mode). Per ADR-0060.
export function runModifyStatusTickAmount(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    statusTypeId: StatusTypeId;
    statusTags: ReadonlyArray<StatusTag>;
    baseAmount: number;
  },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifyStatusTickAmount');
  let value = args.baseAmount;
  for (const h of handlers) {
    value = h.invoke({
      unit: args.unit,
      statusTypeId: args.statusTypeId,
      statusTags: args.statusTags,
      baseAmount: value,
    });
  }
  return value;
}

// Distinct seed sub-stream for the incoming-status-duration Brave gate, so
// the roll doesn't collide with variance (0), evasion (1), brave reactions
// (2), status chance (3), procs (8), or ability chance (16).
const INCOMING_STATUS_DURATION_SUB_STREAM = 9;

// Target-side incoming-status duration modifier (Thief — Slip Free). Fires
// inside `applyStatus` against the TARGET's hooks. Performs the reaction-
// style Brave roll once (Brave/100, read through `modifyStatQuery` so brave
// buffs/debuffs compose) and forwards it as `braveTriggered`, then composes
// the handler chain over the running duration. Floored and clamped to >= 0.
// No handlers → returns the base duration untouched (no roll consumed).
export function runModifyIncomingStatusDuration(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    statusTypeId: StatusTypeId;
    statusTags: ReadonlyArray<StatusTag>;
    baseDuration: number;
    seed: number;
  },
): number {
  const handlers = collectActiveHandlers(
    state,
    args.unit.id,
    catalog,
    'modifyIncomingStatusDuration',
  );
  if (handlers.length === 0) return args.baseDuration;
  const brave = runModifyStatQuery(state, catalog, {
    unit: args.unit,
    statName: 'brave',
    baseValue: args.unit.baseStats.brave,
  });
  const braveTriggered =
    unitFloatFromSeed((args.seed ^ INCOMING_STATUS_DURATION_SUB_STREAM) >>> 0) < brave / 100;
  let value = args.baseDuration;
  for (const h of handlers) {
    value = h.invoke({
      unit: args.unit,
      statusTypeId: args.statusTypeId,
      statusTags: args.statusTags,
      baseDuration: value,
      braveTriggered,
    });
  }
  return Math.max(0, Math.floor(value));
}

// Status-application stack-count modifier (Session 45 follow-up,
// ADR-0084). Fires inside `applyStatus` against the SOURCE unit's
// hook registrations (Wand of Lumen +1 stack on fire-tagged ability +
// burn statusType, registered on its wielder). Chain composes
// additively; each handler receives the running count and returns the
// next. Floored and clamped to `>= 0` so a handler can't drop the
// count negative. Skipped when source is null (system-side applies).
export function runModifyStatusApplicationStackCount(
  state: GameState,
  catalog: Catalog,
  args: {
    target: Unit;
    source: Unit | null;
    statusTypeId: StatusTypeId;
    statusTags: ReadonlyArray<StatusTag>;
    sourceAbilityTags: ReadonlyArray<string>;
    baseCount: number;
  },
): number {
  if (args.source === null) return args.baseCount;
  const handlers = collectActiveHandlers(state, args.source.id, catalog, 'modifyStatusApplicationStackCount');
  let value = args.baseCount;
  for (const h of handlers) {
    value = h.invoke({
      target: args.target,
      source: args.source,
      statusTypeId: args.statusTypeId,
      statusTags: args.statusTags,
      sourceAbilityTags: args.sourceAbilityTags,
      baseCount: value,
    });
  }
  return Math.max(0, Math.floor(value));
}

// System-damage amount modifier — fires inside `reduceSystemDamage`
// against the target's hooks before the HP delta is applied. Each
// handler returns a new running amount; the chain composes in source-tier
// and per-handler priority order. A handler returning 0 fully prevents
// the damage (the reducer's `applied === 0` short-circuit no-ops).
// Per ADR-0052. First v1 consumer: Bedrock Stride (Earth Mage), gating
// on `source.kind === 'falling'` and returning 0.
export function runModifySystemDamage(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    source: SystemDamageSource;
    tags: ReadonlySet<DamageTag>;
    baseAmount: number;
  },
): number {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'modifySystemDamage');
  let amount = args.baseAmount;
  for (const h of handlers) {
    amount = h.invoke({
      unit: args.unit,
      source: args.source,
      tags: args.tags,
      baseAmount: amount,
    });
  }
  return amount;
}

// Pre-resolution hook firing — short-circuits on the first non-`allowed`
// result. Stop returns `blocked`, Berserk returns `replaced`. Equipment
// → Class → Passive → Status order is preserved so a class trait that
// allows after a status that blocks does not run (status fires later
// in the order, but the comparator places equipment-tier first; the
// short-circuit means the most-recently-applied source wins by default
// when multiple sources contend — a knob the per-handler priority
// adjusts).
//
// `abilityTags` is pre-resolved here: when the action is a use_ability,
// the runner looks up the ability and forwards its tag set so handlers
// (Silence on 'magical'/'voice') can gate without a catalog read of
// their own. Non-use_ability actions get an empty set.
export function runOnActionAttempted(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; action: ProposedAction; isReaction?: boolean },
): ActionAttemptResult {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onActionAttempted');
  const abilityTags = resolveAbilityTags(args.action, catalog);
  const isReaction = args.isReaction ?? false;
  let current = args.action;
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit, action: current, abilityTags, isReaction });
    if (result.kind === 'blocked') return result;
    if (result.kind === 'replaced') {
      current = result.with;
    }
  }
  if (current === args.action) return { kind: 'allowed' };
  return { kind: 'replaced', with: current };
}

const EMPTY_ABILITY_TAGS: ReadonlySet<string> = new Set();

function resolveAbilityTags(action: ProposedAction, catalog: Catalog): ReadonlySet<string> {
  if (action.type !== 'use_ability') return EMPTY_ABILITY_TAGS;
  const ability = catalog.getAbility(action.payload.abilityId);
  if (ability.tags === undefined || ability.tags.length === 0) return EMPTY_ABILITY_TAGS;
  return new Set(ability.tags);
}

// Post-application hook firing — collects reactions every handler
// produces, then gates each by a Brave-based trigger roll on the
// reactor (per docs/battle-mechanics-guide.md "Reaction trigger
// chance"): `trigger_chance = Brave / 100`. A unit at Brave 100 (the
// v1 demo default) triggers deterministically; lower-Brave units skip
// reactions probabilistically.
//
// Brave is read through `modifyStatQuery` so future buff/debuff statuses
// modifying brave compose. v1 has no such status — the chain is
// identity today.
//
// Seed determinism: the per-action `seed` is folded with a sub-stream
// constant (BRAVE_REACTION_SUB_STREAM) plus a per-group index. Same
// action seed + same proposed reactions list always produce the same
// trigger pattern. Session 55: Brave is rolled once per *trigger* (per
// handler that emits), not per emitted action — a handler emitting several
// actions (Damage Split: reflect + self-heal) fires or whiffs as a unit, and
// the group shares one cap slot. For the common one-emission-per-handler
// reaction the group index equals the old flat emission index, so the roll
// stream is unchanged.
//
// The reducer enqueues the surviving reactions onto the action chain.
// Damage-bearing actions enrich the args with the final damage amount
// and tag set so reaction handlers (Counter, Auto-Potion) can gate
// without a catalog re-lookup.
//
// Seed contract: `seed` is the per-action seed of the *incoming* action
// (the one that fired onActionTargeted). Stable across replay because
// the action's seed is recorded on its envelope.
const BRAVE_REACTION_SUB_STREAM = 2;
// Session 55: salt for deriving a per-trigger `reactionGroupId` from the
// incoming action's seed + group index. Distinct from the Brave sub-stream so
// the group id never collides with a roll value; the id only needs to be
// stable per trigger and distinct across triggers within a turn (different
// incoming actions carry different seeds).
const REACTION_GROUP_SALT = 0x9e3779b9;

// Per-action proc-roll sub-stream (ADR-0064, Session 30). Weapon
// `attackProcs` entries each consume `seed ^ (PROC_ROLL_SUB_STREAM +
// procIndex)` so multiple proc entries on the same weapon (or two procs
// on stacked weapons in dual-wield) roll independently of each other
// AND independently of variance (0), evasion (1), brave (2), status-
// chance (3+effectIndex), crit (4), and ability-chance (16+effectIndex).
// Lane 8 is clearly outside every existing range. Exported because the
// `attackProcContributor` reads it directly off the per-action seed in
// the DamageContext.
export const PROC_ROLL_SUB_STREAM = 8;

export function runOnActionTargeted(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    incomingAction: ProposedAction;
    damageDealt?: number;
    damageTags?: ReadonlySet<DamageTag>;
    seed: number;
  },
): ReadonlyArray<GeneratedReaction> {
  // Session 29 (ADR-0062): skip reactions when the incoming action's
  // actor is on the same team as the reacting unit. Reactions are
  // adversarial by default; allies shouldn't trigger each other's
  // Counter, Smolder, Discharge, Tidal Pull, Earth Resilience.
  // System actions (no `actorId` on the envelope — fall damage, status
  // ticks, environmental) fall through unfiltered: a unit can still
  // react to environmental damage. A future opt-in `triggerOnAllies`
  // field on reaction definitions can override per-content when berserk-
  // or ally-protection content asks for it.
  if ('actorId' in args.incomingAction) {
    const source = state.units.get(args.incomingAction.actorId);
    if (source !== undefined && source.team === args.unit.team) {
      return [];
    }
  }

  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onActionTargeted');
  // Session 55: group emissions by the handler that produced them. A single
  // reaction trigger may emit more than one action (Damage Split: reflect +
  // self-heal), and those must Brave-roll and cap-account as ONE reaction —
  // not as independent reactions, which previously gave them separate Brave
  // rolls and let the per-turn cap (default 1) admit the reflect but drop the
  // heal. Each handler that emits anything becomes one group.
  const groups: ProposedAction[][] = [];
  for (const h of handlers) {
    const result = h.invoke({
      unit: args.unit,
      incomingAction: args.incomingAction,
      ...(args.damageDealt !== undefined ? { damageDealt: args.damageDealt } : {}),
      ...(args.damageTags !== undefined ? { damageTags: args.damageTags } : {}),
    });
    if (result.length > 0) groups.push([...result]);
  }
  if (groups.length === 0) return [];

  // Pair each surviving reaction with the reactor id (the unit whose
  // hooks fired). `commitAction` reads `.reactorId` for per-unit-per-
  // turn cap accounting independent of whether the emitted action
  // carries `actorId` (e.g., system_apply_status doesn't).
  const reactorId = args.unit.id;

  const brave = runModifyStatQuery(state, catalog, {
    unit: args.unit,
    statName: 'brave',
    baseValue: args.unit.baseStats.brave,
  });
  const triggerChance = Math.max(0, Math.min(1, brave / 100));
  if (triggerChance <= 0) return []; // deterministic at Brave 0

  // One Brave roll per group (per trigger). The sub-seed indexes by group g,
  // matching the pre-S55 stream for the common one-emission-per-handler case
  // (group index == old flat emission index there), so existing single-action
  // reactions keep their exact roll. A surviving group's emissions all share a
  // stable `reactionGroupId` so the cap admits/denies them together.
  const surviving: GeneratedReaction[] = [];
  for (let g = 0; g < groups.length; g++) {
    if (triggerChance < 1) {
      const subSeed = args.seed ^ ((BRAVE_REACTION_SUB_STREAM + g) >>> 0);
      if (unitFloatFromSeed(subSeed) >= triggerChance) continue;
    }
    const groupId = (args.seed ^ ((REACTION_GROUP_SALT + g) >>> 0)) >>> 0;
    for (const action of groups[g]!) surviving.push({ action, reactorId, reactionGroupId: groupId });
  }
  return surviving;
}

// mulberry32-style mixer matching engine/damage/handlers.ts's variance
// roll. Kept here so reaction-roll determinism doesn't depend on a
// damage-package import. Returns a unit float in [0, 1). Exported so
// source-tier hook contributors (e.g. `attackProcContributor`) can roll
// deterministically off a per-action seed XOR'd with their sub-stream
// constant.
export function unitFloatFromSeed(seed: number): number {
  let s = seed >>> 0;
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Damage-pipeline chain hooks — fired at the attacker / target stages
// of the seven-stage damage pipeline (action-resolution.md "Damage
// pipeline"). Each handler reads the in-flight `DamageContext`, may
// contribute multipliers / additives / hit overrides, and returns the
// next ctx. The pipeline orchestrator threads the chain through all
// stages; these runners thread it through one stage's handlers.
//
// Per Session 30 (ADR-0064), `onDamageDealt` accepts either bare-ctx
// returns (legacy) or `OnDamageDealtResult` returns ({ ctx, emittedActions? }).
// Same normalization pattern as `runOnDamageReceived` — bare returns are
// treated as `{ ctx, emittedActions: undefined }`. Emissions are
// accumulated onto `ctx.emittedActions` so the value flowing out carries
// them; `fireOnDamageDealt` returns this ctx as-is, the orchestrator
// threads it through subsequent stages, and `resolveAbilityEffect`
// forwards `ctx.emittedActions` onto the reducer's `generatedActions`.
export function runOnDamageDealt(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; ctx: DamageContext },
): DamageContext {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onDamageDealt');
  let ctx = args.ctx;
  const accumulatedEmissions: ProposedAction[] = ctx.emittedActions ? [...ctx.emittedActions] : [];
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit, ctx });
    if (isOnDamageDealtResult(result)) {
      ctx = result.ctx;
      if (result.emittedActions !== undefined) {
        for (const a of result.emittedActions) accumulatedEmissions.push(a);
      }
    } else {
      ctx = result;
    }
  }
  return accumulatedEmissions.length > 0 ? { ...ctx, emittedActions: accumulatedEmissions } : ctx;
}

function isOnDamageDealtResult(
  value: DamageContext | { readonly ctx: DamageContext; readonly emittedActions?: ReadonlyArray<ProposedAction> },
): value is { readonly ctx: DamageContext; readonly emittedActions?: ReadonlyArray<ProposedAction> } {
  return typeof value === 'object' && value !== null && 'ctx' in value;
}

// Post-finalize emission hook (per ADR-0065, Session 30). Fires after the
// cap/finalize stages have written the integer `damageDealt` to ctx;
// handlers see locked-in damage and may emit follow-on actions but cannot
// mutate the damage already applied. Rasp Pendant (Session 31) emits
// `system_mp_drain` for 10% of damageDealt against the target on physical
// hits that landed for damage; the `absorbed` arg lets handlers gate
// against absorption-flipped hits (resistance > 100 per ADR-0057).
export function runOnFinalDamage(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    target: Unit;
    damageDealt: number;
    damageTags: ReadonlySet<DamageTag>;
    absorbed: boolean;
  },
): ReadonlyArray<ProposedAction> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onFinalDamage');
  const emissions: ProposedAction[] = [];
  for (const h of handlers) {
    const result = h.invoke({
      unit: args.unit,
      target: args.target,
      damageDealt: args.damageDealt,
      damageTags: args.damageTags,
      absorbed: args.absorbed,
    });
    if (result !== undefined && result.emittedActions !== undefined) {
      for (const a of result.emittedActions) emissions.push(a);
    }
  }
  return emissions;
}

// Target-side post-finalize emission. Sibling of `runOnFinalDamage`;
// fires against the *target's* hooks so equipment / passives on the
// recipient can react to incoming damage with follow-on actions.
// Spiked Mail's `physicalReflectPercent` contributor is the first
// consumer (per Session 37 — emits a revenge-sourced system_damage
// back at the attacker). See `hooks.ts > onFinalDamageReceived` for
// the loop-guard rationale (`system_damage` bypasses the damage
// pipeline, so revenge emissions don't re-trigger this hook).
export function runOnFinalDamageReceived(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;       // target whose hooks fire
    attacker: Unit;
    damageDealt: number;
    damageTags: ReadonlySet<DamageTag>;
    absorbed: boolean;
  },
): ReadonlyArray<ProposedAction> {
  const handlers = collectActiveHandlers(
    state,
    args.unit.id,
    catalog,
    'onFinalDamageReceived',
  );
  const emissions: ProposedAction[] = [];
  for (const h of handlers) {
    const result = h.invoke({
      unit: args.unit,
      attacker: args.attacker,
      damageDealt: args.damageDealt,
      damageTags: args.damageTags,
      absorbed: args.absorbed,
    });
    if (result !== undefined && result.emittedActions !== undefined) {
      for (const a of result.emittedActions) emissions.push(a);
    }
  }
  return emissions;
}

// Session 39b: post-move emission. Fires once at the end of a committed
// Move action against the mover's hooks, with the tiles-moved count.
// Emission-only; the runner collects ProposedActions and returns the
// flat list. Field Recovery (Alchemist Movement) emits a system_heal
// for `tilesMoved²` HP via this hook.
export function runOnMoveCompleted(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; tilesMoved: number },
): ReadonlyArray<ProposedAction> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onMoveCompleted');
  const emissions: ProposedAction[] = [];
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit, tilesMoved: args.tilesMoved });
    if (result !== undefined) {
      for (const a of result) emissions.push(a);
    }
  }
  return emissions;
}

// On-healing-received reaction (Session 62, Unified Calling / ADR-0101).
// Fires against the recipient's hooks after a one-time heal lands.
// Emission-only — mirrors `runOnMoveCompleted`.
export function runOnHealingReceived(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; amount: number },
): ReadonlyArray<ProposedAction> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onHealingReceived');
  const emissions: ProposedAction[] = [];
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit, amount: args.amount });
    if (result !== undefined) {
      for (const a of result) emissions.push(a);
    }
  }
  return emissions;
}

// onDamageReceived accepts either bare-ctx returns (legacy) or
// `OnDamageReceivedResult` returns ({ ctx, emittedActions? }). The runner
// normalizes: bare returns are treated as `{ ctx, emittedActions: undefined }`.
// Emissions are appended onto `ctx.emittedActions` so the value flowing
// out of the runner carries them — `fireOnDamageReceived` (the pipeline
// stage handler) returns this ctx as-is, and the orchestrator threads
// it through subsequent stages. The caller (`resolveAbilityEffect`)
// reads `ctx.emittedActions` after the pipeline returns and forwards
// them to the reducer's `generatedActions`. Per ADR-0027.
export function runOnDamageReceived(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit; ctx: DamageContext },
): DamageContext {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onDamageReceived');
  let ctx = args.ctx;
  const accumulatedEmissions: ProposedAction[] = ctx.emittedActions ? [...ctx.emittedActions] : [];
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit, ctx });
    if (isOnDamageReceivedResult(result)) {
      ctx = result.ctx;
      if (result.emittedActions !== undefined) {
        for (const a of result.emittedActions) accumulatedEmissions.push(a);
      }
    } else {
      ctx = result;
    }
  }
  return accumulatedEmissions.length > 0 ? { ...ctx, emittedActions: accumulatedEmissions } : ctx;
}

function isOnDamageReceivedResult(
  value: DamageContext | { readonly ctx: DamageContext; readonly emittedActions?: ReadonlyArray<ProposedAction> },
): value is { readonly ctx: DamageContext; readonly emittedActions?: ReadonlyArray<ProposedAction> } {
  return typeof value === 'object' && value !== null && 'ctx' in value;
}

// Turn-skip query: fires at turn_start, returns the first non-null
// result (the first handler that decides "skip"). Stop / Sleep / Petrify
// register handlers that return `{ reason }` while active; default-
// acting statuses don't register on this hook. Tier order applies; a
// status registered later in the tier chain that wants to *override* a
// prior skip directive isn't supported (the runner short-circuits).
// Today no v1 case needs override semantics; revisit if future content
// surfaces one.
export function runQueryTurnSkipped(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit },
): TurnSkipResult {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'queryTurnSkipped');
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit });
    if (result !== null) {
      // Stamp the winning handler's source status (if any) onto the
      // result so the reducer can emit a self-tick for it on the
      // skipped turn — per the S46 fix, Stop's own duration must
      // decrement even when `suppressStatusTicks` is true. Non-status
      // sources (passive / equipment / class) leave it undefined.
      return h.sourceTypeId !== undefined
        ? { ...result, statusTypeId: h.sourceTypeId }
        : result;
    }
  }
  return null;
}

// onActionResolved runner (per session 18). Fires against the *actor's*
// hooks after a UseAbility / charged-action-resolve has finished its
// per-target dispatch. Handlers may emit system actions (e.g., Flow
// State's `system_ct_push` refund); the runner gathers them flat for
// the reducer to forward onto its `generatedActions`.
export function runOnActionResolved(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    action: ProposedAction;
    ability: ActiveAbilityDefinition | null;
  },
): ReadonlyArray<ProposedAction> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onActionResolved');
  const emissions: ProposedAction[] = [];
  for (const h of handlers) {
    const result = h.invoke({
      unit: args.unit,
      action: args.action,
      ability: args.ability,
    });
    if (result.emittedActions !== undefined) {
      for (const a of result.emittedActions) emissions.push(a);
    }
  }
  return emissions;
}

// Turn-end side effects (per ADR-0053, session 26). Fires against the
// unit-ending-its-turn's hooks just before `reduceTurnEnd` clears
// `state.turnState`, so handlers can read `state.turnState.consumed` to
// gate on what happened during the turn (Quickstep refunds CT iff a Move
// was committed). Handlers may return `OnTurnEndResult | void`; the
// runner accepts both, threads `state` + `catalog` into args so handlers
// can run stat queries / look up entities, and gathers `emittedActions`
// flat for the reducer to forward onto its `generatedActions`.
export function runOnTurnEnd(
  state: GameState,
  catalog: Catalog,
  args: { unit: Unit },
): ReadonlyArray<ProposedAction> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onTurnEnd');
  const emissions: ProposedAction[] = [];
  for (const h of handlers) {
    const result = h.invoke({ unit: args.unit, state, catalog });
    if (result !== undefined && result.emittedActions !== undefined) {
      for (const a of result.emittedActions) emissions.push(a);
    }
  }
  return emissions;
}

// Status-tick side effects: gathers `emittedActions` from each onTick
// handler registered against the unit. Returns the flat list of
// emissions for the reducer to enqueue. Handlers can read state and
// catalog from the args (Regen reads MaxHP and Faith via
// `runModifyStatQuery` to compute its heal amount).
//
// Filtering: only handlers whose statusTypeId matches `statusTypeId` are
// fired. The caller (status_tick reducer) names the type that's being
// ticked; handlers register against arbitrary hook names but a status
// type's tick should only fire that type's handlers, not other statuses
// on the same unit. The handler receives the type id back so it can
// confirm — and for paranoia, the runner also matches on source.
export function runOnTick(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    statusTypeId: StatusTypeId;
  },
): ReadonlyArray<ProposedAction> {
  const handlers = collectActiveHandlers(state, args.unit.id, catalog, 'onTick');
  const emissions: ProposedAction[] = [];
  for (const h of handlers) {
    // Only the ticking status's own handlers participate. Other
    // statuses on the unit may have onTick handlers that fire on
    // *their* tick, not this one.
    if (h.sourceTypeId !== args.statusTypeId) continue;
    const result = h.invoke({
      unit: args.unit,
      state,
      catalog,
      statusTypeId: args.statusTypeId,
    });
    if (result.emittedActions !== undefined) {
      for (const a of result.emittedActions) emissions.push(a);
    }
  }
  return emissions;
}


// Session 49 / ADR-0086: Math Skill per-target MP cost chain. Composes
// contributors against the caster's hooks; default per-target is the
// ability's `mathSkillMpCost.perTarget` (3 in v1 content). Mathematician
// returns 1 unconditionally — the chain doesn't gate on ability identity
// at the engine level; if multiple contributors ever stack (none in v1),
// the chain runs them in tier+priority order, each receiving the
// running value. Result is floored at 0 by `computeMathSkillPerTargetCost`
// at the call site.
export function runModifyMathSkillPerTargetMpCost(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    ability: ActiveAbilityDefinition;
    baseValue: number;
  },
): number {
  const handlers = collectActiveHandlers(
    state,
    args.unit.id,
    catalog,
    'modifyMathSkillPerTargetMpCost',
  );
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, ability: args.ability, baseValue: value });
  }
  return value;
}

// Session 49 / ADR-0086: Math Skill SP bonus chain. Additive over the
// ability's base `power_coefficient`. Mathematician returns +1; future
// SP-boosting content for Math Skill registers here. Only consulted by
// damage / heal / CT-push Math abilities — status-only Math abilities
// (Sculpted Enhancement, Engineered Defenses) don't have an SP factor
// so the hook never fires for them.
export function runModifyMathSkillSpBonus(
  state: GameState,
  catalog: Catalog,
  args: {
    unit: Unit;
    ability: ActiveAbilityDefinition;
    baseValue: number;
  },
): number {
  const handlers = collectActiveHandlers(
    state,
    args.unit.id,
    catalog,
    'modifyMathSkillSpBonus',
  );
  let value = args.baseValue;
  for (const h of handlers) {
    value = h.invoke({ unit: args.unit, ability: args.ability, baseValue: value });
  }
  return value;
}
