# Session 41 Brief: KO/Status Redesign + R/S/M Review + Polish Pass

## Context

S40 closed with three knives shipped (Chef's Knife / Magebane / Sai) on a dynamic-variance substrate, plus a substantial rename pass that landed the four Mage classes as Geosage / Hydrologist / Pyromancer / Aethurge with ability renames throughout. The guide caught up in a follow-on session.

S41 turns to **status system polish + Knight kit review**. The session has three substantive pieces:

1. **KO/status interaction redesign** — currently, KO is treated as terminal-until-Phoenix-Down with no defined behavior around what happens to other statuses on the KO'd unit. Playtest signal says this is too lossy / too sticky in different directions. New rule: **statuses with infinite duration persist through KO and revival; statuses with finite duration clear at KO**. Substrate work + ADR.

2. **R/S/M ability review — Knight kit** — accumulated cruft from early builds (notably "very basic Move +1") needs identification and refresh. Discussion-first work: implementer surfaces what's there, walks through with Chris (via planner), settles changes. Implementation gated on scope — if more than 2 substantive rewrites surface, the heavier ones defer to S42.

3. **Polish pass** — Alchemist Team Builder description missing; renderer-side permadeath badge for visibility; ActionType-wiring discipline promoted to a durable doc. Three small items.

Scope: **medium.** Substrate piece (KO/status) is bounded; review piece is discussion-heavy with capped implementation; polish is small. No split anticipated; R/S/M scope-gate is the safety valve.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions; check whether ActionType-wiring checklist has been lifted from the S39 handoff (one of S41's polish items).
2. **`docs/handoff.md`** — S40 close + guide catchup. Notable: rename pass landed; knife substrate live; some status durations were rebalanced in S40 (Regen 36→10, Don't Act 24→3, Movement Debuff 24→4).
3. **`status-effects.md`** — current status taxonomy, duration encoding, application/expiry mechanics. Central to the KO/status work.
4. **`action-resolution.md`** — damage pipeline; KO transition path.
5. **`docs/decisions/`** — particularly ADR-0076 (permadeath timer + `removed` state) and any prior ADRs touching status lifecycle. Establishes precedent for KO state machine extensions.
6. **`ability-slots.md`**, **`ability-format-spec.md`** — R/S/M class-slot conventions; needed for the Knight kit review.
7. **`content-snapshot.md`** — current Knight loadout (class definition, equipped abilities) as the review's starting point.
8. **`four-mages-design.md`** — reference for what "well-designed R/S/M" looks like in this project's design vocabulary.

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/engine/status/` (or wherever statuses live) — definition shape, especially duration encoding (is "infinite" a discrete state, a sentinel value, or a very large number?). The KO/status rule's implementation depends on how duration is currently typed.
- `src/engine/lifecycle/` — KO transition path. Currently what happens to non-KO statuses when a unit transitions to KO? Audit may reveal "nothing" (statuses just stick) or "all clear" (already cleared) or "some clear" (partial behavior).
- `src/engine/lifecycle/` — revival path (Phoenix Down). What does the revival sequence currently do to statuses? S39 implementation set HP=1+heal, removed KO, reset turnsKOd, reset CT — but didn't address other statuses.
- `src/content/classes/knight.ts` — Knight's current R/S/M abilities. Review starting point.
- `src/content/abilities/` — definitions for whatever abilities the Knight equips. Look for early-build markers (sparse data, generic names, placeholder-feeling formulas).
- `src/ui/team-builder/` — class picker UI for the Alchemist description fix.
- `src/renderer/` — KO'd unit rendering; permadeath countdown surface for the badge work.

## Goal

End state:

**KO/status substrate:**
- New rule lands: **infinite-duration statuses persist through KO and revival; finite-duration statuses clear at KO**.
- Auto-statuses (equipment/passive-granted) are implicitly handled by the rule — they have infinite duration, so they persist; revival sees them already present, no special re-grant logic needed.
- ADR written documenting the rule, the corner cases (Burn / Cataclysm Poison / Magnetic Mark Vulnerable using indefinite-duration encoding), and the rationale for accepting them as simplicity trade-offs.

**R/S/M review:**
- Knight's current R/S/M kit audited and walked through with Chris.
- Identified placeholders (e.g., "very basic Move +1") replaced or refreshed; deliberate v1 choices retained.
- Scope-gated: if more than 2 substantive rewrites surface, the heavier ones defer to S42 with a documented plan.

**Polish:**
- Alchemist Team Builder description authored and surfaced under the icon, matching the other five classes' pattern.
- Renderer-side permadeath badge on KO'd units (numeric countdown + visual differentiation from "KO'd, recoverable" baseline).
- ActionType-wiring discipline lifted to a dedicated process doc (recommend `docs/conventions/action-types.md` or similar).

**Quality:**
- Tests at ~1230+, 0 failing (rough estimate; +20-30 across KO/status behavior, Knight kit changes, polish items).
- New ADR for KO/status rule.
- `docs/handoff.md` updated.
- Browser verification: a unit accumulates several statuses (mix of infinite and finite), gets KO'd, gets revived; expected statuses persist/clear correctly.

## Pre-implementation plan (required)

Audit-first per project conventions.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it. Particularly important for:

- **Status duration encoding.** Is "infinite duration" a discrete value (e.g., `duration: 'infinite'` or `duration: null`) or a magic-number sentinel (e.g., `Infinity` or `99999`)? The KO/status rule needs a clean predicate `isInfiniteDuration(status)`; the audit confirms the shape and proposes the predicate.
- **KO transition path.** What currently happens to a unit's statuses at the moment of KO? Audit and report. If "nothing happens" (statuses stick), the rule is additive (clear finite ones); if "all clear" or "some clear," the rule revises existing behavior.
- **Revival path.** S39 ADR-0076 added the revival sequence. Confirm the steps and identify where the new status-handling fits.
- **Charging status.** Confirm Charging clears at KO (Chris's belief, audit double-checks). If it doesn't currently, the new rule handles it (Charging is finite duration), but worth surfacing the current state.
- **The three corner cases.** Confirm Burn, Cataclysm Poison, and Magnetic Mark Vulnerable are implemented as infinite-duration statuses (their tick mechanic doesn't tie to a duration countdown). Under the new rule, these persist through KO — the accepted simplicity trade-off. If any of the three use a different duration encoding, surface it.
- **Knight R/S/M kit.** Catalog the Knight's current Reaction / Support / Movement equipped abilities + the available abilities the Knight can equip from its native slots. Identify candidates for review.

### Architectural decisions

After the audit:

1. **KO/status rule predicate.** Recommend deriving from duration field directly (`isInfiniteDuration(status)` — no separate `clearedByKO` flag). Rationale: single source of truth; new statuses don't need a separate flag; the corner cases are accepted as-is. Fallback if duration encoding is messy: add an explicit `clearedByKO: boolean` flag with a default derived from duration shape.

2. **KO transition vs. revival placement of the clear logic.** The rule says "clear at KO." Implementation could:
   - **Clear-at-KO**: when the unit transitions to KO, walk statuses and clear finite-duration ones immediately. Revival sees a clean slate of persisted statuses.
   - **Clear-at-revival**: leave statuses untouched at KO; clear finite-duration ones at revival.
   
   **Recommend clear-at-KO** — matches Chris's framing ("KO should remove many statuses from the target when KO'd"). Also clearer in the action log (the clearing event happens at KO, not at revival). The clear-at-revival alternative is defensible if it's substantially simpler to implement, but probably isn't.

3. **Tick gating for persisted statuses.** Auto-statuses (Regen, etc.) persist through KO with infinite duration. Their tick handlers should be gated by alive state (a KO'd unit doesn't take Regen ticks). Audit confirms current tick handlers already check alive; if not, this is a small additional fix.

4. **Permadeath badge rendering surface.** Recommend: numeric badge overlaid on the KO'd unit sprite (similar to existing battlefield overlays), color-differentiated from baseline KO'd state, showing the remaining countdown. Settle visual design in-session with Chris.

5. **R/S/M review scope-gating threshold.** Recommend: if review surfaces more than 2 substantive rewrites (new ability designs, not just renames), defer the heavier ones to S42 with a documented plan. Minor refreshes (renames, formula tweaks) don't count toward the threshold.

### Decision points

(Settled in plan-review before code lands.)

**D1. Finite-duration stat buffs (e.g., Combat Focus +1 PA for 3 turns) under the new rule.** Recommend: **clear at KO** per the simplified rule. Combat Focus is the Alchemist's Reaction proc; losing the buff on KO+revival isn't a major design loss and keeps the rule clean. Conceptual model: persistent identity (infinite duration, equipment/class-derived) survives KO; transient situation (finite duration, proc/spell-derived) doesn't. Original framing ("preserve all stat buffs") is defensible too if Chris prefers it — that path needs an explicit `preserveStatBuff: boolean` flag separating it from generic finite-duration statuses.

**D2. Status debuffs (PA Down, MA Down, etc.) under the new rule.** Recommend: same treatment as buffs. Infinite-duration debuffs persist; finite-duration debuffs clear. This preserves Chris's note that stat debuffs shouldn't clear via KO-exploit — equipment/passive-derived debuffs (if any exist) are infinite duration, so they persist. Spell-applied debuffs are finite duration, so they clear. The "exploit" concern is bounded: a finite-duration debuff that clears on KO is essentially the same as a finite-duration debuff that ticks off; the KO just accelerates the timer.

**D3. Charging status clearing.** Audit confirms current behavior. If it already clears on KO, no work needed. If not, the new rule handles it (Charging is finite duration).

**D4. R/S/M review participation.** Recommend: implementer surfaces the current Knight R/S/M kit + the candidate ability pool at session start; planner relays to Chris; Chris settles in real-time which abilities to keep / replace / refresh. Implementer lands the changes (or defers per scope-gate). This is a planner-coordinated review, not implementer-decided.

**D5. ActionType-wiring doc location.** Recommend: `docs/conventions/action-types.md` as a dedicated process doc, not folded into `CLAUDE.md`. Rationale: CLAUDE.md is high-level conventions; ActionType-wiring is specific cross-cutting discipline that deserves its own document and can be expanded if future ActionType-adjacent disciplines emerge.

**D6. Permadeath badge visibility threshold.** Recommend: badge appears as soon as a unit is KO'd (countdown starts at 3). Alternative: badge appears only when countdown ≤ 1 ("imminent permadeath") for less visual clutter. Settle in-session with Chris based on what reads cleaner in playtest.

## Implementation work

### KO/status rule

- Add `isInfiniteDuration(status)` predicate to the status module.
- At KO transition: walk the unit's statuses; clear those failing the infinite-duration predicate.
- At revival: no additional status handling needed (persisted statuses already present; finite ones already cleared).
- ADR written: `docs/decisions/0078-ko-status-interaction.md` (or next available number) — documents the rule, the predicate, the corner cases (Burn / Cataclysm Poison / Magnetic Mark Vulnerable), and the rationale for the simplified approach.
- Confirm tick handlers for persistent statuses (Regen et al.) gate on alive state.

### R/S/M review — Knight kit

- Implementer audits the Knight's current R/S/M abilities at session start (catalog: what's equipped natively; what's available in the Knight's slot pool).
- Walk-through with Chris via planner: which abilities are deliberate v1 choices, which are early-build placeholders, what should each become.
- Settle changes; land within scope-gate (≤2 substantive rewrites).
- If more surface, document the deferred set as an S42 candidate.
- Touch the four-mage R/S/M kits opportunistically if scope allows — likely the Mages also have uneven kits given the long development arc, but full review is out of scope.

### Polish items

**Alchemist Team Builder description:**
- Author a pithy description matching the other five classes' tone and length.
- Surface in the class-picker UI.

**Renderer-side permadeath badge:**
- Numeric countdown overlay on KO'd unit sprite (3 → 2 → 1 → removed).
- Visual differentiation from baseline KO'd state (color shift, badge style — settle in-session).
- Updates each owning-team turn as the counter ticks.
- Doesn't replace the panel-side counter (per S39 implementation); supplements it.

**ActionType-wiring docs promotion:**
- Lift the five-sites checklist from the S39 handoff (validate / reduce / commit / action-log-format / animator) into `docs/conventions/action-types.md` (or per D5 settlement).
- Include the smoke-test future-work note from S39.
- Reference from `CLAUDE.md` if appropriate.

### Tests

Estimated +20-30 tests:
- KO/status behavior: unit with mixed infinite/finite statuses → KO → expected statuses present/cleared; revival → no additional changes to status state.
- Predicate correctness: `isInfiniteDuration` for known infinite-duration statuses (auto-statuses, the three corner cases) and known finite-duration ones (Combat Focus, Slow, Silence, Don't Act, Sleep, etc.).
- Charging clears on KO (confirms expected behavior).
- Tick gating: persistent status on KO'd unit doesn't tick.
- Permadeath badge rendering: badge appears at KO; count decrements per owning-team turn; removed at threshold.
- Knight R/S/M changes: tests for any abilities rewritten or refreshed in the review (test count varies by changes landed).
- Alchemist Team Builder description: rendered correctly in class picker.

### UI surfaces

- Class-picker description text for Alchemist.
- Permadeath countdown badge on the unit sprite (renderer-side).
- Status changes from KO/revival reflected in unit-detail panel and action log.

## Acceptance criteria

**KO/status:**
- Unit with mixed infinite/finite statuses → KO → finite-duration statuses cleared; infinite-duration statuses persist.
- Unit revived via Phoenix Down → persisted statuses still present; auto-statuses (if any) functional immediately.
- The three corner cases (Burn, Cataclysm Poison, Magnetic Mark Vulnerable) persist through KO per simplified rule; documented as accepted trade-off in ADR.
- Tick handlers for persistent statuses gate on alive state.

**R/S/M review:**
- Knight kit audited and walked with Chris.
- Identified changes landed (within scope-gate) or documented for S42 (if over threshold).

**Polish:**
- Alchemist class picker shows description matching other classes' format.
- KO'd units display permadeath countdown badge; updates per owning-team turn.
- ActionType-wiring discipline lives in a durable doc.

**Quality:**
- Tests at 1230+, 0 failing.
- ADR-0078 (or next available) written for KO/status rule.
- `docs/handoff.md` updated.
- Browser verification: KO+revival sequence with mixed statuses; permadeath badge ticks correctly; Alchemist description surfaces in team builder.

## Out of scope

- **Hi-Potion / Holy Water / Elixir** — additional consumables deferred (could fold in at session tail if scope allows, but not committed).
- **Buff/debuff consumables substrate** — needs `applyStatus` field on `ConsumableEffects`; deferred.
- **TS strict-mode error pile** (S34 carry) — separate dedicated session.
- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session.
- **Calculator class** — substantial; its own session.
- **AI deployment logic / random-fill** — tactics-layer pass.
- **Knight-exclusive armor access for Alchemist** — S39 D1 trajectory; no forcing function.
- **Four-mage R/S/M review** — opportunistic if scope allows during Knight review; full review is a future session.
- **R/S/M rewrites beyond scope-gate** — heavier rewrites defer to S42 with documented plan.
- **Status duration rebalance** — separate from KO/status rule; carry forward to a playtest-signal-driven session.
- **Auto-status re-grant logic** — implicitly handled by infinite-duration rule; no special revival logic.
- **ActionType animator smoke test** — flagged in S39, future polish item.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Engine:**
- `src/engine/status/` — `isInfiniteDuration` predicate; KO transition status-clear logic.
- `src/engine/lifecycle/` — KO transition path; revival path (confirm status handling).
- Tick handlers for persistent statuses (Regen etc.) — confirm alive-state gating.

**Content:**
- `src/content/classes/knight.ts` — R/S/M changes per review.
- `src/content/abilities/` — any ability definitions rewritten or refreshed.
- Possibly the four mage class files if opportunistic R/S/M touches happen.

**UI / Renderer:**
- `src/ui/team-builder/` — Alchemist class-picker description.
- `src/renderer/` — permadeath countdown badge overlay.

**Docs:**
- `docs/decisions/0078-ko-status-interaction.md` (or next available) — new ADR.
- `docs/conventions/action-types.md` (or per D5) — ActionType-wiring discipline.
- `CLAUDE.md` — reference to action-types doc if useful.
- `docs/handoff.md` — updated at session close.

**Tests:**
- Test files mirroring each above.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first within the plan.** Status duration encoding is the central audit item — the rule's implementation shape depends on it.
- **R/S/M review is planner-coordinated.** Implementer audits and reports; planner relays; Chris settles. Implementer lands changes; defers if scope-gate triggered.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: status duration encoding edge cases (audit reveals an unexpected shape); R/S/M review scope-expansion; permadeath badge visual specifics.
- **No new ActionTypes this session.** The S39 five-sites discipline doesn't apply here. Worth noting because the ActionType-wiring doc promotion is part of session scope — the discipline gets documented even though no new types are added.
- **Phase F session** — capture playtest observations in `docs/playtest-watch.md`. KO/status changes will produce new signal; the Knight R/S/M refresh likewise.

## Watch-fors

**Addressed this session:**
- KO/status interaction redesign (new rule + ADR).
- Knight R/S/M review (scope-gated implementation).
- Alchemist Team Builder description (small content fix).
- Renderer-side permadeath badge (S39 polish carry).
- ActionType-wiring discipline lifted to durable doc (S39 process carry).

**Not addressed this session, longer-term carry-forward:**
- Hi-Potion / Holy Water / Elixir (consumable content, deferred).
- Buff/debuff consumables substrate (`applyStatus` extension, deferred).
- TS strict-mode error pile (S34 carry, separate session).
- Pass-and-play toggle + dual deployment + AI gating (dedicated future).
- Calculator class (future content).
- AI deployment / tactics layer (substantial future).
- Four-mage R/S/M review (opportunistic this session; full pass future).
- R/S/M rewrites over scope-gate (deferred to S42).
- Status duration rebalance (playtest-signal-driven future).
- ActionType animator smoke test (S39 carry).
- All other long-running carries from the consolidated deferred work review.

**Watch-fors specific to this session:**
- **Status duration encoding surprises.** If audit reveals duration is encoded inconsistently across statuses (some `null`, some `Infinity`, some large numbers), the predicate needs to handle the mix. Normalization may be appropriate but is additional scope.
- **R/S/M scope creep.** The review may surface more than the scope-gate threshold. Discipline: defer cleanly to S42 rather than overrun the session. Document the deferred set.
- **Permadeath badge collision with other unit overlays.** If KO'd units already have visual treatment (sprite tint, etc.), the badge needs to compose without obscuring identification.
- **Combat Focus loss on KO+revival.** Per D1 recommendation, Combat Focus's +1 PA clears at KO. Watch playtest for whether this feels punishing; calibration via D1 alt-path if so.
- **Auto-status tick after revival.** First own-team turn after revival should see persistent auto-statuses (Regen et al.) tick correctly. Test path.
- **The three corner cases in playtest.** Burn / Cataclysm Poison / Magnetic Mark Vulnerable persisting through KO may or may not feel right in play; the ADR captures the trade-off, but playtest-watch.md should track if it surfaces as a real issue.

## Estimated size

**Medium.** Scope is bounded: one substrate piece (KO/status, ADR-worthy but small implementation footprint), one review piece (discussion-heavy, scope-gated), three polish items (small each).

The wildcards:
- **Status duration encoding audit** — if duration is cleanly typed (e.g., explicit `'infinite'` variant or `null` sentinel), the predicate is trivial. If it's a mess of magic numbers and inconsistent shapes, normalization adds scope.
- **R/S/M review depth** — scope-gate at 2 substantive rewrites; deferring excess is the discipline. Worst case if Knight kit needs heavy revision: identify changes, defer most, land one small one this session.
- **Permadeath badge rendering complexity** — if renderer overlays compose cleanly, it's small. If existing overlay system has constraints, more involved.

No split anticipated. The R/S/M scope-gate is the safety valve; if it triggers, the session lands the KO/status work + the small polish items + a documented S42 plan for the deferred R/S/M work.
