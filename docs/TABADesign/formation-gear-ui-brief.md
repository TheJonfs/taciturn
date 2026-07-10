# Formation Gear UI + Inventory System (implementation brief)

**Status:** review-ready draft. Plaintext review is a hard gate before implementer handoff.
**One-line goal:** equip/unequip gear on roster units between battles, **co-visible with abilities in a
single dense view**, respecting equipment-adjusted capacity + equip-legality — plus the inventory
instance-counting system that makes any of it testable.

---

## The framing that de-risks this whole beat
**We already built this pattern — in the Mage War Team Builder.** That screen is the co-visible
two-column *equipment | abilities* view, with collapsible slot dropdowns, an equipment-aware stat row, and
exactly the illegal-loadout handling we want: the invalid state is **held, surfaced (roster-card warning +
"loadout over capacity" + a pointer to the cause), and proceeding is blocked** — not silently resolved.

So this brief is **not "design a merged view." It's "port the Team Builder's proven middle onto the
celestial Formation dossier, add the JP-economy specifics, and build the inventory layer underneath."**
Reference both shipped screens as the two things being unified:
- **Formation dossier (celestial)** — supplies the *header* (per-class purse, JP economy, INNATE/EXPORTED
  ability labeling, reclass) and the aesthetic (arcane-slate, brass, Cormorant Garamond).
- **Mage War Team Builder** — supplies the *body* (two-column equipment|abilities, collapsible dropdowns,
  equipment-aware stats, illegal-loadout surface-and-block).

---

## D1 — layout: MERGE equipment into Loadout; kill the separate "Equipment·SOON" tab
The shipped Loadout tab already shows the capacity numbers equipment threatens (Reaction 3/3, Support 3/3,
Movement 3/3). Equipment must mutate those *in the same view* — the maul driving Reaction to 0/3 has to be
visible where reactions are managed, or "why did my reaction disappear" is structurally guaranteed. So:
- Adopt the **Team Builder's two-column body**: EQUIPMENT (collapsible slot dropdowns) | ABILITIES
  (collapsible Command/Reaction/Support/Movement sections, keeping Formation's INNATE-free / EXPORTED-cost
  labeling).
- **Equipment slots (5, matching Mage War):** Right hand · Left hand (off-hand) · Headgear · Armor · Accessory.
- **Density refactors (load-bearing, not cosmetic — the merged view is tall):** class *chips* → a dropdown
  / "Change class" affordance (mirrors the Team Builder's button); compact the Secondary-Command rows;
  collapsible sections throughout. Every reclaimed row is what keeps equipment + its ability-consequences
  co-visible without scrolling.
- Keep the **celestial header** (portrait, stat row, per-class purse). Adapt the Team Builder's flat/dark
  body into the celestial skin — port the *structure*, not the raw styling.

## D2 — the coupling: ONE "over-capacity" detector, surfaced not resolved
The Monkeygrip case proves the generalization: **hand-slots and ability-buckets are the same constraint**
("using more slots than you have"). 2H-weapon-plus-off-hand-without-Monkeygrip and maul-reaction-cap are
*the same over-capacity condition*. So:
- **One detector, both directions.** (a) *equipment→abilities*: a capacity-reducing item (maul −3 reaction)
  can push a filled bucket over. (b) *abilities/equipment legality*: Freelancer's Charm illegal with a
  class-restricted body; 2H + off-hand illegal without Monkeygrip.
- **Surface, don't resolve (settled).** Allow the invalid intermediate state; flag it (roster-card warning
  icon + "loadout invalid / over capacity" + **surface the specific cause** so the player can go fix it);
  **block deploy / battle-entry** for invalid units. No eviction logic, auto or prompted — the player fixes
  their own loadout. This mirrors the Team Builder exactly.
- **Equipment-aware capacity display:** the denominator reflects equipment (maul → Reaction *0*/3; over-fill
  flagged). Stats read "unavailable" when the loadout is invalid (mirror the Team Builder header).

## D3 — the #1 architectural watch: UI legality and engine legality are ONE resolver
`createInitialState` **throws** on over-capacity loadouts. If the UI's "is this legal" check ever drifts
from the engine's "should I throw" check, we ship the worst bug in this area: UI says valid → deploy →
battle-entry throws. This is the **three-resolver discipline** applied to legality — UI forecast and live
engine share one capacity/legality resolver. **Reuse the exact check the Team Builder / engine already
call; do not reimplement the rules in the UI.** (Audit: confirm that shared resolver exists and is the one
`createInitialState` uses; if the Team Builder currently has its own copy, unify them as part of this work.)

---

## Inputs
- The two shipped screens above (Formation Loadout dossier; Mage War Team Builder).
- The shipped equipment catalog (133 items) + the capacity/legality rules baked into `createInitialState`
  (cost-weighted buckets; class-innate reactions cost 0; `equipLegality`; the maul reaction-cap; 2H/off-hand
  hand-slot rules; Monkeygrip override).
- The existing **debug-feature toggle** system (local-only, invisible in deployment).
- `tabaShopPool` (surfacing the TABA pool by chapter — the economy pass populates it later).

## Implementation work (staged)

### Stage 0 — inventory instance-counting system (prerequisite; the UI consumes it)
- **Party-wide item counts:** how many of each item the party owns; how many are currently equipped across
  all roster units; how many are free to equip.
- **Decrement-on-equip / return-on-unequip**, across the whole roster (equipping the last free instance
  makes it unavailable elsewhere; unequipping returns it to the pool).
- **Uniqueness is receipt-gated, NOT inventory-capped.** The inventory does not hard-cap uniques at 1 — it
  holds whatever count exists. Uniqueness is enforced by *how items are received* (the deferred economy /
  acquisition pass), leaving the door open for late-game "duplicate a unique" mechanics.
- **Debug seed (via the existing toggle, local-only):** every item available in quantity ~5–20, uniques
  included. This is the test harness that makes the new equipment playable at all today.

### Stage 1 — the merged Loadout view (port the Team Builder body)
- Two-column equipment|abilities inside the Loadout tab; the density refactors (D1).
- Equipment slots as collapsible dropdowns; each dropdown lists **available inventory** for that slot
  (respecting counts from Stage 0, filtered by slot type + basic legality).
- Celestial adaptation of the Team Builder structure; keep the Formation header + JP/INNATE/EXPORTED model.

### Stage 2 — the coupling (D2 + D3)
- Wire the shared capacity/legality resolver (D3) into the view.
- Equipment-aware capacity denominators; over-capacity + legality detection both directions.
- Surface-and-block: roster-card warning, cause-pointer, deploy/battle-entry blocked for invalid units;
  "stats unavailable" when invalid.

### Stage 3 — polish
- Stat deltas on hover/inspect (the Team Builder's inspect panel: "hover an item/ability to inspect").
- Unequip affordances; empty-slot states; edge cases (last instance, swapping, reclass interactions with
  equipped gear).

## Acceptance criteria
- Gear equippable/unequippable on roster units in the merged Loadout view; inventory counts
  decrement/return correctly across the team.
- Equipment-adjusted capacity is shown (maul → Reaction 0/3; over-fill flagged).
- Invalid loadouts are **surfaced with cause and block deploy**, never silently resolved.
- Both legality directions enforced (maul capacity; Freelancer's Charm ↔ class-restricted body; 2H/off-hand
  ↔ Monkeygrip).
- **UI legality == engine legality (one resolver);** no loadout the UI calls valid can make
  `createInitialState` throw.
- Celestial aesthetic preserved; the merged view fits without runaway scrolling (density refactors landed).
- Debug seed (5–20 of everything) works locally, invisible in deployment.

## Out of scope
- **The economy pass** — real shop stock by location, costs, currency, unique *acquisition* flows. Stage 0
  seeds the inventory for *testing*; how items are *earned/bought* in real play is deferred. (This is why
  uniqueness is receipt-gated: the economy pass owns receipt.)
- **Pre-battle Formation entry / deploy-selection UI** (separate deferred beat).
- **2nd-secondary-command UI** (Magus Crown / Command Cap) — separate, unless it falls out trivially.
- **AI valuation of exotic gear** (keep effect weapons off authored enemy loadouts until that beat).

## Files (likely; audit to confirm)
- `src/app/formation/…` — the Loadout view (merge target).
- The inventory model (new) + its debug-seed hook into the existing toggle system.
- The shared capacity/legality resolver (reuse the engine's; unify if a UI copy exists) — do **not** fork.

## Workflow notes
- **Plaintext review is a hard gate.**
- The **Mage War Team Builder is the reference implementation** — point the implementer at it first; most
  of the layout + illegal-handling questions are already answered there.
- **Reuse the engine's capacity/legality resolver** (D3) — single source of truth; the three-resolver
  discipline is the reason.
- Over-specified scope — audit to prune (the Team Builder may already provide more reusable structure than
  assumed; the "audit-overturns-spec" pattern applies).

## Watch-fors
- **Resolver drift (D3) is the #1 risk** — UI-valid-but-engine-throws is the failure mode to design out.
- **Density** — the merged view is tall; if the refactors slip, co-visibility (the whole point of merging)
  breaks and it becomes a scroll-fest.
- **Celestial adaptation** — port the Team Builder's *structure*, not its flat styling; it must read as the
  Formation dossier, not a reskinned debug screen.
- **Inventory edge cases** — last-instance equip, cross-unit contention, unequip-on-reclass, uniques with
  count > 1 (must not break on the receipt-gated model).

## Estimated size
**Medium–large.** The layout is a *port* of a proven pattern (low risk), so the real new work is the
inventory layer (Stage 0), the celestial/JP adaptation, and the shared-resolver coupling. Stageable:
Stage 0 is landable and testable on its own; Stages 1–2 are the core; Stage 3 is polish that can trail.
