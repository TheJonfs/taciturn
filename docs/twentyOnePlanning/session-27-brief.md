# Session 27 Brief: Cluster 3 — Hook Surfaces + Contributor Refactor

## Context

Phase B is closed (Sessions 25-26.5). The MVP is stable and exercises the elemental wheel, the four Movement passives, accurate charged-action timing, and the polished HUD. Phase C now opens with the engine prep needed for the equipment doc's effects to actually function.

This session lands **four new engine hook surfaces** plus the **equipment contributor refactor** (E4 from the audit). Each hook is independently small but they all touch overlapping files (`equipmentContributionsFor`, the hook runners, and the consumer code paths). E4 folds in here because Cluster 3 adds four new branches to the contributor; refactoring the dispatch pattern before adding those branches is cleaner than retrofitting after.

No new content this session — the equipment that consumes these hooks ships in Sessions 29 (post-Cluster-4). This is pure engine substrate.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 26.5 handoff. Note: polish-pass items all landed; no carry-forwards block this session. The handoff specifically flagged audit E2 (resistance composition cap at 100) as visible-for-the-first-time when Item 10 lights up here.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 27 entry; Sessions 28-29 entries for context on what consumes the hooks landing here.
4. **`docs/audits/post-20-engine-audit.md`** — Items 5, 7, 10, 11 (the four hooks) and E4 (contributor refactor). Each item has the implementation sketch this session realizes.
5. **`docs/twentyOnePlanning/mage-war-equipment.md`** — equipment doc; informs what each hook needs to support semantically (Staff of Power, Wand of Deepwood, Wand of Depths, Pointy Hat, Focus Band, etc.).
6. **`docs/decisions/0015-...`** (resistance composition) and **`docs/decisions/0020-...`** (resistance absorption) — context for E2 cap-at-100 question when Item 10 ships.
7. **`docs/decisions/0027-...`** (or whichever ADR covers system_damage bypass) and **`docs/decisions/0053-...`** (onTurnEnd emission) — recent examples of hook-runner patterns to mirror.

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/engine/hooks/` — for hook type definitions, runners, and existing patterns (look at `modifyStatQuery`, `modifyAoeShape`, `modifyStatusApplicationChance`, `modifySystemDamage`, `modifyTerrainCost` as templates)
- `src/engine/equipment/` (or wherever `equipmentContributionsFor` lives) — for the current branch-per-hook structure that needs refactoring
- `src/engine/damage/handlers.ts` — `composeResistance` consumer, also `critRoll` for clamp pattern reference
- `src/engine/abilities/` — for the `computeActionSpeed` and MP-cost computation sites that gain hook integration
- `src/engine/status/` — for `lookupStatusResistance` and the status apply formula (target-side modifyIncomingStatusApplicationChance integration)
- `src/engine/forecast/` — for any forecast paths that read MP cost, action speed, or resistance; these need to compose with the new hooks for forecast accuracy
- `src/content/items/` — for understanding existing equipment shapes (Long Sword, Boots of Haste, the three hidden test items) so the new contributors integrate cleanly
- `src/engine/actions/` — for any reducer paths that read MP cost or action speed
- `src/ai/projection.ts` and `src/ai/basic.ts` — for AI-side consumers of cost/speed/resistance that the hooks must also compose through

The plan articulates what exists, what's being refit, what's being added.

## Goal

End state:

- **Four new hook surfaces** wired into the engine:
  - `modifyMpCost` — multiplicative chain on spell MP cost
  - `modifyActionSpeed` — additive chain on ability action speed (including support for ability-tag-conditional contributors)
  - `modifyResistance` — additive chain on per-tag resistance values
  - `modifyIncomingStatusApplicationChance` — target-side variant of `modifyStatusApplicationChance`; composes as `formula × ∏casterHooks × ∏targetHooks`
- **Equipment contributor refactor (E4)** — registration pattern replaces branch-per-hook dispatch. Each hook has its own contributor module registered at module load; adding a new hook adds a contributor module rather than a branch.
- **Existing contributors migrated to the new pattern**: `modifyStatQuery`, `statusGrants`, `modifyAoeShape`, plus the Session 26 additions (`modifySystemDamage` if applicable, `modifyTerrainCost` from `tidewalker`) all go through the new registration pattern. The four new hooks land in the same shape.
- **Resistance absorption activation (E2 + ADR-0020)** — the cap at 100 is lifted; `composeResistance` returns the uncapped value. The damage application path activates the absorption math per ADR-0020: resistance > 100 converts damage to healing proportional to the excess (Earth Mage with Capacitor Ring + Wand of Depths reaches +150 Lightning resist → partial absorption territory). Status apply chance handles the uncapped resistance by clamping the resulting probability to [0, 100]. Forecast and AI consumers display heal-vs-damage correctly based on the resistance regime.

Tests at 725+, 0 failing. New tests cover each hook's composition behavior (additive vs multiplicative, ordering, empty-chain default), contributor registration mechanics, and integration with the consumer code paths (MP cost computation, action speed computation, resistance composition, status application chance composition).

## Pre-implementation plan (required)

Same discipline as previous sessions. Current-tree audit first; architectural decisions surfaced before code.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it. Especially important here for the existing contributor branches — the refactor must preserve their semantics exactly, not introduce subtle behavior changes.

### Architectural decisions

After the audit:

1. **Contributor refactor (E4) — registration pattern shape.** The current branch-per-hook structure dispatches in `equipmentContributionsFor` based on hook type. The refactor pattern question: how do per-hook contributor modules register, and how does dispatch route to them? Two reasonable shapes:
   - **Eager registration via module side-effect**: each contributor module calls `registerEquipmentContributor(hookType, fn)` at module load. Simple but introduces side-effects-at-import.
   - **Lazy lookup via map literal**: a central `CONTRIBUTORS` map keyed by hook type. Adding a hook adds an entry. No side-effects-at-import.
   
   Lazy lookup is probably cleaner — no import-order subtleties, the registry is inspectable in one place. State the choice and per-hook contributor module structure.

2. **`modifyMpCost` composition.** Multiplicative chain per audit. Order doesn't matter for pure multiplication. State whether the chain returns the multiplier (caller applies to baseCost) or the modified cost (caller takes the final value). The latter is consistent with `modifyStatQuery`'s pattern. New helper `computeMpCost(state, catalog, unit, ability)` centralizes the read; reducer and validator route through it.

3. **`modifyActionSpeed` composition.** Additive chain per audit. Composes with existing `computeActionSpeed` (which already factors caster MA). The hook is applied *after* the baseline computation but *before* clamp (if any). State whether contributors can be tag-conditional (e.g., Wand of Deepwood: +5 actionSpeed for Earth-tagged spells only) — the audit's sketch implies yes; the contributor signature needs to accept the ability shape so it can inspect tags.

4. **`modifyResistance` composition.** Additive chain per audit. `composeResistance` reads through the hook; `lookupStatusResistance` (for status apply chance) also reads through it. Per-tag — each tag's resistance is computed independently with its own chain.

5. **Resistance absorption activation (E2 + ADR-0020).** The cap-at-100 lifts; `composeResistance` returns the uncapped value. v1 content reaches +150 territory in builds like Earth Mage (native +50 Lightning) + Capacitor Ring (+50 Lightning) + Wand of Depths (+50 Lightning), and Chris wants the absorption path active rather than capped. The damage application path activates the absorption math per ADR-0020:
   - Resistance < 0: damage taken = base × (1 + |resistance| / 100) — weakness scales damage up
   - 0 ≤ Resistance < 100: damage taken = base × (1 - resistance / 100) — standard partial reduction
   - Resistance = 100: damage taken = 0 — full block, no heal
   - Resistance > 100: damage taken = 0; target *heals* for base × (resistance - 100) / 100 — partial absorption
   - Resistance ≥ 200: target heals for full base damage — complete absorption
   
   State the exact thresholds and the heal-vs-damage emission path. The reducer needs to handle the absorption case — likely emits `system_heal` instead of (or alongside) `system_damage` when absorption fires. Status apply chance is uncapped resistance routed through the formula, with the resulting probability clamped to [0, 100] (no "negative chance" or "guaranteed beyond certain" semantics for status — those are damage-side concerns). State the exact clamping points.

   Audit existing `composeResistance` and damage application paths to determine the cleanest integration. Worth confirming ADR-0020's full proposed formula against this session's implementation; if ADR-0020 specifies different thresholds or behavior, follow that document rather than the sketch above.

6. **`modifyIncomingStatusApplicationChance` composition.** Multiplicative chain (probabilities compose multiplicatively). Composes with existing caster-side `modifyStatusApplicationChance`: `final_chance = base_formula × ∏casterHooks × ∏targetHooks`. State the formula update site (the status apply chance computation) and verify the existing caster-side chain isn't perturbed.

7. **Hook signature consistency.** All four new hooks should follow the established `modifyX` pattern:
   - Args object with relevant context (unit, ability, target, base value)
   - Return value (modifier factor, additive delta, or final value depending on chain semantics)
   - Pure function — no state mutation
   
   State each hook's exact signature in the plan.

8. **Test strategy.** Per-hook unit tests covering empty-chain default, single-contributor application, multiple-contributor composition, and ordering (where applicable). Integration tests where the hook composes with its consumer (e.g., MP cost computation with a multiplicative contributor; status application chance with both caster-side and target-side contributors). Contributor refactor tests confirm all existing equipment effects (Long Sword's PA bonus, Boots of Haste's auto-status grant, etc.) still apply correctly post-refactor.

9. **Migration ordering within the session.** Refactor first, then add new hook contributors using the new pattern. Or interleave? Refactor-first is cleaner — the refactor preserves existing behavior (verified by existing tests passing), then each new hook lands as a new contributor module without touching the dispatch shape again. State the order.

10. **Forecast and AI integration.** Most consumers of these hooks live in the engine, but a few are in `src/engine/forecast/` and `src/ai/`. Confirm:
    - `projectMpCost` (if it exists) routes through `computeMpCost`
    - Forecast paths reading action speed (charged-timing schedule walk from 26.5) compose with `modifyActionSpeed`
    - AI's projection.ts and basic.ts route through the new helpers where they read MP cost, action speed, resistance
    - The forecast pipeline correctly composes target-side `modifyIncomingStatusApplicationChance` in the status-application-chance preview

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land in this order: refactor first (preserves all existing behavior), then four new hooks in dependency-free order.

### Item 1: Equipment contributor refactor (E4)

Convert `equipmentContributionsFor` from branch-per-hook dispatch to the registration/map pattern. Existing contributors (`modifyStatQuery`, `statusGrants`, `modifyAoeShape`, plus Session 26's additions per audit) migrate to the new shape. Existing tests still pass — the refactor is behavior-preserving.

### Item 2: `modifyMpCost` hook

New hook type, runner, and contributor pattern. New `computeMpCost(state, catalog, unit, ability)` helper. Reducer + validator + forecast + AI route through it. Empty-chain default returns base cost unmodified.

### Item 3: `modifyActionSpeed` hook

New hook type, runner, contributor pattern. `computeActionSpeed` integration. Contributors can inspect ability tags for conditional application. Forecast (charged-timing schedule walk) composes correctly with the new chain.

### Item 4: `modifyResistance` hook + absorption activation

New hook type, runner, contributor pattern. `composeResistance` integration; `lookupStatusResistance` integration. Per-tag chain (each damage / status tag has its own composition). Cap lifted; `composeResistance` returns uncapped values.

**Absorption path activation (ADR-0020).** Damage application path updated:
- Resistance < 0: damage scales up by `1 + |resistance| / 100`
- 0 ≤ Resistance < 100: damage scales down by `1 - resistance / 100`
- Resistance = 100: zero damage, no heal
- 100 < Resistance < 200: zero damage; target heals for `base × (resistance - 100) / 100`
- Resistance ≥ 200: target heals for full base damage

Reducer emits `system_heal` (or composite heal-damage outcome per the existing damage path's shape) when absorption fires. Status apply chance uses uncapped resistance routed through the formula; final probability clamped to [0, 100].

Forecast pipeline updated to display absorption correctly:
- Damage range row shows "heals X-Y HP" when resistance > 100, not "deals X-Y damage"
- Per-target preview reflects the heal-vs-damage regime per target
- AI consumers compose with the absorption path (so the AI doesn't try to "damage" a +150-resist target expecting net HP loss)

Action log entries should render absorption as a heal event (or a "absorbed Lightning Strike for 12 HP" rendering — formatter call). Likely a small `action-log-format.ts` extension.

### Item 5: `modifyIncomingStatusApplicationChance` hook

New hook type, runner, contributor pattern. Status apply formula composes both caster-side (existing `modifyStatusApplicationChance`) and target-side (this new hook). Forecast composes correctly.

## Acceptance criteria

- Four new hooks defined, runners implemented, contributors registered via the new pattern.
- E4 refactor complete: all existing contributors (`modifyStatQuery`, `statusGrants`, `modifyAoeShape`, plus the Session 26 additions) migrated to the new pattern. Branch-per-hook dispatch eliminated.
- All existing tests pass post-refactor (behavior preservation).
- Per-hook unit tests cover empty-chain, single-contributor, multi-contributor composition.
- Integration tests confirm:
  - `computeMpCost` composes correctly with `modifyMpCost` contributors
  - `computeActionSpeed` composes correctly with `modifyActionSpeed` (including tag-conditional)
  - `composeResistance` and `lookupStatusResistance` compose correctly with `modifyResistance`; cap is lifted; uncapped values flow to consumers
  - Status application formula correctly composes both caster-side and target-side chains; final probability clamps to [0, 100]
- **Absorption tests**: damage application correctly emits heal (or composite heal-damage outcome) when resistance > 100; full absorption at resistance ≥ 200; weakness scaling at resistance < 0. Forecast shows heal-vs-damage correctly per resistance regime.
- Forecast pipeline composes correctly with the new hooks; action log renders absorption events readably.
- AI consumers route through the new helpers (no direct reads bypassing the chains); AI scoring correctly treats absorbing-target damage as net-positive-for-target (AI shouldn't try to "damage" a +150-resist target).
- Tests at 725+, 0 failing. New tests proportional to the four hooks + refactor surface.
- ADRs written for: the contributor refactor pattern; the absorption activation (E2 + ADR-0020 — substantive engine behavior change). The four hooks themselves may not warrant individual ADRs unless something non-obvious in their composition surfaces — implementer's call per significance.
- `docs/handoff.md` updated.

## Out of scope

- **All Phase C content authoring** (equipment items that consume these hooks). Sessions 29 onward.
- **Cluster 4 structural work** (maxMp, bucket capacity, status tickdown rate). Session 28.
- **Cluster 5 procs/drains.** Session 30.
- **River Ridge and elevation testing for Bedrock Stride.** Session 33 ships the map; that's when Earth Mage's fall immunity gets empirical confirmation per Chris's note from the 26.5 playtest.
- **`onTurnStart` symmetric widening** (Session 26 carry-forward) — defer until first emitting consumer.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

- `src/engine/hooks/types.ts` (or wherever hook types live) — four new hook type definitions
- `src/engine/hooks/runners.ts` (or equivalent) — four new runners
- `src/engine/equipment/contributor.ts` (or equivalent) — refactor + four new contributor modules
- `src/engine/equipment/contributors/` (new directory? or flat files) — per-hook contributor modules
- `src/engine/abilities/computeMpCost.ts` — new helper
- `src/engine/abilities/computeActionSpeed.ts` — extension
- `src/engine/damage/handlers.ts` — `composeResistance` integration (cap lifted); damage application path activates absorption (heal emission when resistance > 100, weakness scaling when resistance < 0)
- `src/engine/status/` — `lookupStatusResistance` integration; status apply formula update; clamp to [0, 100]
- `src/engine/forecast/` — forecast paths reading cost/speed/resistance through the new helpers; damage-range display handles heal-vs-damage based on resistance regime
- `src/ai/projection.ts`, `src/ai/basic.ts` — AI consumers routed through new helpers; scoring correctly handles absorption (no "damaging" absorption targets)
- `src/engine/actions/reducers.ts` — reducer paths reading cost via `computeMpCost`; reducer handles absorption heal emission
- `src/ui/action-log-format.ts` — absorption event rendering (heal vs damage distinction in log entries)
- New tests for each hook + refactor preservation tests + absorption thresholds
- New ADRs in `docs/decisions/` for refactor pattern and absorption activation
- `docs/handoff.md` — updated

## Workflow notes

- **Plaintext-first review required.** Same discipline as previous sessions.
- **Audit-first within the plan.** The refactor's semantics-preservation requirement makes the audit particularly important — the implementer must enumerate every current contributor and verify the new pattern handles it without behavior change.
- **ADR path is `docs/decisions/`** (not `docs/adr/`; Session 26 surfaced this).
- **Refactor-then-add ordering is load-bearing.** Adding new contributors with the new pattern only works after the dispatch refactors; doing the reverse means refactoring under load with four new hooks in flight.
- **E2 cap decision deserves explicit ADR or comment.** The choice has implications for future content authoring (Phase C equipment authoring needs to know the cap regime).
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: contributor registration pattern shape if the existing structure is more constrained than expected; E2 cap-vs-absorption call if the audit reveals current content pushes past 100 already.
- **The integration test calibrated to `demoBattle`'s 6×6 board** stays calibrated. Behavior-preservation through the refactor is what protects it.

## Watch-fors

**Addressed this session:**
- Four new hook surfaces (audit items 5, 7, 10, 11).
- Equipment contributor refactor (audit E4).
- E2 resistance cap lifted; absorption path activated per ADR-0020 (audit item 10 + ADR-0020 reconciliation).

**Not addressed this session, longer-term carry-forward:**
- `onTurnStart` symmetric widening (Session 26 carry-forward)
- Renderer's MP "max" captured at mount (Session 22 carry; Session 28 lifts)
- Status-badge polarity convention (Session 22 carry)
- rAF vs setInterval for animation drain (Session 23 carry)
- AoE preview correctness across all shapes (Session 23 carry; confirmed shape-agnostic in 26/26.5)
- MP / status snapshot ahead-of-tween fix (Session 22 carry)
- `pa_factor` NotYetImplementedError (audit E3)
- TS strict-mode test errors (audit E8) — ~15 errors continue to carry forward
- Surrender flow (Session 34)
- MVP-unit smarter algorithm (design call)
- Permadeath timer (design call)
- Settings expansion (design call)
- Reactions in projection column (design call)
- Bug 1 (Session 24.5 ADR-0046): mid-battle targeting failure; instrumentation in place, no recurrence in Sessions 25, 26, 26.5
- Portrait asset sizes (~4 MB each → ~20 MB initial load) — pre-release pipeline candidate; Session 26 established sips + pngquant discipline for terrain
- Vite HMR cache invalidation occasional issue
- Hardcoded team color palette across three sites (Session 25 carry)
- Active-ring + counterpart-ring still circles after portrait restructure (Session 26.5 carry)
- Bedrock Stride fall-immunity untested until River Ridge ships (Session 33)
- Item #5 pacing constants (`PRE_RESOLVE_HIGHLIGHT_MS`, `CHARGED_RESOLVE_FLASH_DURATION_MS`) — tuneable per playtest feedback (Session 26.5 carry)

## Estimated size

Medium-to-large. Per the audit's original sizing: "four hooks plus refactor; each hook independently small but they all touch overlapping files." The refactor is the dominating piece because every existing contributor migrates. The four new hooks are each small individually but multiply tests and integration points. No split anticipated; if scope balloons in the audit, refactor + two-hook splits would be the natural lines (e.g., 27a = refactor + Items 5+7; 27b = Items 10+11), but expect single session.
