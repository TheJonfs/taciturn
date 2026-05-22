## ADR-0084: `modifyStatusApplicationStackCount` — source-side hook for adjusting status-application stack counts

**Status:** Accepted
**Date:** 2026-05-22
**Session:** 45 (follow-up)

## Context

The S45 follow-up adds the **Wand of Lumen**, a Fire-themed wand whose
bonus is: *"when the wielder casts a Fire-tagged ability that applies
one or more stacks of Burn, the application lands with one additional
stack — wired so it does not recurse to infinite stacks."*

The brief flagged the recursion concern, which is the design constraint:
the +1 must be a *modification* to the in-flight application, not a
*new* application that itself could re-trigger any "+1" rider.

An audit of the closed hook surface found nothing that fit:
- `modifyStatusApplicationChance` / `modifyIncomingStatusApplicationChance` — both adjust the *chance to apply*, not the stack count.
- `modifyStatusTickAmount` (ADR-0060) — adjusts per-tick decrement, not application.
- `onApply` — fires *after* the application has been built; can't reshape the candidate's stack count.

Alternative non-hook implementations all introduced the recursion the brief warned about:
- Post-apply hook (e.g. via `onActionResolved` on the wielder) that fires a *second* `applyStatus` for +1 Burn would itself be a Burn application subject to any future `+1` rider — the recursion the brief explicitly forbade.
- Encoding the bonus on Burn's own `onApply` would require reaching across to the caster's equipment from inside the status type, which fights the source-tier separation.

## Decision

A new closed-surface hook, **`modifyStatusApplicationStackCount`**, fires
inside `applyStatus` against the **source** unit's hook registrations
(parallel in stance to `modifyOutgoingHitChance`, which collects on the
attacker):

```ts
modifyStatusApplicationStackCount: {
  args: {
    target: Unit;
    source: Unit | null;
    statusTypeId: StatusTypeId;
    statusTags: ReadonlyArray<StatusTag>;
    sourceAbilityTags: ReadonlyArray<string>;
    baseCount: number;
  };
  return: number;
};
```

`runModifyStatusApplicationStackCount` runs the chain once,
floors and clamps to `≥ 0`, and short-circuits when `source === null`
(system-driven applies have no equipped wielder to consult).

Wired into `applyStatus` at exactly one site — **after** computing
`baseStackQuantity = args.stackQuantity ?? 1`, **before** the type's
`composeApplyState` reads `requestedStackQuantity`. Burn snapshots one
per-stack damage per requested stack in its composer, so a `+1` from
the hook flows naturally into `N+1` stack damages without further
plumbing.

`ApplyStatusArgs` gains an optional `sourceAbilityTags?: ReadonlyArray<string>`
that the reducer's `applyStatus` call (in `resolveAbilityEffect`)
populates from `args.ability.tags ?? []`. System / source-less applies
pass `[]` (or omit the field), in which case the modifier's
`sourceAbilityTagAll` gate fails on any non-empty filter — no accidental
bonuses on synthetic applications.

Equipment carries the modifier declaratively, via a new
`statusApplicationStackCountModifiers?: ReadonlyArray<StatusApplicationStackCountModifier>`
field on `EquipmentBase`:

```ts
interface StatusApplicationStackCountModifier {
  readonly delta: number;
  readonly statusTypeId?: StatusTypeId;     // gate by exact status
  readonly statusTag?: StatusTag;            // gate by status tag
  readonly sourceAbilityTagAll?: ReadonlyArray<string>; // all must match
}
```

A generic `statusApplicationStackCountContributor` in
`engine/items/contributions.ts` iterates equipped items and yields one
hook handler per modifier entry, checking every declared gate (logical
AND) before returning `args.baseCount + delta`. Omitted gates are
wildcards.

The Wand of Lumen authors:

```ts
statusApplicationStackCountModifiers: [
  { delta: 1, statusTypeId: statusTypeId('burn'), sourceAbilityTagAll: ['fire'] },
];
```

## Why no recursion is possible

The hook is a **single-pass numeric modifier** on a value the caller
will use to drive *one* application. The chain returns a number; the
caller proceeds to `composeApplyState` and `applyStackingRule` with
that number; the application completes. The hook does not call
`applyStatus` — there is no nested invocation to recurse into. A `+1
delta` resolves as `baseCount + 1` at the call site, not as a separate
"apply another Burn" action. The recursion concern the brief raised is
structurally unreachable by design.

## Consequences

- The hook surface grows by one entry (ground rule 8 calls for this to
  be a deliberate decision; this ADR is that decision). The shape is
  consistent with `modifyStatusTickAmount` (source vs. target side
  being the difference), so future stack-count modifiers — buffs that
  add MA Up stacks, debuffs that subtract from incoming buff stacks —
  fit the same surface without further substrate.
- `ApplyStatusArgs` gains one optional field. All `applyStatus` call
  sites compile without modification; only the reducer's
  `resolveAbilityEffect` populates the new field (so the bonus only
  fires from ability-driven applications, which is the intended scope).
- Determinism is unchanged. The chain composes additively; the result
  is integer-floored. Same `(state, args, catalog)` → same returned
  count.
- The `EquipmentBase.statusApplicationStackCountModifiers` field is
  declarative data — content authors don't write hook handlers, they
  declare entries.

## Alternatives considered

- **Re-apply via `onActionResolved`** (post-spell hook fires a second
  Burn application from the wielder's equipment). Rejected — exactly
  the recursion the brief warned against; any future `+1` rider on
  Burn would re-trigger.
- **Mutating `StatusEffectSpec.stackQuantity` on the wielder's spells
  via a different hook.** Awkward — the spec is shared content, and
  equipment shouldn't reach across to mutate ability data.
- **Reusing `modifyStatusApplicationChance`** by inflating the
  effective probability and translating to stacks. Conceptually
  unrelated (chance ≠ count); breaks the chance hook's contract.

## References

- `src/engine/hooks/hooks.ts` — hook signature.
- `src/engine/hooks/runners.ts` — `runModifyStatusApplicationStackCount`.
- `src/engine/status/apply.ts` — call site and `ApplyStatusArgs.sourceAbilityTags`.
- `src/engine/catalog/definitions/item-definition.ts` — `StatusApplicationStackCountModifier`, `EquipmentBase.statusApplicationStackCountModifiers`.
- `src/engine/items/contributions.ts` — `statusApplicationStackCountContributor`.
- `src/content/items/wand-of-lumen.ts` — first consumer.
- `src/engine/actions/session-45-followup.test.ts` — hook + gating coverage.
- ADR-0060 (`modifyStatusTickAmount` — sibling shape, target-side).
