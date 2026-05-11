## ADR-0045: Projection column and hover-counterpart visual idiom

**Status:** Accepted
**Date:** 2026-05-10

## Context

Session 24's brief calls for a "projection column" surfacing in-flight charged actions, reaction queue, and CT-ordered upcoming turns beyond the QueueTower's horizon. The brief also asks how the hover-counterpart pulse (action log row → unit on canvas) renders visually.

Two structural questions:

1. **Where does the projection column live?** Options: extend the existing QueueTower (which already shows the 7-event horizon); add a new side panel; replace part of an existing region.
2. **What's the visual idiom for hover-counterpart highlighting?** Options: a third highlight-layer channel (tile-aligned); a sprite-tint pulse on the unit's own body; a third indicator (e.g., crosshair sprite).

## Decision

**Projection column: QueueTower remains the projection surface.** No separate fifth panel. The 20-event horizon ships in the QueueTower itself via a scrollable inner container.

Specifically:

- **In-flight charged actions** appear as charged-action mini-cards via the existing `ProjectedEvent.entityKind === 'charged_action'` variant. Already first-class in `projectUpcoming`; Session 22's mini-card design already accounts for them.
- **Reaction queue** is **out of scope for v1.** v1 has no equipped reactions in the active battle content (`trainingFieldBattle`); reactions fire synchronously from `runOnActionTargeted`, not as scheduled events. A separate in-flight reaction queue panel would be empty in v1. Flag for empirical feedback in handoff.
- **CT-ordered turn forecast** is the existing `projectUpcoming` output, extended from 7 events visible to 20 events with scrollable overflow. Bottom-anchored (active unit always at bottom); auto-snap-back-to-bottom on a new turn (re-anchors the player to "here's where you are now" when the next unit's turn starts).

The QueueTower also gains:

- Hover-on-mini-card → canvas hover-counterpart pulse on the unit (reuses the action log's `setCounterpartUnits` API).
- Click-on-mini-card → opens the unit detail panel for that unit (or, for a charged-action card, the spell's caster).

**Hover-counterpart: sprite-tint pulse.** `UnitSprite` gains a `counterpartHighlight` channel — a concentric ring drawn beneath all other unit content (so the unit's body, HP bar, status badges stay legible) with a bright cyan stroke (`COUNTERPART_RING_COLOR = 0x9adfff`) that pops against both team colors and doesn't compete with the gold active-unit ring. Driven by `BattleRenderer.setCounterpartUnits(ids: Iterable<UnitId>)`, called by the action log panel and QueueTower on row/card hover.

### Rejected alternatives

- **Separate reaction-queue panel.** Visible empty in v1; adds visual complexity without payoff. The QueueTower's charged-action variant already covers "what's about to happen that isn't a unit's turn."

- **Third highlight-layer channel for hover-counterpart.** Highlight layer is tile-overlay-shaped; hover-counterpart is a unit-on-canvas concept. Loading a tile-color channel with a unit-aimed pulse muddles the layer's semantics. Sprite-tint stays on the unit's own sprite container and tracks the unit if it moves.

- **Reuse the existing `flash` channel.** Flash is for damage-impact tween; overloading it with hover semantics would mean a hovered + just-damaged unit shows confused visual state. Separate channels stay clear.

- **Add a separate hover-counterpart sprite (crosshair, marker).** More work (asset authoring), no clearer than the ring. Real art is post-MVP — the ring is the placeholder shape, easy to swap when iconography ships.

## Consequences

- **QueueTower carries the full projection-column workload.** Anyone landing extensions (e.g., reaction queue, "+further events" indicator beyond 20, multi-layer projection) edits the same component. Lower coupling, single visual idiom.

- **Hover-counterpart works for any unit-referencing UI.** The action log panel, QueueTower mini-cards, the active unit anchor, and any future surface that wants to "say this unit on the canvas" call the same renderer API. v1 wires the first two; the active unit anchor's "Open full details" button doesn't trigger a hover pulse since the unit is already obviously the active one.

- **Reaction queue visibility flagged for empirical check.** Chris will surface whether the missing queue is perceived as a gap during MVP playtest. If yes, a small extension lands in Phase F; if not, the simpler QueueTower-only model holds.

- **Three click-through routes converge on the unit detail panel** (per the design doc): Status button in the action menu, QueueTower mini-card click, future canvas unit click (deferred — canvas click currently routes to tile-click handlers in target-select; an inspection-mode unit click is a small extension). v1 wires the first two.

## Related

- ADR-0040 — Turn-flow state machine (the UI's hook + reducer pattern)
- ADR-0043 — Derived-events stream (the hover-counterpart consumer side)
- `docs/twentyOneDesign/battle-ui-architecture.md` §"Projection Column / Queue Tower" and §"Hover Behavior"
