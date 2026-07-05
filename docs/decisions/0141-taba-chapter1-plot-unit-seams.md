# ADR-0141: TABA chapter-1 plot-unit seams + instantiation (chapter context, cover, unit-restricted components, the five units)

**Status:** Accepted — three seams AND the five unit instantiations both shipped in S84.
**Date:** 2026-07-05
**Session:** S84
**Brief:** `docs/TABADesign/chapter1-plot-units-brief.md`

> **Update (same session):** the instantiation phase originally scoped as "next
> session" was completed in S84 too. The "Deferred" section below is superseded
> by the "Instantiation (shipped)" section that follows it. Only the plot
> PORTRAIT ART registration remains (art lands incrementally; the seam is wired
> and placeholder-tolerant).

## Context

The chapter-1 plot-unique units (Lumen, Chris, Clio, Thessaly, Sera) are the
campaign's testing lineup, currently standing in as generic L25 fixtures at the
head of `m1Roster`. Authoring them "for real" needs three small reusable **engine
seams** built once, on which the five units are then instantiated. Per the
brief's own sequencing ("seams first, each testable in isolation, then
instantiate the five"), this session built and shipped the three seams; the unit
instantiations are the next session.

Three plaintext-reviewed design questions were settled with Chris before build:

1. **Where "chapter" lives** → an opaque scalar on `GameState` the engine
   carries but never interprets (the `gender` cosmetic precedent).
2. **How the cover redirect lands on the tank** → a real mitigation pass through
   the tank's own pipeline (not the `system_damage` bypass), so his defenses
   improve the soak.
3. **What identity unit-restricted components key on** → durable authored
   plot-unit ids, with the restriction on the component's catalog meta.
4. **The soak's semantics** (a mid-build call) → mitigation-only: the soak runs
   the bearer's resistances/Protect but does NOT trigger his reactions and isn't
   evadable (reactions a clean follow-up).

## Decision

### Seam 1 — Battle knows its chapter (opaque scenario scalar)

- `GameState.scenarioTier?: number` (+ `DEFAULT_SCENARIO_TIER = 1`), copied from
  `BattleConfig.scenarioTier` at `createInitialState`. The engine **carries it
  but never interprets it** — its meaning is a consumer concern. The TABA fold
  will fill it with the node's chapter number; Mage War / demo / tests omit it
  and run at the default. Optional-with-default (the "campaign enriches, engine
  defaults" rule), so no blast radius on hand-built states.
- Threaded onto `DamageContext.scenarioTier` in the pipeline so source-tier
  damage hooks (which see `args.ctx`, not the full state) can read the
  battle-wide magnitude — reaches Lumen's fire-multiplier (`onDamageDealt`) and
  Chris's cover fraction.
- Widened `onTurnStart` from `{unit}` → `{unit, state, catalog}` +
  `OnTurnStartResult` (the ADR-0053 `onTurnEnd` precedent the stub's own comment
  anticipated), added `runOnTurnStart`, wired into `reduceTurnStart`'s
  **non-skipped** path (a Stopped/Charging unit takes no real turn). Clio's
  team-CT signature is the first emitting consumer.

### Seam 2 — Parameterized cover (raw redirect, bearer mitigates)

- Declarative `coverParams` on `PassiveAbilityDefinition`
  (`redirectPerTier / range / verticalTolerance / maxFraction?`), read
  **generically** by the engine (the `relaxesTwoHandedGrip` precedent) — no
  reference to any specific ability id, so Chris is just instance one; generic
  tanks / boss minions reuse the same handler.
- `cover_redirect` target-stage pipeline handler (`src/engine/damage/cover.ts`):
  post-evasion (only a landed hit soaks), pre-resistance (reads the RAW base).
  Finds a qualifying adjacent coverer, subtracts the redirected RAW share off
  the ally's base (`fraction = redirectPerTier × scenarioTier`, capped), and
  emits a `system_cover_redirect`. Registered in the default ruleset's `target`
  stage (and the test-fixture pipeline, kept in structural lockstep).
- `runMitigationOnlyPipeline` + the new `system_cover_redirect` action + its
  `reduceCoverRedirect`: the soak runs the bearer's OWN resistances/Protect (no
  evasion, no re-roll, no attacker re-multiply) — a **mitigation-only** pass, so
  a tankier bearer soaks better. Reactions deliberately do NOT fire on a soak
  (verified clean against a Counter-equipped tank). New `ActionType` wired
  through all five convention sites (validate / reduce / commit / log-format /
  animator).
- **Why not `system_damage`:** that bypasses mitigation by design (ADR-0027/
  0052), which fights the "then the bearer mitigates" ruling — so cover cannot
  be a `system_damage` emission. Hence the dedicated mitigation-only pass.

### Seam 3 — Unit-restricted components (catalog-side)

- `restrictedToUnit?: UnitId` on `ComponentMeta` + an `isComponentAvailableTo`
  helper (single source of truth). A restricted component appears (buyable,
  curve-priced) only in its unit's catalog, absent from every other unit's.
- Enforced in two places off the one helper: the buyable-list UI
  (`buildTrainingGroups`) filters it, and `unlockComponent` rejects a wrong-unit
  purchase as the authoritative fail-loud gate. Thessaly's Math components and
  Sera's Hamstring will be the first entries (deferred with the units).

## Instantiation (shipped S84 — supersedes the "Deferred" list above)

- **Four signature abilities.** Three free innate always-equipped signatures —
  Ascendant Flame (Lumen, `onDamageDealt` fire × `1 + 0.1·chapter`), Bulwark Oath
  (Chris, a hook-less passive carrying `coverParams`), Tidal Cadence (Clio,
  `onTurnStart` team-CT `3·chapter` to each ally) — plus Sera's **Hamstring**, a
  new Shadow Arts active applying the new **Hamstrung** status (permanent +
  `STACK_ADDITIVE`; each stack −1 Move AND −1 Jump, floored INDEPENDENTLY at 0;
  Speed proc, MP 8).
- **Thessaly's Math components + engine extension.** The closed
  `MathSkillParameter` gained `xp` and `MathSkillValue` gained `square` (perfect
  squares 1/4/9/16/25…), lifting her lattice from 4×4 to 5×5; evaluator, in-battle
  picker, and display names all updated.
- **Costing + restriction.** Hamstring 200 (Sera-restricted); XP/Square 200 each
  (Thessaly-restricted, above the 150 premiere base — accelerating lattice).
  `seedStartingKit` EXCLUDES restricted components (the brief's "earned, not
  auto-unlocked"; also blocks leaking to non-owners of the class). Restricted
  components are excluded from the per-class near-master budget sums.
- **The five units** (`src/campaign/plot-units.ts`, durable `plot-*` ids): four
  reuse their Gravity Well BuiltUnit; **Chris is authored fresh as a Knight** (the
  brief's class — Gravity Well's Chris is a Templar). Each carries its
  `classAccessOverride` (correct at join level, per the load-bearing scoping
  note), a portrait key (= id), and its innate signature (the three scaling
  leads). Swapped into `m1Roster`'s head. `campaignUnitFromBuilt` was extracted to
  its own module to break the roster ⇄ plot-units import cycle.
- **Portrait override threading** (ADR-0136 completion item 1): durable
  `CampaignUnit.portrait?` (opaque key, D-C plain-serializable — store the key,
  not the full `PortraitRef`) → fold → `UnitPlacement.portrait?` → engine
  `Unit.portrait?` → `resolveUnitPortrait` at the render sites (battle token,
  queue tower, deployment, unit detail). Placeholder-tolerant; `FIXED_PORTRAITS`
  stays empty until the plot art is registered.

**Remaining:** register the five plot portrait keys in `FIXED_PORTRAITS` once the
art lands (rename Chris's `CHARACTERNAME_1.png` files to `plot-*.png`, resize to
512×512 top-anchored); a manual in-battle playtest (Pixi deployment can't be
driven by the preview tools). The mitigation-only cover soak (reactions/evasion
deferred) is a clean additive follow-up.

## Consequences

- The three seams are complete, tested in isolation, and reusable beyond the
  plot units (any chapter-scaling ability, any tank, any prodigy-restricted kit).
- `classAccessOverride` (the plot-unique relief valve, added earlier) is
  confirmed to survive the `reclassUnit` round-trip — a plot-unique can reclass
  out to its Tier-1 fallback and back to its override class.
- **Deferred to the next session (the instantiation phase):** the five unit
  definitions in a first-class plot-unit module (durable stable ids); the four
  signature abilities (Lumen fire ×, Chris cover, Clio team-CT, Sera Hamstring);
  Thessaly's two restricted Math components + the combinator wiring; the costing
  entries (Hamstring ~200, XP/Square curve-priced); the ADR-0136 portrait
  override completion (durable `CampaignUnit.portrait?` threading); and pre-
  seeding the buyable signatures at the L25 fixtures so the lineup exercises
  them. See `docs/handoff.md`.

## Follow-ups / watch-fors carried to the instantiation phase

- **Overrides correct at join-level despite L25 not stressing them** (the
  brief's load-bearing scoping note — Thessaly/Sera's Tier-1 fallbacks are the
  anti-dead-end).
- **Clio's tempo loop** — a playtest watch, tunable via the multiplier, not a
  pre-nerf.
- **Cover reactions** — the mitigation-only soak is a deliberate v1; wiring the
  bearer's reactions/evasion onto the redirect is a clean, additive follow-up.
