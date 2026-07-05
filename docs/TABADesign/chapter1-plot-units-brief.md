# Chapter-1 Plot-Unique Units — signature abilities, overrides, three new seams (brief)

**Status:** review-ready draft. Plaintext review is a hard gate before implementer handoff.
**Shape:** this is **capability work + content**, not just content entry. Three small reusable engine
**seams** get built once; **five units** are instantiated on them. Frame the session as "add three seams,
then author five units," not "author five characters."
**Reference:** the JP costing rubric (`m2-jp-costing-budget.md`) for pricing the two *purchasable*
signature components (Hamstring, Thessaly's Math components); the S83 handoff for `classAccessOverride`,
`reclassUnit`, the component catalog, and the seed-opens-tiers behavior.
**Out of scope (M5 story):** when/how these five join, dialogue, Chapter-1 beats, recruitment triggers. A
unit is fully functional as a fixture and a character *without* any story attached — the story decides when
you *meet* them, not what they *are*.

---

## Why author these now (not M5)
They are **already the campaign testing lineup**, currently standing in as generic L25 fixtures wearing the
wrong data. Authoring them for real makes the test lineup exercise the plot-unique machinery (overrides,
signature abilities, the new seams) instead of routing around it. Each signature also *is* a small new
engine capability — building them now proves those seams early, while the design is fresh and the
progression code hasn't ossified.

## LOAD-BEARING SCOPING NOTE — overrides at join-level, not test-level
Current testing is at **L25** (≈ mid Chapter 2). At L25 a unit has enough **seeded spend** that its tiers
open semi-naturally (the handoff's seed-opens-tiers wrinkle) — so Thessaly and Sera at L25 will **not**
stress the "capstone-lit / foundations-dark, rescued only by the fallback" path. **This is a reason to be
explicit, not to skip it:** the `classAccessOverride` fields must be authored **correctly now even though
the L25 fixtures won't visibly exercise them**, so they're right when the real Chapter-1-*level* join
versions get authored in M5. Risk to avoid: setting up L25 Thessaly, seeing her tree work without the
override doing visible work, and under-specifying the field. **The override is load-bearing at join level.**

---

## Three new engine seams (build once; reusable)

### Seam 1 — Battle knows its chapter
The battle context exposes a **chapter number**. Feeds two abilities (Lumen's fire multiplier, Chris's
redirect fraction), so it's a shared input, not a one-off — build it properly.
- Fake playtest battles **declare a placeholder chapter** (or let each battle be its own chapter, to
  exercise the range — recommended, so abilities are seen at multiple chapter values).
- Both consumers derive a per-chapter magnitude from this one value.

### Seam 2 — Parameterized proximity damage-redirect (cover)
A reusable "cover" primitive: a fraction of a nearby ally's **incoming** damage reroutes to the bearer.
- **Parameters:** redirect fraction, range (adjacency), vertical tolerance. Chris is instance one; future
  generic tanks / boss minions reuse it with different params.
- **Ruling (settled):** redirect the **raw** incoming, *then* the bearer mitigates it through their own
  Protect / resistances / armor — so the tank's own defenses make the cover *better* (the point of a soak).
- Interacts with the engine's `system_damage` bypass patterns — implement as composition on those, don't
  special-case. Verify the redirect resolves cleanly against reactions/counters on the redirected hit.

### Seam 3 — Unit-restricted components
The component catalog can **scope a component to a specific unit** — present in that unit's catalog
(buyable, curve-priced), **absent from every other unit's** catalog. Thessaly's XP-Parameter and
Square-Value are the first instances (they must NOT appear for generic Calculators). "Restricted +
purchasable" is barely more than "restricted + auto-unlocked," and it's the version that keeps her power
*paced* (see her entry).

---

## The five units (instantiations)

| Unit | Class | `classAccessOverride` | Signature |
|---|---|---|---|
| **Lumen** (protagonist, ♀) | Pyromancer (T1) | *none* | Fire-multiplier passive (chapter-scaling) |
| **Chris** (deuteragonist, ♂) | Knight (T2) | `[Knight, Alchemist]` | Cover passive (chapter-scaling) |
| **Clio** (♀) | Hydrologist (T1) | *none* | Team-CT passive (chapter-scaling) |
| **Thessaly** (♀) | Calculator (T3) | `[Calculator, Geosage]` | 2 exclusive Math components (buyable) |
| **Sera** (♀) | Assassin (T3) | `[Assassin, Monk]` | Hamstring (new active, buyable) |

The **motif:** three of five scale with the chapter (Lumen/Chris/Clio); two instead get **exclusive kit
expansion** nobody else can reach (Thessaly/Sera). Two deliberate categories, not an incomplete pattern.

**Override note:** Lumen and Clio are Tier-1 classes → baseline-reachable → **no override needed** (any unit
can be a Pyromancer/Hydrologist). Chris's `Alchemist` fallback is also his Knight→Templar on-ramp (Alchemist
is Physical T1 → crediting it opens his tree legitimately; Templar is a hybrid needing both-halves T1, and
healing-JP is thematic). Thessaly/Sera's Tier-1 fallbacks are the **anti-dead-end**: a T3-only unit whose
spend credits only T3 can *never* satisfy a Tier-1-gated threshold, so it's locked forever without a
fallback. They reclass out to their fallback and back (override is a **durable unit field** — confirm it
**survives `reclassUnit`**, the one load-bearing mechanic here), and earn breadth by spending 500 in the
fallback's Tier-1 the normal way. They start as specialist-plus-one, not generalist.

### Lumen — fire multiplier
Free, innate, always-equipped passive: multiply any **fire-tagged** damage she deals by **1 + 0.1·chapter**
(×1.1 / ×1.2 / ×1.3 across the 3-chapter campaign). Capped by the 3-chapter horizon → tops at ×1.3
(a fire-only, bounded second Conductor — potent but not runaway). Reads Seam 1. Name TBD.

### Chris — cover
Free, innate passive (Knight-themed): a unit within adjacency (+ vertical tolerance 3) of Chris has
**10/20/30%** (= 10%·chapter) of its incoming damage redirected to Chris (raw, then he mitigates). Instance
of Seam 2, magnitude from Seam 1.

### Clio — team CT
Free, innate passive: **on every turn Clio takes** (settled: every turn, not gated to an action — she's
always conducting), all allies gain **3–4·chapter CT** (start at either, tune from playtest). A mild
accelerant that occasionally decides a round; a team-tempo role nobody else fills.
- **WATCH-FOR (playtest, not a blocker):** stacked with her own Hydrologist CT tools (Flow State, Quickstep,
  Short Charge) this could compound toward a degenerate "Clio acts → allies accelerate → Clio comes up
  sooner → repeat" loop. **Committed as-is; the multiplier is the tuning knob** if playtest shows it. Watch
  for it; don't pre-nerf by analysis.

### Thessaly — exclusive Math components (buyable, curve-priced)
Two **unit-restricted** components (Seam 3) in *her* Calculator catalog only:
- **XP** (Parameter) and **Square** (Value: 1, 4, 9, 16, 25, …).
- **Not auto-unlocked** — **buyable like any component**, so the prodigy fantasy (math nobody else can do)
  is *earned*, and the large power delta is **paced**. With them she reaches a **5×5 = 25-pairing** lattice
  vs. the base 4×4 = 16 (+56% targeting combinations × 5 payloads).
- **Costing:** price them **above** a base Math component, because each opens a whole new row/column of
  triples (the accelerating-lattice curve from the costing arc), not just +1 cell. Reaching the full
  25-grid becomes a Thessaly-unique Calculator-mastery milestone. She gets the **normal T3 unlock grant**;
  the two components are the paced part, not the grant.

### Sera — Hamstring (new Assassin active, buyable, her signature)
A new active, **Sera-exclusive** (unit-restricted, buyable — parallel to Thessaly's components; NOT a
chapter passive — she and Thessaly are the two "exclusive-kit" units):
- **MP 8; same range + LoS as her other line abilities; instant.** Applies **Move −1 and Jump −1**, proc
  gated by the **same Speed-based formula as Shadow Stitch / Blowdart**.
- **Stacking + permanent** (a different anti-mobility axis than Shadow Stitch's short-duration total Stop —
  attritional grind-down vs. burst lockdown). **Floors at 0** (both Move and Jump — negative is meaningless;
  "immobilized" is only true when *both* floor, since Move-0/Jump-2 can still climb/be repositioned).
  Accumulating to full immobilize takes several dedicated turns → a boss-fight texture, not a dominant
  strategy.
- **Costing: ~200 JP.** Slots as her natural fifth active — above the basic debuffs (Blowdart 100 /
  Undermine · Sow Doubt 150), well below the capstone (Shadow Stitch 350): entry poison → situational
  debuffs → Hamstring (mid attritional) → Shadow Stitch (burst capstone). Internally coherent.

---

## Portraits (flag)
All five want **unique portrait references** (Chris is authoring the art on the side, landing
incrementally). This is the **first live consumer of the ADR-0136 portrait-override seam** — previously an
untouched M5 to-do. Wire the seam for these five; art fills in as it arrives (placeholder-tolerant).

## Implementation work
1. **Seam 1** (battle-chapter context) + fake-battle chapter declaration.
2. **Seam 2** (parameterized redirect) composing on `system_damage`.
3. **Seam 3** (unit-restricted components) in the catalog.
4. **Five unit definitions** (class, level, `classAccessOverride`, portrait ref, signature ability), with
   the two chapter-passives (Lumen, Chris) and Clio's team-CT passive as innate free abilities, and
   Thessaly's two components + Sera's Hamstring as buyable unit-restricted components.
5. **Costing entry:** Hamstring ~200; Thessaly's XP/Square above base-component cost (curve-justified).

## Acceptance criteria
- The three seams work in isolation (chapter readable; redirect parameterized + raw-then-mitigate; a
  unit-restricted component appears only for its unit).
- Each of the five units instantiates correctly; signatures fire (fire ×; cover redirect; team CT; the two
  Math components buyable *only* for Thessaly and absent elsewhere; Hamstring buyable only for Sera).
- `classAccessOverride` **survives `reclassUnit`** — a plot-unique can reclass to its fallback and back to
  its override class (the round-trip mechanic).
- Hamstring: stacks, floors Move/Jump at 0, procs on the Speed formula.
- Portrait seam wired (placeholder-tolerant).

## Watch-fors
- **Overrides right at join-level despite L25 fixtures not stressing them** (the scoping note).
- **Clio's tempo loop** — playtest watch, tunable, not a pre-nerf.
- **Chris's redirect vs. reactions/`system_damage`** — verify clean resolution.
- **Thessaly's components must be absent** from every non-Thessaly Calculator catalog.
- **Portrait art lands incrementally** — don't block unit authoring on final art.

## Estimated size
**Medium-large.** Three small seams (each modest) + five unit definitions + two costed components. The
seams are the load-bearing part; the units are mostly data once the seams exist. Natural order: seams
first (each testable in isolation), then instantiate the five.
