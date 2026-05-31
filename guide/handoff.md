# Handoff

*Outgoing notes from the S52–S55 guide update — a large one. Marshmoor
(third training field), the bow range-from-height rule, the Gravity
Well tavern splash, the seven previously-bare Armory notes, the
**Terraformer** (tenth class spread), and the Staff of Power retune.
Three reader-facing formatter defects were found and fixed in passing.*
*Overwritten each session — read every item, then act / promote / drop.*

## What landed

`output/guide.pdf` rebuilt clean at **51 pages**, ~76 MB (the size bump
from ~59 MB is the new 6 MB tavern splash, the 4.7 MB Terraformer
portrait, Marshmoor's 3 pages, and the Terraformer's 2-page spread).
Build is `npm run build:guide` (vite build + tsx render-pdf).

### Marshmoor — third training field (S52)

- `content/training-fields/marshmoor.ts` — new `marshmoorProse:
  FieldProse`, same shape as River Ridge / Stonebridge: intro, three
  terrain sections (The Marsh / The Central Flats / The Corner Peaks),
  three tactical zones (The Long Approach / The Archer's Peaks / The
  Water Flank), a knockback-into-water section, the instructor's
  counsel, and a 7-swatch legend (deep water → SE peak elev 6, colours
  matched to `build/diagrams.ts`'s land ramp).
- `build/data.ts` — added `marshmoorMap()` (imports `marshmoor` from
  `@content/maps/marshmoor.ts`).
- `build/training-fields.ts` — appended `{ prose: marshmoorProse, map:
  marshmoorMap() }` to `TRAINING_FIELDS`. TOC, the Part-Five
  half-title list, and the chapter render all pick it up automatically;
  the data-driven SVG map renders the 16×16 grid with no template
  changes. Verified: map reads cleanly (blue NE / red SW corners, both
  peaks, legend correct) on p45.

### Bow range-from-height (S52)

Chris's call was **bow notes + Marshmoor** (Foundations left general).
- `content/items/index.ts` — extended the **Longbow** tactical note
  ("height does not only sharpen the shot — it lengthens it … a tile of
  range for every two elevations of drop") and the **Riptide Bow**
  note ("the same height rules: damage and reach both grow with the
  drop").
- Marshmoor's "Archer's Peaks" zone + the counsel carry the same
  lever, tied to the two corner peaks (the map doc flags these as the
  premium archer objectives the S52 mechanic creates).
- Foundations "Reading the Ground" was deliberately **not** touched —
  the rule is bow-specific and Foundations stays a general chapter.

### Gravity Well tavern splash

- `pages/layout.ts` — imports `../art/Gravity_Well_1.png` and renders a
  `<figure class="half-title__plate">` on the **Training Fields
  half-title** (Part Five), with the caption "Cadets between exercises
  — the off-hours the Academy does not examine."
- `styles/front-matter.css` — new `.half-title__plate` rules (max
  3.5in, hairline oxblood border, soft shadow, Cormorant italic
  caption). Generic, so any future half-title can carry a plate.

### Two reader-facing formatter defects — fixed in passing

Both were surfaced by items that auto-imported into the Armory after
the S50-pt2 catch-up, and both were genuine guide-side `item-format.ts`
bugs (not game bugs):

1. **`±NaN%` on Absolom.** Absolom (S50 Knight Sword) uses a fourth
   physical-variance kind, `attacker_brave`, that the formatter didn't
   handle — it fell through the `else` into the `height_delta` branch
   and read a missing field. Added an explicit `attacker_brave` arm
   ("Variance scales with Brave (±5%)") and made every arm match its
   `kind` explicitly so an unknown future kind prints nothing rather
   than `NaN`. Verified: Absolom now reads "±5%", no `NaN` anywhere in
   the document.
2. **Books' restriction line clipped off the page.** The three Books
   are equippable by the four Mages **+ the Calculator** (5 classes),
   which didn't hit the 4-class "Mages only" collapse, so the formatter
   spelled out all five display names and the line overflowed the entry
   column. Added a "Mages & Calculator only" collapse for that exact
   set. Verified on p32.

### Seven missing Armory notes — authored this session

A catalog-vs-`itemNotes` diff revealed the real answer to the "did the
S50/S51 items get incorporated?" check: the **mechanical data** flowed
in (the items appeared in the Armory), but the **hand-authored notes**
were never written for the S51 off-hand wave or Absolom — they rendered
*bare*. The prior catch-up handoff's "incorporated" claim was true only
for the data, not the prose. Chris's call was **author all seven now**,
so `content/items/index.ts` gained Armorer's-voice flavor + tactical
notes for:

- **Absolom** (Knight Sword) — placed in the swords block.
- **Buckler**, **Talisman of Warding**, **Talisman of Conviction**,
  **Tome of Power**, **Livre of Urgency**, **Battle Dictionary** —
  placed in the Shields block (the off-hand pieces).

All seven now render with the same density as their neighbours; the
Armory grew one page for it. The four consumables
(Potion, Phoenix Down, Remedy, Ether) also lack notes but are
`kind: 'consumable'` and are **not** rendered in the Armory, so they
are not a gap. No stale note keys remain.

A third formatter gap was closed while here: **Battle Dictionary's
+1 AoE vertical tolerance** on magical casts wasn't surfaced at all
(item-format.ts had no `aoeVerticalToleranceModifiers` arm). Added it
("AoE elevation +1 (magical)") so the entry's data line is complete and
the authored note doesn't outrun the mechanics.

### Terraformer — tenth Specialization spread (S54)

Chris implemented the Terraformer mid-session; its spread is now in,
wired exactly as the Calculator was:

- `content/classes/terraformer.ts` — new `terraformerProse: ClassProse`,
  slotted alphabetically **last** in `SPREAD_ORDER`. Tagline +
  2-paragraph brief (the battlefield-shaper; the first hybrid PA/MA
  class — Barrier HP is the *product* of the two), a `commandSetIntro`
  block for **Worldcraft** (the second class after the Calculator whose
  First Action is a system, not a list — the intro explains the effect
  cap and the revert before the five works), notes for all five works
  (Pillar / Pit / Hill / Valley / Barrier) and the three free passives
  (Damage Split / Ignore Height / Expert Former), strategy, and four
  marginalia.
- **Attack is intentionally omitted** (no authored note → template
  skips it), same call as the Calculator: the brief says the
  Terraformer "deals almost no direct damage," so the generic strike is
  a footnote and the Worldcraft intro leads the column instead. Reverse
  by authoring an `attack` note if you'd rather show it.
- Wiring: `content/classes/index.ts` (registry), `build/spread-context.ts`
  (portrait import `terraformer_1.png` + `CLASS_META` + `'terraformer'`
  ElementId + `SPREAD_ORDER`), `styles/variant-e.css` (new
  `.v-e--terraformer` palette — quarried slate-grey, off-wheel like the
  Calculator's indigo), and `pages/layout.ts` (the Specializations
  half-title brief now closes on the Terraformer; the "ten disciplines,
  ten spreads" count auto-derives from `SPREAD_ORDER.length`).

**Fit pass (S55).** The first draft spilled the recto onto a third
page. The brief, the Worldcraft intro, all eight ability notes, and the
strategy were tightened to the Calculator's density (~25-30 words a
note), which brought it back to a clean two-page spread. Total page
count is unchanged at 51 — the reclaimed third page was the parity blank
that already sat before the Armory half-title.

Verified on the final rebuild: verso (stats HP105/MP35/PA6/MA8/SPD8,
slate palette, four scribbles), recto (Worldcraft intro + five works
with correct MP 8/8/16/16/12 and Arc range 4, three passives with
correct buckets, counsel closing cleanly on the page), TOC entry,
half-title "ten" count, and verso/recto parity intact across all ten
spreads (every spread title on an even page).

### Staff of Power retune (S55)

Chris raised the Staff of Power's MP-cost multiplier 1.2 → 1.5. This
flows in automatically — the Armory now renders "MP cost ×1.5". Its
hand-authored note ("at the cost of every spell running dearer") is
number-free and stays accurate; no prose edit was needed.

### Note on Edit discipline (process)

Two edits (`content/classes/index.ts`, `styles/variant-e.css`) silently
no-op'd on the first attempt because I'd only `cat`-ed the files via
Bash, which does not satisfy the Edit tool's "must Read first" guard —
the build then failed with "No instructor's prose registered for class
terraformer" and a PDF-render timeout. Fixed by Read-then-Edit. Flagging
the failure mode for future sessions: a Bash `cat` is not a Read.

## Watch-for / flag

- **Worldcraft has no per-work data beyond MP / range.** The five works'
  *effects* (elevation deltas, the 3×3 kernels, Barrier HP = PA × MA,
  TTL) live only in the hand-authored notes, not the auto-imported facts
  line — the ability formatter has no `worldcraft` effects arm (it
  handles damage / status / aoe / ctPush / selfMove, none of which
  Worldcraft uses). This is fine for now (the notes carry the mechanics
  accurately), but if a future pass wants the *data* line to show
  "Raises 1 tile +4" etc., that's a new `item-format`/`ability-format`
  arm to add. Flagged, not blocking.
- **PDF is ~76 MB.** The art downsample is now well overdue — the
  six largest PNGs (the four elemental portraits, the seal, and the
  new 6 MB Gravity Well splash) dominate. A publication-time downsample
  pass would cut the file by more than half with no visible loss at
  print DPI.
- **Dev server still serves CSS as JS.** All verification is via
  `npm run build:guide` → `output/guide.pdf` (rasterise pages with
  `pdftoppm -r 90 -png` for visual checks; plain `tsx` can't import
  `compose.ts` because of the `?raw` SVG import, but it *can* import
  `build/data.ts` + `build/item-format.ts` for data-level checks).

## Considered and rejected

- **Putting the bow rule in Foundations too.** Offered; Chris chose
  bow-notes-+-Marshmoor only. Foundations stays general; a weapon-
  specific rule doesn't belong in the conceptual chapter.
- **Splash on the colophon or a parity blank.** The Training Fields
  half-title won on theme (cadets at rest between *exercises*) and had
  the most open room; the colophon already carries dense credits.
- **Authoring the seven missing notes unprompted.** Held for Chris's
  scope call rather than expanding the session silently; he then chose
  "author all seven now," which is what landed.
- **Changing the variance *field name* to fix the NaN.** A false lead
  from a diagnostic that had silently failed (wrong cwd). The real fix
  was the missing `attacker_brave` case; the field names are correct.

## Suggested next scope

- **Art downsample** for distribution — now the single most impactful
  cleanup (PDF is ~76 MB; the ten portraits + seal + splash dominate).
  A publication-time pass would more than halve the file at no visible
  loss at print DPI.
- **Write-through** on this session's new prose if the voice wants
  tuning: the seven Armory notes and the whole Terraformer spread were
  drafted against the catalog mechanics, but the instructor's /
  Armorer's character is yours to adjust.
- **Future training fields** as the game ships them (the pipeline is
  proven: prose module + `marshmoorMap()`-style accessor + one
  `TRAINING_FIELDS` entry).
