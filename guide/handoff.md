# Handoff

*Outgoing notes from the S40-catchup session — added the Alchemist
spread, swept the S40 rename pass through the guide's prose,
catalogued the new knife weapons, and patched the item formatter for
S40's dynamic-variance substrate.*
*Overwritten each session — read every item, then act / promote / drop.*

## What landed

The guide is now in sync with main as of S40. **29 pages**; verso/recto
parity preserved across all six spreads (Knight 8, Alchemist 10,
Geosage 12, Hydrologist 14, Pyromancer 16, Aethurge 18 — every spread
verso falls on an even page).

### Alchemist spread (new)

- `content/classes/alchemist.ts` — full prose authored: brief,
  ability notes for the six surfaceable abilities (attack, compound,
  throw_item, combat_focus, field_recovery as *Healthy Stride*,
  field_kit as *Travel Preparations*), strategy, and four marginalia.
  Strategy is intentionally compact — the recto runs an Instructor's
  Counsel box and the page won't take a longer one without overflowing
  into a third page and breaking the verso/recto parity of every
  spread that follows. Held the Knight as the volumetric reference.
- `content/classes/index.ts` — `alchemistProse` registered.
- `build/spread-context.ts` — Alchemist portrait imported,
  `'alchemist'` added to `ElementId`, entry added to `CLASS_META`,
  inserted into `SPREAD_ORDER` *second* (right after the Knight, before
  the four elemental Mages — physical-leaning disciplines grouped, then
  the elemental wheel).
- `styles/variant-e.css` — `.v-e--alchemist` palette added: apothecary
  brass (amber accent `#8a5a1e` / copper stat band `#6b4416` / parchment
  label `#e8cf9e`). Distinct from the Knight's steel and from the four
  elemental hues.
- `art/alchemist_1.png` — copied from `../src/assets/portraits/`. **The
  Alchemist portrait is 512×512** vs. the other class portraits at
  1792×2400 — visually it crops and prints fine, but if you ever
  commission a higher-resolution Alchemist art piece, drop it in at
  `guide/art/alchemist_1.png` and the spread picks it up unchanged.

### S40 rename pass — prose updated to match the display names

ClassIds and ability ids are preserved in the catalog, so the
content/ key structure didn't move — only the prose strings did.

- **Classes**: Earth Mage → **Geosage**, Fire Mage → **Pyromancer**,
  Water Mage → **Hydrologist**, Lightning Mage → **Aethurge**. Mage
  prose files all rewritten to use the new names throughout (briefs,
  ability notes, strategy, marginalia). Wand notes in
  `content/items/index.ts` updated for the Geosage / Hydrologist
  ownership lines. River Ridge "Water Mage" → "Hydrologist" in all
  three mentions.
- **Earth Mage abilities**: Earth Strike → **Rock Toss**, Earth's
  Blessing → **Life from the Loam**, Earth Curse → **Gaian Hex**, Earth
  Quake → **Earthquake** (one word), Earth Cataclysm → **Cataclysm**,
  Earth Communion → **Biomastery**, Earth Resilience → **Landwalker**.
  Bedrock Stride unchanged.
- **Water Mage abilities**: Water Strike → **Water Lash**, Tide Surge
  → **Rapids Rush**. Rest unchanged.
- **Fire Mage abilities**: Fire Strike → **Scorch**, Fire Embrace →
  **Inner Warmth**, Fire Storm → **Fireball**, Spark → **Slow Burn**.
  Rest unchanged.
- **Lightning Mage abilities**: Lightning Strike → **Lightning Bolt**,
  Storm Caller → **Megavolt**. Rest unchanged.

### Knives (S40 weapon class) — added to the Armory

Three new weapons land in the Weapon Racks (catalog order):

- **Chef's Knife** — WP 4, +1 PA. The Alchemist's natural sidearm.
- **Magebane** — WP 5, 50% on-hit Silence. The anti-caster knife.
- **Sai** — WP 4, +1 Speed. Self-compensating Speed feedback into the
  knife class's Speed-derived variance.

Flavor + tactical lines authored for each in
`content/items/index.ts`. The catalog auto-renders them; only the
notes were the manual piece.

### Item formatter fixes — `build/item-format.ts`

Two regressions surfaced when the knives appeared. Both patched:

- **Weapon family** — `'knife'` added to `WEAPON_FAMILIES`. Without
  it, the formatter dropped `Knife-imbued` into the effects line.
  Knives now show `WP 4 · 95% accuracy · knife` on the headline like
  swords and axes do.
- **`physicalVariance` discriminated union** (S40) — was reading
  `.min` / `.max` directly, which produced `Variance undefined–undefined`
  for the new `{ kind: 'attacker_speed', spread }` shape. Now branches
  on `kind`: static prints the band; attacker-speed prints
  `Variance scales with Speed (±N%)` (the absolute range depends on the
  wielder so a fixed range would be misleading).

## What I deliberately did NOT pull in

- **Consumables** (Potion, Phoenix Down, Remedy, Ether) — these are
  `kind: 'consumable'` items in the catalog, not Armory-requisitionable
  gear; they live inside the Alchemist's stockpile economy. The
  Armory's sections filter to `weapon/shield/armor/headgear/accessory`,
  so consumables are invisible to it. They're named and explained in
  the Alchemist's `field_kit` (*Travel Preparations*) and `throw_item`
  notes — that's where they belong for v1. If a future pass wants a
  dedicated "The Stockpile" subsection in the Armory or a sidebar on
  the Alchemist's recto, both are easy: add a section to
  `pages/armory.ts` with `kinds: ['consumable']` and author a
  consumable formatter (the existing `item-format.ts` doesn't yet
  surface `compoundMpCost` / `effects.hpRestore` / etc.).
- **Targeting `unit_or_tile` reads** — many spells had their targeting
  kind migrated to `unit_or_tile` in S40. The formatter doesn't render
  the kind, so no prose change was needed; the mechanical lines look
  identical to before.
- **Status durations** — many statuses had their `duration` values
  rebalanced in S40 (e.g. Regen 36→10, Don't Act 24→3, Movement
  Debuff 24→4). The formatter doesn't surface duration, and the prose
  doesn't quote it; nothing to do.

## Watch-for / flag to Chris

- **Alchemist portrait resolution**. The 512×512 source from
  `src/assets/portraits/alchemist.png` is the highest-fidelity art
  available. Crops fine into the 3.4″ portrait box, but is visibly
  softer than the 1792×2400 class portraits beside it. A higher-res
  commission is the publication-quality upgrade.
- **Alchemist strategy is volume-constrained**. The text was tightened
  because a longer counsel overflowed page 11 onto a near-blank page
  12 and pushed every following spread by one, breaking parity. If you
  want to expand the counsel, you'll need to either also trim ability
  notes (Compound and Healthy Stride are the longest) or accept the
  parity break and find a different fix (an extra half-title, a deliberate
  blank, etc.).
- **Dev server still doesn't load styles** (Vite serves CSS as JS
  modules in dev — flagged last session). Continued to verify via
  `npm run build:guide` and inspecting `output/guide.pdf` directly.
- **PDF still ~45 MB** — art downsample remains the publication
  pre-pass.

## Considered and rejected

- **Authoring a fourth Armory section for consumables.** Cleaner in
  principle, but would require a new formatter branch for consumables
  (`compoundMpCost`, `effects.hpRestore`, `effects.mpRestore`,
  `effects.removeKO`, `effects.clearStatuses`) and four new item-note
  entries. Out of scope for "catch the guide up to S40"; the
  Alchemist's spread covers the consumables in prose. Easy follow-up.
- **Renaming the wand names** (Wand of Depths, Wand of Deepwood). S40
  did *not* rename the wands — the wand names are unchanged at the
  catalog level. Only the *owner* names ("Hydrologist's wand",
  "Geosage's wand") needed updating in the flavor / tactical notes.
- **Putting the Alchemist last in the spread order.** Putting them
  second instead reads better — physical-leaning disciplines (Knight,
  Alchemist) front; then the elemental wheel as a self-contained
  block. The shared-gear note Chris flagged also implies adjacency.

## Suggested next scope

- **Write-through pass on the Alchemist's prose** — first draft;
  Chris's read-through is the calibration step.
- **Consumables as their own subsection** — either as the fourth
  Armory section ("The Stockpile") or as a callout on the Alchemist
  spread. The fact that Ether is the only Compound-only item (not in
  the starting kit) is worth flagging more prominently than the
  current note allows.
- **Higher-res Alchemist portrait** when one exists.
- **Art downsample** for publication-size PDF.
- **Future training fields** when the game ships them.

The handbook now ships every class and ability in the S40 catalog
under their current display names, and the new knife substrate prints
correctly in the Armory.
