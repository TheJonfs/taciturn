# Handoff

*Outgoing notes from the S42-catchup session — added the Assassin
spread, added The Offering accessory, swapped the Knight's Stasis Sword
for Lightning Stab, and cleaned up two pieces of older drift the render
exposed (Knight S41 passive renames, stale class-count prose).*
*Overwritten each session — read every item, then act / promote / drop.*

## What landed

The guide is in sync with main as of S42. **31 pages**; verso/recto
parity preserved across all seven spreads (Knight 8, Alchemist 10,
Assassin 12, Geosage 14, Hydrologist 16, Pyromancer 18, Aethurge 20 —
every spread verso falls on an even page).

### Assassin spread (new — the seventh class, third non-caster)

- `content/classes/assassin.ts` — full prose: brief, eight ability
  notes (attack + the four Shadow Arts: shadow_stitch, blowdart,
  undermine, sow_doubt; plus speed_save, two_weapons, fleet_of_foot),
  strategy, four marginalia. **The recto is volume-constrained** — the
  Assassin has five active skills (the most of any class), so the brief
  *and* the strategy were authored tight. A longer counsel overflows
  page 13 onto a near-blank 14 and breaks parity for every spread that
  follows; if you expand the counsel, trim ability notes (Shadow Stitch
  / Speed Save / Two Weapons are the longest) to compensate.
- `content/classes/index.ts` — `assassinProse` registered.
- `build/spread-context.ts` — portrait imported, `'assassin'` added to
  `ElementId`, `CLASS_META` entry, inserted into `SPREAD_ORDER` **third**
  (after Knight + Alchemist, before the four Mages — the three
  non-casters grouped, then the elemental wheel). The SPREAD_ORDER doc
  comment was rewritten for the seven-class roster.
- `styles/variant-e.css` — `.v-e--assassin` palette: moonlit steel
  (gunmetal accent `#3d4452` / charcoal stat band `#23272e` / cool
  steel-grey label `#aab2bf`). Distinct from the Knight's oxblood, the
  Alchemist's brass, and the Aethurge's purple.
- `art/assassin_1.png` — **cropped this session.** Chris supplied a
  landscape 2752×1536 portrait, which rendered as a short wide strip in
  the tall portrait frame. Cropped symmetrically around the figure's
  alpha bbox (she occupied x=879–1771) to **1120×1536** (~0.73 portrait
  aspect, matching the other six), keeping both daggers. The uncropped
  original is at `/tmp/assassin_1_original.png` for this machine only —
  if a re-crop is ever wanted, re-export from Chris's source.

### The Offering (new accessory)

- `build/item-format.ts` — new branch surfaces `attackSwingMultiplier`
  (it was previously dropped silently). Renders as
  "Attack swings ×N per weapon".
- `content/items/index.ts` — `the_offering` note added to the accessory
  cases: doubles every weapon's swings on a basic Attack at −2 PA; with
  Two Weapons that is four light strikes — the Assassin's volume-damage
  keystone.

### Knight — Lightning Stab replaces Stasis Sword (S42)

- `content/classes/knight.ts` — ability note rekeyed
  `stasis_sword` → `lightning_stab`, rewritten for the Silence rider
  (and the Bravestrider Brave-synergy: Silence scales on Brave×MA).
  Stasis Sword stays in the catalog as a cross-class option; the
  Knight's Battle Skill set no longer surfaces it.

## Drift the render exposed and I fixed (not in the brief)

- **Knight S41 passive renames.** The Knight's free Support/Movement
  passives became **Martial Expertise** (PA ×1.25) and **Bravestrider**
  (+1 Move, +10 Brave) back in S41 — the S40 catch-up missed it, so the
  spread was rendering those two abilities with *blank* notes (the old
  `damage_reduction` / `move_plus_1` keys no longer resolved). Both
  notes rewritten and rekeyed. Damage Reduction / Move +1 remain in the
  catalog as cross-class options.
- **Stale class counts.** Welcome letter said "five specializations"
  (×2); the Specializations half-title said "five disciplines, five
  spreads" with a brief naming only "the Knight and the four elemental
  Mages." All pre-Alchemist text. Fixes: welcome letter made numberless;
  half-title subtitle is now **data-driven** off `SPREAD_ORDER.length`
  via a small `numberWord()` helper in `pages/layout.ts` ("seven
  disciplines, seven spreads" today, self-updating as the roster grows);
  half-title brief rewritten to name all three non-casters and the four
  Mages. The spread list under it was already data-driven.

## Watch-for / flag to Chris

- **`numberWord()` covers 0–12.** Past twelve classes the subtitle falls
  back to digits. Not a concern at seven; noted for completeness.
- **Alchemist brief still says "the Academy's sixth specialization"** and
  the Assassin's file comment says "seventh discipline." These are
  chronological-introduction order (correct), but the Alchemist reads
  *second* in the book — a reader could find "sixth" momentarily odd.
  Left as-is (it predates this session and isn't wrong); flag for the
  write-through if the phrasing grates.
- **Dev server still doesn't load styles** (Vite serves CSS as JS in
  dev — flagged two sessions ago). Verified throughout via
  `npm run build:guide` + inspecting `output/guide.pdf`.
- **PDF ~49 MB** — the art downsample remains the publication pre-pass,
  now more pressing with two large new portraits (Alchemist, Assassin).

## Considered and rejected

- **Blind 30%/30% crop of the Assassin portrait** (as first suggested).
  Her daggers reach to ~28% and ~71% of the width, so a strict 30%
  trim from each side would have clipped both blade tips. Cropped to
  the figure's measured alpha bbox instead — same visual goal, blades
  intact.
- **A per-Assassin CSS portrait treatment** (letterbox / shorter frame)
  to accommodate the landscape source. The crop is the right fix — it
  makes the Assassin a true peer of the other spreads rather than a
  special case. No CSS portrait override needed (the Alchemist's 4.1in
  override still stands for its own reason).

## Suggested next scope

Roadmap is unchanged: the write-through pass, the art downsample (now
overdue at ~49 MB), and future content as the game ships it. The guide
reads end to end as the seven-discipline Cadet's Handbook.
