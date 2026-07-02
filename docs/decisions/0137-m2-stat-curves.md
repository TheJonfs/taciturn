## ADR-0137: M2 per-class base-stat curves (`buildBaseStats`)

**Status:** Accepted
**Date:** 2026-07-02
**Milestone:** TABA M2 (progression) — the base-stat-curve piece
**Brief:** `docs/TABADesign/m2-stat-curves-brief.md`

## Context

The campaign (TABA) grows units across the full level range, so it needs a real
per-level base-stat curve. What existed was the **S49/S50 slot-level modifier**
(ADR-0087): on top of each class's L25 stat block it applied a flat **±10%**
HP/MP step (`round(base × (1 + 0.1·sign(level−25)))`, capped at ±10% regardless
of distance) plus a **±1 dominant-stat** step at the ±2 boundary. That was a
Mage-War device — MW clusters at L23–27 — and it has no meaningful curve away
from 25. This ADR replaces it with continuous per-class, per-stat curves that
carry from L1 to L50 and beyond.

The design was locked across a long planner exploration; the brief is an
implementation spec with verification tables. Two decisions were confirmed with
Chris at implementation time (see **Decisions** 4 and 5 below).

## The curve

For each class, take its **L25 base stat** from the §5 stat block (the
authoritative anchor, `classBaselineStats`). Derive the float curve from a small
set of shared per-stat constants, evaluate at the requested level, then round.
**Constants, not 14 tables** — the curves are `f(L25 anchor, constant)`, so
retuning is a constant edit. Round only the *final* output (the float curve is
continuous; rounding is a storage/display step).

| Stat | Form | L1 anchor | L50 anchor | Round | Past L50 |
|---|---|---|---|---|---|
| **PA** | linear through (1,L1),(25,L25) | (4/13)·L25 | — | **ceil** | linear continues |
| **MA** | quadratic through (1,L1),(25,L25),(50,L50) | (3/17)·L25 | (40/17)·L25 | **ceil** | **quadratic continues — uncapped** |
| **HP** | linear through (1,L1),(25,L25) | (60/190)·L25 | — | **ceil** | linear continues |
| **MP** | linear through (1,L1),(25,L25) | (13/48)·L25 | — | **ceil** | linear continues |
| **Speed** | piecewise-linear through (1,L1),(25,L25),(50,L50) | 0.5·L25 + 1.5 | (4/3)·L25 | **floor** | **plateau — clamp to L50 value** |

Two special cases:
- **MA is quadratic and deliberately uncapped past L50** — a grinding mage's MA
  accelerates by design (Aethurge base ~93 at L100). Its counterplay is a
  gear/access concern for M3, not a curve concern.
- **Speed is floored and plateaus at L50** — ceiling would inflate the one stat
  that compounds into turn economy. Base Speed stops climbing at L50; the fast
  build comes from the Haste/gear multiplier stack, not base growth. Speed is the
  **anti-MA**: bounded by design.

Implementation: `src/content/classes/stat-curves.ts` (constants + pure
evaluator `leveledClassStats`); `buildBaseStats` (in
`src/content/teams/built-team.ts`) is now a thin composition over it + Brave/Faith
+ crit defaults. Verified against the brief's L1/L25/L50 tables for all 14
classes in `stat-curves.test.ts` (61 assertions).

## Decisions

**1. Curve forms + rounding + past-L50 behavior** — as tabled above.

**2. Constants, not tables** — the retuning surface is the factor constants in
`stat-curves.ts`, keyed off the `classBaselineStats` L25 anchors.

**3. The L25 = §5 invariant** — every curve reproduces the exact §5 block at L25
(ceil/floor of an integer is itself). Tested explicitly per class.

**4. Mage War re-tunes its off-L25 units (the byte-identical criterion is
replaced).** The brief assumed MW is "tuned at L25, battles at 23–27" and would
be byte-identical by construction. It isn't: `mage-war.ts` deploys the Knight at
L25 but the four mages at **L24/L26/L23/L27**, and their *current* numbers come
from the ±10% modifier this ADR removes — which the new curve does not reproduce
at those levels. **Chris's call: keep the 23–27 levels and adopt the curve**,
accepting the re-tune as a blessed change (the curve is the more principled
model). The Knight (L25) stays byte-identical; the four mages shift:

| Unit | Old (±10% modifier) | New (curve) |
|---|---|---|
| Earth Mage L24 | HP101 MP43 PA4 MA12 SPD8 | HP109 MP47 PA4 MA12 **SPD7** |
| Fire Mage L26 | HP107 MP53 PA4 MA13 SPD9 | HP100 MP50 **PA5 MA14** SPD9 |
| Lightning Mage L23 | HP78 MP43 PA4 MA13 SPD9 | HP83 MP46 PA4 MA13 **SPD8** |
| Water Mage L27 | HP112 MP53 PA4 MA13 SPD10 | HP108 MP51 **PA5 MA14** SPD10 |

The same curve now also drives **team-builder** slot units (slots 1–4 →
L24/26/23/27 via `slotLevelFor`), so player-built off-L25 units shift
identically. The old dominant-stat ±1-at-±2 device is subsumed by the per-stat
curve; `buildBaseStats` no longer consumes `classDominantStats` (the map stays
for its other consumer — the `ClassDefinition.dominantStat` parity check and Math
Skill).

**5. The per-stat cap — the global 99 was never implemented; honor the spec
minimally.** The mechanics guide's "PA/MA/Speed capped at 99" is a **guide
fiction**: no 99 clamp on pa/ma/hp/mp exists in code, and `RulesetSpeedBounds.ceiling`
is `null` (the Haste-stacking ceiling was deliberately left open). Rather than
build a clamp subsystem nothing needs, the cap is applied **per-stat at the curve
output**: Speed gets `min(99, …)` (academic — base Speed plateaus ~17); MA gets
**no cap** (the runaway is the design). PA/HP/MP stay uncapped (PA ~32 at L100,
nowhere near any limit). MA-uncapped was audited for downstream digit-width /
overflow assumptions — none found (stat displays don't hard-assume ≤2 digits; the
`padStart` usages are all turn-number `T####` formatting, unrelated).

**6. The stat seam — pragmatic (Chris's call).** The brief asked base curves to
"compose through `modifyStatQuery`, not a bypass that hardcodes class-level
values," pointing at a future per-unit (unique-character) stat override. Today
the class base is the **seed** fed into the `modifyStatQuery` chain, not a live
handler — the engine `class` hook tier exists in the collector's ordering but is
dormant. Effective stat reads *already* compose through `modifyStatQuery`
(Equipment → Class → Passive → Statuses). So `buildBaseStats` stays the class
**seed**; the future per-unit override must arrive as **another
`modifyStatQuery` handler** registered at the `class` tier (flat + multiplicative
per stat, keyed by the unit's stable id), *not* by re-baking values into the
stored block. The insertion point is documented in `built-team.ts`'s
`buildBaseStats` docblock. We did **not** activate the class tier as a live
handler (that would be a large, risky engine change touching every stat-seed
site — inconsistent with this brief's scope); nor did we add any override data,
handler, or field now.

## Consequences

- Campaign units can now be authored/grown at any level with sensible stats; M2's
  XP→level piece (separate) feeds `level` into this consumer.
- Mage War's four mages re-tune (Decision 4) — a **player-facing** change, logged
  in `guide-changelog.md`.
- The MA runaway is now live in the model. Its balance counterplay (M3
  universal-resistance gear as a hard wall; scarce non-elemental MA damage as the
  relief valve) is a later economy concern, noted so the runaway is intentional,
  not an oversight.
- The per-unit stat-override slice (unique characters) is now a clean *additive*
  future step, not another refactor (Decision 6).

## Out of scope (per the brief)

- **XP→level** and **JP→ability-unlock** — separate M2 pieces; this only maps a
  given level to stats.
- The **gear / passive / status** layers (Martial Expertise, weapons, robes,
  Haste) — they already compose on top of these base stats via `modifyStatQuery`.
- The per-unit override **data + handler** (Decision 6 leaves the seam, not the
  wiring).
- Quadratic-MA past-L50 *balance* for any future postgame content.
