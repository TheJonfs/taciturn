// Hook system — typed extension points used by statuses (and, in future
// sessions, equipped passives, equipment, and class traits).
// See ADR-0005 for the typing pattern and docs/design/status-effects.md
// for the hook surface.
//
// `HookSignatures` is the single enumeration of every hook the engine
// fires. Each entry pins down args and return type. Adding a hook is one
// edit here plus its runner; existing handlers and runners stay correct.
//
// `StatusHookRegistration` is a discriminated union over hook names: a
// status definition's `hooks: ReadonlyArray<StatusHookRegistration>`
// carries handlers whose signatures are individually type-safe.
//
// Only `modifyStatQuery`, `onApply`, and `onRemove` have runners in
// session 3 — the rest are typed surface area waiting for their
// consumers in later sessions (annotated below). Defining them now
// avoids type-system surgery later.

import type { StatName, StatusInstance, Unit } from '../types/index.ts';

// Per-hook signature map. New hooks add an entry; that's it.
export interface HookSignatures {
  // Stat query: consumed by computeSpeed today; computeMoveProfile,
  // damage stat reads, accuracy/evasion will follow.
  modifyStatQuery: {
    args: { unit: Unit; statName: StatName; baseValue: number };
    return: number;
  };

  // Lifecycle: fired by applyStatus / removeStatus (session 3).
  onApply: {
    args: { unit: Unit };
    return: void;
  };
  onRemove: {
    args: { unit: Unit };
    return: void;
  };

  // Tick: fired by the turn loop / duration scheduler. Session 9 wires
  // the runner; session 3 only declares the signature so status types
  // can register handlers in advance.
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

  // Action filtering / reactions: session 7 (reducer + action types).
  onActionAttempted: {
    args: { unit: Unit; action: unknown };
    return: unknown;
  };
  onActionTargeted: {
    args: { unit: Unit; incomingAction: unknown };
    return: unknown;
  };

  // Movement: session 4.
  onMoveStep: {
    args: { unit: Unit; fromTile: unknown; toTile: unknown };
    return: unknown;
  };
}

export type HookName = keyof HookSignatures;

// Context passed to a status handler in addition to the hook's args.
// Carries the instance so handlers can read magnitude / source / etc.
// Other source kinds (Equipment, Class, Passive) will define their own
// context shapes when they land — the args half stays shared.
export interface StatusHookContext {
  readonly instance: StatusInstance;
}

// Discriminated registration. A `StatusEffectType.hooks` entry names
// the hook it targets; `handler` is then typed against that hook's
// signature without casts at the call site.
export type StatusHookRegistration = {
  [K in HookName]: {
    readonly name: K;
    // Optional per-handler tiebreaker within its source tier. Lower
    // numbers fire first. When omitted, source-order applies (statuses:
    // application order).
    readonly priority?: number;
    readonly handler: (
      args: HookSignatures[K]['args'],
      ctx: StatusHookContext,
    ) => HookSignatures[K]['return'];
  };
}[HookName];

// Source-tier ordering for hook dispatch. Lower tier fires first.
// Per docs/design/status-effects.md ("Ordering"). Session 3 only has
// the Status tier; the others arrive with their owning sessions.
export type HookSourceTier = 'equipment' | 'class' | 'passive' | 'status';

export const HOOK_SOURCE_TIER_ORDER: ReadonlyArray<HookSourceTier> = [
  'equipment',
  'class',
  'passive',
  'status',
];

// Helper for content authors and tests. TypeScript can't narrow the
// discriminated union from an inline `{ name: 'foo', handler: ... }`
// literal in an array — so handler params would otherwise infer as the
// widened union of all arms, defeating the per-hook typing. Wrapping
// each registration in `statusHook(name, handler)` carries the K type
// parameter through, making `args` and `ctx` typed to the right hook.
export function statusHook<K extends HookName>(
  name: K,
  handler: (args: HookSignatures[K]['args'], ctx: StatusHookContext) => HookSignatures[K]['return'],
  priority?: number,
): StatusHookRegistration {
  // The cast is safe by construction: `name` and `handler` agree on K.
  return (
    priority === undefined ? { name, handler } : { name, handler, priority }
  ) as StatusHookRegistration;
}
