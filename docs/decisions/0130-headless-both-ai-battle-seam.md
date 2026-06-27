## ADR-0130: Headless both-AI full-battle seam (AI feel-verification)

**Status:** Accepted
**Date:** 2026-06-27

## Context

Since S70 the in-app battle-setup Human/AI toggle accepts real clicks but ignores
synthetic/DOM clicks, so the implementer cannot auto-drive a both-AI battle in the
browser preview. Every AI feature since (S73 cohesion, S74 A coverage-weighted
AoE buffs, S74 B charged-attack CT-race devaluation — ADR-0129) has therefore
shipped feel-unverified at the *battle* level: validation was unit-test-only,
against hand-constructed states. The missing thing is a *full, organic both-AI
battle* that is observable for emergent feel (does the Enchanter actually anchor
its buffs on clusters across a real fight; does the AI actually decline charges
the target can dodge), not just the constructed unit-test states.

The S75 audit found:

- **The toggle is mostly a red herring.** The control flags are plain React
  `<button onClick>`s; but even a working toggle still requires auto-driving the
  *entire* pre-battle fork (setup → team builder ×2 → deployment) to reach a
  both-AI battle. That whole chain is the real block, not the one control.
- **The engine + AI already drive a both-AI battle headlessly, trivially.** The
  orchestrator's controller wiring is pure data: each team's `control: 'ai'` flag
  routes to a `createBasicAiController()`, and the `DemoOrchestrator` pump runs to
  completion with no UI. `ai-controller.integration.test.ts` was *already* a
  headless full-battle runner (AI vs. greedy); swapping the second controller to a
  second AI is the whole mechanism. The action log is the deterministic source of
  truth for behaviour.

Decision points settled at plan review: **D1 = headless runner (option c)**;
**D2 = action-log observation (no rendered-preview path this session)**; seam form
= **a reusable runner module + an env-gated dev script, with no permanent A/B
regression assertions** (per Chris — keep it a finding-enabler, not a framework).

## Decision

Add a **test/debug-only headless both-AI runner** that composes exactly the pieces
`App` + `BattleView` compose for a live both-AI battle, minus React/Pixi:

- `src/app/demo/headless-battle.ts` — `runHeadlessBattle({ teamA, teamB, mapId,
  seed })`: folds two `BuiltTeam`s onto a real map, computes both teams' AI
  deployments (the same `computeAiDeploymentResult` path live AI teams use),
  builds initial state + pre-battle queue, drives the `DemoOrchestrator` with two
  `createBasicAiController()`s to completion, and returns the full committed
  action log + final state + outcome.
- `src/app/demo/battle-log-inspect.ts` — generic action-log readers that turn the
  log into structured behaviour facts. Ships two for S74: `aoeBuffCasts`
  (allies-in-footprint + allies-buffed per AoE-buff cast — the cluster read,
  reading coverage from `charged_action_resolve` because Enchanter buffs are
  charged) and `chargedTilePinResolutions` (land/whiff per tile-pinned charge,
  correlated from commit to resolve by charged-action id).
- `src/app/demo/both-ai-sim.test.ts` — a dev harness gated behind the
  `TACITURN_SIM` env var (`describe.runIf`). The normal suite SKIPS it (zero
  assertions in CI); `npm run sim:both-ai` runs it on demand, booting several
  full battles and console-logging the A/B report.

**Production-safety:** nothing in the shipped app imports any of these modules, so
they tree-shake out of the production bundle. There is no player-facing surface
and no debug backdoor — the seam is reachable only from tests and the env-gated
harness.

## Why not the alternatives

- **(a) URL-param / debug preset** (`?control=ai,ai`) — would still need the UI to
  skip the team builder + deployment, and only yields screenshots, not a
  structured log. More work, less observable.
- **(d) fix the toggle** — fixes a symptom (one control) without addressing the
  real block (the whole pre-battle fork), and the player path already works on
  real clicks.
- **A full AI-testing framework / scenario DSL** — explicitly out of scope; this
  is the cheap seam that *enables* such later, not the framework itself.

## Consequences

- Every future AI feature can be feel-verified in a full organic battle by adding
  one reader to `battle-log-inspect.ts` and running the sim — no more
  ships-feel-blind.
- The seam reuses the live orchestration path, so it exercises the real
  controller wiring, pre-battle phase, and deployment heuristic — not a parallel
  mock that could drift.
- **First dividend (S74 A/B feel read, claudesBulwark vs. claudesAnswers on River
  Ridge, 5 seeds):**
  - **B verified working** — 5/5 committed `charged_attack` charges landed (0%
    whiff). The AI declined the dodgeable ones, exactly as ADR-0129 B intends.
  - **A surfaced but confounded** — the Enchanter clustered 0/3 AoE-buff casts on
    ≥2 allies (avg 0.67 allies in footprint). Coverage == buffs-landed, so it is
    NOT a buff-exclusivity artifact (ADR-0124). But the enchant buffs are diamond
    *radius 1*, so two allies must be adjacent to be co-covered, and on an open
    map they rarely were; the Enchanter also cast rarely (3 casts across 5
    battles, 0 in two). This is not evidence that `scoreAoeBuff` is broken — it
    points at next-session questions (does the AI position allies to *create*
    cluster-buff opportunities; why the low cast frequency). Acting on it is a
    follow-up tune, out of S75 scope.

## References

`src/app/demo/headless-battle.ts`, `src/app/demo/battle-log-inspect.ts`,
`src/app/demo/both-ai-sim.test.ts`, `package.json` (`sim:both-ai`). Builds on the
controller wiring in `src/app/BattleView.tsx` and the headless pattern in
`src/app/controllers/ai-controller.integration.test.ts`. S74 AI A/B: ADR-0129.
Buff exclusivity: ADR-0124.
