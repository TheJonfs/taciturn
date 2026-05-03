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
  DamageContext,
  DamageTag,
  HookSourceTier,
  MovementProfile,
  ProposedAction,
  StatName,
  StatusInstance,
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
// a `skip` directive with a human-readable reason; everything else
// returns `null` (the default — turn proceeds normally). The runner
// returns the *first* non-null result; downstream handlers don't run.
export type TurnSkipResult = { readonly reason: string } | null;

// Per-hook signature map. New hooks add an entry; that's it.
export interface HookSignatures {
  // Stat query: consumed by computeSpeed today and computeMovementProfile
  // (for moveRange / jump). Damage stat reads, accuracy/evasion follow.
  modifyStatQuery: {
    args: { unit: Unit; statName: StatName; baseValue: number };
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

  // Lifecycle: fired by applyStatus / removeStatus.
  onApply: {
    args: { unit: Unit };
    return: void;
  };
  onRemove: {
    args: { unit: Unit };
    return: void;
  };

  // Tick: fired by the turn loop / duration scheduler. Session 9 wires
  // the runner; the signature is declared so handlers can register early.
  onTick: {
    args: { unit: Unit };
    return: void;
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
  onDamageReceived: {
    args: { unit: Unit; ctx: DamageContext };
    return: DamageContext;
  };
  onDamageDealt: {
    args: { unit: Unit; ctx: DamageContext };
    return: DamageContext;
  };

  // Action filtering: fired pre-resolution against the actor's hooks
  // (statuses, equipped passives, etc.) so they can block (Stop) or
  // replace (Berserk) the in-flight action. The runner short-circuits
  // on the first non-`allowed` result; downstream handlers do not run.
  onActionAttempted: {
    args: { unit: Unit; action: ProposedAction };
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
