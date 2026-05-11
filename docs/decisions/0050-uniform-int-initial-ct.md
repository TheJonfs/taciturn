# ADR-0050: `uniform_int` initial-CT variant + test-ruleset preservation

**Date:** 2026-05-11
**Session:** 25
**Status:** Accepted

## Context

Per audit Item 13 and the Mage War content spec: the v1 default
ruleset should produce a small starting-tempo wobble at battle
start so two openings of the same battle feel different without
unbalancing the action queue. Pre-session-25 default was
`initialCT: { kind: 'fixed', value: 0 }` — every unit starts at CT 0,
ordering strictly by Speed.

The existing `speed_with_variance` variant scales the base value with
Speed, which conflates two things the spec wants separate: starting
tempo and class identity. The spec asks for "uniform integer [0, 20]
per unit, independent of Speed."

## Decision

1. **New `uniform_int` variant.** `RulesetInitialCT` gains a third
   discriminant:
   ```ts
   { readonly kind: 'uniform_int'; readonly min: number; readonly max: number }
   ```
   Resolver clause hashes `(masterSeed, placement.id)` via the existing
   `unitFloatFromKey` helper, scales to the `[min, max]` integer range
   inclusive, and clamps defensively to `[0, TRIGGER_THRESHOLD - 1]`
   so authoring a `max >= 100` doesn't pre-trigger a unit.

2. **Default ruleset switches** to `{ kind: 'uniform_int', min: 0, max: 20 }`.
   Existing variants (`fixed`, `speed_with_variance`) are preserved
   for tests and future tournament rulesets.

3. **Test-ruleset preservation: inline overlay (option a).** The
   AI-vs-greedy integration test
   (`src/app/controllers/ai-controller.integration.test.ts`) is
   calibrated to a specific tempo through its win-rate parity
   assertion. To preserve that calibration:

   - `src/content/index.ts` now re-exports the per-kind content arrays
     (`abilities`, `classes`, `commandSets`, `items`, `rulesets`,
     `statusTypes`) alongside `loadDefaultCatalog`.
   - The integration test builds a one-off catalog with the default
     ruleset's `initialCT` overridden to `{ kind: 'fixed', value: 0 }`:
     ```ts
     createCatalog({
       statusTypes, abilities, commandSets, classes, items,
       rulesets: [{ ...defaultRuleset, initialCT: { kind: 'fixed', value: 0 } }],
     })
     ```

   No exported helper (`loadDefaultCatalog({ rulesetOverride })`) — one
   calibration-sensitive consumer, inline overlay is cleaner than
   API expansion.

   - `src/app/demo/orchestrator.test.ts` runs unmodified; its
     termination-in-500-steps assertion is robust to the
     `uniform_int [0, 20]` shift. If a future change breaks the
     bound, apply the same overlay.

4. **Engine-test ruleset (`engine/catalog/test-fixtures.ts`) is
   unchanged.** It already pins `initialCT: { kind: 'fixed', value: 0 }`,
   so the ~30 integration tests that build state via
   `makeGameState`/`makeUnit` keep their deterministic CT-0 starts
   without any change.

## Rejected alternatives

- **`loadDefaultCatalog(opts)` API expansion.** Adds a public
  parameter for what's effectively a one-call-site need. Inline
  overlay keeps the public surface tight; the per-kind re-exports are
  already a meaningful API addition.
- **Per-placement `initialCT: 0` on every demo unit.** Verbose
  (six placements × two battles); also doesn't isolate the test from
  the ruleset's intent.
- **Sampling the variance through a Box-Muller or other floating-point
  hash.** Overkill for a 20-value integer range; `unitFloatFromKey ×
  span` is faithful and reproducible.

## Consequences

- Default battles now have a small but real starting-tempo wobble.
  Verified in preview: demo battle starts with units at distinct CTs
  in [0, 20] (e.g., 18, 14, 4, 10, 19, 0 for one seed).
- AI-vs-greedy integration test runs against a CT-0 catalog; the
  win-rate parity assertion stays calibrated.
- A future tournament ruleset can declare its own `uniform_int` range
  or revert to `fixed`/`speed_with_variance` per design intent.

## References

- [`src/engine/types/ruleset.ts`](../../src/engine/types/ruleset.ts) (`RulesetInitialCT`)
- [`src/engine/setup/create-initial-state.ts`](../../src/engine/setup/create-initial-state.ts) (`resolveInitialCT`)
- [`src/content/rulesets/default.ts`](../../src/content/rulesets/default.ts)
- [`src/app/controllers/ai-controller.integration.test.ts`](../../src/app/controllers/ai-controller.integration.test.ts) (`calibrationCatalog`)
- `docs/audits/post-20-engine-audit.md` (Item 13)
