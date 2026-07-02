# M2 — Per-class base-stat curves (`buildBaseStats`)

**Component of M2 (progression).** This brief specifies how `buildBaseStats(class, level)` produces
the five level-driven base stats — **PA, MA, HP, MP, Speed** — for all 14 classes across the full
level range. The design is **locked** (settled across a long planner exploration); this is an
implementation spec with the verification tables to check against. It does **not** cover XP/leveling
mechanics or JP/ability-unlock — those are separate M2 pieces that *drive* the `level` input this
consumes.

## Key invariant (why Mage War is safe)

Every curve is anchored so that **at L25 it returns the exact stat-block value** from
`planner-content-reference.md §5`. Since ceil/floor of an integer is itself, `buildBaseStats(class,
25)` reproduces today's numbers exactly — so Mage War (tuned at L25, battles at 23–27) is unaffected
by construction. The curves only diverge from current behavior *away* from L25, which is the campaign.

## Pre-implementation audit (light)

`buildBaseStats(class, level)` already exists (it's the class-layer of the stat composition in the
mechanics guide). Before implementing:
1. **How does it curve today?** Is there a real per-level curve, or does it effectively return the
   L25 values regardless of level (untested away from 25 because MW never leaves ~25)? Report the
   current form; this spec replaces it.
2. **The per-stat cap (load-bearing — see §Caps).** The mechanics guide shows
   `clamp(..., min_cap, max_cap)` with PA/MA/Speed capped at 99. This spec **lifts the cap on MA**
   (intentional runaway) but **keeps it on Speed**. Enumerate everything that *assumes* a ≤99 ceiling:
   stat-display field widths, any formula written trusting the bound, the clamp itself. The cap must
   become **per-stat**, not global.

## The method

For each class, take its **L25 base stat** from §5 (the authoritative anchor). Derive the float
curve from the per-stat constants below, evaluate at the requested level, then round. **Store the
constants, not 14 hand-authored tables** — the curves are `f(§5 L25 value, constant)`, so retuning is
a constant change. Round only the *final output* (the float curve is continuous; round per level).

| Stat | Form | L1 anchor | L50 anchor | Round | Past L50 |
|---|---|---|---|---|---|
| **PA** | linear through (1, L1),(25, L25) | (4/13)·L25 | — (linear extend) | **ceil** | linear continues |
| **MA** | quadratic through (1, L1),(25, L25),(50, L50) | (3/17)·L25 | (40/17)·L25 | **ceil** | **quadratic continues — runaway, uncapped** |
| **HP** | linear through (1, L1),(25, L25) | (60/190)·L25 ≈ 0.316·L25 | — (linear extend) | **ceil** | linear continues |
| **MP** | linear through (1, L1),(25, L25) | (13/48)·L25 ≈ 0.271·L25 | — (linear extend) | **ceil** | linear continues |
| **Speed** | piecewise-linear through (1, L1),(25, L25),(50, L50) | 0.5·L25 + 1.5 | (4/3)·L25 | **floor** | **PLATEAU — clamp to L50 value** |

Notes on the two special cases:
- **MA is quadratic and deliberately unbounded past L50.** A grinding mage's MA accelerates
  (Aethurge base ~93 at L100), by design — "sufficiently advanced wizardry eclipses a grandmaster's
  swordarm." Its counterplay is a gear/access concern for M3 (universal high-resistance gear as a
  hard wall; scarce non-elemental MA-damage as the relief valve), NOT a curve concern. Do not
  linearize or clamp MA.
- **Speed is floored (not ceiled) and plateaus at L50.** Ceiling would inflate the one stat that
  compounds into turn economy; floor keeps it bounded and reproduces the intended targets. Base Speed
  stops climbing at L50 — the "devastating fast build" comes from the Haste/gear multiplier stack
  (gated behind campaign investment), not base growth. Speed is the **anti-MA**: bounded by design,
  and it keeps its 99 cap.

Rounding rationale (for the record): ceil is generous — it lifts dump stats off zero and makes L1
units marginally beefy, fine for magnitude stats (PA/MA/HP/MP). Floor keeps the compounding stat
(Speed) tight.

## Verification tables (implementation must reproduce these — L1 / L25 / L50)

L25 = exact §5 stat block. L1/L50 = derived + rounded per the method above.

**PA** (linear, ceil)
```
Knight 4/10/18   Monk 3/9/16    Alchemist 3/8/14   Hunter 3/7/13   Thief 3/7/13
Assassin 2/6/11  Templar 2/6/11 Terraformer 2/6/11 Calculator 2/5/9
Geosage 2/4/7    Hydrologist 2/4/7  Pyromancer 2/4/7  Aethurge 2/4/7  Enchanter 1/3/6
```
**MA** (quadratic, ceil; L50 shown, continues past it)
```
Knight 1/4/10    Monk 1/4/10    Alchemist 1/5/12   Hunter 1/5/12   Thief 1/3/8
Assassin 1/3/8   Templar 2/6/15 Terraformer 2/8/19 Calculator 2/9/22
Geosage 3/12/29  Hydrologist 3/12/29  Pyromancer 3/13/31  Aethurge 3/14/33  Enchanter 2/10/24
```
**HP** (linear, ceil)
```
Monk 60/190/326  Knight 46/144/247  Templar 42/132/227  Alchemist 40/126/216
Hunter 37/116/199  Geosage 36/112/192  Terraformer 34/105/180  Enchanter 33/103/177
Hydrologist 33/102/175  Calculator 32/101/173  Pyromancer 31/97/167
Assassin 31/96/165  Thief 29/90/155  Aethurge 28/87/150
```
**MP** (linear, ceil)
```
Monk 8/26/46   Knight 6/20/36   Templar 10/36/64   Alchemist 10/36/64   Hunter 8/28/50
Geosage 13/48/85  Terraformer 10/35/62  Enchanter 11/40/71  Hydrologist 13/48/85
Calculator 11/37/66  Pyromancer 13/48/85  Assassin 7/24/43  Thief 8/28/50  Aethurge 13/48/85
```
**Speed** (piecewise, floor, plateaus at L50)
```
Monk 6/10/13   Knight 5/8/10   Templar 5/8/10   Alchemist 7/11/14   Hunter 6/10/13
Geosage 5/8/10  Terraformer 5/8/10  Enchanter 6/10/13  Hydrologist 6/10/13
Calculator 5/7/9  Pyromancer 6/9/12  Assassin 8/13/17  Thief 7/11/14  Aethurge 6/9/12
```

Same-anchor ties are expected and correct (the curve is a pure function of the L25 anchor): the four
elemental mages share MP (all 48) and several classes share Speed/PA rows. They're differentiated by
other stats and kits, not these curves.

## Caps (the per-stat decision — flag from the audit)

- **MA: lift the 99 cap** (unbounded runaway by design). Ensure nothing downstream overflows or
  assumes ≤2 digits.
- **Speed: keep the 99 cap** (and the plateau makes it academic anyway — base tops out ~17).
- **PA / HP / MP:** keep existing caps; none approach them in the base curves (PA ~32 at L100).

## Forward seam — per-unit override layer (leave the hook, don't wire it)

TABA will later define **unique characters** (protagonists, guests) whose stats layer per-character
overrides on top of the class-derived base — e.g. a flat MaxMP modifier. That is a *separate future
slice* (a durable override field on the unit + a composition handler); **do not build it here.** But
since this brief refactors the stat-composition path, leave the seam clean so the later work is
*additive, not another refactor*:

- Compose the new base curves **through the existing `modifyStatQuery` hook chain** (Equipment →
  Class → Passive → Statuses), NOT via a bypass that hardcodes class-level values. The hook is
  already the extensibility mechanism — a future per-unit modifier is just another handler.
- **Document the intended insertion point** for a per-unit (unique-ID) stat-modifier handler: where
  it attaches (a per-character layer, conceptually alongside Class) and the shape it would read (flat
  + multiplicative per-stat modifiers keyed by the unit's stable id).
- Do **not** add the override data field, a handler, or any per-unit data now — keep the composition
  open and mark the spot.

*(Scope boundary: a unique character's other half — an always-on passive independent of class — lives
in the free-ability/passive system, not this stat path. This brief covers the **stat-modifier seam
only**; the passive-grant seam is the future slice's concern.)*

## Acceptance criteria

- `buildBaseStats(class, level)` reproduces every value in the verification tables at L1/L25/L50 for
  all 14 classes, with the correct per-stat rounding.
- **L25 returns the exact §5 stat block** for every class/stat (→ Mage War unchanged — verify a MW
  battle is byte-identical).
- MA continues on the quadratic past L50 (uncapped); Speed clamps to its L50 value past L50; PA/HP/MP
  extend linearly.
- Curves are computed from stored **constants + §5 L25 values**, not 14 hardcoded tables.
- Base curves compose **through `modifyStatQuery`** (no bypass), with the per-unit override insertion
  point documented (§Forward seam) — no override data or handler wired.
- Per-stat cap wired (MA uncapped, Speed capped); downstream cap-assumptions audited/handled.
- Suite green; `tsc -b` + `vite build` clean; ADR for the stat-curve system.

## Out of scope

- **XP → level** mechanics and **JP → ability unlock** — separate M2 pieces; this only maps a given
  level to stats.
- The **gear, passive, and status layers** (Martial Expertise, Conductor, weapons, armor HP, robes,
  Haste) — they already exist and compose on top of these base stats; this spec is base-only.
- The **M3 counterplay gear** (universal-resistance wall, non-elemental relief valve) — a later
  economy concern, noted here only to explain why MA is allowed to run away.
- Quadratic-MA past-L50 balance for bonus content (enemy scaling, whether weapons keep tiering) — a
  content pass if/when postgame is built.

## Files (hedged — audit confirms)

`buildBaseStats` and its constants (wherever the class-level curve lives); the per-stat cap
configuration in the stat-clamp path; ADR; Vitest covering the L1/L25/L50 verification values +
the L25-reproduces-§5 invariant + the MA-runaway / Speed-plateau past-L50 behavior. No changes to
gear/passive/status layers expected.

## Watch-fors

- **L25 must reproduce §5 exactly** — the MW-safety invariant; test it explicitly.
- **Round at the output, per level** — not on the anchors; the curve is continuous, rounding is a
  display/storage step.
- **Constants, not tables** — keep the derivation parameter-driven so retuning is a constant edit.
- **MA uncapped is a real change** — hunt overflow / digit-width / clamp assumptions (audit §Caps).
- **Speed floor + plateau** — don't let Speed inherit the ceil rule or the linear-extend behavior.

## Estimated size

Medium. The math is fully specified; the work is (a) implementing five curve forms + two rounding
rules + two special past-L50 behaviors in `buildBaseStats`, (b) making the cap per-stat and auditing
its downstream assumptions, (c) tests. The audit's cap-assumption sweep is the only place scope could
grow. No design decisions remain.
