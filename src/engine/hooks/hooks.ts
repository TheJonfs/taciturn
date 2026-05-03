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

  // Damage pipeline: session 8. The `damage` shape is fleshed out then;
  // declaring `unknown` here keeps the surface non-binding until a real
  // type exists.
  onDamageReceived: {
    args: { unit: Unit; damage: unknown };
    return: unknown;
  };
  onDamageDealt: {
    args: { unit: Unit; damage: unknown };
    return: unknown;
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
  // Session 7 ships the runner shape; session 8 wires the damage-driven
  // call sites and the v1 Counter content.
  onActionTargeted: {
    args: { unit: Unit; incomingAction: ProposedAction };
    return: ReadonlyArray<ProposedAction>;
  };

  // Per-step movement event. Runner lands when a movement-modifying
  // status (Don't Move, etc.) needs it.
  onMoveStep: {
    args: { unit: Unit; fromTile: unknown; toTile: unknown };
    return: unknown;
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
