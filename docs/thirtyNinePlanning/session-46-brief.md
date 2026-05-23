# Session 46 Brief: Playtest Tuning + Bug Fixes (Hunter / UI / Status Mechanics)

## Context

S45 closed with the Hunter class + bow weapon substrate + Riptide Bow + three follow-up items (Mantle of Protection, Wand of Lumen, Ironfoot) + new `modifyStatusApplicationStackCount` hook. 1342 tests / 119 files. The in-battle layer was not feel-verified at the end of S45 — Chris has now playtested and surfaced a batch of items that need attention before more content work lands.

**Session character:** tuning + bug-fix pass. Different from substrate sessions — multiple discrete items, each bounded, ordered by gameplay correctness first then UI polish. No new substrate, no new content.

Six items in scope; one item logged for future (not addressed this session).

Scope: **Medium.** Items individually small, but compound across six fixes + verification. Audit per item; no expected substrate work.

## Inputs (read first)

In recommended order:

1. `CLAUDE.md` — project conventions.
2. `docs/handoff.md` — S45 close, including the in-battle verification gap.
3. `docs/playtest-watch.md` — existing watch-fors; this session's playtest reads add to / refine these.
4. `docs/decisions/0079-ko-status-interaction.md` — relevant to status duration ticking (Stop).
5. `docs/decisions/0083-weapon-substrate.md` — bow variance pipeline, target-context variance.
6. `docs/decisions/0076-permadeath-timer-and-removed-units.md` — `removed` state semantics (relevant to permadeath visual).
7. `docs/conventions/action-types.md` — wiring discipline.
8. `damage-resolution.md`, `ct-system.md`, `status-effects.md` — foundational reference for each item.

### Targeted audits per item

(Detailed in Implementation work below; each item gets its own audit pass.)

## Goal

End state — each item resolved or explicitly deferred:

**Gameplay correctness:**

1. **Bow damage projection** matches actual damage formula. Specifically: height-delta variance is accounted for in the projection; hit chance is *not* folded into damage range.
2. **Charging target hit guarantee** verified — physical attacks on charging targets cannot miss (confirm design intent; confirm or implement).
3. **Stop duration ticking** decrements each time the Stopped unit would have a turn (CT drained + duration decremented per FFT-canonical mechanic).

**UI polish:**

4. **Terrain bar** stays in frame (padding fix) and doesn't vanish mid-battle (state-management fix).
5. **Permadeath unit visual** distinguishes from KO'd units — sprite removed from field entirely (FFT-style), badge no longer needed.
6. **Zoom max** bumped by a small amount (art holds up at current max; can support slightly more).

**Logged for future, NOT addressed this session:**

7. **Move/map size tuning observation** — units routinely have 5-7 Move on a 14×14 map → first turn often includes combat. Future tuning options: (a) reduce baseline Move by 1 across all classes, (b) make future maps larger (16×16 or 18×18). Log for the second-map design session; this brief does not act on it.

**Quality:**
- Tests at 1342+, 0 failing. Most fixes will add coverage (variance projection, charging hit guarantee, Stop ticking).
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated with playtest signal from this round (Hunter feel, AI deployment, etc.).
- Browser-verified in actual battles — each fix exercised in play, not just at test layer.

## Pre-implementation plan

This session's plan is structurally different from substrate sessions — each item is small and independent. Audit per item; no expected cross-item refactor.

### Required first step: per-item audit

For each item (1-6), implementer audits to:
- Confirm the bug exists / understand the root cause.
- Identify the fix scope.
- Surface to Chris (via planner) if the audit reveals the issue is larger than the brief assumes, or if a fix interacts non-obviously with other systems.

The audit-and-fix character means a single plan-review checkpoint after all six audits is appropriate, *unless* any one item surfaces unexpected complexity — in which case surface immediately rather than batching.

### Architectural decisions (minimal)

After audits:

1. **Damage projection format (per D1).** Recommend: show damage as a *range* (min variance damage to max variance damage), where variance uses the actual context (attacker, target, height delta, ability, weapon). Do NOT multiply by hit chance — hit chance is displayed separately. Single-number expected-value displays mix concerns and obscure both.

2. **Charging hit guarantee (per D2).** Audit determines whether it's implemented or not.
   - If implemented and working: add test coverage if missing; close the item.
   - If implemented but broken: fix.
   - If not implemented: Chris confirms design intent (very likely yes per his recollection), implement, add test coverage.

3. **Stop duration ticking (per D3).** Audit the Stop status's tick logic.
   - If CT isn't being drained on the fake turn, duration doesn't decrement → unit keeps "having turns" instantly. Fix: drain CT on fake turn per FFT canon.
   - If CT is being drained but duration isn't decrementing, that's a different bug location.
   - Audit determines which.

4. **Terrain bar padding (per D4 part 1).** CSS-level fix. Investigate top padding / margin on terrain bar; ensure it doesn't clip out of frame on standard viewport sizes.

5. **Terrain bar vanishing (per D4 part 2).** State-management bug. Audit conditional render / visibility state for the terrain bar component. Repro by triggering the same conditions Chris hit (second battle, mid-battle). Reset-to-main-menu restores it → state isn't cleared properly between battles.

6. **Permadeath visual (per D5).** Renderer-level fix. Units in `removed` state should not render. Per S43's KO'd-pathing work, the engine already treats `removed` units as non-occupants; the renderer just needs to hide them. Badge added in S41 can be retired (or kept as a brief in-place fade before removal — implementer's call on transition).

7. **Zoom max (per D6).** Config value bump. Implementer picks a value in "small" range (e.g., +25-50% of current max) based on art rendering quality.

### Decision points

(Mostly audit-driven; a few need Chris confirmation.)

**D1 — Damage projection format.** Recommend: range based purely on variance bounds, no hit-chance multiplication. Hit chance shown separately (already is). Settle in plan-review.

**D2 — Charging hit guarantee design intent.** Recommend: confirm "physical attacks on charging targets cannot miss" is the canonical rule. This is a gameplay-rule choice; Chris confirms or revises. The mechanic exists in FFT canon (charging units are effectively defenseless against physical attacks, modeling the "you're focused on your spell" state).

**D3 — Stop duration tick mechanism.** Per FFT canon: when Stopped unit would have a turn, the turn is skipped; CT is fully drained; duration decrements by 1. Recommend implementing or fixing to match. The "fake turn" must consume CT for the duration to count down properly.

**D4 — Terrain bar fixes.** Padding fix is single-point. Vanishing-state fix needs root-cause audit. Recommend: audit reveals the conditions that cause the vanishing; fix targets the underlying state issue rather than papering over.

**D5 — Permadeath visual approach.** Recommend: full sprite removal (FFT-style). Optionally: brief fade-out transition (200-400ms) before removal for visual continuity rather than instant pop-out. Badge added in S41 becomes redundant. Implementer's call on whether to remove the badge entirely or keep it for the brief window before fade-out.

**D6 — Zoom max value.** Implementer picks. Recommend: bump by ~25-33% (e.g., if current max is 1.5×, try 2.0× or 2.25×). Verify art still renders crisply at new max.

**D7 — Note 8 (Move/map tuning) deferral.** Log in `docs/playtest-watch.md` for the second-map design session (S47+). Do not act in S46.

## Implementation work

### Item 1: Bow damage projection (high impact)

**Bug:** Hunter (PA 6, WP 7, Brave 80) shooting Brave 70 target with height advantage 5 (delta -5) projects 28 damage; actual damage is 84.

**Analysis:** Base damage = PA × WP = 42. Variance at delta -5 = Max(0, 1 - (-5)/5) = 2.0. Actual = 42 × 2.0 = 84 ✓.

Projection of 28 is consistent with: 42 × 1.0 (height-blind variance) × ~0.66 (Eagle Eye accuracy) ≈ 27.7. So *two* bugs compound:
- Projection ignores height delta (uses default variance 1.0).
- Projection multiplies by hit chance (it shouldn't — hit chance is shown separately).

**Fix:**
- Damage projection's variance calculation reads the same `(attacker, target, action)` context as actual damage resolution — ensures height delta (and any other future target-context variance) is reflected.
- Damage projection does not multiply by hit chance. Output is the damage range (min/max) given variance bounds; hit chance display remains separate.

**Tests:**
- Projection matches actual damage for various bow shot scenarios (same-height, +4 above, -5 below, etc.).
- Projection format is range, not single number.
- Hit chance no longer factored into damage projection numerically.

### Item 2: Charging target hit guarantee (medium impact)

**Bug:** Chris recalls physical attacks on charging targets should be guaranteed hits. Unclear if implemented.

**Fix (audit-driven):**
- Audit the hit-chance calculation for charging-target case.
- If implemented and working: add test coverage if missing; close.
- If implemented but broken: fix.
- If not implemented: implement. Charging units' hit chance against incoming physical attacks → 100% (or attacker's hit chance is forced to 100% in the resolution pipeline).

**Tests:**
- Attacking a charging unit with a physical attack guaranteed to land.
- Attacking a non-charging unit unaffected.
- Test covers both melee and ranged physical attacks (bows count).

### Item 3: Stop duration ticking (medium impact)

**Bug:** Stop applied via Shadow Stitch, duration stays at 3 across multiple of the target's "turns." Target's turns coming up frequently (suggesting CT isn't draining).

**Analysis:** Per FFT canon, Stopped unit's "turn" should: (a) skip the action, (b) fully drain CT, (c) decrement Stop duration by 1. Chris's observation suggests at least (b) and (c) aren't happening.

**Fix (audit-driven):**
- Audit the turn-loop / scheduler handling of Stopped units.
- Confirm fake turn consumes CT (per FFT canon).
- Confirm duration decrements on each fake turn.

**Tests:**
- Stop applied at duration 3.
- After one fake turn: duration 2, CT drained.
- After three fake turns: status cleared.
- Other status durations (Slow, Burn, Poison) verified unchanged (regression check).

### Item 4: Terrain bar UI (lower impact, two parts)

**Bug A:** Padding at top is off — bar runs off frame.
**Bug B:** Bar vanishes mid-battle; restored after Main Menu → new battle.

**Fix (audit-driven):**
- *Padding:* CSS audit on terrain bar container; adjust margins/padding to keep it in viewport.
- *Vanishing:* Audit the conditional render / visibility state. Most likely: state cleared during some battle transition (e.g., turn end, status application) but not restored. Repro steps: start battle, play through to the trigger point. Reset-to-Main-Menu cleanly initializes everything, hiding the bug.

**Tests:**
- Snapshot test on terrain bar visibility across full battle lifecycle.
- Manual: start second battle, exercise to repro trigger; verify bar remains.

### Item 5: Permadeath unit visual (lower impact)

**Bug:** Permadead unit visually too similar to KO'd unit; FFT-canonical removal-from-field not yet rendered.

**Fix:**
- Renderer hides sprites of units in `removed` state.
- Optionally: brief fade-out transition before removal (200-400ms) for visual continuity.
- The S41 permadeath badge becomes redundant; either remove it or keep for the pre-fade window.

**Tests:**
- Snapshot / DOM test: unit in `removed` state has no sprite.
- Unit in KO'd state retains sprite (regression check).

### Item 6: Zoom max bump (lower impact)

**Bug:** Current zoom max is conservative; art holds up at slightly higher zoom.

**Fix:**
- Update zoom max constant. Implementer picks within ~25-33% bump.
- Verify camera bounds + UI layout still work at new max.

**Tests:**
- Existing zoom tests pass with new max.
- Manual: zoom in to new max, verify rendering quality and no UI overlap.

### Item 7 (deferred): Move/map size tuning

**Not addressed in S46.** Log in `docs/playtest-watch.md` for second-map design session:
> *Observation:* Units commonly have 5-7 Move on a 14×14 map; first turn often includes combat. Tuning options for future maps and balance review: (a) reduce baseline Move by 1 across all classes, (b) make future maps larger (16×16 or 18×18). Either or both, decision in second-map design session.

### Other potential playtest signal to surface in `docs/playtest-watch.md`

While implementing the above, the implementer should add any additional playtest reads they encounter in browser verification. Likely candidates given Chris's playtest:

- Hunter feel — bow accuracy at Eagle Eye 66%, height-delta damage in actual play.
- AI Hunter deployment (HP-only sort puts Hunter middle of zone; tactical identity wants high ground or back-line).
- Riptide Bow CT push (does ~18 ticks feel meaningful, or weak/strong?).
- Any other surface that emerged during the playtest pass.

## Acceptance criteria

**Per-item:**
1. Bow damage projection matches actual damage formula in all variance contexts. No hit-chance multiplication. Range display.
2. Charging target hit guarantee implemented (or confirmed working). Test coverage in place.
3. Stop duration decrements on fake turns. CT drains on fake turns.
4. Terrain bar in frame across battle lifecycle. No vanishing.
5. Permadeath sprite removed from field. KO'd sprite remains.
6. Zoom max bumped within recommended range.

**Quality:**
- Tests at 1342+, 0 failing.
- All six items browser-verified in actual battles (not just unit tests).
- `docs/playtest-watch.md` updated with playtest signal + the move/map-size deferral note.
- `docs/handoff.md` updated.

## Out of scope

- **Move/map size tuning** (Note 8) — logged for second-map design session.
- **Second map design** — was S46 candidate before this tuning round; now S47 candidate.
- **Calculator class** — later in roadmap.
- **5v5 unlock** — later in roadmap.
- **Equipment expansion** (Hi-Potion / Holy Water / Elixir + accessories) — displaced; later.
- **Charm/Seduction substrate** — dedicated future session.
- **Pyromancer R/S/M consolidation** (S41 carry).
- **Knight base-PA recalibration** (S41 D2 carry).
- **AI deployment role-aware sorting** (S43 carry; Hunter sharpens case but tuning waits).
- **Speed Save / Updraft per-swing reaction cap** (S42 D5 deviation).
- **Renderer-side multi-swing animation polish** (S42 carry).
- **Pass-and-play UX refinements** (S43, playtest-driven).
- **content-id-registry.md broader reconciliation** (S44 carry — pre-S45 staleness).
- **Border/borderColor React dev warnings** (S43 + S44 carry).
- **`assignAiTeamNames` removal** (carry).
- **ActionType-wiring smoke test** (carry).

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Item 1 (damage projection):**
- `src/engine/damage/projection.ts` (or equivalent) — projection variance calculation.
- `src/engine/damage/__tests__/projection.test.ts` — coverage.
- UI component rendering the damage forecast — display format.

**Item 2 (charging hit guarantee):**
- `src/engine/damage/hit-chance.ts` (or equivalent) — charging-target case.
- `src/engine/status/charging.ts` (or equivalent) — status definition / interactions.
- Test coverage.

**Item 3 (Stop tick):**
- `src/engine/scheduler/turn-loop.ts` (or equivalent) — fake-turn handling.
- `src/engine/status/stop.ts` (or equivalent) — duration decrement logic.
- Test coverage.

**Item 4 (terrain bar):**
- `src/ui/battle-screen.tsx` (or wherever terrain bar lives) — padding + state.
- CSS module for terrain bar component.
- Snapshot tests.

**Item 5 (permadeath visual):**
- `src/renderer/unit-sprites.ts` (or equivalent) — sprite render gate.
- Badge component (retire or fade-window).
- Tests.

**Item 6 (zoom max):**
- `src/renderer/camera.ts` (or equivalent) — zoom max constant.

**Docs:**
- `docs/handoff.md` — updated at session close.
- `docs/playtest-watch.md` — playtest signal + move/map deferral note.
- ADR not anticipated — these are bug fixes and small UI changes, not design calls. Possible exceptions: if charging-hit-guarantee implementation is genuinely new (not just verified), that warrants an ADR; if Stop tick mechanic gets a substantive redesign rather than a fix, that warrants an ADR.

## Workflow notes

- **Plaintext-first review required.**
- **Per-item audits.** Implementer can batch-audit at the start, then batch-fix, or interleave audit-fix per item. Implementer's call. Single plan-review checkpoint after all audits is fine *unless* any audit surfaces unexpected complexity (then surface immediately).
- **Browser verification per item.** This session's items are largely playtest-surfaced, so playtest-verification matters more than usual. Don't close items based on unit-test pass alone; drive each fix in actual battle.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: charging hit guarantee design confirmation (D2), Stop tick mechanic edge cases, terrain bar vanishing root cause if it's a state-management issue with wider implications.
- **Phase F session** — playtest signal continues to accumulate. The "Other potential playtest signal" surfacing is genuinely useful; record observations even if not fixed in this session.

## Watch-fors

**Addressed this session:**
- Bow damage projection vs. actual (height-delta variance + hit-chance separation).
- Charging target hit guarantee.
- Stop duration ticking.
- Terrain bar visual bugs.
- Permadeath unit visual distinction.
- Zoom max.

**Not addressed this session, longer-term carry-forward:**
- Move/map size tuning (Note 8 — logged for second-map session).
- Second map design.
- All carries from prior handoffs (Calculator class, equipment expansion, 5v5, etc.).
- All standing playtest watch-fors (Pin Down EV, Riptide tuning, Eagle Eye, AI deployment, elevation safe zones, etc.).

**Watch-fors specific to this session:**

- **Damage projection edge cases.** Once height-delta variance is in the projection, watch for: projections at variance-clamp boundaries (Delta ≥ 5: damage 0; Delta = 0: damage 1.0), accuracy display visibly separated from damage, range formatting (does "0-0" display correctly for unhittable targets?).
- **Charging hit guarantee interactions.** If implemented, watch for: does it interact correctly with The Offering's multi-swing (each swing guaranteed?), with Charged Attack's own charging state (mutually exclusive — charging attacker vs. charging target), with Counter reactions, etc.
- **Stop tick edge cases.** Watch for: Stop on a unit that's also Slowed (slower CT progression × stopped → very slow recovery), Stop on a unit at exactly the CT trigger (boundary case for first decrement), Stop on a unit with permanent statuses persisting through KO (ADR-0079) — should not interact, but verify.
- **Terrain bar state-management ripple.** If the vanishing bug's root cause is broader (e.g., a state initialization issue affecting multiple components), watch for other affected surfaces during the fix.
- **Permadeath sprite removal animation polish.** Initial fix is just "render or don't"; if Chris wants a fancier transition (fade, particle effect, etc.), that's polish work for a later session.
- **AI Hunter deployment sharpens role-aware sort case.** Continue to log in playtest-watch as a future carry; not addressed this session.

## Estimated size

**Medium.** Six items, each bounded but compounding. No new substrate, no new content. The audit-per-item character means the implementer can pace incrementally.

**No split contingency anticipated.** Items are independent; if budget runs out partway, remaining items stay as carry. Likely ordering by impact: items 1-3 (gameplay correctness) before items 4-6 (UI polish), unless audits reveal an ordering that batches better.

**Stretch indicator:** if items 1-6 complete with substantial budget remaining, the implementer can:
- Add the AI deployment role-aware sort (S43 carry) — the Hunter playtest provides the empirical case.
- Tackle one of the small maintenance carries (border warnings, `assignAiTeamNames` removal).
- Drive additional playtest passes to surface more signal.

Stretch items are opportunistic; not core scope.
