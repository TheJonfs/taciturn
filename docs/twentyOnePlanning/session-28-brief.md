# Session 28 Brief: Cluster 4 — Structural (maxMp, Bucket Capacity, Status Tickdown) + Compression Carry-ins

## Context

Phase C engine substrate continues. Session 27 landed the four Cluster 3 hook surfaces, the equipment contributor refactor, and resistance absorption activation. The substrate accumulated over Sessions 25-27 (availability tags, deploymentZone, uniform_int initial CT, modifyMpCost / modifyActionSpeed / modifyResistance / modifyIncomingStatusApplicationChance + contributor map) is now ready for content; Session 29 ships the bulk equipment authoring against it.

This session lands the remaining structural pieces before equipment authoring opens up. Three Cluster 4 items: **`maxMp` introduction as a stat**, **`modifyBucketCapacity` hook**, and **`modifyStatusTickAmount` hook**. Plus three carry-ins: portrait + terrain asset compression (recipe known from Session 26), and a small action-menu UI fix to suppress 0-MP cost displays.

**`maxMp` is the time-dominator.** Per the Session 27 handoff's suggested scope, it touches placement, `fillVitalsFromComputedMaxes`, the AI's projection surface, the renderer's MP cap (currently captured at mount), and the per-class baselines. Plan ~30 minutes of buffer for retrofit work. The other two hooks are independently small.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 27 handoff. Note especially: contributor map shape (ADR-0056), absorption activation (ADR-0057), `actorHasDamageFollowUp` dead-code cleanup candidate.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 28 entry; Session 29 entry for what consumes the substrate landing here.
4. **`docs/audits/post-20-engine-audit.md`** — Items 1 (`modifyBucketCapacity`), 6 (`maxMp` introduction), 8 (`modifyStatusTickAmount`). Each item has the implementation sketch this session realizes.
5. **`docs/twentyOnePlanning/mage-war-content-spec.md`** — `maxMp` baselines per class (Knight 20, Mages 60).
6. **`docs/twentyOnePlanning/mage-war-equipment.md`** — items that will consume the new hooks in Session 29 (Augmentor, Steel Helm, Magus Crown, Wizard's Robe, Sorcerer's Robe, Silvered Vest, Purifier, Staff of Abundance).
7. **`docs/decisions/0056-...`** (contributor map pattern) — reference for how the two new hook contributor entries plug in.

### Pre-settled design decision: Burn × Purifier interaction

Surfaced and settled in conversation back when Cluster 4 was first sketched. The decision: **Purifier doubling Burn's tick rate effectively doubles per-stack drain damage** (front-loaded damage profile, same total damage per stack but stacks deplete twice as fast). Net positive for the wearer because total Burn damage is reduced. The implementer should bake this into the `modifyStatusTickAmount` design without re-deriving — it's a settled call, captured in the Session 21 brief's design-decisions-captured section.

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/engine/stats/` (or wherever `BaseStats` lives) — for the `maxMpBase` field addition and `STAT_MOD_KEYS` extension
- `src/content/classes/` — for per-class `maxMpBase` population (Knight 20, Mages 60)
- `src/engine/state.ts` or initial-state-creation — for `fillVitalsFromComputedMaxes` integration
- `src/engine/items/contributions.ts` — for two new contributor entries (`modifyBucketCapacity`, `modifyStatusTickAmount`)
- `src/engine/hooks/types.ts`, `src/engine/hooks/runners.ts` — for the two new hook definitions and runners
- `src/engine/status/` — for `reduceStatusTick` and the tick-rate consumer integration
- `src/engine/abilities/` — for bucket-capacity consumers (R/S/M placement validation, team-builder forecasting)
- `src/renderer/unit-layer.ts` — for the MP "max" lift from mount-captured to per-frame query
- `src/renderer/battle-renderer.ts` — for any MP-related state subscription if mount-captured is replaced
- `src/ai/projection.ts` — for AI's MP queried surface (needs `maxMp` added)
- `src/ai/basic.ts` — for any AI MP-cap reads that go through projection
- `src/ui/action-menu.tsx` — for the 0-MP suppression in `AbilityButton`
- `src/assets/portraits/` and `src/assets/terrain/` — for compression targets (verify file inventory)

The plan articulates what exists, what's being refit, what's being added.

## Goal

End state:

- **`maxMp` is a stat.** New `maxMpBase` field on `BaseStats`; derived `maxMp` queryable via `runModifyStatQuery`. Per-class baselines populated (Knight 20, Mages 60). `STAT_MOD_KEYS` extends to include `maxMp`. `vitals.mp` continues to override per-placement; absent cases filled from computed max via `fillVitalsFromComputedMaxes`. New optional `statModsMultiplicative?: Partial<Record<StatName, number>>` field on `ItemDefinition` for Staff of Abundance-style multiplicative shifts (e.g., 1.5× maxMp).
- **`modifyBucketCapacity` hook landed.** Args `{ unit, bucket }`, additive chain. Equipment contributor map entry. Per-bucket — abilities R, S, M each have their own composition. Consumed by `validateEquipmentPlacement` and any future team-builder bucket validation.
- **`modifyStatusTickAmount` hook landed.** Args `{ unit, statusTypeId, statusTags, baseAmount }`, additive chain. Equipment contributor map entry. `reduceStatusTick` reads chain product. Burn × Purifier interaction per the pre-settled design (front-loaded damage; per-stack drain doubles).
- **Renderer's MP "max" reads through `runModifyStatQuery`** rather than mount-captured value. The Session 22 carry-forward lifts.
- **AI projection includes `maxMp`** so MP-cap-aware AI decisions correctly compose with future equipment that modifies `maxMp`.
- **Action menu suppresses 0-MP cost display** for abilities with zero MP cost (Attack being the principal v1 case). General rule preferred over Attack-specific suppression.
- **Asset compression carry-ins:**
  - Portraits: all five class portraits → 512×512, `sips -z 512 512` + `pngquant --quality=75-90`. Target ~150-250 KB each, ~1 MB total.
  - Terrain: any newly-added terrain source files → 256×256 (same as grass-01), same compression pipeline.

Tests at 747+, 0 failing. New tests for `maxMp` stat composition, two new hook surfaces, action menu zero-suppression.

## Pre-implementation plan (required)

Same discipline as previous sessions. Current-tree audit first; architectural decisions surfaced before code.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it. Particularly important for `maxMp` — the retrofit work depends on accurate inventory of all current MP consumers.

### Architectural decisions

After the audit:

1. **`maxMp` introduction approach.** The audit identifies the cleanest integration point — likely `BaseStats` gets a new `maxMpBase: number` field, `STAT_MOD_KEYS` extends to include `maxMp` (so passives/equipment can modify), and a derived `maxMp` is queried via `runModifyStatQuery('maxMp')`. State:
   - Exact field shape on `BaseStats`
   - Per-class default values (Knight 20, Mages 60 per spec)
   - How `fillVitalsFromComputedMaxes` handles the absent-vitals.mp case (defaults to maxMp at battle start)
   - Whether equipment-side `statModsMultiplicative` is a new field on `ItemDefinition` or extends an existing one
   - The retrofit list — every place that currently reads MP cap (renderer, AI, validator, forecast)

2. **`modifyBucketCapacity` composition.** Additive chain per audit. Per-bucket — each of R, S, M has its own composition. State whether the hook args include the bucket identifier or the contributor returns a per-bucket map. The audit suggests `{ unit, bucket }` per-call; cleaner than per-bucket-map returns.

3. **`modifyStatusTickAmount` composition.** Additive chain. Args `{ unit, statusTypeId, statusTags, baseAmount }`. Composes with `reduceStatusTick`'s base amount. Burn × Purifier per pre-settled design — Purifier returns `+1` (or `×2`, depending on chain semantics) for negative-tagged statuses, baseAmount of 1 becomes 2, Burn's per-stack drain doubles. State whether the chain semantics is additive-delta or multiplicative-factor; spec implies additive but the Purifier example may suggest otherwise. Per the design decision: front-loaded damage is the intent, doubled per-stack drain is the mechanism. Either chain shape can produce that outcome; pick the cleaner one and document.

4. **Renderer MP "max" lift.** Currently captured at mount as `vitals.mp`. Replace with per-frame query via `runModifyStatQuery('maxMp')`, OR per-state-change subscription, OR per-render lookup. State the integration approach. Per-frame query is simplest but may have performance implications at 60fps; per-state-change subscription is cleanest but adds plumbing. Audit reveals which path the existing HP-bar pattern uses (HP bar correctly reads through queryable max — likely the same pattern works for MP).

5. **AI projection `maxMp` integration.** Add `maxMp` to the AI's projection surface so `canAfford`-style checks correctly compose with `maxMp` modifications from equipment. State the specific projection.ts entry points that need extension.

6. **Action menu 0-MP suppression.** General rule preferred over Attack-specific. State whether the suppression is "if `mpCost === 0`, omit the MP label entirely" or "if `mpCost === 0`, show 'Free' or similar." My lean is "omit entirely — the absence of a cost label communicates free-ness." Implementer's call after audit reveals the `AbilityButton` subline structure.

7. **`fillVitalsFromComputedMaxes` integration.** When does this run — at battle start in `createInitialState`, or lazily on placement? State the integration. If per-placement, the resolver needs catalog access to compute maxMp from passives + equipment.

8. **Compression workflow.** Independent of code work. State whether the compression runs in-session (implementer invokes `sips` + `pngquant` against the source files) or via a checked-in script. Per Session 26's pattern, in-session invocation is fine. Source files exist alongside the compressed outputs; the implementer compresses to target sizes (portraits 512×512, terrain 256×256) and updates the asset manifest if needed (probably not needed — same filenames, smaller bytes).

9. **Test strategy.** `maxMp` stat composition tests (with passive and equipment modifications), per-class baseline verification, vitals.mp absent-case fallback. `modifyBucketCapacity` composition tests. `modifyStatusTickAmount` composition tests including the Burn × Purifier scenario (synthetic since Purifier doesn't ship until Session 29). Action menu 0-MP suppression: small snapshot test. Compression: no tests (asset-level work).

10. **Order of work.** `maxMp` first (largest retrofit surface; landing it first means subsequent items integrate against the final shape). Then `modifyBucketCapacity` and `modifyStatusTickAmount` in either order (independent). Renderer MP lift slots in alongside `maxMp`. AI projection alongside `maxMp`. Action menu 0-MP and compression can land at any point — independent of structural work.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land in roughly this order. Bigger / more invasive work first; small carry-ins absorbed where convenient.

### Item 1: `maxMp` introduction

- `maxMpBase` field on `BaseStats`
- `STAT_MOD_KEYS` extends to include `maxMp`
- Per-class baselines populated (Knight 20, Mages 60)
- `vitals.mp` absent-case fill via `fillVitalsFromComputedMaxes` reads computed `maxMp`
- New `statModsMultiplicative?: Partial<Record<StatName, number>>` field on `ItemDefinition` (for Staff of Abundance-style 1.5× maxMp)
- All current MP-cap consumers retrofit to read via `runModifyStatQuery('maxMp')`:
  - Renderer (MP bar max)
  - AI (canAfford projection)
  - Validator
  - Forecast (if any reads cap)

### Item 2: `modifyBucketCapacity` hook

- Hook type, runner, equipment contributor map entry
- Args `{ unit, bucket }`, additive chain
- Consumed by `validateEquipmentPlacement`
- No current content uses it; Session 29 (Steel Helm, Augmentor, Magus Crown) provides first consumers

### Item 3: `modifyStatusTickAmount` hook

- Hook type, runner, equipment contributor map entry
- Args `{ unit, statusTypeId, statusTags, baseAmount }`, additive chain
- `reduceStatusTick` reads chain product
- Burn × Purifier: implements the pre-settled design (Purifier doubles Burn's per-stack drain, front-loaded damage profile)
- No current content uses it; Session 29 (Purifier) provides first consumer

### Item 4: Renderer MP "max" lift

- Renderer MP bar max reads through `runModifyStatQuery('maxMp')` rather than mount-captured
- Closes the Session 22 carry-forward

### Item 5: AI projection `maxMp` integration

- AI's projection surface includes `maxMp`
- `canAfford` and similar MP-cap-aware AI checks compose correctly with equipment modifications

### Item 6: Action menu 0-MP suppression

- General rule: `mpCost === 0` → omit MP display entirely
- `AbilityButton` in `action-menu.tsx`
- Implementer settles the exact rendering during plan; the audit-time call is whether a fully-general rule introduces edge cases (e.g., is there ever an ability with MP cost displayed where you'd want "Free" instead of omission?). My read: omission is correct for v1.

### Item 7: Portrait compression

- `sips -z 512 512` + `pngquant --quality=75-90` applied to each of the 5 class portraits
- Target ~150-250 KB each (~1 MB total, down from ~20 MB)
- Output replaces existing portrait files; loader machinery unchanged
- Verify all 5 portraits still load and render correctly post-compression

### Item 8: Terrain compression

- Same recipe (`sips -z 256 256` + `pngquant --quality=75-90`) applied to any newly-added terrain source files Chris has added to the project
- Output replaces source files; manifest updates only if filenames change (unlikely)

## Acceptance criteria

- `maxMp` queryable via `runModifyStatQuery`; per-class baselines correct (Knight 20, Mages 60).
- All current MP-cap consumers (renderer, AI, validator, forecast) route through `runModifyStatQuery('maxMp')`; no mount-captured values remain.
- `modifyBucketCapacity` hook defined, runner implemented, contributor entry registered, additive chain composes correctly.
- `modifyStatusTickAmount` hook defined, runner implemented, contributor entry registered, composition produces the Burn × Purifier outcome (per-stack drain doubles, total damage same).
- Renderer MP bar correctly reflects `maxMp` changes (synthetic test or planned playtest scenario).
- AI's MP-cap-aware decisions correctly compose with `maxMp` modifications.
- Action menu's `AbilityButton` does not display MP cost line when `mpCost === 0` (Attack in particular).
- Portrait files compressed to 512×512 per recipe; total payload ~1 MB.
- Terrain files compressed per recipe.
- Tests at 747+, 0 failing. New tests cover `maxMp` stat composition, two new hook chains, Burn × Purifier scenario, action-menu 0-MP suppression.
- ADRs written for: `maxMp` introduction (substantive stat-layer change); possibly `modifyStatusTickAmount` if the Burn × Purifier semantics warrant their own ADR. Other ADRs at implementer's discretion.
- `docs/handoff.md` updated.

## Out of scope

- **All Phase C content authoring** (equipment items that consume the new hooks). Session 29 onward.
- **Cluster 5 procs/drains.** Session 30.
- **`onTurnStart` symmetric widening** (Session 26 carry-forward). Defer until first emitting consumer.
- **Action menu MP / action-speed display threading** (Session 27 carry-forward). Lifts in Session 29 when items produce divergence.
- **`actorHasDamageFollowUp` dead code cleanup** (Session 27 carry-forward). Optional; can be folded in if the implementer is touching `basic.ts` anyway for the AI projection work, but not required.
- **River Ridge / elevation testing for Bedrock Stride.** Session 33.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

- `src/engine/stats/` (or `BaseStats` definition) — `maxMpBase` field; `STAT_MOD_KEYS` extension
- `src/content/classes/knight.ts`, `earth-mage.ts`, `water-mage.ts`, `fire-mage.ts`, `lightning-mage.ts` — per-class `maxMpBase`
- `src/engine/state.ts` (or initial-state) — `fillVitalsFromComputedMaxes` integration
- `src/engine/items/contributions.ts` — two new contributor entries
- `src/engine/hooks/types.ts` — two new hook type definitions
- `src/engine/hooks/runners.ts` — two new runners
- `src/engine/status/` — `reduceStatusTick` chain consumer
- `src/engine/abilities/` (or wherever bucket validation lives) — bucket-capacity consumer
- `src/renderer/unit-layer.ts` — MP cap lift to runtime query
- `src/renderer/battle-renderer.ts` — possibly state-subscription wiring if needed
- `src/ai/projection.ts` — `maxMp` added to projection surface
- `src/ai/basic.ts` — possibly retrofit any direct MP-cap reads
- `src/engine/forecast/` — any MP-related forecast reads
- `src/ui/action-menu.tsx` — `AbilityButton` 0-MP suppression
- `src/assets/portraits/*.png` — replaced with 512×512 compressed versions
- `src/assets/terrain/*.png` — newly-added files compressed
- New tests
- New ADRs in `docs/decisions/`
- `docs/handoff.md` — updated

## Workflow notes

- **Plaintext-first review required.** Same discipline as previous sessions.
- **Audit-first within the plan.** Particularly important for `maxMp` — accurate inventory of all current MP consumers is what determines retrofit scope.
- **ADR path is `docs/decisions/`** (Session 26 path correction).
- **`maxMp` first, then everything else.** Doing the structural work first means subsequent items integrate against the final shape rather than retrofitting once `maxMp` lands.
- **Compression work is non-overlapping** with structural code work. Reasonable to handle during natural pause points rather than as a discrete item.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: `statModsMultiplicative` placement on `ItemDefinition` (extension of existing or fully new field); `modifyStatusTickAmount` chain semantics (additive delta vs multiplicative factor — both can produce the Burn × Purifier outcome; pick the cleaner one).
- **The integration test calibrated to `demoBattle`'s 6×6 board** stays calibrated. `maxMp` introduction shouldn't perturb anything for v1 content (no existing item modifies maxMp), but the retrofit work is the place where subtle regressions can sneak in.

## Watch-fors

**Addressed this session:**
- `maxMp` introduction (audit Item 6)
- `modifyBucketCapacity` hook (audit Item 1)
- `modifyStatusTickAmount` hook (audit Item 8)
- Renderer MP "max" mount-captured fix (Session 22 carry-forward)
- AI projection `maxMp` integration
- Action menu 0-MP suppression
- Portrait compression (carry-forward from 24.5 onward, now scoped to 512×512)
- Terrain asset compression (new in this session — applies to Chris's newly-added terrain files)

**Not addressed this session, longer-term carry-forward:**
- Action menu MP / action-speed display threading (Session 27 carry; Session 29 lifts when items produce divergence)
- `actorHasDamageFollowUp` dead-code cleanup (Session 27 carry; optional)
- AI active absorption exploitation (Session 27 carry; tactics-layer design pass)
- `onTurnStart` symmetric widening (Session 26 carry)
- Status-badge polarity convention (Session 22 carry)
- rAF vs setInterval for animation drain (Session 23 carry)
- AoE preview correctness across all shapes (Session 23 carry; sessions 26, 26.5, 27 confirmed shape-agnostic)
- MP / status snapshot ahead-of-tween fix (Session 22 carry)
- `pa_factor` NotYetImplementedError (audit E3)
- TS strict-mode test errors (audit E8)
- Surrender flow (Session 34)
- MVP-unit smarter algorithm (Session 24 Wave 1)
- Permadeath timer (Session 24 Wave 1)
- Settings expansion (Session 24 Wave 1)
- Reactions in projection column (Session 24 Wave 1)
- Bug 1 (Session 24.5 ADR-0046): mid-battle targeting failure; instrumentation in place, no recurrence in Sessions 25, 26, 26.5, 27
- Vite HMR cache invalidation occasional issue
- Hardcoded team color palette across three sites (Session 25 carry)
- Active-ring + counterpart-ring still circles after portrait restructure (Session 26.5 carry)
- Bedrock Stride fall-immunity untested until River Ridge (Session 33)
- Item #5 pacing constants tuneable (Session 26.5 carry)

## Estimated size

Medium-to-large. `maxMp` is the time-dominator — substantial retrofit across renderer, AI, validator, forecast. Other items are small individually. Compression is fast (Session 26 took minutes per asset). Total scope comparable to Session 27. No split anticipated; if needed, the natural lines are `maxMp` + renderer MP lift + AI projection as 28a (the connected MP cluster), and `modifyBucketCapacity` + `modifyStatusTickAmount` + 0-MP suppression + compression as 28b.
