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

---

## From session 2026-05-03 (basic AI)

### Suggested next-session scope

Roadmap session 13: **first playable end-to-end battle.** The mechanism stack is now complete (engine + renderer + UI + AI). Session 13 is an integration milestone, not a new mechanism — sit down with the demo battle, play it through, and surface what's missing or wrong.

Concrete shape suggested:
- Audit the v1 demo for "feels off" friction. Likely candidates: only one ability per side (Attack), 6×6 flat-ground map, no terrain variation, no facing-direction tactics, no log of what happened.
- Pick the smallest content addition that materially improves the play experience. Candidates in rough cost order: a second ability for Knight (e.g., a charged attack to exercise the `chargeTicks > 0` path), terrain variation on the demo map (introduce elevation differences that exercise jump + LoS), or a battle log surface in the HUD.
- Don't conflate this with content-expansion. Session 13 is about proving "the playable loop works"; broad content (full class roster, full status catalog) is a separate interleaved pass.

The integration test added this session pits greedy vs basic AI in the demo battle. When richer content lands, expand it to use a varied map / multi-ability loadouts to stress the heuristic and surface any missing decision policy.

### Things noticed during the AI session

- **Symmetric 1v1 demo battle is dominated by first-mover.** Both knights have identical stats and the side that goes first lands the first hit, then snowballs. Initial CT tiebreaks by lex-id (`blue_knight` < `red_knight`), so blue (team_a) reliably wins regardless of which controller is on which side. This is not an AI bug — it's a property of the test fixture. The integration test handles this by running both team assignments and checking "AI doesn't underperform greedy across the matrix" rather than "AI wins outright."

- **The `BasicAiDecision` type is structurally a subset of `ControllerDecision`.** I considered re-exporting `ControllerDecision` from `src/app/demo/orchestrator.ts` and using it directly in `src/ai/`, but that would push the AI layer into a dependency on the app layer (violates `architecture-overview.md`'s arrow). Defined a parallel shape locally in `src/ai/basic.ts` instead — it's two variants. The adapter in `src/app/controllers/ai-controller.ts` is the only place that needs to know about both.

- **AI ignores statuses, MP cost beyond range checking, and reactions.** The heuristic considers single_unit damage abilities only and uses `validateAction` as the final gate (so MP-gated abilities won't fire if the actor is out of MP). Status-aware decisions (don't attack a Reflect-buffed enemy without thinking about it; prefer a target who's about to be skipped by Stop; etc.) wait for content that makes those situations possible.

- **Browser-preview verification needed a temporary debug hook.** Session 11's handoff already documented that the preview tab is hidden, which throttles Pixi's ticker so the orchestrator pump doesn't fire. To verify the AI end-to-end I added `window.__taciturnApp = app` to `BattleView` temporarily, manually drove `app.ticker.update()` from `preview_eval`, confirmed the AI moves into melee range and attacks (Blue Knight took 22 damage on the first AI-driven turn), then removed the hook before commit. If a future session wants a permanent debug surface, gate on `import.meta.env.DEV` rather than always-on.

### Things considered but did not do

- **Two-action turn planning.** The basic AI returns one decision per call; the orchestrator re-asks. A planner that reasons about the full turn ("Move to A, then Attack B from A") could pick better destinations because it sees the attack consequence. Skipped — the per-call heuristic already chooses move destinations *as if* an attack will follow ("from this destination, which lowest-HP enemy could I threaten?"), which captures most of the planner's value without the complexity. Lands when content surfaces a case where a planner's view is materially different (e.g., abilities that require ending the turn at a specific facing).

- **Stat-aware damage projection.** `abilityScore()` returns just the ability's `power` coefficient as a stand-in. A real expected-damage projection would multiply by the actor's PA (or MA), variance midpoint, and a target-resistance estimate. Skipped — with `attack` as the only offensive ability in the v1 catalog, all candidates score the same and the work is unobservable. Refines when a class gets ≥2 offensive abilities and the AI needs to *choose between* them.

- **Threat-aware positioning.** The AI doesn't consider what enemies will do to it next turn — it picks destinations purely on what *it* can do *to* enemies. A "don't end turn adjacent to a heavy hitter" pass is the obvious next refinement. Skipped — symmetric demo battle gives no cover/positioning to exploit. Lands with map-content expansion.

- **Wait as a tactic.** The AI never commits a `wait` action; it ends the turn via `turn_end` (the orchestrator's path when the controller returns `'end-turn'`). Same CT outcome today (per `reduceTurnEnd`'s "nothing consumed → wait cost"). Lands distinctly if a future status hooks `wait` differently than budget-exhaust.

- **Reaction-aware AI.** The AI doesn't model that an enemy with Counter equipped will hit back. Skipped — modeling reactions is non-trivial (depends on damage spec lookup + the reactor's stats); the v1 demo doesn't equip Counter on the AI's targets. Lands when a content scenario forces it.

- **Multi-target / AoE ability handling.** `enumerateOffensiveAbilities` filters to single_unit only. AoE adds a layer: pick the *best AoE center*, not just the best single target. Skipped — no AoE in v1 catalog. Lands with the first AoE-content session.

- **Caching `getLegalMoves` across the move-scoring loop.** `pickBestMove` calls `getLegalMoves` once and iterates the result; `targetIsInAbilityRange` is called O(destinations × enemies × abilities) but each call is just an `inRange` arithmetic check. Profiled mentally: at v1 scales (≤6×6 map, ≤2 enemies, ≤1 ability) this is ~70 cheap calls per AI decision. Skipped — premature optimization. Revisit if the AI is in the frame budget at large scales.

- **Move the `Controller` type out of `src/app/demo/orchestrator.ts`.** Carried from session 11. Still three import sites, three controllers (UI, greedy, basic AI). Same deferral logic — lands when the demo orchestrator generalizes.

### Open questions for later sessions (not blocking)

- **Greedy controller's place going forward.** The basic AI strictly supersedes the greedy controller for the demo. Greedy still has value as the integration-test baseline (testing "AI ≥ greedy"). Carrying it indefinitely costs almost nothing — it's one file. If and when a meaningfully-stronger AI tier ships, the question becomes "what does basic-AI become the baseline of?" Lands with a stronger AI tier.

- **AI-vs-AI evals as a tuning surface.** The integration test runs ~10 matchups and asserts a coarse property. With richer content, there's room for a "tournament" suite: a richer set of seeds + matchup configurations that produces summary stats the next AI iteration can target. Premature today. Lands when a stronger AI tier needs an eval bar.

- **Where does charge-action UI live?** Carried from session 11. Still no v1 consumer.

- **Battle log / damage popups.** Carried from session 11. Becomes more useful when the AI is doing things the player can't directly see ("the AI moved into range and attacked" right now is observable via the HP bar; a richer AI is worth narrating).

- **Pause / step-by-step debug mode.** Carried from session 10/11. The TEMP debug hook in this session was a manual workaround; a real "step one action at a time" mode would be more ergonomic for AI-vs-AI debugging.

- **Catalog hot-reload during development.** Carried.

- **Turn-skipped status_tick fan-out (Stop).** Carried.

- **Battle-end checkpoint on damage-application.** Carried.

- **Charged-action triggers in `advanceToNextEvent`.** Carried.

- **Per-status flag for "tick on skipped turn."** Carried.

- **Initial-CT formula tuning.** Carried.

- **Action-log compaction on long battles.** Carried.

- **Out-of-range counter / "Counter Magic at non-magical attack" gating semantics.** Carried.

- **`reaction_fizzled` system event.** Carried from session 9.

- **Refactor projection.ts and scheduler.ts to share a snapshot helper.** Carried from session 9/10.
