## ADR-0044: Results screen — modal overlay, post-MVP exit paths stubbed

**Status:** Accepted
**Date:** 2026-05-10

## Context

Session 24's MVP-readiness criterion requires that a player can finish a battle and see the outcome cleanly. The design doc (`docs/twentyOneDesign/battle-ui-architecture.md` §"Battle-End and Results Screen") prescribes a translucent panel with the winner, MVP unit, per-unit stats, KO timeline, and exit buttons (Rematch, New Battle, Main Menu, Save Replay).

Three sub-decisions:

1. **Trigger.** When does it appear?
2. **Layout.** Modal overlay, full-screen takeover, or in-shell panel?
3. **Exit-button behavior.** Phase E (battle setup + title screen) hasn't shipped — Rematch / New Battle / Main Menu have no destination. Show them? Hide them? Stub them?

## Decision

**Trigger: `state.outcome !== undefined && !paused && !dismissed`.** The `battle_end` reducer sets `state.outcome` (already in place per ADR-0011's outcome shape); BattleView watches the field and mounts `ResultsScreen`. A `resultsDismissed` React state lets the player Close the modal to review the log and map behind it.

**Layout: modal overlay covering ~60% of the screen, centered, translucent backdrop.** Map remains interactive behind it (pan/zoom/click-for-inspection); action log stays in its right-side slot, still scrollable. Camera and inspection controls stay functional. The earlier `WinOverlay` placeholder from Session 23 is replaced.

**Exit buttons: disabled-with-tooltip placeholders, plus an active Close button.**

- **Rematch** — disabled, tooltip "Phase E."
- **New Battle** — disabled, tooltip "Phase E."
- **Main Menu** — disabled, tooltip "Session 34" (matches ADR-0041's pattern for the pause overlay's Main Menu button).
- **Close** — active. Dismisses the modal so the player can review the log and map.

This mirrors ADR-0041's discipline: buttons exist to communicate intent ("this feature is intentional, not missing") rather than being hidden until their destination ships. Save Replay is omitted entirely (lower priority, no Phase E framework, can land alongside Rematch).

**Content.** Per the design doc, sourced from `src/ui/derived-events.ts`:

- Winner team + battle-end T-number + outcome description
- MVP unit: strict highest-damage-dealt, tie-broken by lexical unit id for determinism (per Chris's Session 24 call; future task to add a more nuanced evaluator)
- Per-unit stats: name, class, damage dealt / damage taken, KO marker for KO'd units
- KO timeline: chronological list of `[ko]` events with T-numbers and killer attribution. Title is "KO Timeline" rather than the design doc's "Permadeath Casualties" since permadeath isn't implemented yet (flagged in handoff)

**ESC and click-outside dismiss the modal.** Matches the pause overlay's dismissal idiom.

### Rejected alternatives

- **Hide unimplemented exit buttons.** Same argument as ADR-0041's pause overlay: a missing button surprises the player when Phase E ships. Disabled-with-tooltip surfaces intent.

- **Full-screen takeover.** Loses the "map remains interactive" property the design doc wants. The modal-with-backdrop pattern keeps the post-battle inspection mode (click any unit on the map → opens their detail panel reading their final stats) intact.

- **In-shell panel (e.g., replacing the bottom bar).** Underweights the moment — the battle is over and the player wants attention drawn to the outcome before drifting back to inspection. The modal beat signals "battle complete."

- **Auto-close on first map interaction.** Surprising; the player would lose the MVP / stats summary on the first mouse-move. Explicit Close is predictable.

- **Nuanced MVP scoring (damage dealt + KOs + healing).** Out of scope for v1 per Chris's call; tracked as a future task. The strict-highest-damage metric is deterministic and easy to verify in playtest. Future evaluator candidates: damage-with-KO-weighting, "tie within X% → no MVP," role-aware scoring (healer credit, tank tank-credit).

## Consequences

- **MVP-readiness milestone is reachable.** Players can finish a battle end-to-end with proper outcome surfacing. Phase B planning calibrates against playtest feedback here.

- **Exit buttons document the upcoming-feature backlog.** A player who hovers Main Menu sees "Session 34" — the title screen / pre-battle UI work is on the roadmap and intentionally not present in v1.

- **The strict-highest-damage MVP metric may flag in playtest.** A pure tank who wins by absorbing damage scores zero. A healer scores zero. The metric is a heuristic; Chris's playtest will surface whether it feels right. Flagged in handoff's empirical checklist.

- **Permadeath UI is deferred.** v1 has no 3-turn KO timer or permadeath; the section is labeled "KO Timeline" with no permadeath callouts. When the permadeath mechanic ships, both `derived-events.ts` and `ResultsScreen` extend cleanly.

## Related

- ADR-0011 — Turn flow + battle outcome (the `state.outcome` shape this consumes)
- ADR-0041 — Pause overlay scope (disabled-with-tooltip pattern for unimplemented exits)
- ADR-0043 — Derived-events stream (sources MVP, per-unit stats, KO timeline)
- `docs/twentyOneDesign/battle-ui-architecture.md` §"Battle-End and Results Screen"
