## ADR-0041: Pause overlay scope for Session 23 vs Session 34

**Status:** Accepted
**Date:** 2026-05-10

## Context

`docs/twentyOneDesign/battle-ui-architecture.md` §"Battle-Pause / Out-of-Turn UI" prescribes a pause overlay triggered by ESC during battle, with four options: **Resume**, **Settings**, **Surrender**, **Main Menu**. Pause halts both the renderer's animator and the orchestrator pump; the map and HUD remain visible behind a translucent backdrop.

Session 23's brief lists three options for the overlay — Resume, Settings, Quit — and explicitly defers the navigation target ("Quit-to-title is deferred to Session 34 when the title screen exists"). The brief and design doc therefore diverge on (a) Surrender's presence and (b) whether the post-quit destination is the title screen, main menu, or something else.

Two questions to settle:

1. Which subset of the four design-doc options ships in Session 23?
2. How should the deferred items be visually signaled in v1 — hidden, stubbed, or disabled?

## Decision

**v1 scope: Resume + Settings + Main Menu (disabled).** Surrender is deferred entirely.

- **Resume** — active. Closes the overlay, resumes both the pump and the animator.
- **Settings** — active. Inline expansion within the same overlay (rather than a nested overlay). v1 settings per the design doc §"Settings Menu": default animation speed, confirm-step preference, status icon density preference. In-memory only.
- **Main Menu** — present as a disabled button with `title="Available after Session 34's title screen"` tooltip. The button is visible (signals the feature exists and is intentional) rather than hidden (which would create a surprise when Session 34 lands).
- **Surrender** — not present in the overlay. Mechanically straightforward (emit a `battle_end` system action with the opposing team as winner; the existing WinOverlay path takes over), but it's a battle-outcome flow that deserves its own scrutiny pass and isn't on Session 23's critical path. Deferred to Session 34's pre-battle UI work, where Surrender + Main Menu + title-screen routing can land as a coherent unit.

**Pause mechanism.** Two halts:

- `BattleRenderer.setPaused(true)` — added to the renderer in Session 23. The Pixi ticker keeps running so camera input remains responsive, but the animator's `tick` is gated. The animator's existing queue is preserved (resume picks up exactly where pause left off).
- BattleView's pump exits early when paused (`if (pausedRef.current) return`). The orchestrator and the engine are untouched while paused; AI doesn't compute, charged actions don't advance.

Pause overlay rendering: full-viewport translucent backdrop, modal grid-centered card. The map and HUD render *behind* the overlay (per the design doc); only the action-menu inputs are visually obstructed because they sit lower in the z-order than the overlay's z-index 100.

**ESC dispatch precedence** (from ADR-0040): ESC in a picking sub-state backs out one step (`cancel`). ESC in `idle | action-menu | animation` opens the pause. ESC while the overlay is open closes it (Resume). So ESC is "back out one step, or open/close pause if no step to back out of."

## Why this shape

- **Matches the brief.** Chris confirmed Resume + Settings + Quit-disabled when settling open question 1 of the Session 23 plan. Surrender's deferral was implicit in the brief's three-option list.

- **Coordinates with Session 34.** When the title screen ships in Session 34, the same Main Menu button becomes active and Surrender appears alongside it. Both are battle-outcome navigations that should ship together.

- **Disabled-not-hidden communicates intent.** A user opening pause in v1 sees that Main Menu is *planned*, not missing — and gets a tooltip explaining when it'll arrive. Hidden options invite the "where's the quit button?" question that disabled ones answer in place.

- **Inline settings beats nested overlay.** v1 has only three settings; a nested overlay would add a back-button hop without information density gain. If settings grow to a long list later, splitting becomes obvious.

## Consequences

- **Session 34 inherits the wiring.** When the title-screen lands, the Main Menu button gets a real `onClick`, and Surrender is added as a fourth option. Pause-overlay surface stays familiar to playtesters.

- **No `battle_end` emission from UI in v1.** The Surrender flow would need it, but with Surrender deferred there's no UI-side commit path for `battle_end`. The engine still emits it via victory-condition firing; the UI just doesn't initiate one.

- **Animator state preserves through pause.** The existing queue continues from where it stopped — no need to flush or rewind on resume. Tested by manual verification: pause mid-tween, resume, animation continues.

- **No localStorage persistence.** Settings reset on reload, per design doc. The pause overlay surfaces a footnote about this so users understand the limitation.

## Alternatives considered

- **Match the design doc verbatim (Resume + Settings + Surrender + Main Menu).** Rejected — Surrender ships before its natural cohort. Adds incremental risk to a session already touching every UI surface; defers the battle-outcome flow to one consolidated pass in Session 34.

- **Hide deferred options entirely.** Rejected — a user opening pause and seeing only Resume + Settings would reasonably wonder if exit was supposed to work. The disabled button is honest about the feature's status.

- **Stub Main Menu to no-op (clickable but does nothing).** Rejected — silent buttons are worse than disabled ones. The tooltip explains the deferral cleanly.

- **Treat ESC as pause-only (no cancel-from-picking shortcut).** Rejected — the design doc explicitly lists ESC as one of the back-out keys for sub-states. ADR-0040's precedence rule keeps both behaviors.
