# Brief — Chapter 1 iteration workbench (fixes + ongoing authoring)

*Status: plaintext review by Chris before it ships to CC. **This is a working-session brief, not an
execute-a-spec brief.** It lands a few concrete fixes up front, then exists to iterate — story-battle
lineups, map definitions, and cosmetic polish — as Chapter 1 authoring continues. Expect the shape to be
"land the fixes, then Chris and the implementer work through content together," with new items surfacing
from playtest mid-session.*

---

## Context

Chris played the first three story battles (Oskun, Alvera, Zelmonia Hills) fresh. Outcome: won all three,
but lost a generic at Alvera, came within ticks of losing Lumen, and sprinted to beat Renault at the Hills —
all while the party stayed ~L1–2 against L3–4 enemies. Read: **a little too tough, but close** (and Chris
has an expert's advantage, so a normal player would feel it harder). Two mechanical gaps surfaced
alongside. This session fixes those, adds a difficulty-headroom dial, and continues Ch1 content authoring.

**One framing that shapes the gil fix:** the party leveling slowly is not necessarily wrong — a persistent
2–3 level deficit *is* the intended "under-leveled, outplay them" pressure. The intended *answer* to that
deficit is **gear investment**, but at game start the player has zero gil and can't participate in that
loop. So the fix bootstraps the loop, it doesn't paper over difficulty.

---

## Land these fixes first

### Fix 1 — Starting gil (the headroom dial)

Grant the player a **starting gil purse** at campaign start (currently 0). Placeholder **~1500–2500** (Chris
noted 1000 may not buy even one upgrade across a starting five — aim where a couple of meaningful buys are
possible; it's a tuning dial, land it in `economy-config` as a placeholder next to the others). This lets
the player invest before Oskun and compensate for the level deficit with equipment.

*Note it's now the third gil dial (with the enemy gear purse and item prices) — the D-econ-6 cost pass will
move all three together.*

### Fix 2 — Plot-character death → battle loss

A plot character reaching KO should **end the battle as a loss** (Lumen's near-death should have). This is
the **loss-side mirror** of the ADR-0149 victory-condition system — compose on it:
- **Plot units are must-survive** (key off the existing `PLOT_UNIT_IDS`/`isPlotUnique`); their KO triggers a
  loss outcome.
- **Generics still permadie** (unchanged — the lost Alvera generic was correct).
- **In-session design call:** immediate-loss-on-plot-KO vs loss-only-if-not-revived-in-window (ties to the
  permadeath/revival model — Fix 3's open thread). Lean: immediate is cleaner and tenser; decide live.

### Fix 3 — Lost-unit communication (+ an open thread)

Today a permadeath is shown **only by absence** — the unit is silently gone from the pre-battle lineup, which
is the first the player learns of it. Add a **clear lost/fallen indicator** on the Formation/roster screen
(a marked or memorialized entry) so the loss is communicated, not inferred.

**Open thread (discuss, don't pre-decide): is there revival at all?** The indicator forces the question —
permadeath-classic (dead is dead), or a recovery path (a church/aftermath revive, at gil or story cost)?
This is a real design decision with economy implications; flag it for a working-through this session or a
dedicated one, not a one-liner. Whatever's decided shapes Fix 2's immediate-vs-window detail.

---

## Then iterate (the workbench)

The rest of the session is collaborative Ch1 authoring — Chris drives, the implementer supports, items
surface from play. Known threads to work:

- **Story-battle lineups.** Oskun and Alvera still fight on **generated/default** lineups; author them
  explicitly (Chris in Cartographer Tier 2/3, as Zelmonia Hills was). Zelmonia Hills' Oscar/Tina keep their
  overrides but inherited new defaults for any un-overridden half — eyes-on there too.
- **Map cosmetics — Alvera roofs.** New **building-roof tile art** for Alvera's architecture (elev-8 walls,
  elev-3 interiors). Implementer adds the art asset + makes it selectable in Cartographer; Chris applies it.
- **Map cosmetics — Zelmonia Hills and onward.** Improve the look, **reusing Mountain Pass's rocky terrain**
  art (existing assets applied to new maps). Confirm the rocky terrain/tile art is exposed for reuse in
  Cartographer; Chris iterates the aesthetics.
- **Whatever else playtest surfaces** — this is the point of the session; treat the above as the seed list,
  not the boundary.

---

## Not this session (holding threads)

- **The full calibration pass** (offset curve + `ENEMY_JP_PER_LEVEL` + the native-passives-free lever) —
  still pending, still wants the party-avg-per-node series across a fuller playthrough. Starting gil handles
  the *opening*; the whole-chapter curve is a later, deliberate pass. **Don't pre-tune offsets here.**
- **D-econ-6 cost tuning** (moves all three gil dials).
- **Revival mechanism** beyond the Fix-3 communication — the open thread above.
- Remaining Ch1 maps beyond cosmetics (Grek onward) — author as the workbench continues, no fixed target.

## Workflow notes

- **Land Fixes 1–3, then go open-ended.** The fixes are small and specced; the authoring is iterative and
  Chris-driven. The implementer's job after the fixes is to support authoring and absorb playtest items, not
  to execute a checklist.
- File paths are inferences — audit to confirm (campaign-start gil grant site; the outcome-condition
  loss-side; the Formation/roster render; Cartographer's tile-art selection).
- Mid-session design questions (revival, immediate-vs-window) route through Chris.

## Watch-fors

- **Starting gil vs the opening feel** — the dial's whole job; if the opening still reads too tough after a
  meaningful buy, the native-passive lever (not the offset) is the next thing to look at, per last session.
- **Plot-loss scope** — confirm it fires for *joined* plot units too (Clio/Thessaly/Sera once they join),
  not just the starting two; and that it doesn't misfire on a guest (guests aren't must-survive unless a
  battle authors them so).
- **Lost-unit indicator vs revival** — don't build the indicator in a way that assumes permadeath is final
  if revival might land; keep it a "fallen" state that a future revive could clear.
- **Cosmetic-authoring round-trip** — new tile art must survive Cartographer export (the map modules are
  overwritten wholesale; art selection has to be real authored data, not a hand-edit that the next export
  clobbers).

## Estimated size

The three fixes are small (a config grant, a loss-condition compose, a roster indicator). The bulk of the
session is intentionally open authoring/polish time — which is the point. If revival becomes a live design
discussion, it may warrant its own session rather than eating this one.
