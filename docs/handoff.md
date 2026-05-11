# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`).
- Comprehensive progress / deferred-work review (`docs/progress.md` is the durable home for that — refreshed periodically, not session-by-session).

---

## From session 2026-05-11 (Session 27 — Cluster 3: hook surfaces + contributor refactor + absorption activation)

Session 27 landed the four new modifier-hook surfaces, refactored the equipment contributor to a map-based dispatch, and activated the resistance-absorption path. Tests: **747 passing across 64 files, 0 failing** (up from 725). +22 new tests in `session-27-integration.test.ts`.

### Scope completed

**Engine substrate (this session):**

1. **Equipment contributor refactor (E4 / ADR-0056).** `equipmentContributionsFor` migrated from a hardcoded `if (hookName !== 'modifyStatQuery') return;` guard to a lazy `EQUIPMENT_CONTRIBUTORS` map keyed by HookName. Per-hook contributor functions live alongside `statQueryContributor` in `src/engine/items/contributions.ts`. Behavior-preserving — all 725 pre-Session-27 tests continued to pass after the refactor.

2. **Four new hook surfaces (ADR-0056):**
   - **`modifyMpCost`** — multiplicative caster-side chain. New helper `computeMpCost(state, catalog, unitId, abilityId)` rounds half-up at exit, floors at 0, short-circuits class-granted free abilities. Reducer (`reducers.ts:247, 305, 382`), validator (`validate.ts:215`), AI (`basic.ts canAfford`), UI (`use-turn-flow.ts:611`), and forecast (`forecast-compose.ts:165`) all route through it.
   - **`modifyActionSpeed`** — additive caster-side chain. New helper `computeBaseActionSpeed(state, catalog, unit, ability)` clamps positive-base abilities at `>= 1` to preserve the charged-vs-instant invariant. Applied at commit (`reducers.ts:351`); forecast hypothetical state (`charged-timing.ts:117`) routes through too. Tag-conditional contributors inspect `args.ability.effects.damage?.tags`.
   - **`modifyResistance`** — additive target-side chain. Per-tag composition in `composeResistance` (with the "include only if native or contributor-modified" rule preserving ADR-0015) and `lookupStatusResistance`. Cap-at-100 lifted in both consumer sites.
   - **`modifyIncomingStatusApplicationChance`** — multiplicative target-side chain. Composes after the existing caster-side `modifyStatusApplicationChance` in `computeStatusChance`: `final = base × ∏casterHooks × ∏targetHooks`. Final clamps to `[0, 1]`.

3. **Resistance absorption activation (ADR-0057, supersedes ADR-0022).** Cap lifted in `resistanceCheck` and `lookupStatusResistance`. Absorption activates via tag-flip in `clampMinMax` (cap stage): when `raw < 0` for non-healing damage, add `'healing'` to `ctx.damageTags`, set `finalDamage = min(|raw|, baseDamage, max-HP-room)`. Existing healing path handles HP delta direction, perTargetResult recording, CT-push gating, and action-log distinction.
   - Resistance regimes verified: `< 0` (vulnerability scales damage up), `0` (normal), `0..100` (reduced), `100` (immune, no heal), `100..200` (partial absorption), `≥ 200` (full absorption capped at base damage).

4. **`AbilityTargetResult.absorbed?: boolean`** added so the action log can render "absorbed X HP" vs "+X HP" — distinguishes absorbed damage from native healing for the player.

5. **`DamageRange.regime: 'damage' | 'heal' | 'absorbed'`** added so the forecast panel labels the row appropriately ("dmg" / "heal" / "absorb"). Forecast inspects the projection-mode pipeline's tag set to detect absorption.

6. **AI passive absorption avoidance.** `projectExpectedDamage` returns 0 when the projection's tag set flips to healing for a non-healing ability — the AI's offensive scoring discards the target. Active exploitation (heal allies via absorbed-tag hits) is a deliberate non-goal for v1.

7. **Equipment contributor map entries for the four new hooks.** Optional `mpCostMultipliers`, `actionSpeedModifiers`, `resistanceMods`, `incomingStatusModifiers` fields added to `EquipmentBase`. No v1 item declares them; Session 29 populates them on real content.

**Test reconciliation:**

- Two `reducers.test.ts` tests had inline catalogs with `classes: []` — broke when `computeMpCost` started reading the unit's class for free-ability lookup. Fixed by switching to `[makeKnight()]` (matches the default `makeAbilitiesCatalog` pattern).
- One `pipeline.test.ts` test asserted "resistance 200 reads as immune (cap-at-100)" — rewritten to assert "resistance 200 absorbs full base damage as healing" per ADR-0057.
- One `damage-range.test.ts` test asserted `{ min: 0, expected: 0, max: 0 }` — extended to include the new `regime: 'damage'` field.
- `makeStatusType` fixture extended to accept `resistanceTag` (used by absorption / status-chance tests).

### Architecture records

- **ADR-0056** — Equipment contributor registration pattern + four new modifier hooks. Documents the map-based dispatch shape, the four new hook surfaces' chain composition, and the helper-chokepoint discipline (`computeMpCost`, `computeBaseActionSpeed`).
- **ADR-0057** — Resistance absorption activation via tag-flip at the cap stage. Status `Supersedes ADR-0022`. Documents the regime table, the tag-flip rationale (vs. explicit absorption flag), the base-damage cap on absorbed amount, and the AI passive-avoidance call.

### Limitations + watch-fors

- **Action menu MP / action-speed display deferred.** `AbilityButton` (`src/ui/action-menu.tsx:361-362`) reads `ability.mpCost` and `ability.actionSpeed` directly for the button subline. With no v1 item declaring `mpCostMultipliers` / `actionSpeedModifiers`, the displayed value matches the committed cost. When Session 29 ships items that produce divergence, that session should thread `state` + `catalog` to `AbilityButton` for accurate display.

- **`actorHasDamageFollowUp` in `src/ai/basic.ts:679` is unused dead code** (caller-less). Signature was updated to take `state` for consistency with other enumeration helpers, but the function isn't invoked. Clean removal is a low-priority follow-up.

- **`projectDamageContext` used for absorption-regime detection in `damage-range.ts`.** When the projection ctx's tag set includes `'healing'` but the ability isn't natively healing, the regime is 'absorbed'. The function runs the full projection pipeline three times for min/expected/max — same cost as before, just one of the three calls is now `projectDamageContext` instead of `projectExpectedDamage`.

- **AI active absorption exploitation deferred to a tactics-layer pass.** Current AI passive avoidance handles the "+150-resist target shouldn't take damage spells" case correctly (scores collapse to 0). The "heal an ally by hitting them with their absorbed tag" pattern is a deliberate non-goal for v1 — it's a tactics design surface (friendly-fire targeting, score signing, projection cost) that wants its own pass.

- **Synthetic test fixtures for absorption.** No v1 content reaches resistance > 100, so the absorption tests use synthetic `resistances: [['lightning', 200]]` setups. Once Session 29 ships Capacitor Ring + Wand of Depths, real-content integration tests can replace the synthetic ones (or coexist alongside them).

- **`computeStatusChance` formula change.** The function now calls two modifier hooks (caster-side + target-side) instead of one. v1 statuses with caster-side modifiers (Earth Communion × 1.25) keep working unchanged because the target-side chain is empty for v1 targets.

- **`composeResistance`'s "include only if native or contributor-modified" rule.** A handler that returns 0 for a tag the unit doesn't natively carry is treated as "no opinion" — preserves ADR-0015's "skip implicit zeros" rule. If a future content piece wants "explicitly clamp to 0," it should use `target.resistances.set(tag, 0)` (native zero) rather than relying on a contributor returning 0.

- **`computeBaseActionSpeed` applies modifications at commit.** In-flight ChargedActions store the modified value; mid-charge equipment changes (no v1 scenario) don't affect already-spawned charges. Matches the existing "ChargedAction.speed is canonical" pattern.

- **`makeStatusType` fixture extension** — accepts `resistanceTag` now. Existing tests with no `resistanceTag` keep their behavior (the field stays undefined). New tests can pass `resistanceTag: 'lightning'` etc.

### Considered and rejected this session

- **Eager registration via `registerEquipmentContributor` import-side-effect.** Rejected — introduces import-order coupling. The lazy map is inspectable in one place.

- **Explicit `absorbed: boolean` flag on `DamageContext` instead of tag-flip.** Rejected — five plumbing sites instead of one, with every downstream `'healing'`-gating consumer needing a parallel branch on the new flag. Tag-flip reuses the existing heal path for free.

- **Active AI absorption exploitation.** Rejected for v1 per Chris's session-start call — passive avoidance is sufficient; active exploitation needs its own tactics-layer pass.

- **Splitting Session 27 into 27a (refactor + 2 hooks) / 27b (2 hooks + absorption).** Rejected — the audit showed the four hooks are individually small enough to land together. Single session was achievable.

- **Threading `state` + `catalog` into `AbilityButton` for accurate MP / action-speed display.** Deferred to Session 29 — no v1 content produces divergence, and threading would touch multiple props through `AbilityListPicker`. When content lands, the polish lands with it.

- **Adding modifyMpCost / modifyActionSpeed contributor entries for status / passive sources separately from equipment.** Not needed — `statusContributionsFor` and `passiveContributionsFor` already iterate all hooks uniformly. Any status or passive that registers a handler for a new hook is automatically collected.

### Empirical-questions checklist for Chris's next playtest

(No new visible behavior in v1 — all four new hooks have no current consumers among shipped content. The next playtest mainly verifies the 26.5 polish items still work as expected; Session 27's surfaces light up when Session 29 ships their consumers.)

**Refactor preservation (sanity check):**
- [ ] All Knight + Mage abilities still cost the same MP they did pre-Session 27.
- [ ] All charged-action timings still resolve at the same ticks they did pre-Session 27.
- [ ] All resistance / status outcomes still play the same way.

**Absorption (synthetic — no v1 content triggers):**
- [ ] No v1 content reaches resistance > 100, so no absorption events should fire in normal play.

### Longer-term carry-forward

- **Action menu MP / action-speed display** — UI polish for Session 29 (when items that produce divergence ship).
- **`actorHasDamageFollowUp` dead code in `src/ai/basic.ts`** — clean-up follow-up.
- **AI active absorption exploitation** — tactics-layer design pass (post-v1 or when class content calls for it).
- `onTurnStart` symmetric widening (Session 26 carry; not addressed; defer until first emitting consumer).
- Renderer's MP "max" captured at mount (Session 22 carry; Session 28 lifts).
- Status-badge polarity convention (Session 22 carry).
- rAF vs setInterval for animation drain (Session 23 carry).
- AoE preview correctness across all shapes (Session 23 carry; sessions 26 + 26.5 + 27 confirmed shape-agnostic).
- MP / status snapshot ahead-of-tween fix (Session 22 carry).
- `pa_factor` NotYetImplementedError (audit E3).
- TS strict-mode test errors (audit E8) — pre-existing list carries forward; 27 added zero.
- Surrender flow (Session 34 / ADR-0041).
- MVP-unit smarter algorithm (Session 24 Wave 1).
- Permadeath timer (Session 24 Wave 1).
- Settings expansion (Session 24 Wave 1).
- Reactions in projection column (Session 24 Wave 1).
- Bug 1 (Session 24.5 ADR-0046): mid-battle targeting failure; instrumentation in place, no recurrence in Sessions 25, 26, 26.5, 27.
- Portrait asset sizes (~4 MB each → ~20 MB initial load) — pre-release pipeline candidate.
- Vite HMR cache invalidation occasional issue.
- Hardcoded team color palette across three sites (Session 25 carry).
- Active-ring + counterpart-ring still circles after portrait restructure (Session 26.5 carry).
- Bedrock Stride fall-immunity untested until River Ridge ships (Session 33).
- Item #5 pacing constants (`PRE_RESOLVE_HIGHLIGHT_MS`, `CHARGED_RESOLVE_FLASH_DURATION_MS`) — tuneable per playtest feedback (Session 26.5 carry).

### Suggested scope for Session 28

Per `docs/twentyOnePlanning/roadmap-sessions-21-plus.md`, Session 28 is Cluster 4 (structural): introduce `maxMp` as a stat, add `modifyBucketCapacity` hook, add `modifyStatusTickAmount` hook. The most invasive piece is `maxMp` — it touches placement, `fillVitalsFromComputedMaxes`, the AI's projection surface, and the renderer's MP cap captured at mount. Plan for retrofit work; the brief calls out ~30 minutes of buffer.

Session 27's four new hooks have no consumers yet — Session 29 (equipment authoring batch A) is when the substrate lights up. Session 28 doesn't depend on the absorption activation; the cap lift is independently shippable.
