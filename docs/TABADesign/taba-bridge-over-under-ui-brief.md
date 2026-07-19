# Brief — Bridge over/under UI/UX (the open half of layers)

*Status: plaintext review by Chris before it ships to CC. The bridge **mechanical** substrate shipped
(ADR-0155, `bridge-overpass-audit.md`); this is the **visualization + interaction** half the ADR flagged
as open. Scoped to the sparse-bridge case; the global multi-floor layer-focus mode is deferred. Audit-first
on the renderer and the hit-test.*

---

## Context

Two occupiable cells can now share an (x,y) (a bridge deck over ground). The mechanics handle it; the UI
doesn't yet. Every open symptom is one of **two problems** — *see-both* (the screen pixel is shared) or
*pick-which* (the click is ambiguous):

| Symptom (from ADR-0155) | Problem |
|---|---|
| Stacked cells overdraw (deck only drawn) | see-both |
| Elevation digits overprint | see-both |
| Both layers' highlights merge | see-both |
| Picking is occupant-priority topmost | pick-which |
| Can't click a move dest UNDER the span (resolves to deck when both empty) | pick-which |

## Settled direction

- **Context-first + stack chip.** Resolve the layer from context whenever only one is valid for the current
  action; surface an explicit **stack chip** chooser only in the genuinely-ambiguous both-valid case.
- **Local (sparse-bridge) solution**, not a global layer-focus mode. The mode from the old
  `battle-ui-architecture.md` "Layer Toggle (Deferred)" sketch stays deferred until a *dense* multi-floor
  map exists (deferred-until-consumer, like the ADR's `layerScope`).
- **See-both via a local deck-lift + shadow**, reusing the renderer's **existing** elevation-border
  drop-shadow (it already shadows tiles whose elevation exceeds an adjacent tile — the deck-over-ground case
  is the same treatment). Full isometric stays parked.

## Goal

Make stacked cells legible and selectable: each layer visibly distinct with its own elevation digit and
highlight, selection resolving automatically when unambiguous and via a discoverable, touch-safe chip when
not — so a player can see the bridge, move under or over it deliberately, and target the layer they mean.

---

## WI1 — See-both: local deck-lift + shadow

Render a stacked-cell **deck lifted by its elevation** with a drop-shadow onto the ground cell beneath,
**extending the existing elevation-border shadow mechanism** (audit confirms it can carry the deck case).
The ground cell then **peeks out** beneath the lifted deck, giving each layer its own visible area. That
single change dissolves three symptoms:

- **Overdraw →** ground is visible beneath the lifted deck (not fully hidden).
- **Digit overprint →** each layer's elevation digit sits on its own visible area (deck digit on the deck,
  ground digit on the peeking sliver).
- **Highlight merge →** move/target highlights render **per-layer** on each layer's area, no longer a single
  merged cell (this depends on WI1's per-layer areas existing).

*If the renderer audit finds the elevation-shadow mechanism can't extend cleanly, fall back is
transparency-of-the-under-layer — but the lift is preferred (it shows both without a mode).*

## WI2 — Pick-which: context-first resolution

Replace occupant-priority-topmost as the **primary** hit-test with **context resolution** — the UI already
knows per-layer validity (stack-enumeration shipped). Per state:

- **MOVE-SELECT →** resolve to the layer that's a legal destination; if only the under-cell is walkable, the
  click picks it (fixes the under-span wart directly).
- **TARGET-SELECT →** resolve to the layer holding a valid target.
- **IDLE / inspection →** default to topmost (deck); the chip switches to inspect the under-cell (inspection
  panel already shows `(x, y, layer)`).

Occupant-priority-topmost survives only as the tiebreak *inside* an already-ambiguous case, not as the
front-line rule.

## WI3 — Stack chip (the ambiguous-case chooser)

When context leaves **both** layers valid (both walkable in MOVE-SELECT; both hold valid targets; or the
player wants the non-default layer in IDLE), surface a small **layer chip** on the stacked cell — a
two-segment picker (deck / ground) — to choose. Requirements:

- **Visible** (discoverable — appears on stacked-cell hover/interaction, not a hidden gesture).
- **Touch-safe** (a tap target, since this is a web/mobile/desktop product — no reliance on modifier keys).
- Sits with the lifted deck; the peeking ground sliver is also directly clickable as the under-cell,
  so the chip and the geometry agree.

Exact chip placement/appearance is an implementer + Chris design detail; the requirement is *visible,
touch-safe, appears when-and-only-when it's needed.*

## WI4 — (Optional) desktop accelerators

If cheap and non-disruptive: a **click-cycles-stack** accelerator (second click on a stacked cell cycles to
the under-layer) and/or a modifier-to-target-under for desktop power users. **Neither is primary** (click-
cycle muddies click-to-confirm; modifiers are dead on touch) — add only as accelerators on top of WI2/WI3,
or defer entirely. Flag if it complicates confirm semantics.

---

## Acceptance criteria

- A stacked cell renders with the deck lifted + shadowed and the ground peeking; each layer shows its own
  elevation digit and its own move/target highlight (no overdraw, overprint, or merge).
- MOVE-SELECT: a unit can be ordered to a walkable cell **under** the span (context resolves it when only
  the under-cell is walkable; the chip picks it when both are).
- TARGET-SELECT: targeting resolves to the valid-target layer automatically; the chip disambiguates when
  both hold valid targets.
- The stack chip appears only on stacked cells, only when disambiguation is needed, and works by tap.
- Alvera's western bridge (the live content) is the verification map — playtest over-and-under movement,
  targeting across layers, and an AoE/Worldcraft interaction with the deck visible.
- Suite green, `tsc -b` clean.

## Out of scope

- **Global multi-floor layer-focus mode** (the old deferred sketch) — deferred until a dense multi-floor
  map needs it; sparse bridges don't.
- **Isometric view** (parked, per ADR).
- The ADR's other deferred edges (`layerScope`, deployment-zone stacked exclusion, charged-tile-cast on a
  mid-charge-destroyed deck) — separate, unrelated to this UI pass.

## Workflow notes

- **Audit-first:** (1) confirm the elevation-border drop-shadow mechanism can extend to the deck-lift
  (Chris's read: yes, it's the same treatment); (2) locate the current occupant-priority hit-test and the
  per-layer validity the selection code already computes. Report what's reusable.
- File paths here are inferences — audit to correct.
- Mid-session design questions (chip appearance, cycle-or-not) route through Chris to the planner.

## Watch-fors

- **Lift height vs readability** — a deck lifted by a tall elevation could push its digit/art off its cell
  or over neighbors; clamp the *visual* lift independent of the *mechanical* elevation if needed (they need
  not be 1:1).
- **Chip clutter** — it must not appear on the ~all single-layer cells, and should stay quiet until the
  action makes it relevant; over-showing it defeats the "sparse, local" intent.
- **Highlight correctness under AoE** — an AoE that hits both layers (vertical-tolerance rule) should show
  *both* layer highlights lit; confirm the per-layer highlight change reads that case right (it's the most
  visually confusing one).
- **Touch parity** — verify the chip and the ground-sliver click both work by tap, not just mouse.

## Estimated size

Contained. WI1 is the bulk but rides the existing shadow mechanism (extension, not new); WI2 reuses
already-computed per-layer validity; WI3 is a small contextual widget; WI4 is optional. The Alvera bridge
gives an immediate live test map.
