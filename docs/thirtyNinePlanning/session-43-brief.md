# Session 43 Brief: Unified Team Architecture + KO'd-Unit Pathing + (Stretch) AI Deployment

## Context

S42 closed with the Assassin class, Two Weapons substrate, Lightning Stab swap, and The Offering accessory all landing in one monolithic session (1264 tests / 114 files). The audit found the attack pipeline was already consolidated, so Pattern B substrate dropped in additively rather than requiring refactor. Two post-close playtest fixes (unit-detail Brave/Faith display; damage-forecast variance for knives) and a small MP/targeting tuning pass also shipped.

S43 turns to **playtest infrastructure**: a unified team-architecture refactor that subsumes three previously-distinct features (the AI team picker Chris originally wanted, the deferred pass-and-play toggle, and AI vs. AI as a new capability for balance testing) under a single per-team control-flag abstraction. Plus a likely-bug fix on movement through KO'd units, plus a stretch goal of basic AI deployment for custom builds.

Three substantive pieces this session:

1. **Unified team architecture.** Both teams flow through the team builder; each carries a `control: 'human' | 'ai'` flag; the battle loop dispatches per-team. Constraint in v1: AI-controlled teams must be template-loaded (avoids forcing the AI-deployment-for-arbitrary-builds carry). This delivers AI team picker, pass-and-play, and AI vs. AI all from one architecture.

2. **KO'd-unit pathing fix** (if confirmed by audit). FFT canon: units can move *through* a KO'd unit but cannot *stop on* its square (unless the unit is permadead and removed). Likely bug; investigation + small fix.

3. **Stretch — basic AI deployment for custom builds.** Conditional on audit finding the team-architecture work small. Heuristic: place units onto deployment-zone tiles by distance to the "front center" (closest point to opposing deployment zone), prioritized by descending maxHP, facing toward the center. Relaxes the "AI must be template-loaded" v1 constraint when it lands.

Scope: **Medium.** Solid medium rather than light/medium. Substantive in architecture but no new content. Stretch goal is the upside if audit confirms engine generality.

## Inputs (read first)

In recommended order:

1. `CLAUDE.md` — project conventions, including the `docs/conventions/action-types.md` reference.
2. `docs/handoff.md` — S42 close. Notable: attack pipeline already consolidated; engine separates teams abstractly; post-close playtest fixes for unit-detail and damage-forecast surfaced display-vs-substrate gaps worth knowing about.
3. `docs/decisions/0080-unified-attack-pipeline.md` — S42 attack substrate (orthogonal to S43 but worth context).
4. `docs/decisions/0076-permadeath-timer-and-removed-units.md` — relevant to KO'd-unit pathing (the `removed` state interacts with "stop-on" rules).
5. `core-types.md`, `action-resolution.md`, `ct-system.md` — engine model; particularly how teams/units are referenced in turn dispatch.
6. `deployment-phase-architecture.md` — current deployment flow (Blue / Red placement).
7. `team-builder-architecture.md` — current team builder design and state management.
8. `battle-ui-architecture.md` — battle-loop input dispatch, AI vs human handling.
9. `map-and-battlefield.md` — movement and pathing rules; relevant to KO'd-unit fix.

### Paths to survey before planning

Current-tree audit required. **The audit's most important deliverable is determining how team-A-specific or team-agnostic the existing code is** — that finding drives whether the unified architecture is lightweight (mostly additive) or refactor-heavy (deep team-A assumptions baked in).

At minimum survey:

- **Team-builder state management.** Currently builds Team A only. How is "the team being built" represented in state? Is the assumption "always Team A" hardcoded, or could state generalize to "Team A then Team B in sequence"? Look for hardcoded references to a single team identity, color, or unit collection.
- **Battle config shape.** Where is "Team A is human, Team B is AI" currently encoded? Likely a hardcoded assumption rather than a config flag. Audit identifies the data path for adding per-team control flags.
- **Battle-loop input dispatch.** When it's a team's turn, what dispatches to human input vs. AI logic? Likely a check that "team === Team A" routes to human and otherwise to AI. The generalization: check `team.control === 'human'`.
- **Deployment phase.** How are placements currently authored vs. human-chosen? Team A's deployment is human-interactive; Team B uses authored placements. Audit confirms the placement-source distinction and how cleanly it generalizes.
- **Movement validator.** Specifically, the tile-occupancy check during pathfinding and final-tile-validation. Does it currently differentiate KO'd vs. non-KO'd occupants? Does "move through" vs. "stop on" make sense in the existing structure?
- **Deployment-zone definitions.** For the stretch AI-deployment heuristic: how are deployment zones defined per-map (a set of tiles? a rectangular region?), and how is "the opposing zone" identified? Centroid math depends on this.

## Goal

End state:

**Unified team architecture:**

- Team builder runs for **both teams** in sequence. Team A first (existing flow), then Team B with the same UX.
- Each team carries a `control: 'human' | 'ai'` flag.
- For AI-controlled teams in v1: **must be template-loaded** (cannot fully custom-build). Template carries authored placements; AI uses them during deployment.
- For human-controlled teams: full team builder access, manual deployment.
- Battle loop dispatches per team's control flag — human input vs. existing AI logic.

This delivers three modes from one architecture:

- **AI team picker** (Team B = template + AI). The original S43 ask, now incidental.
- **Pass-and-play** (Team A + Team B both human, both built and deployed manually).
- **AI vs. AI** (both teams = template + AI). New capability — balance testing without human input.

**KO'd-unit pathing:**

- Investigate current movement validator; confirm whether "move through KO'd unit, can't stop on" is honored.
- Fix if missing (likely small — extend the tile-occupancy predicate).
- `removed` units (post-permadeath) are not a tile occupant per ADR-0076; movement rules unchanged for those.

**(Stretch) AI deployment for custom builds:**

- Conditional on audit showing team-architecture work is small enough to fit a stretch.
- Heuristic: for each unit in the AI team (sorted by descending maxHP), assign to the deployment-zone tile closest to the "front center" (the point on the deployment zone closest to the opposing zone's centroid). Set facing toward the opposing zone center.
- Relaxes the v1 "AI must be template-loaded" constraint; enables fully custom AI opponent builds.

**Quality:**

- Tests at ~1300+ (estimated +30-40, depending on stretch).
- ADR for the team architecture change (substantive — control flag is a real abstraction).
- `docs/handoff.md` updated.
- Browser verification: load existing flow (Team A = human, Team B = template + AI) — works exactly as before; load template for Team B and run battle — works exactly as before; switch Team A to AI controlling a template, watch AI vs. AI play; build both teams as human and exercise pass-and-play turn handoff.

## Pre-implementation plan (required)

Audit-first per project conventions. **Plan-review checkpoint between audit completion and substrate code-writing** — audit determines whether team-architecture work is lightweight (additive) or refactor-heavy (deep team-A assumptions).

### Required first step: current-tree audit

Per "Paths to survey" above. The critical deliverable is an assessment of how team-A-specific the existing code is. Three plausible outcomes:

- **Clean (engine treats teams abstractly):** Lightweight. Add per-team control flag; team-builder state runs for either team via parameter; battle-loop dispatch reads flag. Stretch goal becomes feasible.
- **Mostly clean with localized assumptions:** Medium. A few specific code paths to refactor. Stretch goal possibly feasible at the margin.
- **Refactor-heavy (deep "Team A is player" assumptions):** Larger. Refactor consumes most of session budget. Stretch goal deferred to a later session; team architecture lands as foundation.

The audit also covers the KO'd-unit pathing question — confirm or refute the bug presence — which is small regardless of outcome.

### Architectural decisions

After the audit:

1. **Team-builder state-management shape (per D1).** Whether the existing team-builder state generalizes via parameter ("which team is being built?") or whether the state structure needs refactoring to hold two teams. Audit drives.

2. **Per-team control flag placement (per D2).** Live on the team object in battle config? Separate field at battle-config root? Recommend **on the team object** — colocates with team-specific data (units, color, etc.) and reads naturally as `battleConfig.teamA.control === 'human'`.

3. **AI-controlled team gating (the "must be template-loaded" v1 constraint).** Recommend: the team-builder's control-toggle UI disables "Build from scratch" when "AI control" is selected. Forces template-load path. Constraint can be relaxed when stretch lands or in a future session.

4. **Pass-and-play UX v1 (per D3).** Two parts: handoff transitions + active-team signaling.
   - *Handoff transitions:* confirmation screens between team builders, between deployment phases (when both teams are human-controlled), and between turns when human teams alternate. Minimal text + button.
   - *Active-team signaling:* persistent visual cue making it unmistakable whose turn it is. **Note: secret-mode UX is not needed** — Taciturn has no hidden information (positions, stats, statuses all visible to both teams). The pass-and-play risk is forgetting whose turn it is, not info leak. Three complementary polish options to discuss with implementer in plan-review:
     - **(a) Distinct bar/banner** in active-team color, immediately below the terrain bar — persistent always-on indicator.
     - **(b) Thicker / flashing / oscillating highlight** on the active unit menu in team color — attention-grabbing during action selection.
     - **(c) Brief on-screen alert** at turn transitions (e.g., "Blue's turn") that fades on its own without requiring a click.
   - Beyond v1: animated transitions, ambient sound cues, etc. — defer.

5. **(Stretch) AI deployment heuristic shape (per D6).**
   - Compute opposing deployment zone's centroid.
   - For the deploying team's zone: identify "front center" = the tile within the zone closest to the opposing zone's centroid.
   - Sort the team's units by descending `maxHP`.
   - Iterate units; for each, assign the available zone tile closest to the front center. Set facing toward the opposing zone's centroid.
   - Edge case: tied maxHP — break ties by class id alphabetically (deterministic).
   - Edge case: zone smaller than team size — shouldn't happen for v1 maps; flag for content authors.

### Decision points

(Settled in plan-review.)

**D1 — Team-builder state shape.** Per architectural decision 1. Audit drives.

**D2 — Per-team control flag placement.** Recommend on the team object within battle config.

**D3 — Pass-and-play UX v1 minimums.** Two parts:
- *Handoff confirmations* at team-builder, deployment-phase, and mid-battle transitions. Minimal text + button.
- *Active-team signaling.* No secret-mode needed (no hidden information in Taciturn). Three complementary options to discuss with implementer in plan-review: (a) distinct bar/banner below terrain bar in active-team color (persistent always-on); (b) thicker/flashing/oscillating highlight on active unit menu in team color (attention-grabbing during action selection); (c) brief on-screen alert at turn transitions, fading without requiring click. Not mutually exclusive; in-session decision on which combination ships in v1. **Recommend at least (a) as the baseline** — at-a-glance persistent indicator is the highest-value signal; (b) and (c) layer on if implementation is light.

**D4 — Template availability for both sides.** Recommend: same template list available for both teams. No team-A-only or team-B-only templates. Lets you load the same comp for both sides for AI vs. AI testing.

**D5 — KO'd-unit pathing fix.** Confirm bug presence via audit. If confirmed, implement: extend the movement validator's tile-occupancy predicate to allow path *traversal* through KO'd unit tiles while still rejecting them as *final* tiles. `removed` units (per ADR-0076) are not occupants and don't affect movement. If audit shows the bug isn't present (already correctly implemented), drop from session scope.

**D6 — Stretch: AI deployment for custom builds.** Conditional on audit finding the team-architecture work small. Plan-review decides in/out after audit completion. If in: heuristic per architectural decision 5. If out: explicit S44 candidate.

**D7 — Control toggle UI location.** Recommend: inline in the team builder, near the team-name or class-picker area. Visible default ("Team A: Human", "Team B: AI"). Click to toggle. Settled in plan-review or with implementer.

**D8 — Battle-loop dispatch shape.** Recommend: read `team.control` at turn-start, route to human input handler or AI logic accordingly. Single point of dispatch; no changes to existing input/AI handlers themselves.

## Implementation work

### Team builder generalization

- Refactor team-builder state to be parameterized by team identity (A or B) rather than hardcoded to Team A.
- Drive both teams through the same UI flow in sequence: Team A → Team B.
- Each team's builder includes the control toggle (Human / AI).
- For AI-controlled team: lock the "Build from scratch" option; require template selection. Auto-populate team from template.
- For Human-controlled team: full builder access (existing behavior).
- State persists Team A while Team B is being built (existing pattern from the S37 team-draft lift, applied to both teams).

### Per-team control flag

- Add `control: 'human' | 'ai'` to each team's representation in battle config.
- Default values: Team A human, Team B AI (matches current default behavior for backward compatibility).
- Persist through battle config; readable at battle-loop dispatch and elsewhere as needed.

### Battle-loop dispatch generalization

- At each unit's turn-start, check the unit's team's control flag.
- Human → existing human input flow (action menu, etc.).
- AI → existing AI logic.
- Single dispatch point; no changes to the handlers themselves (audit confirms).

### Pass-and-play UX v1

**Handoff confirmations:**
- Between team-builder phases: confirmation screen prompting handoff.
- Between deployment phases (when both teams are human-controlled and both deploy): confirmation screen between.
- Mid-battle handoffs (when human teams alternate turns): confirmation screen between turns; clear any team-specific UI state when transitioning.
- All confirmations are minimal — text + button.

**Active-team signaling** (per D3 plan-review decision; options listed in architectural decision 4):
- One or more of: (a) persistent bar/banner below terrain bar in active-team color; (b) thicker/flashing/oscillating highlight on active unit menu in team color; (c) brief on-screen turn-transition alert that fades without requiring click.
- Complementary — can ship 1, 2, or all 3 depending on implementer assessment of effort.
- Recommend at least (a) as baseline.

### KO'd-unit pathing fix

- Audit movement validator's tile-occupancy logic.
- If bug confirmed: extend the predicate. Path *traversal* permits KO'd unit tiles; *final* tile must be unoccupied (KO'd unit IS an occupant for final-tile check). `removed` units are not occupants at all.
- Tests cover: path traversal through KO'd units succeeds; final-tile-on-KO'd-unit rejected; final-tile-on-removed-unit accepted.

### (Stretch) AI deployment for custom builds

Conditional on plan-review decision per D6.

- Compute opposing zone centroid: average position of opposing deployment-zone tiles.
- Compute deploying team's "front center": the tile within the team's deployment zone with minimum distance to the opposing zone's centroid.
- Sort team units by descending `maxHP` (break ties by class id alphabetically).
- Iterate sorted units; for each, assign the remaining zone tile with minimum distance to the front center. Set facing direction toward the opposing zone's centroid.
- Relax v1 constraint: AI-controlled teams may be fully custom-built (deployment uses this heuristic when no authored placements exist).
- Tests cover: deployment puts high-HP units forward; tied-HP units placed deterministically; facing direction correct; zone-smaller-than-team-size edge case handled (assign as many as fit; log warning).

### Tests

Estimated +30-40 tests (depending on stretch):
- Team-builder state generalization: builds for either team via parameter.
- Per-team control flag: persistence; default values; battle-config integration.
- Battle-loop dispatch: human flag → human handler; AI flag → AI handler.
- Pass-and-play handoff confirmations: shown at each transition; advance correctly on confirmation.
- KO'd-unit pathing: traverse-through succeeds; stop-on-KO'd rejected; stop-on-removed accepted.
- (Stretch) AI deployment heuristic: HP ordering correct; placement geometry correct; facing direction correct.

### UI surfaces

- Team builder runs for both sides with sequential UX flow.
- Control toggle visible in each team's builder.
- Handoff confirmation screens at each phase transition.
- (Stretch) No new UI for AI deployment heuristic — uses existing deployment phase UI; AI just places units automatically rather than waiting for player input.

## Acceptance criteria

**Unified team architecture:**
- Both teams can be built through the team builder.
- Per-team control flag persists through battle config; defaults match current behavior.
- Battle-loop dispatch respects per-team control.
- AI team picker (Team B = template + AI), pass-and-play (both teams human), AI vs. AI (both teams template + AI) all functional.

**KO'd-unit pathing:**
- Movement validator's behavior is FFT-faithful (or confirmed already correct, dropped from scope).

**Stretch (if landed):**
- AI deployment heuristic places high-HP units forward, facing center.
- Custom-built AI teams deploy without authored placements.

**Quality:**
- Tests at 1300+, 0 failing.
- ADR for unified team architecture.
- `docs/handoff.md` updated.
- Browser verification: existing flows work exactly as before; new modes (AI vs. AI, pass-and-play) exercised end-to-end.

## Out of scope

- **Fully custom AI opponent without stretch.** If stretch deferred, AI-controlled teams remain template-only.
- **Pass-and-play polish beyond v1.** Animated transitions, ambient sound cues, additional active-team signaling layers beyond the chosen baseline combination — future polish session. **Secret-mode UX is explicitly not needed** in Taciturn (no hidden information; positions / stats / statuses all visible to both teams).
- **Content pool expansion.** No new AI templates or team builds this session.
- **Hi-Potion / Holy Water / Elixir and other equipment expansion** — S44 candidate.
- **Second map design** — S45 candidate per multi-session roadmap.
- **5v5 unlock** — later in roadmap.
- **Pyromancer R/S/M consolidation** (S41 carry) — future R/S/M review.
- **Knight base-PA recalibration** (S41 D2 carry) — playtest-driven.
- **TS strict-mode error pile** — separate session.
- **Renderer-side multi-swing animation polish** (S42 carry).
- **Permadeath badge first-playtest visual read** (S41 carry).
- **Content-id-registry.md reconciliation** (S42 carry) — small docs item, fold elsewhere.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**UI:**
- `src/ui/team-builder/*.tsx` — generalize for both teams.
- `src/ui/setup-screen.tsx` (or equivalent) — control toggles, sequence flow.
- `src/ui/deployment-screen.tsx` — handle both teams deploying; handoff confirmations.
- `src/ui/battle-screen.tsx` — handoff confirmations mid-battle.

**Engine:**
- `src/engine/battle-config.ts` (or equivalent) — per-team control flag.
- `src/engine/battle-loop.ts` (or equivalent) — dispatch per control flag.
- `src/engine/movement/validator.ts` (or equivalent) — KO'd-unit tile-occupancy.
- (Stretch) `src/engine/ai/deployment.ts` (new) — AI deployment heuristic.

**Content:**
- No new content this session (templates remain available to both teams).

**Docs:**
- `docs/decisions/0082-unified-team-architecture.md` (or next ADR number) — substantive.
- `docs/handoff.md` — updated at session close.
- `docs/playtest-watch.md` — observations from any pass-and-play or AI vs. AI runs.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first with explicit plan-review checkpoint** between audit completion and substrate code-writing. This session's scope is uniquely audit-dependent — engine generality determines whether stretch is in/out and whether refactor is heavy.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: team-A-specific assumptions in unexpected places (UI components, deployment phase, animation paths); pass-and-play UX edge cases (what to do if neither team is selected as AI? probably allowed); deployment-zone shape edge cases (asymmetric maps).
- **Phase F session** — capture playtest observations in `docs/playtest-watch.md`. New modes (AI vs. AI, pass-and-play) will generate new signal.
- **No new ActionTypes this session** — ActionType-wiring discipline doesn't apply.

## Watch-fors

**Addressed this session:**
- Unified team architecture (subsumes AI team picker, pass-and-play, AI vs. AI).
- KO'd-unit pathing (if confirmed by audit).
- (Stretch) Basic AI deployment for custom builds.

**Not addressed this session, longer-term carry-forward:**
- Fully custom AI opponent (if stretch deferred — S44+ candidate).
- Pass-and-play UX polish (animations, secret-mode for plans).
- Content pool expansion for AI teams (S44 candidate alongside equipment).
- Equipment expansion pack (Hi-Potion / Holy Water / Elixir + weapons/accessories) — S44.
- Second map design — S45 per roadmap.
- 5v5 unlock — later in roadmap.
- Pyromancer R/S/M consolidation (S41 carry).
- Knight base-PA recalibration (playtest-driven, S41 carry).
- TS strict-mode pile (S34 carry).
- Renderer-side multi-swing animation polish (S42 carry).
- All other long-running carries.

**Watch-fors specific to this session:**

- **AI vs. AI surfacing balance bugs.** Putting the AI in charge of both sides exercises edge cases that human-vs-AI may not. Watch for AI loop conditions, AI making questionable decisions both sides notice, AI vs. AI battles going excessively long, etc.
- **Pass-and-play handoff UX in real play.** First playtest pass with a second human will surface ergonomic issues — does the handoff feel smooth? Is the active-team signaling unmistakable in active play? Expect refinement signal, especially around whether the v1 active-team signaling combination is sufficient or whether additional options should layer on. (Recall: no information-hiding needed — the question is purely "is it clear whose turn it is.")
- **Template-load constraint on AI control.** Players may expect to be able to fully customize the AI opponent in v1. Constraint is "AI = template only" until stretch lands. If users complain or it limits playtest utility significantly, accelerate the stretch goal into a near-term session.
- **(Stretch) AI deployment positioning quality.** The heuristic is "high HP forward, low HP back, all facing center." Real play will reveal cases where this heuristic feels wrong (e.g., the Alchemist near the front despite being a support role). The heuristic is correct most of the time but isn't smart; if it produces bad placements in playtest, refinements include role-aware sorting (tanks > damage > support) or AI scoring-based placement.
- **KO'd-unit traversal interactions.** Once the fix lands, the new behavior may interact with charging-spell-LoS rules, AoE targeting, or other tile-occupancy-sensitive subsystems. Watch playtest for unexpected secondary effects.
- **Battle-config schema change.** Adding `control` to teams is a schema change that affects save state, replays, test fixtures. Confirm backward compatibility or migration story for any persisted battle configs.

## Estimated size

**Medium.** Solid medium. Variability driven by:

- **Engine generality audit outcome.** Clean → lightweight + stretch likely feasible. Heavy assumptions → larger refactor, stretch deferred.
- **Stretch goal inclusion.** If audit shows clean engine: AI deployment heuristic adds ~30-40% more work to the session, but lands a real capability and resolves the v1 "AI must be template-loaded" constraint.

**Split contingency:** If audit reveals refactor-heavy state, consider 43a (team-architecture refactor + KO'd-unit fix) / 43b (pass-and-play UX + stretch AI deployment).

**Recommendation:** Plan-review checkpoint after audit. Decide on stretch + split based on audit findings.
