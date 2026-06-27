# Session 75 — Both-AI auto-drive seam (unblock AI feel-verification)

*A cheap infra win, but **audit-dominated** — the planner doesn't know the setup screen's internals,
and the root cause of "real clicks work, synthetic/DOM clicks don't" is the whole fork. Since S70 the
implementer can't auto-drive a both-AI battle in the preview (the Human/AI toggle ignores DOM clicks),
so every AI feature (S73 cohesion, S74 A/B) ships feel-unverified at the unit level and waits on
Chris's manual runs. This gates the testability of all future AI work — the threat-model especially.
Goal: a cheap, robust, **test/debug-only** way to boot + run a full both-AI battle and observe it.*

## What already works vs what's missing

- **Works:** the engine + AI drive headlessly in unit tests (A/B were scored against constructed
  states). So the AI-driving machinery exists.
- **Missing:** a *full organic both-AI battle* that's **observable for emergent feel** — does the
  Enchanter anchor buffs on clusters across a real battle, does the AI avoid whiffing charges over
  many turns. The block is configuring/booting a both-AI battle past the setup-screen toggle.

## Inputs

The battle setup screen + per-team controller wiring (Human input vs AI driver) — *tech unknown to
planner; audit*. The existing headless engine+AI test setup. The replay-deterministic **action log**
(the source of truth for behavior assertions). The S74 A/B scorers (`scoreAoeBuff`,
`chargedTilePinValueFactor`) — the first things to verify with the new seam.

## Goal

1. Start a full both-AI battle (chosen map/teams) **without manual clicking**, run to completion.
2. Observe/assert AI behavior — via action-log inspection and/or the rendered preview.
3. **First dividend:** feel-verify S74 **A** (Enchanter anchors AoE buffs on clusters, not lonely
   allies) + **B** (AI declines dodgeable tile-pin charges) in full battles, with log evidence.

## Pre-implementation plan (AUDIT — the mechanism is unknown; diagnose before building)

- **Diagnose** why the Human/AI toggle ignores synthetic/DOM clicks but accepts real ones. Likely:
  a Pixi-canvas-rendered control (no DOM target to click), a React synthetic-event/binding quirk,
  a pointer-events/hit-area issue, or a custom input layer. The cause picks the fix.
- **Survey cheapest robust paths to a both-AI battle:**
  - (a) a dev-only **URL param / debug flag** the setup screen reads to preset per-team control modes
    (`?control=ai,ai`) — harness loads the preview pre-configured, no toggle click;
  - (b) a **dev-only hook** (window-exposed fn or dev route) that boots a battle with a given config
    (teams, map, control modes), skipping the setup UI;
  - (c) a **headless both-AI full-battle runner** (script/test entry: run to completion with two AI
    controllers, emit the action log / summary) — bypasses the UI entirely;
  - (d) **fix the toggle** click handling so synthetic clicks land.
- **Recommend the cheapest robust option.** Planner lean: **(c) or (a)** — both sidestep the fragile
  toggle and are automatable. (c) (headless + log inspection) is likely the most implementer-usable
  for *emergent-feel* assertions (the implementer reasons better over a structured log than over
  screenshots); confirm whether the engine+AI already expose enough to make it near-trivial. (a) is
  closest to the existing DOM-harness paradigm if a visual preview run is specifically wanted.
- **Surface early if the root cause isn't cheap.** Chris flagged this a "cheap win"; if the audit
  finds a deep/architectural block with no cheap bypass, that's itself the finding — report and let
  Chris re-decide rather than sinking the session in.

## Implementation work

1. Build the chosen seam (cheapest robust path from the audit).
2. Demonstrate: run a full both-AI battle (representative map/teams) end-to-end, no manual input.
3. Use it to feel-verify S74 **A** + **B**: report whether the Enchanter clusters its buffs and
   whether the AI avoids dodgeable charges, with action-log evidence.

## Acceptance criteria

- A full both-AI battle starts + runs to completion without manual clicking, repeatably.
- AI behavior is observable/assertable — demonstrated by a concrete read on S74 A + B.
- The seam is **test/debug-only** — no player-facing change, no debug backdoor in production builds
  (gate to dev, or a test-only entry point).
- Suite green; `tsc -b` + `vite build` clean; ADR for the new seam.

## Out of scope

- A full AI-testing **framework / scenario DSL / automated AI regression suite** — this is just the
  seam that *enables* those later. Keep it cheap.
- Setup-screen UX redesign beyond what the seam needs; fixing the player-facing toggle if the seam
  bypasses it (the player path works on real clicks) — unless the audit finds fixing it IS cheapest.
- **Acting on** the A/B findings — if A or B misbehave, that's a follow-up tune, not this session.
  This session just makes the finding *possible*.

## Decision points

- **D1 — seam mechanism:** headless runner (c) vs URL-param/debug-preset (a) vs toggle-fix (d).
  Lean (c) or (a); settle at plan review with the audit's cost read. If the engine+AI already
  trivially support a headless full-battle run, (c) is the obvious cheapest + most durable.
- **D2 — observation mode:** action-log (headless, automatable) vs rendered preview (visual, closer
  to Chris's manual feel). Lean action-log primary; preview optional.

## Files (hedged — audit confirms)

The battle setup screen + per-team controller wiring; possibly a dev-only URL-param/flag reader or a
headless battle-runner entry; test affordances. ADR for the seam.

## Watch-fors

- **No debug backdoor in production** — gate the seam to dev/test.
- **Don't over-build** — a cheap seam, not a framework.
- **The "cheap win" assumption is under test** — if the root cause is deep, surface before building.
- The seam must produce a **full organic battle** (emergent feel), not just the constructed
  unit-test states A/B already have.

## Estimated size

Small — contingent on the audit confirming a cheap path. If it isn't cheap, that's a scoping
decision (report + re-decide), not a slog. The payoff is outsized: it converts every future AI
feature from "ships feel-blind" to "verifiable in-loop."
