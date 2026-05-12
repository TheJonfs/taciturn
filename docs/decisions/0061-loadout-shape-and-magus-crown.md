## ADR-0061: Loadout shape — list-valued active buckets, `secondary_command_sets` rename, Magus Crown enabling

**Status:** Accepted
**Date:** 2026-05-12

## Context

Magus Crown ("Mage-only headgear; +1 Action capacity allows equipping two secondary action command sets") is the Session 29 fold-in that surfaced a latent shape mismatch in `Loadout`. Pre-Session-29 the shape was:

```ts
actionBuckets: Readonly<Record<BucketId, CommandSetId | null>>
```

Each active bucket (`first_action`, `second_action`) held one CommandSetId. The default ruleset's `bucketCapacities` defined capacity 1 for both. ADR-0059's `modifyBucketCapacity` hook could lift those caps to 2+, but the storage shape — single-CommandSetId-per-bucket — couldn't represent the second set.

Three implementation questions had to settle:

1. **Storage shape.** Two reasonable refits:
   - **Bilateral list shape** — `actionBuckets: Record<BucketId, ReadonlyArray<CommandSetId>>`. Both `first_action` and `secondary_command_sets` hold lists; `first_action` always length ≤ 1 (capacity 1, pin-checked). Mirrors how passive buckets work.
   - **Asymmetric** — keep `first_action` as `CommandSetId | null` (single), make only the secondary bucket a list. Smaller blast radius but lives with the inconsistency between the two active buckets.

2. **Bucket rename.** The conceptual name "secondary command sets" matches the equipment doc's language but pre-Session-29 the bucket id was `'second_action'` (consistent with `first_action`). Either keep `'second_action'` (less churn) or rename to `'secondary_command_sets'` (clearer intent).

3. **Cost-vs-capacity gating.** `CommandSetDefinition.baseCost` already existed (default 1). The validator's existing cost-summing for active buckets read a single CommandSetId; the list shape needs an iteration.

## Decision

**Bilateral list shape; rename `'second_action'` → `'secondary_command_sets'`; validator sums per-bucket cost and gates against `getCapacity`.**

- `Loadout.actionBuckets: Readonly<Record<BucketId, ReadonlyArray<CommandSetId>>>`. Empty list means "nothing equipped." `first_action` carries exactly one entry (capacity 1, pinned to `classDef.firstActionCommandSet`).
- `BUCKET_SECONDARY_COMMAND_SETS = bucketId('secondary_command_sets')` (renamed from `BUCKET_SECOND_ACTION`). Default ruleset's `bucketCapacities` entry uses the new bucket id with capacity 1.
- `validateLoadout`'s active-bucket loop now iterates the list, sums `getCommandSetCost(unit, csId)` per entry, and compares the total against `getCapacity(unit, bucketId)`. First-action pin still verifies `firstActionList.length === 1 && firstActionList[0] === classDef.firstActionCommandSet`.
- `setActiveBucket(unitId, bucketId, commandSetId | null)` — v1 mutators stay single-set-per-call; the array shape is expressed at loadout-authoring time. Multi-set composition (needed when team-builder UI lands in Session 36) gets its own helpers then.
- Magus Crown is authored with `bucketCapacityMods: new Map([[bucketId('secondary_command_sets'), 1]])`. Wearer's secondary capacity lifts from 1 to 2; the validator accepts two CommandSetIds in that bucket.

## Rationale

**Bilateral list over asymmetric.** Uniformity reduces special-casing across consumers. The action menu's Act picker, the AI's enumeration, and the validator's per-bucket loop all now treat both active buckets identically — `for (const csId of entries)`. The cost of unification is a one-time refit of fixtures (a dozen test files); the cost of asymmetry would be every consumer remembering "first_action is single, secondary is list" forever. Passive buckets already use list shape; the two active buckets matching that pattern keeps the loadout uniform.

**Rename to `'secondary_command_sets'`** (per Chris's session-start call). The pre-Session-29 name `'second_action'` carried a misleading specificity — it implied "the second of two actions per turn," when the engine reality is "a bucket of command sets beyond first_action, capacity-gated." With Magus Crown lifting capacity to 2, the bucket can hold *multiple* secondary sets — `second_action` would have to be re-read as "the secondary-command-sets bucket" anyway. Renaming it now (vs. carrying a misnamed bucket through Sessions 30+) is the cheaper time to absorb the churn.

A future polish pass will surface the display name (the bucket's player-facing label is still TBD; the engine id is internal). Tracked in handoff as a Session 29 carry-forward.

**`first_action` stays capacity-1, pin-checked.** No content asks for a multi-set first_action — class-pinning the first active bucket is part of the v1 design (Knight = battle_skill, Earth Mage = earth_spells, etc.). The list shape's pin check verifies "exactly one entry, equals the class pin." Future content can lift this if needed; not in scope.

**`CommandSetDefinition.baseCost` already exists.** No new field — the audit revealed the cost field shipped in an earlier session (default 1 per v1 convention; future premium command sets may price higher). The validator's per-entry cost summing routes through the existing `getCommandSetCost` helper.

**Mutator API stays single-set.** `setActiveBucket(unitId, bucketId, commandSetId | null)` wraps the input in a length-1 list (or empty when null). Multi-set add/remove operations belong to the future team-builder UI (Session 36); the engine surface here is "replace the bucket's contents wholesale" which the demo-time authoring shape already exercises.

## Consequences

- **`Loadout.actionBuckets` type changes.** Every test fixture and demo battle that constructed action buckets needs the list shape. Updated this session: 12+ test files plus the demo battle loadouts. Behavior-preserving — mages' existing `white_magic` in `second_action` now reads as `[white_magic]` in `secondary_command_sets`.

- **`BUCKET_SECOND_ACTION` constant renamed to `BUCKET_SECONDARY_COMMAND_SETS`.** All consumers updated; the public engine barrel re-exports the new name. The bucket-id string also changed (`'second_action'` → `'secondary_command_sets'`); test files using the literal string were updated.

- **No behavior change for v1 demo.** Mages still have one secondary command set (white_magic). Knight still has zero. Capacity remains 1. The shape is wider but the content is unchanged.

- **Magus Crown unlocked.** With the bucket capacity hook (ADR-0059) and the list shape, Magus Crown is fully functional: wearing it lifts secondary capacity to 2, and the validator accepts two CommandSetIds in that bucket. The content authoring is mechanical.

- **AI / UI / validator all see lists.** AI's `enumerateActiveAbilities` flattens across buckets; UI's `activeCommandSets` iterates per-bucket; validator's `validateLoadout` sums costs. Each was a single-site update.

- **Future cost-2 command sets compose naturally.** A hypothetical "Master Magic" command set with `baseCost: 2` fits in a 2-capacity secondary bucket alone, or doesn't fit at all without a capacity bump. The cost-vs-capacity gating is content-agnostic.

## Alternatives considered

**Asymmetric shape (keep first_action as `CommandSetId | null`, only secondary as list).** Rejected per the rationale above — the consistency benefit beats the smaller refit.

**Keep the bucket id `'second_action'` and only change the conceptual name.** Considered, but the misnaming would persist in code forever; the rename is cheaper now than letting future readers wonder why a "second_action" bucket holds N command sets.

**Per-bucket loadout-field rename (introduce `secondaryCommandSets: ReadonlyArray<CommandSetId>` as a sibling of `actionBuckets`).** Rejected — the Record-of-BucketId pattern is the v1 idiom; introducing per-field aliases would multiply the surface and break the "buckets are uniform" invariant.

**Mutator API that accepts list directly (`setActiveBucket(unit, bucket, csIds: ReadonlyArray<CommandSetId>)`).** Considered for forward-compat with team builder. Rejected for v1 — no current consumer needs it, and the single-set helper is the simpler mutation surface for the action-menu commit path. Team builder gets bespoke helpers when it ships.

## References

- `src/engine/types/loadout.ts` — `Loadout.actionBuckets` shape change.
- `src/engine/abilities/constants.ts` — `BUCKET_SECONDARY_COMMAND_SETS` rename + literal `'secondary_command_sets'`.
- `src/engine/abilities/validate.ts` — per-entry cost summing + first_action pin check.
- `src/engine/abilities/equip.ts` — `setActiveBucket` wraps single-set in list.
- `src/content/rulesets/default.ts` — capacity entry under the new bucket id.
- `src/content/battles/demo.ts` — list-shaped loadouts.
- `src/content/items/magus-crown.ts` — `bucketCapacityMods` against the new bucket id.
- `src/engine/actions/session-29-integration.test.ts` — Magus Crown enabling, validator pin / capacity tests.
- ADR-0007 — bucket model.
- ADR-0028 — equipment integration.
- ADR-0059 — `modifyBucketCapacity` hook.
