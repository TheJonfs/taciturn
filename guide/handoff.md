# Handoff

*Outgoing notes from the S48 + S49 + S50 catch-up session — the big
one. Three implementer sessions reconciled in one guide-side pass:
S48's tuning bundle (Charged Attack / Quickstep), S49's ninth class
(Calculator + Math Skill substrate + Level system), and S50's
universal-gear additions (five new items) and level-formula fix.
This session also surfaced a code/spec mismatch on the Level math
which Chris reconciled mid-session in commit 04f8b0f (S50 pt 2: cap
level HP/MP shift at ±10%).*
*Overwritten each session — read every item, then act / promote / drop.*

## What landed

The guide is in sync with main through S50 pt 2. `output/guide.pdf`
rebuilt clean at ~59.4 MB; the size growth (55.5 → 59.4) is
substantively the new Calculator portrait + new prose + 5 new Armory
entries + new Foundations section.

### S48 prose tweaks (two single-paragraph edits)

- **Hunter / Charged Attack** (`content/classes/hunter.ts`). S48 retuned
  Charged Attack from `power_coefficient: 1.5` / `mpCost: 0` to
  `2.0` / `6`. Updated the full / compact notes to say "twice the
  force … and a measure of her MP besides" and "×2 damage, paid in
  MP and a turn's wait."
- **Aethurge / Quickstep** (`content/classes/lightning-mage.ts`).
  S48 corrected the in-game description from "Move-only turn" to
  "any turn with Move." Tightened the guide's "commits to moving"
  (ambiguous) to "any turn the Aethurge moves — whether or not she
  also acts."

### Calculator — full Specialization spread (new)

`content/classes/calculator.ts` — the 9th class's ClassProse, slotted
alphabetically between Assassin and Geosage. Tightened over three
passes during the session to fit on the standard two-page spread:

- **Tagline + 2-paragraph brief**: identity-only on the verso. The
  back-line arithmetician who reads the engagement and resolves a
  question of arithmetic on each turn. Slow, fragile, unforgiving
  of the cadet who doesn't check the preview.
- **`commandSetIntro`** (new optional field on `ClassProse`): a
  named "Math Skill" block at the head of the Active Skills column,
  explaining the parameter (CT / Height / Level / current HP) ×
  divisor (3 / 4 / 5 / *prime*) picker, field-wide dispatch, and the
  Mathematician-required note. Visually a peer of the ability blocks
  beneath it; semantically a section intro.
- **5 Math ability notes** (Precision Fire, Targeted Treatment, Exact
  Rhythm, Sculpted Enhancement, Engineered Defenses) — each ~25-30
  words after tightening, focused on the spell's tactical question
  (friendly fire on Treatment, deterministic Faith-scaling on Rhythm,
  buff-stacking on Defenses).
- **3 R/S/M notes** (Cornered Focus reaction; Mathematician support
  — explicit "*not* optional"; Thoughtful Pacing movement — walk to
  sustain).
- **2-paragraph strategy + 3 marginalia**.

`attack` is intentionally omitted from the spread per Chris's brief.
The `commandSetIntro` block fills the freed slot; the variant-e
template now skips actives without an authored note (new convention,
applied only to Calculator today).

### Calculator wiring + machinery changes

- `SPREAD_ORDER` (`build/spread-context.ts`) now lists 9 classes in
  alphabetical order; `CLASS_META` registers the Calculator with its
  portrait (`art/calculator_1.png`) and a `'calculator'` element
  identity.
- `variant-e.css` adds the Calculator's parchment-ink palette (cool
  indigo `#2c3a6b` over deep ink-on-vellum band `#1e2747`, warm
  vellum label `#d8c79b`).
- `content/classes/index.ts` wires `calculatorProse` into the
  registry.
- `pages/layout.ts` updates the Specializations half-title intro to
  read "...and the Calculator, who answers it with her arithmetic";
  the *nine* count auto-updates via `numberWord(SPREAD_ORDER.length)`.
- `build/ability-format.ts` `rangeText` handles `kind: 'math_skill'`
  by returning `"Field-wide (parameter × value)"`.
- `pages/variant-e.ts` (1) renders the `commandSetIntro` block at the
  head of Active Skills when present, (2) skips abilities without
  authored prose notes.
- `content/prose.ts` adds the optional `commandSetIntro` field to
  `ClassProse`.

### Foundations chapter — *The Cadet's Standing* (new section)

`content/foundations/index.ts` gains a section between *Lingering
Conditions* and *Requisitioned Gear* — the cadet's body before her
gear. Describes the marching order (slot 1 → L25, alternating
outward: 24 / 26 / 23 / 27 / …), the **flat ±10% HP/MP shift** at
either ±1 or ±2 levels of remove, and the ±1 dominant-stat shift
added *on top of* the 10% shift at the outer ranks. Per-class
dominant stat enumerated (PA for Knight / Alchemist / Hunter; SPD
for Assassin; MA for the four elemental Mages and Calculator).

**Code/spec reconciliation during the session.** The guide originally
described per-level scaling (matching ADR-0087's formula and the
then-current `built-team.ts` implementation: `1 + 0.1 × levelOffset`,
yielding ±20% at slots 4/5). Chris corrected mid-session that the
*design* was flat ±10% capped, with the dominant-stat shift as the
additive at ±2; I rewrote the Foundations prose to match the design,
flagged the code/spec drift, and Chris reconciled it on the code
side in commit 04f8b0f (S50 pt 2). Guide and engine are now in sync.
ADR-0087 likely warrants an amendment to capture the cap; flagged
here as a doc follow-up.

### Armory — 5 new universal items (S50 pt 1)

`content/items/index.ts` picks up five entries in their existing
catalog subsections:

- **Parrying Sword** (Weapons / swords): WP 6 + +10 front / +5 side
  evade. The blade for the long exchange.
- **Shimmer Cloak** (Armour): universal body, +75 HP + flat +10
  evade at every facing.
- **Soul Vest** (Armour): universal body, +50 HP + +10 Brave + +10
  Faith.
- **Golden Hairpin** (Headgear): universal head, +10 HP + every
  cast costs half MP. Pitched at the long-engagement mage,
  Calculator paying the per-cadet Math tax, and the
  magical-secondary Knight.
- **Skullclamp** (Headgear): universal head, +1 PA + +1 MA, paid
  in -20 HP / -10 MP. Hybrid striker's helm; note is explicit that
  the costs are real and deliberate.

## Watch-for / flag to Chris

- **Calculator spread fit (final pass).** After two rounds of
  tightening, the Calculator's recto lands on a single page in my
  build; flip through to confirm on yours. If it *still* spills the
  remaining levers are: drop the `commandSetIntro` block and fold a
  sentence about the picker into the brief (costs the spread its
  system explainer); cut a marginalia; or consolidate the two
  shortest passives into one block.
- **Verso/recto parity across 9 spreads.** Adding a 9th spread shifts
  every subsequent half-title's page parity. The S47 design carried
  an auto-inserted blank between Pyromancer recto and Armory
  half-title; that blank may move or vanish, and a new one may
  appear elsewhere. CSS `break-before: right` should handle it, but
  worth a flip-through.
- **"Divisor" vs "Value" terminology.** I authored to your brief's
  "Parameter and Divisor" framing. The in-game UI says "Value" (with
  options Prime / ×3 / ×4 / ×5), and Prime isn't strictly a divisor.
  The intro block's facts line reads "Parameter × divisor"; the
  per-spell formatter line reads "Field-wide (parameter × value)" —
  slightly inconsistent but each is true in its own register. Easy
  edit either way if you'd prefer perfect alignment.
- **ADR-0087 may need amending.** Now that the level math caps at
  ±10% (rather than scaling per-level as the original ADR formula
  prescribed), the ADR text in `docs/decisions/0087-level-system.md`
  is out of date — the formula block in the Decision section still
  reads `(1 + 0.1 × (level - 25))`. Either amend in place with an
  update note or write a small follow-up ADR; it's historical
  documentation, so not blocking.
- **Dev server still doesn't load styles** (Vite serves CSS as JS in
  dev — flagged sessions ago). All verification via
  `npm run build:guide` + `output/guide.pdf`.
- **PDF still ~59 MB.** Art downsample remains overdue.

### Build setup note (this machine)

`pnpm` isn't on PATH and corepack's shim install needs admin on
`C:\Program Files\nodejs`. The cached pnpm at
`$env:LOCALAPPDATA\node\corepack\v1\pnpm\10.33.2\bin\pnpm.cjs` works
when invoked directly with `node`. `guide/node_modules` was missing
this session; one `node $path install` from `guide/` populated it
from the lockfile. Future sessions on this machine may hit the same
shape.

## Considered and rejected

- **A separate diagram for the Level system Foundations section.**
  A swatch graphic showing slot positions 1–5 with their level
  numbers could read nicely. Skipped — the prose carries the
  pattern, and diagrams in Foundations are currently reserved for
  the visually-helpful cases (CT meter, elemental wheel). Future
  polish pass if Chris wants to expand Foundations' visual
  vocabulary.
- **Synthesizing Math Skill as a fake ability in `classAbilities`.**
  Rejected: `math_skill` is a command-set, not an ability, and
  faking a synthetic ability would have required a fake
  AbilityDefinition with fake `kind`/`bucket`. The `commandSetIntro`
  prose field is more honest — clearly an instructor's-voice block,
  not a pretend-ability.
- **Adding `attack` to the Calculator's prose anyway.** The
  game-side Calculator has Attack in `freeAbilities`. Per the brief,
  dropped from the spread. The new "no note = no entry" rule makes
  this a clean skip.
- **A fourth marginalia repeating "the Calculator does not race the
  engagement; she counts it."** Originally authored but cut during
  tightening — the strategy paragraph already closes on that line.

## Suggested next scope

- **Visual proof pass on the Calculator spread.** Find Calculator
  (now 4th alphabetically) and confirm: verso brief fits, recto lands
  on one page, intro block reads as a peer of the ability blocks,
  parchment-ink palette feels right.
- **Pre-vs-post-Calculator spread parity sanity-check.** Flip through
  the 9 spreads to confirm none of them landed on the wrong
  facing-pair after the page-count shift.
- **ADR-0087 reconciliation** (per watch-for above) if doc-hygiene
  matters to you.
- **Art downsample** if 59 MB is a concern for distribution.
