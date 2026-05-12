## ADR-0059: `modifyBucketCapacity` hook for equipment-driven R/S/M cap shifts

**Status:** Accepted
**Date:** 2026-05-12

## Context

Session 28 lands the engine prep for the equipment-doc items that shift R/S/M bucket capacity:

- **Steel Helm** (Knight headgear) — `+1 Reaction-bucket capacity`
- **Augmentor** (universal accessory) — `+1 Support-bucket capacity`
- **Magus Crown** (Mage headgear) — `+1 First-Action-bucket capacity` (enables a second secondary command set per the equipment doc)

The audit (item 1) called out two options:

1. **Dedicated `modifyBucketCapacity` hook** — additive integer chain, args `{ unit, bucket, baseCapacity }`. Adds one new entry on the closed hook list (per CLAUDE ground rule 8).

2. **Extend `modifyStatQuery`** — register `bucket_capacity_reaction`, `bucket_capacity_support`, etc. as `StatName` entries. Keeps the hook surface closed but pollutes the stat namespace with non-stats.

`getCapacity` currently returns `ruleset.bucketCapacities.get(bucketId)` directly with a vestigial `void getUnit(state, unitId)` line waiting for hook integration. The author's TODO comment explicitly flags this gap: "equipment, status, and class traits with '+1 Active capacity' or '-2 Reaction capacity' effects compose at query time when their hook surfaces land."

## Decision

**Add `modifyBucketCapacity` to the closed hook list with args `{ unit, bucket, baseCapacity }`, additive value-passing chain. Equipment contributors read a new optional `bucketCapacityMods?: ReadonlyMap<BucketId, number>` field on `EquipmentBase`, emitting one handler per `(bucket, delta)` entry that gates on `args.bucket`. `getCapacity` routes the ruleset baseline through `runModifyBucketCapacity` and floors the final value at 0.**

Handler shape: `(args) => args.bucket === localBucket ? args.baseCapacity + localDelta : args.baseCapacity`.

Composition: additive within the Equipment tier (`+1 + +1 = +2`). The runner returns the raw chain product; the floor at 0 lives in `getCapacity` so callers that want the raw value (forecast tooling, AI introspection) can read it via the runner directly.

## Rationale

**Dedicated hook over `modifyStatQuery` extension.** Bucket capacity is structurally different from stats: it's a per-bucket integer with three discrete values today (reaction, support, movement, plus first/second action), not a single scalar like `pa` / `ma` / `maxHp`. Folding it into `modifyStatQuery` would expand the `StatName` union to include `bucket_capacity_reaction`, `bucket_capacity_support`, etc., conflating "computed stat" with "computed capacity." The dedicated hook keeps the stat namespace clean and gives the runner a natural per-bucket args slot. Audit Item 1 recommended the dedicated hook for the same reason.

**Additive chain.** Bucket capacity is integer-valued; `+1` reads naturally as "one more slot." Multiplicative composition would force authors to write `× 1.333` for "+1 to a 3-cap bucket," which is brittle to baseline changes (a future v2 ruleset bumping the baseline to 4 would silently rebalance every multiplier). Additive composition matches the integer semantics; the floor at 0 catches author errors (`-10` on a 3-cap baseline produces 0, not negative capacity).

**Per-call `args.bucket`.** The audit considered two args shapes: per-bucket via `{ unit, bucket }` or per-call returning a `Map<BucketId, number>`. Per-call args win for hook-runner uniformity — every other modifier hook takes a single args object and returns a scalar; a map-returning runner would be a one-off. Per-call also means the contributor's handler can short-circuit cheaply (`if (args.bucket !== 'reaction') return args.baseCapacity`) without computing values for buckets the caller doesn't need.

**`bucketCapacityMods?: ReadonlyMap<BucketId, number>` on `EquipmentBase`.** Map-keyed by `BucketId` (the closed enum from `engine/abilities/constants.ts`) for type-system enforcement: a typo in the bucket id is a compile-time error. The map shape covers single-bucket items (Steel Helm `{ reaction: 1 }`) and hypothetical multi-bucket items in one shape; no v1 item declares multiple entries, but the field doesn't grow when one does.

**Floor at 0 inside `getCapacity`, not the runner.** Separates the chain's mathematical output from the consumer's safety guard. A forecast UI rendering "this Knight has -1 reaction capacity from <equipment>" might want to display the raw value as a flag; floor-in-consumer keeps that option open. The runner's job is composition; the helper's job is producing a usable capacity.

**`Math.floor` after the additive sum.** Integer-valued capacity; floor handles any fractional artifacts from fractional deltas (no v1 author would write `+1.5 reaction`, but the floor catches it). Compatible with the additive semantics — every integer delta produces an integer result.

## Consequences

- **`HookSignatures` gains one entry.** `modifyBucketCapacity` with `{ unit, bucket, baseCapacity }` args, `number` return. Per CLAUDE ground rule 8: the hook list grows by one deliberate entry.

- **`runners.ts` adds `runModifyBucketCapacity`.** Standard additive chain shape mirroring `runModifyResistance` and the other additive runners.

- **`EQUIPMENT_CONTRIBUTORS` gains the `modifyBucketCapacity` entry.** Contributor function `bucketCapacityContributor` walks `iterateEquippedItems`, yields per-bucket handlers. No v1 item declares `bucketCapacityMods`; Session 29 (Steel Helm / Augmentor / Magus Crown) provides first consumers.

- **`getCapacity` routes through the chain.** Previously a near-pure ruleset lookup; now a per-unit composition. The `void getUnit(state, unitId)` placeholder line is replaced with a real unit read that feeds the runner.

- **No regression risk for v1 content.** No current item declares `bucketCapacityMods`; every existing test that calls `getCapacity` still returns the ruleset baseline. Verified by 745+ pre-Session-28 tests continuing to pass post-implementation.

- **Test coverage in `session-28-integration.test.ts`.** Six tests: empty chain returns baseline; Steel Helm headgear adds +1 reaction only; Augmentor accessory adds +1 support without touching other buckets; multiple items summing additively; negative deltas floor at 0 in `getCapacity`; the runner returns raw chain product without flooring.

- **Future content composes cleanly.** A "Master Pendant" granting `+1` to both reaction and support is one item with a two-entry map. A class-trait passive could register a `modifyBucketCapacity` handler the same way; the hook is source-agnostic per the existing collector pattern.

## Alternatives considered

**Map-returning runner.** `runModifyBucketCapacity(state, catalog, unit) → ReadonlyMap<BucketId, number>` aggregating all buckets in one call. Rejected — diverges from every other modifier hook's "scalar args, scalar return" shape. `getCapacity` queries one bucket at a time; aggregating all of them would compute values the consumer doesn't need.

**`bucketCapacityMods?: Partial<Record<BucketId, number>>` (object instead of Map).** Considered — slightly nicer authoring (`{ reaction: 1 }` reads as a plain object). Rejected because `BucketId` is a branded string type (`bucketId('reaction')`), and `Record<BucketId, number>` requires explicit branding at every key. The Map shape works around this with `new Map([[bucketId('reaction'), 1]])` — uglier but type-safe.

**Bucket capacity through the existing `modifyStatQuery` with per-bucket StatName entries.** Rejected per the dedicated-hook discussion above.

**No floor in `getCapacity`; let negative values propagate.** Rejected — `validateLoadout` calls `getCapacity` and compares against bucket-total cost; a negative cap would cause the comparison `sum > -1` to pass when summing 0 abilities, then fail when summing 1, producing surprising behavior. The floor at 0 is the fail-safe.

## References

- `src/engine/hooks/hooks.ts` — `HookSignatures.modifyBucketCapacity`.
- `src/engine/hooks/runners.ts` — `runModifyBucketCapacity`.
- `src/engine/items/contributions.ts` — `bucketCapacityContributor` + `EQUIPMENT_CONTRIBUTORS` entry.
- `src/engine/catalog/definitions/item-definition.ts` — `bucketCapacityMods` field on `EquipmentBase`.
- `src/engine/abilities/capacity.ts` — `getCapacity` chain integration + floor.
- `src/engine/actions/session-28-integration.test.ts` — composition tests.
- ADR-0007 / ADR-0008 — bucket capacity baseline.
- ADR-0028 — equipment integration shape.
- ADR-0056 — equipment contributor registration pattern.
- ADR-0058 — `maxMp` introduction (Session 28 sibling).
- ADR-0060 — `modifyStatusTickAmount` (Session 28 sibling).
