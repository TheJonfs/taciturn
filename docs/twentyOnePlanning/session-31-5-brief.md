# Session 31.5 Brief: Post-Playtest Bug Fixes + Accumulated Polish

## Context

Session 31 closed the equipment-complete milestone (846/0 across 70 files, all items in `mage-war-equipment.md` shipped). Chris ran the triggered broad-playtest and surfaced five bugs plus one UI consistency issue. Session 31.5 is a polish/bug-fix session that addresses those, bundles two implementer-flagged refactors from the S31 handoff, and folds in a curated subset of the older polish-queue carry-forwards before Session 32 (Phase D — Cluster 6 / map mechanics / River Ridge).

Equipment-complete milestone holds. Phase D kickoff gates on this session landing cleanly.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 31 handoff. The "Empirical-questions checklist" plus the "Longer-term carry-forward" section together define this session's source list.
3. **`docs/decisions/0056-...`** (modifyResistance), **`0057-...`** (absorption activation), **`0064-...`** (attack_proc + riderSource), **`0065-...`** (onFinalDamage + system_mp_drain), **`0066-...`** (tagged_resistance_shift), **`0067-...`** (physicalVariance), **`0068-...`** (rider bypass extended). The bug fixes below all touch substrate that one of these ADRs covers; review for design intent.
4. **`docs/design/status-effects.md`** — for the status-effect inventory; the Don't Move / Don't Act gating fix lives at the menu-rendering layer but should respect the existing status definitions. *(Note: path corrected from S31 brief's `twentyOneDesign/`; same correction applies to action-resolution.md and equipment-doc references.)*
5. **`docs/design/mage-war-equipment.md`** — for the equipment item specifications, especially Rasp Pendant's "every final damage" intent and Bolt Hammer's hit-gated proc intent.

### Paths to survey before planning

For each bug, the audit confirms what the current code path does vs. what the substrate intent specifies. Particularly:

- **Resistance pipeline** (bug 2+5). `src/engine/hooks/runners.ts` for `runModifyResistance` composition. `src/content/items/` for equipment-side `resistanceMods` field contribution path. `src/ui/unit-detail-panel.tsx` for the displayed-resistance read path. `src/engine/damage/` for the resolution-side resistance read path. The audit needs to identify which of these paths (display, projection, resolution) actually consult the hook chain.
- **Bolt Hammer proc-on-miss** (bug 4). `src/engine/equipment/attack-proc-contributor.ts` (or wherever the contributor lives) for the `ctx.hit === true` gate. `src/engine/damage/` for where `ctx.hit` is set during the pipeline.
- **Rasp Pendant magic-damage gap** (bug 3). `src/engine/equipment/final-damage-drain-contributor.ts` for the gate composition. `src/engine/damage/pipeline.ts` for the postFinalize stage trigger — confirm magical damage reaches it. ADR-0065 explicitly does not gate on physical tag.
- **Don't Move / Don't Act menu gating** (bug 6). `src/ui/action-menu.tsx` (or wherever the top-level action menu lives) for the Move and Act button enablement logic. Status-status read pattern.
- **Shell / Auto-Regen duration display** (bug 1). `src/ui/unit-detail-panel.tsx` for the status-effect badge / list rendering. `src/content/statuses/regen_auto.ts` and `shell.ts` for display-name conventions.

The plan articulates what each fix touches.

## Goal

End state:

**Critical bug fixes (5):**

- **Resistance pipeline correctness.** Equipment-side `resistanceMods` and status-side `modifyResistance` contributions both flow correctly to: (a) unit detail panel display, (b) forecast/projection display, (c) actual damage resolution. End-to-end verification: Earth Mage with Wizard's Robe + Capacitor Ring shows correctly modified resistance values in panel; Lightning damage from Blue Lightning Mage on this Earth Mage triggers absorption healing (ADR-0057 tag-flip).
- **Bolt Hammer proc respects `ctx.hit`.** Lightning Strike proc does not fire on missed physical swings. Proc rate stays at 25% × hit-rate (75 × 0.25 = effective ~19% of attempted swings).
- **Rasp Pendant drains on all final damage.** Magical damage from the Lightning Mage's spells triggers the drain via `onFinalDamage` per ADR-0065's specification (no physical-tag gate). End-to-end verification: Lightning Mage's Water Strike / Lightning Strike on a target drains 10% of final damage as MP.
- **Don't Move / Don't Act menu gating.** Move button disabled (or hidden, per audit recommendation) when wielder has Don't Move status active. Act button (or the secondary-action panels) similarly gated on Don't Act. No soft-lock when player attempts to use a restricted action.
- **Shell / Auto-Regen duration display consistency.** Both render as `{Status Name} ∞` (or equivalent) — Shell as "Shell," Auto-Regen as "Regen," with their permanent durations consistently formatted.

**Flagged refactors (2):**

- **`isRiderCast(payload): boolean` helper.** Consolidates the five-site `riderSource !== undefined` check (validate.ts Act + MP, reducers.ts MP + Act + actionSpeed, commit.ts pre-hook) into a single helper. No engine behavior change. Per ADR-0068's flag.
- **`commit.ts:envelopeFor` exhaustive switch.** Convert the existing case-switch to an exhaustive switch over `ActionType` with a `default: { const _exhaustive: never = … }` guard. Prevents the silent crash class that surfaced with `system_mp_drain` (S31 handoff item 21).

**Polish queue (subset — TBD pending Chris's additional observations):**

- **Status-badge polarity convention** (S22 carry). The demo now carries Auto-Shell, Auto-Regen, and `tagged_resistance_shift` instances at battle start; a consistent visual convention for positive/negative/neutral badges aids readability.
- **Hardcoded team color palette across three sites** (S25 carry). Centralize the palette source.
- **Active-ring + counterpart-ring rounded-square fitment** (S26.5 carry). Cosmetic but visible during play.
- **Tile-info effect-icon area still empty** (S26.5 carry). Populate per existing status-badge convention (pairs with polarity work above).
- **HP / MP / status snapshot ahead-of-tween fix** (S22 carry). Visual correctness.
- **Renderer's HP "max" captured at mount** (S28 carry). Sibling to MP lift.
- **rAF vs setInterval for animation drain** (S23 carry). Perf / correctness.

**Playtest observations resolved:**

- **Tooltip system:** Option-A auto-formatter is landing well per Chris's observation — solid information level and functional. Option B authored-description pass deferred to post-current-roadmap.
- **AI behavior:** no creative play surfaced in playtest, but Chris notes this is partially a function of the AI's loadout (Red Knight is unchanged from default; Red Lightning Mage is unchanged). Tactics-layer pass remains carry-forward; no action this session.
- **Calibration reads:** Bolt Hammer feel, Magus Crown -3 MA cost, Tintinibar Regen rate, and Sorcerer's Robe Move +1 all read as reasonable in initial playtest. No tuning changes for those.

**Tuning consideration (plan-review decision):**

- **Wizard's Robe and Staff of Power: +3 MA → +4 MA.** Chris's framing: "tools that are powerful for mage classes but also carry meaningful drawbacks." Currently Wizard's Robe carries -25 to all four elemental resistances and Staff of Power carries +20% MP cost. The proposal is to push the upside to match the existing drawback magnitude. Implications worth noting at plan-review:
  - Mage base MA 12-14; Wizard's Robe +4 = 16-18; Staff of Power +4 = 16-18; both stacked = 20-22 (vs. current 18-20 stacked at +3 each). Roughly +11% basic spell damage on stacked builds.
  - Drawbacks unchanged: -25 all-res from Robe still compounds on multi-element pressure; +20% MP cost from Staff still reduces total casts per battle by ~17%.
  - Discrimination question for plan-review: does +3 currently feel "useful but unremarkable" (argues for the bump) or "obviously the right pick" (argues against)? Chris's "tempted to consider" suggests the former.
  - Settle at plan-review with the implementer present.

**Quality:**

Tests at 846+, 0 failing. New tests where bug fixes warrant regression coverage. New ADRs where the resistance pipeline fix surfaces design-level (vs. plumbing-level) changes.

## Pre-implementation plan (required)

Same discipline as previous sessions. Current-tree audit first; for the resistance pipeline bug specifically, a diagnostic-first step.

### Required first step: current-tree audit + diagnostic discrimination

The five bugs vary in how much investigation they need. Audit-first applies especially to bugs 2+5 (resistance pipeline) and bugs 3-4 (substrate gating).

**Diagnostic for bugs 2+5 — discriminate which contribution path is broken:**

The S31 handoff confirmed:
- Equipment-side `resistanceMods` (Capacitor Ring +100 Lightning, Wizard's Robe -25 to all four) is the Session 29 contribution path.
- Status-side `modifyResistance` (tagged_resistance_shift) is the Session 27 / S31 contribution path.

Both surfaced as broken in playtest (or at minimum, the display side surfaced). The discrimination test:

1. Apply Wand of Depths Resonance to a target (Knight).
2. Cast Lightning damage on the target.
3. Measure: does Lightning land ~25% harder than against a baseline Knight (no Resonance)?

If yes: status-side `modifyResistance` is working in damage resolution; the bug is display-only for status-side. Equipment-side may still be broken in resolution (bug 5 confirms that).

If no: status-side is broken in resolution too. Both paths fail.

This determines whether the fix scope is:
- **(A) Display-only fix:** unit panel / projection / damage paths read raw values without consulting the hook chain. One fix at the read site(s).
- **(B) Substrate fix:** the contribution path itself doesn't fire correctly. Deeper investigation; may need to follow each contribution from equipment/status to hook registration to chain execution.

**Diagnostic for bug 3 — Rasp Pendant magic-damage gap:**

Add a trace log or inspect dev tools when Lightning Mage casts a spell with Rasp Pendant equipped:
- Does `onFinalDamage` fire for the caster's wielder context?
- If yes: the drain contributor's gate is rejecting magical-damage contexts.
- If no: spell damage isn't reaching postFinalize, OR the wielder context isn't being passed to the hook fire site.

**Diagnostic for bug 4 — Bolt Hammer proc-on-miss:**

Audit `ctx.hit === true` gate in the attack proc contributor. Check: does `ctx.hit` get set before the proc gate is evaluated? Or is the proc evaluation running on a pre-hit-roll ctx that has `hit: false` (or `undefined`) interpreted as "fire"?

### Architectural decisions

After the audit:

1. **Resistance pipeline fix scope.** Once the diagnostic determines display-only vs substrate-level, scope follows naturally. If substrate-level, this becomes the largest item in 31.5 and may benefit from an ADR clarifying the resistance-contribution chain. If display-only, this becomes a moderate UI fix touching three sites.

2. **Bolt Hammer proc gate fix.** Direct fix: ensure `ctx.hit === true` is set before the proc contributor evaluates, OR ensure the gate is strict (rejects `false` AND `undefined`). Audit identifies which.

3. **Rasp Pendant magic-damage drain.** If `onFinalDamage` isn't firing for spell casters, fix the pipeline trigger. If the contributor gate is over-eager, remove the offending gate per ADR-0065.

4. **Don't Move / Don't Act menu gating shape.** Two reasonable shapes:
   - **A — Disable the menu button** (greyed out, tooltip explains why).
   - **B — Hide the menu button** entirely when restricted.
   
   **Recommendation: A.** Maintains menu spatial consistency; surfaces the restriction to the player rather than silently disappearing options. Soft-lock fix is separate — if the player somehow does click a tile in a restricted state (defensive code), the click is no-op'd and the UI returns to top-level cleanly.

5. **Shell / Auto-Regen display convention.** Implementation detail: the display formatter reads the status-effect's `displayName` field. Audit confirms whether `regen_auto` has a `displayName: 'Regen'` field, and whether Shell does too. Normalize.

6. **`isRiderCast` helper placement.** Lives in `src/engine/actions/payload-helpers.ts` (or equivalent) as a pure predicate. Five call sites swept.

7. **`envelopeFor` exhaustive switch shape.** Per ADR-0068 flag: `default: { const _exhaustive: never = action; return _exhaustive; }`. TS error surfaces on any new `ActionType` addition. Runtime fallback can be `throw new Error(...)` for surface visibility or empty-object for silent recovery — audit picks per existing conventions.

8. **Polish queue inclusion criteria.** Items above are the recommended subset. Final inclusion depends on:
   - Total estimated session size (don't blow 31.5 into 31.5/32 split)
   - Chris's notes on which polish items came up most visibly during playtest
   - Whether tooltip / AI / calibration fold-ins fill scope

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land in roughly this order: bug fixes first (priority by severity), refactors second, polish-queue items third.

### Item 1: Resistance pipeline fix (bugs 2 + 5)

- Diagnostic determines fix scope (display-only vs substrate-level)
- Fix at identified site(s)
- Regression test: equipment-side resistance (Wizard's Robe + Capacitor Ring on Earth Mage) shows correctly in panel + projection + resolution
- Regression test: status-side resistance (Wand of Depths Resonance) shows correctly in panel + projection + resolution
- Regression test: combined (status + equipment) shows correct net via additive composition
- Regression test: Earth Mage absorbs Lightning damage end-to-end (ADR-0057 healing)

### Item 2: Bolt Hammer proc-on-miss fix (bug 4)

- Audit identifies whether `ctx.hit` is set before proc evaluation, OR whether the gate is non-strict
- Fix: enforce `ctx.hit === true` (strict) at the contributor's gate
- Regression test: missed swing → no proc fire (deterministic seed)
- Regression test: hit swing → 25% proc fire rate over N rolls (deterministic seed)
- Verify no spurious proc fires now appear in existing demo battles

### Item 3: Rasp Pendant magical-damage drain fix (bug 3)

- Audit identifies root cause (pipeline doesn't reach postFinalize for spells, OR contributor gate is over-eager)
- Fix at root cause
- Regression test: Lightning Mage with Rasp Pendant casts Water Strike on a target → 10% of final damage drained as MP
- Regression test: same with Lightning Strike (cast, not procced)
- Regression test: physical-damage drain still works (no regression from bug 4's fix scope)

### Item 4: Don't Move / Don't Act menu gating (bug 6)

- Move button disabled (recommendation A) when wielder has Don't Move active
- Secondary-action panels (or top-level Act button, audit decides which is the cleaner gate) disabled when wielder has Don't Act active
- Defensive: if a click somehow reaches a restricted action's target-selection state, no-op the click and return to top menu cleanly
- Regression test: Don't Move applied → Move button shows disabled; tile-click does nothing harmful
- Regression test: Don't Act applied → Act button (or secondary panels) disabled; no soft-lock

### Item 5: Shell / Auto-Regen duration display normalization (bug 1)

- Display formatter reads the status effect's `displayName` consistently
- Normalize `regen_auto.displayName` to "Regen" (matching cast Regen) and `shell.displayName` to "Shell"
- Render format: `{displayName} ∞` (or equivalent permanent-duration glyph)
- Tests: status-list rendering for Shell and Regen reads consistently

### Item 6: `isRiderCast` helper consolidation

- New helper in `src/engine/actions/payload-helpers.ts` (or equivalent location): `isRiderCast(payload: UseAbilityPayload): boolean { return payload.riderSource !== undefined; }`
- Sweep five sites; replace literal `riderSource !== undefined` checks with `isRiderCast(payload)`
- Regression tests: all five rider-bypass behaviors continue to work (MP, Act, actionSpeed, Silence pre-hook, charge state)

### Item 7: `commit.ts:envelopeFor` exhaustive switch

- Convert case-switch to exhaustive switch over `ActionType`
- `default: { const _exhaustive: never = action; ... }` guard
- Runtime fallback per audit (throw or empty-object)
- Tests: regression that the existing system action types still envelope correctly
- TS strict-mode check passes

### Items 8+: Polish queue (in order of inclusion priority)

- **Status-badge polarity convention** — pairs with the tile-info effect-icon work below.
- **HP / MP / status snapshot ahead-of-tween fix** — visual correctness.
- **Renderer's HP "max" captured at mount** — sibling pattern to MP.
- **Tile-info effect-icon area** — populate per badge polarity convention.
- **Hardcoded team color palette centralization** — extract palette source.
- **Active-ring + counterpart-ring rounded-square fitment** — cosmetic.
- **rAF vs setInterval for animation drain** — perf / correctness.

Each polish item lands as a small commit with regression coverage where applicable.

### Items pending plan-review decision

- **Wizard's Robe and Staff of Power +3 MA → +4 MA tuning adjustment** (per Goal section's tuning consideration). If plan-review approves: update both items' `statMods` entries in `src/content/items/`. Mechanical change is trivial (one numeric value per item). Regression test: the items' contribution to a wielder's effective MA reads correctly through the existing `runModifyStat` chain. No new substrate; no ADR.

If declined at plan-review: no implementation work. Considered-and-rejected note in the session handoff.

## Acceptance criteria

**Bug fixes:**

- Wizard's Robe + Capacitor Ring + Earth Mage class baseline composes correctly: unit panel shows Lightning resistance ~150, Fire resistance -50, Water resistance -25, Earth resistance -25 (or whatever the correct math yields).
- Lightning damage on the Earth Mage triggers absorption healing (HP goes up, action log shows tag-flip).
- Wand of Depths Resonance on the Knight modifies displayed Knight resistances (+25 Fire, -25 Lightning); subsequent Lightning damage lands ~25% harder.
- Bolt Hammer misses produce no Lightning Strike proc emissions (deterministic-seed verification).
- Bolt Hammer hits produce Lightning Strike procs at the expected 25% rate (over a multi-swing run).
- Lightning Mage's Water Strike / Lightning Strike with Rasp Pendant drains 10% of the final damage as MP (verifiable via action log + MP delta).
- Knight with Don't Move applied: Move button visibly disabled; tile clicks during restriction do not soft-lock; turn can be ended normally.
- Knight with Don't Act applied: Act options disabled per audit; no soft-lock.
- Sorcerer's Robe + Tintinibar units show Shell and Regen status displays in consistent format with permanent-duration glyph.

**Refactors:**

- `isRiderCast` helper centralized; all five sites updated; tests pass.
- `commit.ts:envelopeFor` exhaustive switch; TS strict-mode passes; new ActionType additions surface compile-time error.

**Polish (per inclusion):**

- Each included polish item has its own acceptance criterion. Will be itemized once scope is finalized.

**Quality:**

- Tests at 846+, 0 failing.
- New tests proportional to bug fixes (regression coverage at minimum).
- ADRs where the resistance pipeline fix surfaces substrate-level changes (TBD per diagnostic).
- `docs/handoff.md` updated.

## Out of scope

- **Phase D content** — Cluster 6 / map mechanics / River Ridge. Session 32.
- **Option B authored-description pass** — Option-A auto-formatter is landing well per Chris's playtest read; Option B deferred to post-current-roadmap (post-Phase F or later).
- **Multi-command-set substrate refactor** — beyond Magus Crown wiring (already done). Future work if more variety surfaces.
- **Ally-targetable wand swings** — S31 deferral; reassess later.
- **Pre-battle UI surfaces** — Phase E.
- **Surrender flow, MVP-unit algorithm, permadeath timer, settings expansion, reactions in projection column** — Phase E/F.
- **AI tactics-layer pass (active absorption exploitation)** — design call to defer until after Phase D content adds more substrate to plan tactics over.

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**Bug fixes:**
- `src/engine/hooks/runners.ts` — possibly, if `runModifyResistance` composition is the issue
- `src/engine/equipment/` — equipment-side resistance contribution path
- `src/engine/damage/pipeline.ts` — if spell damage doesn't reach postFinalize
- `src/engine/equipment/attack-proc-contributor.ts` (or wherever) — bug 4 gate fix
- `src/engine/equipment/final-damage-drain-contributor.ts` — bug 3 gate fix if over-eager
- `src/ui/unit-detail-panel.tsx` — resistance display, status-display consistency
- `src/ui/forecast-panel.tsx` (or equivalent) — projection resistance read
- `src/ui/action-menu.tsx` — Don't Move / Don't Act menu gating
- `src/content/statuses/regen_auto.ts` and `shell.ts` — display name normalization if needed

**Refactors:**
- `src/engine/actions/payload-helpers.ts` (or new file) — `isRiderCast` helper
- `src/engine/actions/validate.ts`, `reducers.ts`, `commit.ts` — sweep sites
- `src/engine/actions/commit.ts:envelopeFor` — exhaustive switch

**Tests:**
- `src/engine/actions/session-31-5-integration.test.ts` — bug-fix regression coverage
- Individual unit tests as needed

**ADRs:**
- `docs/decisions/0069-...` (next available) if resistance pipeline fix surfaces substrate-level design changes
- Otherwise none

**Documentation:**
- `docs/handoff.md` — session handoff

## Workflow notes

- **Plaintext-first review required.**
- **Diagnostic-first within the plan.** The resistance pipeline bug's fix scope hinges on whether the issue is display-only or substrate-level. Don't pre-commit to a fix shape before the diagnostic runs.
- **Bug-fix priority order:** bug 5 (resistance pipeline — possibly largest scope) → bug 4 (proc on miss — substrate gate) → bug 3 (Rasp magic damage — substrate gate) → bug 6 (Don't Move menu — UI/state) → bug 1 (display normalization — cosmetic).
- **ADR path is `docs/decisions/`.**
- **Mid-session design questions** route through Chris to the planner. Most likely surface: whether the resistance pipeline fix needs an ADR (substrate-level changes warrant one; display-only fixes don't); polish-queue inclusion calls if scope balloons.
- **Equipment-complete milestone holds.** No new content items in this session.
- **Pre-flight verification:** confirm demo battle still launches cleanly before any fix lands. Run existing 846-test suite to confirm baseline.

## Watch-fors

**Addressed this session:**

- Resistance pipeline display + resolution correctness (playtest bugs 2 + 5)
- Bolt Hammer proc-on-miss substrate bug (playtest bug 4)
- Rasp Pendant magical-damage drain gap (playtest bug 3)
- Don't Move / Don't Act menu gating + soft-lock (playtest bug 6)
- Shell / Auto-Regen duration display consistency (playtest bug 1)
- Rider bypass consolidation refactor (S31 handoff)
- `envelopeFor` exhaustive switch (S31 handoff defensive add)
- Status-badge polarity convention (S22 carry — included)
- Hardcoded team color palette (S25 carry — included)
- Active-ring + counterpart-ring fitment (S26.5 carry — included)
- Tile-info effect-icon area (S26.5 carry — included)
- HP/MP/status snapshot ahead-of-tween fix (S22 carry — included)
- Renderer's HP "max" captured at mount (S28 carry — included)
- rAF vs setInterval animation drain (S23 carry — included)
- Brief path correction (`docs/design/` not `docs/twentyOneDesign/`) — applied here for the first time post-handoff

**Not addressed this session, longer-term carry-forward:**

- **Tooltip Option B authored-description pass** — deferred to post-current-roadmap per Chris's playtest read (Option A auto-formatter landing well)
- **Wand swing ally-targetability** — S31 deferral
- **AI active absorption exploitation** — S27 carry; tactics-layer pass deferred
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry; optional refinement
- **Procced spell uses caster's MA — playtest read** — S30 carry; initial read reasonable, longer-term observation continues
- **Magus Crown -3 MA cost calibration** — initial read reasonable; +5 MA / +25% MP cost tighteners remain available if future playtest reveals issue
- **Burn × Purifier playtest** — no Purifier in v1 demo; one-off battle setup needed
- **Tintinibar Regen tuning playtest read** — initial read reasonable, longer-term observation continues
- **Sorcerer's Robe Move +1 playtest read** — initial read reasonable, longer-term observation continues
- **`pa_factor` NotYetImplementedError** — audit E3
- **TS strict-mode test errors** — audit E8
- **Surrender flow** — S34
- **MVP-unit smarter algorithm** — S24 Wave 1
- **Permadeath timer** — S24 Wave 1
- **Settings expansion** — S24 Wave 1
- **Reactions in projection column** — S24 Wave 1
- **Bug 1** (S24.5 / ADR-0046): no recurrence S25–31
- **Vite HMR cache invalidation** — occasional
- **Bedrock Stride fall-immunity** — untested until River Ridge (S33)
- **Forecast accuracy row visibility** — S30 carry; rejected unless playtest reveals confusion
- **Forecast facing uses actual attacker→target geometry** — S30 carry; no v1 hypothetical-position projection
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in** — S30 carry
- **`onTurnStart` symmetric widening** — S26 carry; defer until emitter
- **Multiplicative tick-amount stacking** — S28 carry; no v1 stacking case
- **`onFinalDamage` fires on absorbed hits but handlers gate** — design pattern, not a problem
- **Item #5 pacing constants** — S26.5 carry; tuning pending playtest
- **Constant-map labels don't carry icons today** — migration seam in place; future polish
- **AoE preview correctness across all shapes** — S23 carry; confirmed shape-agnostic

## Estimated size

**Medium.** Five bug fixes range from likely-small (display normalization, menu gating) to potentially-medium (resistance pipeline, depending on diagnostic outcome). Two refactors are well-scoped. Polish queue subset is small-each-but-multiple. The resistance pipeline bug is the largest uncertainty — if it's substrate-level with new ADR-worthy design, that alone could be moderate.

**31.5a/31.5b split allowance:** if the resistance pipeline bug turns out substrate-level AND requires significant rework, natural split is 31.5a (resistance pipeline fix only + ADR) / 31.5b (remaining bugs + refactors + polish). Otherwise no split needed.

**Pending plan-review decision:** Wizard's Robe / Staff of Power +3 → +4 MA tuning. If approved, scope addition is trivial (two numeric values + regression coverage). If declined, no scope change.

End of session: Phase D ready (Session 32 — Cluster 6 / map mechanics / River Ridge). No new triggered check-in unless 31.5 surfaces design-level surprises.
