// Passive-ability hook registration shape.
//
// The shared hook surface (HookSignatures, runners, the active-handler
// collector) lives in engine/hooks/. This file defines the *passive*
// slice: how a passive ability registers handlers and what context
// handlers see.
//
// Per ADR-0005, source kinds (Status, Passive, Equipment, Class) share
// hook signatures but each carries its own provenance context. Passives
// see their `ability` definition; statuses see their `instance`; etc.
//
// A passive ability lives in a Passive Bucket (Reaction / Support /
// Movement). Its hooks fire while it's equipped (per
// docs/design/ability-slots.md "Passive buckets"); equip / unequip
// don't fire onApply / onRemove (those are status-specific lifecycle
// events). The collector simply walks the loadout each time hooks are
// gathered.

import type { AbilityDefinition } from '../catalog/definitions/ability-definition.ts';
import type { HookName, HookSignatures } from '../hooks/index.ts';

// Context passed to a passive handler in addition to the hook's args.
// Carries the ability definition so handlers can read attached metadata
// (cost, custom params, the ability's id for self-reference).
export interface PassiveHookContext {
  readonly ability: AbilityDefinition;
}

// Discriminated registration. An `AbilityDefinition.hooks` entry names
// the hook it targets; `handler` is then typed against that hook's
// signature without casts at the call site.
export type PassiveHookRegistration = {
  [K in HookName]: {
    readonly name: K;
    readonly priority?: number;
    readonly handler: (
      args: HookSignatures[K]['args'],
      ctx: PassiveHookContext,
    ) => HookSignatures[K]['return'];
  };
}[HookName];

// Helper for content authors and tests. Mirrors `statusHook` — wrapping
// each registration in `passiveHook(name, handler)` carries the K type
// parameter through, making `args` and `ctx` typed to the right hook.
export function passiveHook<K extends HookName>(
  name: K,
  handler: (
    args: HookSignatures[K]['args'],
    ctx: PassiveHookContext,
  ) => HookSignatures[K]['return'],
  priority?: number,
): PassiveHookRegistration {
  return (
    priority === undefined ? { name, handler } : { name, handler, priority }
  ) as PassiveHookRegistration;
}
