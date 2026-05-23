# Handoff

*Outgoing notes from the S45/S46 catch-up + Hunter spread + new items
+ S46 stat-and-MP tuning + Armory half-title + alphabetical
specializations + armoury sub-category sort.*
*Overwritten each session — read every item, then act / promote / drop.*

## What landed

The guide is in sync with main as of S46 + the tuning pass. **37 pages**;
verso/recto parity preserved across all eight spreads, and both
half-titles now land on right-hand (recto) pages.

### Hunter spread (new — the eighth class, fourth non-caster)

- `content/classes/hunter.ts` — full prose: brief, seven ability notes
  (attack + Marksmanship's pin_down / charged_attack / scramble +
  passives updraft / eagle_eye / high_jump), strategy, four marginalia.
  Recto holds at a single page (4 actives + 3 passives, same shape as
  the Knight).
- `content/classes/index.ts` — `hunterProse` registered.
- `build/spread-context.ts` — portrait imported (`hunter_1.png`, the
  user's tall 1696×2528 art that fills the frame), `'hunter'` added to
  `ElementId`, `CLASS_META` entry, inserted into `SPREAD_ORDER`.
- `styles/variant-e.css` — `.v-e--hunter` palette: deep emerald
  (`#2d5641`) over dark-forest band (`#1f3d2e`) with pale-sage label
  (`#a7c8b3`). Cooler and darker than the Geosage's brighter olive, so
  the two greens stay clearly distinct in a side-by-side flip.

### New armoury items (5)

In `content/items/index.ts` with flavor + tactical notes:
- **Wand of Lumen** (the Pyromancer's wand — `+1 Burn stack per
  fire-tagged application`, plus on-hit Wand of Lumen Resonance
  resistance shift)
- **Longbow** (WP 7, two-handed, range 2–5, height-delta variance)
- **Riptide Bow** (WP 5, water-imbued two-handed, 30% on-hit Undertow
  CT push)
- **Ironfoot** (mobility ↔ power trade: Move/Jump/Spd cost for PA/MA
  + Movement-slot lift)
- **Mantle of Protection** (catalog name; you'd called it "Mantle of
  Resistance" — used the catalog) — all 6 damage-type resistances +25
  and all-facing evasion +25

### Formatter expansions

The new content surfaced gaps in the auto-rendered mechanical lines.
All extensions are minimal and scoped.

**`build/ability-format.ts`:**
- **Min horizontal range** — `"Arc, range 2–5"` for bows / Pin Down
  (was always rendering as just `"range 5"`).
- **Vertical** — `vertical >= 10` becomes `", any elevation"` (the
  bow's vertical-99 sentinel). For `selfMove` abilities, vertical is
  spelled out when it exceeds horizontal (Scramble: `"Melee (1),
  vertical 5"`). Ordinary melee/spell verticals stay implicit so basic
  Attacks aren't noised up with `"vertical 3"`.
- **`selfMove`** — surfaces as the effect `"Self-move"` so Scramble has
  a non-empty mechanical line.

**`build/item-format.ts`:**
- **Weapon `range` + `twoHanded`** on the headline — the bow line now
  reads `"WP 7 · 33% accuracy · bow · range 2–5 · two-handed"`.
- **`height_delta` variance** — `"Variance scales with elevation
  (±20% per level above/below target)"`.
- **`statusApplicationStackCountModifiers`** — Wand of Lumen surfaces
  `"+1 Burn stack per fire-tagged application"`.
- **Six-element resistance collapse** — Mantle of Protection prints
  as `"All damage-type resistance +25"` instead of six lines. The
  earlier four-element ("All elemental resistance") collapse still
  applies.
- **All-equal evasion collapse** — Mantle's uniform +25/+25/+25
  prints as `"All-facing evasion +25"`.

### S46 tuning catch-up

S46 tuned baseline stats across the roster; the stat bands auto-render
the new values from `baseline-stats.ts`, so no per-class prose edits
were needed beyond a spot-check pass. The changes the data picked up:
**Knight PA 11→10**, **Alchemist Spd 10→11**, **Assassin Spd 14→13**,
**Move −1 across all eight classes**, **Assassin Command Set MP
retune** (Shadow Stitch 8→10, Undermine 10→6, Sow Doubt 10→6),
**The Offering tax −2→−3 PA**. All comparative-superlative claims in
prose (Aethurge "highest MA / lowest HP", Geosage "slowest of the four
elemental cadets / sturdiest caster", Hydrologist "fastest caster",
Pyromancer "one of the most fragile", Assassin "fastest cadet")
re-verified against the new numbers and still hold.

Two pieces of prose drift the data shift exposed and I fixed:
- The Offering's tactical line said "at a flat −2 PA" — corrected to
  −3 PA.
- Blowdart's note called it "the Assassin's cheapest standing
  pressure"; with Undermine/Sow Doubt now at 6 MP (cheaper than
  Blowdart's 8), the superlative is stale. Reframed as "the Assassin's
  *standing* chip pressure" — the durable claim (Blowdart is the only
  Shadow Art that lays ongoing damage).

### Armory half-title (Part Four)

- `pages/layout.ts` — new `armoryHalfTitle()` matching the
  Specializations and Training Fields half-titles (eyebrow / title /
  subtitle / brief / section list). The brief reuses the existing
  `armoryIntro` from `content/items/index.ts` — single source of truth
  for the Armorer's framing.
- `pages/armory.ts` — chapter masthead dropped (it duplicated what the
  half-title now carries). The `armoryIntro` import is gone from this
  file; the `#ch-armory` id moved to the half-title.
- `build/compose.ts` — `armoryHalfTitle()` inserted between the
  spreads and the armory chapter.
- `styles/front-matter.css` — `.half-title` now uses
  `break-before: right` so half-titles auto-land on recto. This was
  needed for the Armory half-title (Aethurge's recto ends on an odd
  page in the new alphabetical order, so the half-title would have
  fallen on an even page without it). The Specializations half-title
  was already on a recto and is unaffected.
- `styles/base.css` — new `@page :blank` rule styles the auto-inserted
  parity-blank pages with the standard frame and suppresses the folio
  + running header, so they read as intentional "end-of-part" pages
  rather than stray blanks. Page 24 (the parity blank before the
  Armory half-title) is the current consumer.

### Specializations sorted alphabetically

- `build/spread-context.ts` — `SPREAD_ORDER` reordered by display
  name: Aethurge, Alchemist, Assassin, Geosage, Hunter, Hydrologist,
  Knight, Pyromancer. Doc comment rewritten with the
  display-name-to-class-id mapping in the new order.
- `pages/layout.ts` — Specializations half-title brief lightly updated:
  added "the Hunter from the perch" to the non-caster roll-call, and
  noted "the spreads are arranged alphabetically; each is the same in
  form."
- All eight spread versos still land on even pages (the half-title
  before them keeps the parity).

### Armoury items sorted by sub-category

- `pages/armory.ts` — `ArmorySection` gained an optional `sortKey`,
  and each section declares its own.
  - *Weapon Racks* (`weaponSortKey`): swords → knives → axes → bows
    → staves → wands → shields. Items with no recognised family tag
    fall before shields.
  - *Armour Stores* (`armourSortKey`): armour first (universal →
    Knight-only → Mages-only), then headgear in the same restriction
    order.
  - *Accessory Cases*: no sortKey — preserves catalog order (you
    didn't ask for sub-sort there).
- Sort is stable (`Array.sort` since ES2019), so items within each
  sub-category preserve their catalog order. Sub-category groupings
  are visually apparent from the existing per-item header chips
  (`WEAPON · SWORD`, `ARMOUR · MAGES ONLY`, etc.) — no subheadings
  added.

## Watch-for / flag to Chris

- **Page 28 carries only Managuard.** The two-column flow chose to
  break the Weapon Racks section there, leaving a sparse page. Not
  broken — just a touch underfilled. Could tighten with a `widows`
  hint or by adjusting items per column; left as-is for now.
- **`@page :blank` styling.** Future half-title additions will
  trigger the same auto-blank treatment. If a chapter is ever added
  whose parity makes the previous half-title's blank land in the
  middle of a chapter (rather than between chapters), the blank could
  read awkwardly. Not currently a risk.
- **Alphabetical order reshuffled the chronological-intro phrasings.**
  The Alchemist brief still says "the Academy's sixth specialization"
  and the Hunter brief still says "the Academy's eighth specialization";
  these mean chronological-introduction order, not handbook order.
  Defensible as written; flag for the write-through if Chris wants
  them genericized.
- **Dev server still doesn't load styles** (Vite serves CSS as JS in
  dev — flagged sessions ago). All verification continues through
  `npm run build:guide` + `output/guide.pdf`.
- **PDF is now ~55 MB.** Art downsample is overdue.

## Considered and rejected

- **Adding visible sub-category subheadings** (e.g. "Swords", "Knives"
  inline) inside Weapon Racks / Armour Stores. The per-item header
  chips already communicate the grouping clearly enough that the sort
  alone reads. Subheadings would have needed CSS to span columns and
  break nicely. Easy to add later if you'd like them.
- **Hand-authored Armory half-title brief.** Re-using `armoryIntro`
  keeps a single source of truth for the Armorer's framing — and the
  existing prose already opens the chapter in exactly the voice a
  half-title needs.
- **Per-class MP-economy commentary in the Assassin's ability notes.**
  Tried adding "the dearest of her four" to Shadow Stitch and "cheap
  enough to spread" to Undermine; the additions tipped the recto past
  the page edge and broke parity. Reverted — the auto-rendered MP
  costs on the mechanical lines carry the economy clearly enough.
- **Restoring Foundations to 4 pages or rearranging the front matter
  to flip parity** so the Armory half-title would land on an odd page
  without an auto-blank. Cleaner solution turned out to be
  `break-before: right` + a styled `@page :blank` — book-typography
  standard, no front-matter disruption.

## Suggested next scope

Roadmap unchanged: write-through pass, art downsample (now overdue at
~55 MB), and future content as the game ships it. The handbook reads
end to end as the eight-discipline, alphabetically-ordered, four-part
Cadet's Handbook.
