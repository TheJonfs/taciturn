// Status-specific hook registration shape.
//
// The shared hook surface (HookSignatures, HookName, HookSourceTier,
// chain runners, the active-handler collector) lives in engine/hooks/
// and is source-agnostic. This file defines the *status* slice: how a
// status type registers handlers and what context handlers see when
// they fire.
//
// Per ADR-0005, source kinds (Status, Passive, Equipment, Class) share
// the hook *signatures* but each carries its own provenance context.
// Statuses see their `instance`; passives see their `ability`;
// equipment will see its item, and so on.

import type { HookName, HookSignatures } from '../hooks/index.ts';
import type { StatusInstance } from '../types/index.ts';

// Context passed to a status handler in addition to the hook's args.
// Carries the instance so handlers can read magnitude / source / etc.
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
