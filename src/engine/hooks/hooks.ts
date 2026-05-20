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
  BucketId,
  DamageContext,
  DamageTag,
  GameState,
  HookSourceTier,
  MovementProfile,
  ProposedAction,
  StatName,
  StatusInstance,
  StatusTag,
  StatusTypeId,
  SystemDamageSource,
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

// Result of `onActionResolved` (per session 18) — fired once per
// UseAbility / ChargedActionResolve, on the actor, after all per-target
// dispatch and emissions have settled. Handlers gate themselves on
// ability tags / id to react to specific kinds of actions (Flow State
// gates on `'magical'` to refund 10 CT). Returns optional emissions for
// the reducer to forward onto its `generatedActions`.
export interface OnActionResolvedResult {
  readonly emittedActions?: ReadonlyArray<ProposedAction>;
}

// Result of `onTurnEnd` (per ADR-0053, session 26 widening). Fired from
// `reduceTurnEnd` against the unit-finishing-its-turn's hooks. Returning
// nothing (or undefined) is the legacy shape; returning an
// OnTurnEndResult lets handlers emit follow-on actions onto the reducer's
// `generatedActions`. First v1 emitting consumer is Quickstep (Lightning
// Mage), which reads `state.turnState.consumed.movesConsumed` and emits
// a `system_ct_push` of +MA when a Move was committed this turn.
export interface OnTurnEndResult {
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

// Result of `onDamageDealt`. Mirrors `OnDamageReceivedResult` on the
// attacker side. Handlers may modify the in-flight DamageContext (the
// legacy shape) or wrap it with `emittedActions` to propose follow-on
// actions — `attackProcs` (weapon spell-cast riders) fire `use_ability`
// emissions when their proc roll lands. Per Session 30 (ADR-0064).
export interface OnDamageDealtResult {
  readonly ctx: DamageContext;
  readonly emittedActions?: ReadonlyArray<ProposedAction>;
}

// Result of `onFinalDamage` (per ADR-0065, Session 30). Emission-only —
// the post-finalize stage fires this hook after the cap/finalize stages
// have written the integer `damageDealt`, and handlers may emit follow-on
// system actions (Rasp Pendant's `system_mp_drain`) but cannot mutate the
// damage already applied. Empty / undefined result is the no-op case.
export interface OnFinalDamageResult {
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
  //              × ∏casterHooks × ∏targetHooks
  // Composition is multiplicative. Target-side composition uses the
  // sibling `modifyIncomingStatusApplicationChance` hook below.
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

  // Target-side variant of modifyStatusApplicationChance. Fires against
  // the *target's* hooks so equipment / statuses on the recipient can
  // resist incoming status applications. Pointy Hat (per-status-type:
  // × 0.5 on incoming Silence), Focus Band (per-status-tag: × 0.75 on
  // incoming negative-tagged statuses), Stoneskin-style status immunity.
  // Composes multiplicatively after the caster-side chain — see
  // computeStatusChance for the full formula. Per ADR-0028.
  modifyIncomingStatusApplicationChance: {
    args: {
      unit: Unit;          // the target whose hooks fire
      caster: Unit;
      statusType: StatusEffectType;
      ability: ActiveAbilityDefinition | null;
      baseChance: number;  // post-caster-chain
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
  // class-baseline values. Float adds water-tagged terrains to
  // canEnter; Fly sets specialMovement = 'fly'; future: marsh-walking,
  // road bonus, etc.
  //
  // Session 33 (ADR-0073): both hooks pass `terrainRegistry` (sourced
  // from the active ruleset) so handlers can register against a tag
  // ('water') rather than enumerating every terrain literal. The
  // helpers in `engine/map/terrain-registry.ts` make tag-based
  // composition compact.
  modifyCanEnter: {
    args: {
      unit: Unit;
      baseValue: ReadonlySet<TerrainType>;
      terrainRegistry: ReadonlyMap<TerrainType, ReadonlySet<string>>;
    };
    return: ReadonlySet<TerrainType>;
  };
  modifyTerrainCosts: {
    args: {
      unit: Unit;
      baseValue: ReadonlyMap<TerrainType, number>;
      terrainRegistry: ReadonlyMap<TerrainType, ReadonlySet<string>>;
    };
    return: ReadonlyMap<TerrainType, number>;
  };
  modifySpecialMovement: {
    args: { unit: Unit; baseValue: MovementProfile['specialMovement'] };
    return: MovementProfile['specialMovement'];
  };

  // Dual-wield capability query (Session 42). Boolean OR-chain: the
  // engine asks "may this unit attack with its off-hand weapon in
  // addition to its primary?" with a base of `false`; the Two Weapons
  // Support returns `true`. The attack swing-list computation
  // (`attackingWeaponSlots`) consults this to decide whether to include
  // the off-hand weapon slot as a second swing. Two Weapons doesn't
  // touch the damage pipeline itself — it just unlocks the second slot,
  // which the per-swing dispatch then iterates. The future "attack twice
  // with each weapon" accessory (S43) is a separate axis (swings *per*
  // weapon) and would land as its own count-returning hook; see the
  // unified-attack-pipeline ADR. Composition is OR: any handler
  // returning true enables it.
  modifyDualWield: {
    args: { unit: Unit; baseValue: boolean };
    return: boolean;
  };

  // Swings-per-weapon query (the second multi-swing axis anticipated by
  // ADR-0080). Multiplicative chain over how many times each eligible
  // weapon swings on a basic Attack; base `1`. The Offering accessory
  // returns `baseValue × 2` (each weapon swings twice). Orthogonal to
  // `modifyDualWield` (which adds the off-hand *slot*): the swing-list
  // computation multiplies the eligible-slot list by this count, so
  // dual-wield × The Offering = four swings. The call site
  // (`attackingWeaponSlots`) applies it ONLY to the basic Attack command
  // and only when the action is not a reaction — Counter and the Battle
  // Skills don't benefit. The hook itself is a pure capability; the
  // ability/reaction gating lives at the call site.
  modifySwingsPerWeapon: {
    args: { unit: Unit; baseValue: number };
    return: number;
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

  // MP cost modifier — multiplicative on the ability's base MP cost.
  // Equipment / status / passive contributors (e.g., Staff of Power
  // × 1.20) fire against the caster's hooks; the chain is read by
  // `computeMpCost` at the cost-affordability check (validate.ts), the
  // MP deduction (use_ability reducer), and the recorded `mpSpent` on
  // outcomes. Free abilities (class-granted, cost 0) short-circuit
  // before the chain runs — multiplying 0 by any factor stays 0, but
  // skipping the chain keeps the contributor surface honest. Final
  // value is rounded half-up at `computeMpCost`'s exit, floored at 0.
  modifyMpCost: {
    args: {
      unit: Unit;
      ability: ActiveAbilityDefinition;
      baseCost: number;
    };
    return: number;
  };

  // Action-speed modifier — additive on the ability's base action speed.
  // Applied at commit time via `computeBaseActionSpeed`; the resulting
  // value is stored on the spawned `ChargedAction.speed`. Equipping a
  // contributor mid-charge does not affect in-flight charges — the
  // stored value is the canonical commit-time read. Tag-conditional
  // contributors inspect `args.ability.effects.damage?.tags` to gate
  // (Wand of Deepwood: +5 actionSpeed only when the spell is Earth-
  // tagged). The line-264 `ability.actionSpeed > 0` charged-vs-instant
  // gate stays based on the *unmodified* base value so equipment can't
  // flip an instant ability into a charged one (or vice versa).
  modifyActionSpeed: {
    args: {
      unit: Unit;
      ability: ActiveAbilityDefinition;
      baseActionSpeed: number;
    };
    return: number;
  };

  // Per-tag resistance modifier — additive on the unit's per-tag
  // resistance value. Capacitor Ring (+50 Lightning), Wand of Depths
  // ({ lightning: +50, fire: -50 }), and future status-driven shifts
  // ("Curse of Vulnerability" stripping resistance) all flow through
  // this chain. Read sites: `composeResistance` (damage pipeline) and
  // `lookupStatusResistance` (status apply formula). Result is no
  // longer capped at 100 — values > 100 trigger the absorption path
  // per ADR-0057 (supersedes ADR-0022). The contributor receives the
  // running per-tag value; per ADR-0015, a tag is included in the
  // damage-pipeline signedMax composition only when the unit natively
  // carries it OR a contributor produces a non-zero value (so an
  // implicit zero on an unrelated tag doesn't preempt a real signed-max
  // winner from a different tag).
  modifyResistance: {
    args: {
      unit: Unit;
      tag: DamageTag;
      baseValue: number;
    };
    return: number;
  };

  // Bucket-capacity modifier — additive on the unit's effective capacity
  // for a single bucket. Equipment / status / passive contributors
  // (Steel Helm +1 reaction, Augmentor +1 support, Magus Crown +1 active)
  // fire against the wearer's hooks; the additive chain runs through
  // `getCapacity` which floors the final value at 0. The contributor
  // reads `args.bucket` to gate per-bucket — a Steel Helm handler
  // returns `args.baseCapacity + 1` only when `args.bucket === 'reaction'`.
  // First v1 consumer (Session 29): Steel Helm, Augmentor, Magus Crown
  // equipment items. Per ADR-0059.
  modifyBucketCapacity: {
    args: {
      unit: Unit;
      bucket: BucketId;
      baseCapacity: number;
    };
    return: number;
  };

  // Status-tick-amount modifier — multiplicative on the per-tick
  // decrement (default `baseAmount = 1`). Equipment contributors
  // (Purifier ×2 on `negative`-tagged statuses) gate on `args.statusTags`
  // / `args.statusTypeId` and return `args.baseAmount * factor`.
  //
  // Standard duration-mode statuses consume the chain product in
  // `reduceStatusTick`'s decrement step (decrements `remainingDuration`
  // by `floor(K)` instead of 1). Custom-mode statuses (Burn) read the
  // chain in their own onTick handler to scale stack-consumption rate:
  // Burn under Purifier emits `floor(K)` `status_decrement_stack`
  // actions per tick, halving effective duration without altering the
  // per-tick damage formula. Per ADR-0060.
  modifyStatusTickAmount: {
    args: {
      unit: Unit;
      statusTypeId: StatusTypeId;
      statusTags: ReadonlyArray<StatusTag>;
      baseAmount: number;
    };
    return: number;
  };

  // Ability-range modifier — caster-side, additive. Fires from
  // `computeAbilityRange` to thread per-axis deltas. Equipment contributors
  // (Wand of Depths +1 horizontal/+1 vertical on Water-tagged spells) and
  // future status/passive contributors compose additively per axis. The
  // chain is invoked once per query; handlers gate on the ability (e.g.,
  // `ability.effects.damage?.tags.includes('water')`) and return adjusted
  // `{ horizontal, vertical }`. `validateProposedAction`, the AI's
  // targeting / range scoring, and the UI's target-picker overlay all
  // route through `computeAbilityRange` so equipment-shifted range is
  // consistent across systems. Per Session 29.
  modifyAbilityRange: {
    args: {
      unit: Unit;
      ability: ActiveAbilityDefinition;
      baseHorizontal: number;
      baseVertical: number;
    };
    return: { readonly horizontal: number; readonly vertical: number };
  };

  // Outgoing hit-chance modifier — caster-side mirror of target-side
  // `modifyHitChance`. Equipment contributors (Arcane Lens ×1.10) fire
  // against the attacker's hooks during evasion_check; the composition is
  // multiplicative, applied after the target-side chain:
  //   final = base × ∏casterHooks × ∏targetHooks
  // The combined product is clamped to [0.05, 1.0] at the existing exit
  // clamp. Per Session 29 (ADR-0063 sibling).
  modifyOutgoingHitChance: {
    args: {
      attacker: Unit;
      target: Unit;
      ability: ActiveAbilityDefinition;
      baseHitChance: number;
    };
    return: number;
  };

  // System-damage amount modifier — fires inside `reduceSystemDamage`
  // against the *target's* hooks before the HP delta is applied. Each
  // handler receives the running amount and returns a new one; the chain
  // runs in tier/priority order. A handler can drop the amount to 0 to
  // fully prevent the damage (the reducer's `applied === 0` short-circuit
  // then no-ops).
  //
  // Per ADR-0052: system_damage bypasses the seven-stage damage pipeline
  // by design (ADR-0027), but a single modification seam keeps fall-immunity,
  // poison-tick reduction, and similar mitigation expressible as passives /
  // statuses / equipment without ad hoc plumbing per source. Handlers gate
  // on `source.kind` (the discriminated SystemDamageSource union) for
  // source-specific behavior — Bedrock Stride filters on `'falling'`;
  // future Purifier-style content would filter on `'status_tick'` + the
  // tick's statusTypeId.
  modifySystemDamage: {
    args: {
      unit: Unit;
      source: SystemDamageSource;
      tags: ReadonlySet<DamageTag>;
      baseAmount: number;
    };
    return: number;
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

  // Turn boundaries: session 9 fires onTurnStart; session 26 (ADR-0053)
  // widened `onTurnEnd` to pass state + catalog so handlers can read
  // `state.turnState.consumed` (gate on what the unit did this turn) and
  // use `catalog` for stat queries via `runModifyStatQuery`. Return is
  // `OnTurnEndResult | void`: existing void-returning handlers stay
  // valid, new emitting handlers (Quickstep) return an emittedActions
  // wrapper. `onTurnStart` keeps its narrow shape until a v1 consumer
  // needs to emit; widening it symmetrically is a follow-up if needed.
  onTurnStart: {
    args: { unit: Unit };
    return: void;
  };
  onTurnEnd: {
    args: { unit: Unit; state: GameState; catalog: Catalog };
    return: OnTurnEndResult | void;
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
  // `onDamageDealt` accepts either a bare `DamageContext` (legacy —
  // handlers that only modify damage) or `OnDamageDealtResult`
  // ({ ctx, emittedActions? }) for handlers that propose follow-on
  // actions on hit. The runner normalizes. v1 emitting consumer:
  // `attackProcs` (weapon spell-cast riders fire `use_ability` on a
  // physical hit). Per Session 30 (ADR-0064).
  onDamageDealt: {
    args: { unit: Unit; ctx: DamageContext };
    return: DamageContext | OnDamageDealtResult;
  };

  // Post-finalize damage hook. Fires after the cap/finalize stages have
  // written the integer `damageDealt` to ctx; handlers see the locked-in
  // final damage value and may emit follow-on system actions. Cannot
  // mutate damage (emission-only). `absorbed` is true when the cap stage
  // tag-flipped the result to healing (resistance > 100 per ADR-0057);
  // handlers gate accordingly (Rasp Pendant skips MP drain on absorbed
  // hits since no damage actually landed). Per Session 30 (ADR-0065).
  onFinalDamage: {
    args: {
      unit: Unit;       // attacker (matches onDamageDealt convention)
      target: Unit;
      damageDealt: number;     // post-finalize integer
      damageTags: ReadonlySet<DamageTag>;
      absorbed: boolean;
    };
    return: OnFinalDamageResult | void;
  };

  // Target-side mirror of `onFinalDamage`, added in Session 37 for the
  // Spiked Mail reflect substrate. Fires post-finalize against the
  // *target's* hooks (the one taking the damage), so equipment / passives
  // on the recipient can read the locked-in `damageDealt` integer and
  // emit follow-on actions back at the attacker — Spiked Mail's
  // `physicalReflectPercent` emits a `system_damage { source: 'revenge', ... }`
  // for the configured fraction of the post-mitigation amount.
  //
  // Loop guard: `system_damage` actions (including revenge emissions)
  // bypass the seven-stage damage pipeline (per ADR-0027), so they never
  // reach this hook — reflects can't trigger further reflects without an
  // explicit substrate addition. `absorbed === true` follows the same
  // convention as `onFinalDamage` (handlers gate themselves; Spiked Mail
  // skips reflect when the wearer absorbed the hit through resistance >
  // 100, matching Rasp Pendant's skip-on-absorbed gate).
  onFinalDamageReceived: {
    args: {
      unit: Unit;       // target (the wearer being struck) whose hooks fire
      attacker: Unit;
      damageDealt: number;     // post-finalize integer
      damageTags: ReadonlySet<DamageTag>;
      absorbed: boolean;
    };
    return: OnFinalDamageResult | void;
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

  // Action resolution complete: fired once per UseAbility / charged-
  // action-resolve, on the actor's hooks, after all per-target dispatch
  // and pipeline emissions have settled. Handlers gate themselves on
  // `ability.tags` / `ability.id` (the ability arg is non-null for
  // use_ability and charged_action_resolve actions; null for other
  // action kinds the runner is invoked for, though v1 fires it only on
  // ability resolution). Returns optional `emittedActions` to forward
  // onto the reducer's generatedActions.
  //
  // First v1 consumer is Flow State (Water Mage Support): gates on
  // `'magical'` ability tag and emits `system_ct_push` of +10 against
  // the actor. Per session 18.
  onActionResolved: {
    args: {
      unit: Unit;
      action: ProposedAction;
      ability: ActiveAbilityDefinition | null;
    };
    return: OnActionResolvedResult;
  };

  // Per-step movement event. Runner lands when a movement-modifying
  // status (Don't Move, etc.) needs it.
  onMoveStep: {
    args: { unit: Unit; fromTile: unknown; toTile: unknown };
    return: unknown;
  };

  // Post-move emission hook (Session 39b). Fires once at the end of a
  // committed Move action against the mover's hooks, with the
  // tiles-moved count (path length minus 1 — the number of step
  // transitions taken). Handlers can emit follow-on actions (Field
  // Recovery emits `system_heal` of `tilesMoved²`). Bypassed by forced
  // movement (knockback / pull) since those don't go through reduceMove
  // — the brief's "intentional movement only" gate is satisfied
  // structurally rather than by an explicit flag.
  //
  // First v1 consumer is Field Recovery (Alchemist Movement). Emission-
  // only; handlers may return an array of ProposedActions.
  onMoveCompleted: {
    args: { unit: Unit; tilesMoved: number };
    return: ReadonlyArray<ProposedAction>;
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
