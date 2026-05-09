// Hook system core — the source-agnostic part.
//
// Defines `HookSignatures` (the single enumeration of every hook the
// engine fires), `HookName`, the source-tier ordering, and the per-hook
// shared shape. Per-source registration types (StatusHookRegistration,
// PassiveHookRegistration, …) live in their owning subsystems and
// supply their own context shapes; the runtime collector flattens them
// into a uniform `CollectedHandler<K>` (see collector.ts) so runners
// don't care what source produced a handler.
//
// Adding a hook is one edit here plus its runner. Existing handlers
// stay correct because each handler discriminates on its hook's args.

import type {
  ActiveAbilityDefinition,
  Catalog,
  StatusEffectType,
} from '../catalog/index.ts';
import type {
  AoeShape,
  DamageContext,
  DamageTag,
  GameState,
  HookSourceTier,
  MovementProfile,
  ProposedAction,
  StatName,
  StatusInstance,
  StatusTypeId,
  TerrainType,
  Unit,
} from '../types/index.ts';
import { DEFAULT_HOOK_SOURCE_TIER_ORDER } from '../types/index.ts';

// Result of `onActionAttempted` — what a handler decides about an
// in-flight action. Handlers can leave it allowed, block it (Stop,
// Silence-on-magical), or replace it (Berserk forces an attack).
export type ActionAttemptResult =
  | { readonly kind: 'allowed' }
  | { readonly kind: 'blocked'; readonly reason: string }
  | { readonly kind: 'replaced'; readonly with: ProposedAction };

// Result of `queryTurnSkipped` — fired once at turn_start to ask
// "can this unit take its turn at all?" Stop / Sleep / Petrify return
// a `skip` directive; Charging returns one with `suppressStatusTicks:
// false` so per-unit-CT statuses (Poison, Regen, etc.) still tick on
// the skipped turn. Default-acting statuses return `null`. The runner
// returns the *first* non-null result; downstream handlers don't run.
//
// `suppressStatusTicks` defaults to `true` in semantic intent — Stop's
// "frozen in time" behavior. Charging is the v1 outlier; new skip
// statuses should default to `true` and opt out only when the design
// calls for it (a unit that's still "alive but unable to act" — Charging,
// not Stop). See ADR-0024.
export type TurnSkipResult =
  | { readonly reason: string; readonly suppressStatusTicks: boolean }
  | null;

// Result of `onTick` — fired during status_tick reduction so a status
// can produce side-effects on its tick (Regen heals, Poison damages).
// Per ADR-0024, on*-and-query* hooks gain an `emittedActions` slot when
// a v1 consumer needs it. v1 emitting consumer is Regen via
// `system_heal`; future statuses (Sleep wakeup, Burn damage, Vulnerable
// consume) plug additional emissions onto their hosting hook (onDamageReceived
// for Sleep, etc.) with the same wrapping pattern.
export interface OnTickResult {
  readonly emittedActions?: ReadonlyArray<ProposedAction>;
}

// Result of `onDamageReceived` (per ADR-0027). Handlers may either modify
// the in-flight DamageContext (the legacy shape) or wrap it with
// `emittedActions` to propose system actions in response — Sleep wake-on-
// damage emits a `status_remove` against itself; Vulnerable consume-on-
// damage will do the same. The runner accepts either shape: a bare ctx
// return is normalized to `{ ctx, emittedActions: undefined }`.
export interface OnDamageReceivedResult {
  readonly ctx: DamageContext;
  readonly emittedActions?: ReadonlyArray<ProposedAction>;
}

// Per-hook signature map. New hooks add an entry; that's it.
export interface HookSignatures {
  // Stat query: consumed by computeSpeed today and computeMovementProfile
  // (for moveRange / jump). Damage stat reads, accuracy/evasion follow.
  modifyStatQuery: {
    args: { unit: Unit; statName: StatName; baseValue: number };
    return: number;
  };

  // Hit-chance modifier — multiplicative on physical hit chance.
  // Consumers: Blind (negative status, factor < 1.0), Concentration
  // (future positive support, factor > 1.0). The evasion_check handler
  // collects the chain product and folds it into the BMG formula:
  //   hit_chance = weapon_accuracy × (1 − evasion/100) × elevation × ∏modifiers
  // before clamping to [0.05, 1.0]. Composition is multiplicative across
  // all returned factors.
  modifyHitChance: {
    args: {
      unit: Unit;
      attacker: Unit;
      ability: ActiveAbilityDefinition;
      baseHitChance: number;
    };
    return: number;
  };

  // Status application chance modifier — multiplicative on status
  // application chance. Consumers: Earth Communion (× 1.25), Mediator-
  // style accuracy boosters. The applyStatus pipeline collects the chain
  // product against the *caster* (attacking unit) and folds it into the
  // BMG status hit_chance formula:
  //   hit_chance = base_chance × Faith_factor × MA_factor × (1 - resist/100)
  //              × ∏modifiers
  // Composition is multiplicative.
  modifyStatusApplicationChance: {
    args: {
      unit: Unit;          // the caster (attacking unit) whose hooks fire
      target: Unit;
      statusType: StatusEffectType;
      ability: ActiveAbilityDefinition | null;
      baseChance: number;  // post-Faith, post-MA, post-resistance
    };
    return: number;
  };

  // Evasion modifier — additive on per-facing evasion. Consumers:
  // Bulwark Stance (+10 front evade), future Concentration support
  // (-N target evasion), reaction abilities that condition evasion on
  // active state. Fired against the *defender's* hooks inside
  // `pickEvasion` so handlers see the relevant facing classification.
  // Chain composes additively; the result is read into the BMG hit
  // formula's `(1 - target_evasion[facing] / 100)` term. Per ADR-0028.
  modifyEvasion: {
    args: {
      unit: Unit;        // the defender whose hooks fire
      attacker: Unit;
      baseEvasion: number;
      facing: 'front' | 'side' | 'back';
    };
    return: number;
  };

  // Movement-profile structural modifiers — chain hooks over the
  // class-baseline values. Float adds 'water' to canEnter; Fly sets
  // specialMovement = 'fly'; future: marsh-walking, road bonus, etc.
  modifyCanEnter: {
    args: { unit: Unit; baseValue: ReadonlySet<TerrainType> };
    return: ReadonlySet<TerrainType>;
  };
  modifyTerrainCosts: {
    args: { unit: Unit; baseValue: ReadonlyMap<TerrainType, number> };
    return: ReadonlyMap<TerrainType, number>;
  };
  modifySpecialMovement: {
    args: { unit: Unit; baseValue: MovementProfile['specialMovement'] };
    return: MovementProfile['specialMovement'];
  };

  // AoE shape modifier — fires against the *caster's* hooks just before
  // `resolveAbilityTargets` computes the affected footprint. Each handler
  // receives the running shape and returns a new one; the chain runs in
  // tier/priority order so the last handler's return wins ties.
  // v1 has no consumer; Fire Mage's "larger AoE" rider in session 19 is
  // the planned first user. Pure-compute hook — no emission slot.
  modifyAoeShape: {
    args: {
      unit: Unit;
      ability: ActiveAbilityDefinition;
      baseShape: AoeShape;
    };
    return: AoeShape;
  };

  // Lifecycle: fired by applyStatus / removeStatus.
  onApply: {
    args: { unit: Unit };
    return: void;
  };
  onRemove: {
    args: { unit: Unit };
    return: void;
  };

  // Tick: fired during status_tick reduction so duration-counted statuses
  // can produce side effects (Regen heals via system_heal emission,
  // future Poison damages, etc.). Args include `state`, `catalog`, and
  // `instance` so handlers can read the current world (compute heal
  // amount from MaxHP × Faith, etc.) and reference the instance's
  // magnitude/customState. Return shape carries an optional
  // `emittedActions` list per ADR-0024.
  onTick: {
    args: {
      unit: Unit;
      state: GameState;
      catalog: Catalog;
      statusTypeId: StatusTypeId;
    };
    return: OnTickResult;
  };

  // Turn boundaries: session 9 fires these.
  onTurnStart: {
    args: { unit: Unit };
    return: void;
  };
  onTurnEnd: {
    args: { unit: Unit };
    return: void;
  };

  // Damage pipeline (session 8). Handlers fire at the attacker / target
  // stages of the seven-stage pipeline (see action-resolution.md
  // "Damage pipeline"). They contribute multipliers / additives via the
  // returned context — the finalize stage folds everything in. The
  // attacker handler reads `args.unit === ctx.attacker`; the target
  // handler reads `args.unit === ctx.target`.
  // `onDamageReceived` accepts either a bare `DamageContext` (legacy —
  // handlers that only modify damage) or `OnDamageReceivedResult`
  // (handlers that also propose system actions). The runner normalizes.
  // Per ADR-0027.
  onDamageReceived: {
    args: { unit: Unit; ctx: DamageContext };
    return: DamageContext | OnDamageReceivedResult;
  };
  onDamageDealt: {
    args: { unit: Unit; ctx: DamageContext };
    return: DamageContext;
  };

  // Action filtering: fired pre-resolution against the actor's hooks
  // (statuses, equipped passives, etc.) so they can block (Stop) or
  // replace (Berserk) the in-flight action. The runner short-circuits
  // on the first non-`allowed` result; downstream handlers do not run.
  //
  // `abilityTags` is the resolved tag set from the use_ability target's
  // catalog entry — pre-resolved by the runner so handlers can gate
  // on tags (Silence on `'magical'`/`'voice'`) without a catalog
  // lookup of their own. Empty set when the action isn't a use_ability,
  // or when the ability declares no tags. Per ADR-0024.
  //
  // `isReaction` (per ADR-0027) lets handlers distinguish volitional
  // actions from reflexive ones. Don't Act blocks volitional UseAbility
  // but allows reactions (Counter still fires on a Don't-Act-afflicted
  // reactor). Silence's behavior is unchanged — Silence blocks
  // 'magical'/'voice' regardless of whether the cast is a reaction
  // (a Silenced unit can't speak the words to fire a magical reaction
  // either). The flag is forwarded by `commitAction` from the queue
  // entry's `isReaction`.
  onActionAttempted: {
    args: {
      unit: Unit;
      action: ProposedAction;
      abilityTags: ReadonlySet<string>;
      isReaction: boolean;
    };
    return: ActionAttemptResult;
  };
  // Reactions: fired post-application against the *target's* hooks so
  // they can generate response actions (Counter, Auto-Potion, Reflect).
  // Returns the list of reactions to enqueue — empty if no reaction.
  //
  // Damage-bearing actions enrich the args with `damageDealt` (the final
  // amount applied; positive for damage, negative for healing) and
  // `damageTags` (the action's tag set). Non-damage incoming actions
  // leave both undefined so reaction handlers that gate on damage can
  // skip them. The runner does not pre-filter — handlers decide for
  // themselves whether they care.
  onActionTargeted: {
    args: {
      unit: Unit;
      incomingAction: ProposedAction;
      damageDealt?: number;
      damageTags?: ReadonlySet<DamageTag>;
    };
    return: ReadonlyArray<ProposedAction>;
  };

  // Per-step movement event. Runner lands when a movement-modifying
  // status (Don't Move, etc.) needs it.
  onMoveStep: {
    args: { unit: Unit; fromTile: unknown; toTile: unknown };
    return: unknown;
  };

  // Turn-skip query: fired once at turn_start to decide whether the
  // unit can act this turn at all. Stop / Sleep / Petrify return a
  // `{ reason }` directive; default-acting statuses return `null`.
  // The runner short-circuits on the first non-null result. See
  // docs/design/turn-structure.md ("Turn start").
  queryTurnSkipped: {
    args: { unit: Unit };
    return: TurnSkipResult;
  };
}

export type HookName = keyof HookSignatures;

// Source-tier ordering for hook dispatch. The ordering itself lives on
// the active ruleset (see engine/types/ruleset.ts hookOrdering); the
// default tier list is re-exported from `types/` for callers that need
// the v1 ordering without resolving a ruleset (e.g., source contributors
// computing their own tier label).
export type { HookSourceTier };
export { DEFAULT_HOOK_SOURCE_TIER_ORDER };

// Shared per-hook handler shape that source-specific registrations conform
// to (modulo their own context). The handler returns by hook contract;
// `ctx` carries source-specific provenance (StatusInstance, AbilityDefinition,
// equipped item, class trait — whichever applies).
export type HookHandler<K extends HookName, Ctx> = (
  args: HookSignatures[K]['args'],
  ctx: Ctx,
) => HookSignatures[K]['return'];

// Per-handler ordering — also exposed for source-specific helpers.
export const DEFAULT_HOOK_PRIORITY = 0;

// Re-export the StatusInstance import as a public symbol for any callers
// that build handler types parameterized by StatusHookContext through
// this module. (Status-specific types live in engine/status/hooks.ts.)
export type { StatusInstance };
