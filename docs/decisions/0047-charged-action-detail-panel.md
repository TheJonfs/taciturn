# ADR-0047 — ChargedActionDetailPanel as a separate component

**Status:** Accepted (Session 24.5, 2026-05-11)

**Context.** In Session 24's MVP build, clicking a charged-action mini-card in the QueueTower opened the *caster's* unit detail panel — informative about the unit but not about the spell in flight. Chris's second playtest pass called this out: the player wants to inspect the spell itself (target, projected AoE, time to resolution), not just the caster.

The design surface is structurally different from a unit:
- A charged action is an in-flight spell with a discrete CT trajectory and (usually) a tile / unit target.
- Its "stats" are spell-specific: ability name, caster, target list, current charge progress, ticks-to-resolve, AoE footprint.
- The interesting visualization (AoE projection on the canvas) only makes sense for the charged-action case — units don't have a single tile-range readout.

**Decision.** Build a new component `ChargedActionDetailPanel` (`src/ui/charged-action-detail-panel.tsx`) instead of extending `UnitDetailPanel`. The click context from a QueueTower mini-card disambiguates the route via a new callback `onOpenChargedActionDetail`, propagated through `QueueTowerProps → BattleHudProps → BattleView`.

The panel:
- Reads the in-flight charged action from `state.chargedActions` by id.
- Renders ability name, caster, target list, current charge (`ct / 100`), speed, estimated ticks-to-resolve, and (when AoE > 1 tile) a "see canvas overlay" hint.
- On mount, computes the spell's AoE footprint (mirroring use-turn-flow's `resolveAoeTiles` dispatch) and calls `renderer.setHighlightOverlay(tiles, 'aoe')`. Cleanup clears the overlay.
- ESC closes the panel (capture-phase listener prevents BattleView's ESC handler from firing).

**Consequences.**

- New component, new ADR, new UI surface. Test count remains stable (the panel is visual; coverage relies on the AoE shape regression tests landed for Bug 2 + manual verification).
- Overlay-channel sharing: while the panel is open, the highlight overlay can be overwritten by use-turn-flow's effect if the player enters target-select. Accepted — the React panel still shows the data; the canvas overlay is a bonus. Cleaner gating (suppress the panel during target-select, or stack overlay channels) is a later concern if playtest reports the race as confusing.
- Unit-detail and charged-detail flows are now structurally parallel: each has its own panel, its own callback from BattleView, and its own ESC handler. Mirrors the ResultsScreen / PauseOverlay pattern.

**Alternatives considered.**

- **Extending `UnitDetailPanel` with a "charged action" variant.** Rejected — the content shapes share almost nothing (a unit's stats panel vs. a spell's timing readout). The conditional branch would dwarf the shared shell.
- **A single `onOpenDetail(target: UnitDetailTarget | ChargedActionDetailTarget)` callback** with a discriminated union. Rejected for v1 — adds plumbing complexity (a parameter that's already discriminable at the call site, since mini-cards know whether they're charged) without saving any code.
- **Suppressing charged-action mini-card click outside `idle` / `action-menu` states** to avoid overlay collisions. Rejected — clicking a mini-card to read about an in-flight spell is useful regardless of turn-flow state. The data is still visible in the React panel; the canvas overlay is best-effort.
- **Showing the AoE preview in the panel itself** (mini-map render of the spell's footprint) rather than on the main canvas. Rejected for v1 — main-canvas overlay reuses the existing rendering path and shows the AoE in spatial context. A mini-map would be additional rendering work for limited additional clarity.

**References.**

- Session 24.5 brief: `docs/twentyOnePlanning/session-24-5-brief.md` (Item 10)
- Session 24.5 plan: `docs/twentyOnePlanning/session-24-5-plan.md` (Architectural decision 10)
- Implementation: `src/ui/charged-action-detail-panel.tsx`
- Wiring: `src/ui/queue-tower.tsx` (route), `src/ui/battle-hud.tsx` (prop pass-through), `src/app/BattleView.tsx` (mount + state)
- AoE resolution: mirrors `src/ui/use-turn-flow.ts:resolveAoeTiles` (inline in panel for self-containment)
