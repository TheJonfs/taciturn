# ADR 0001 — Armory gear tiers (Universal / Heavy / Magical)

*Status: accepted. First guide ADR. Decided during the S60–S65 guide
maintenance arc; the folder `guide/decisions/` is created with this
record (the guide CLAUDE.md anticipated ADRs "when first needed").*

## Context

The Armory renders each item's class restriction beside its name, read
straight from the game's `classRestrictions` data. As the roster grew
past the original five classes, the restricted armour-slot pieces
(off-hand/shield, body, head) accumulated longer and longer enumerations:
a mage robe came to read **"Geosage, Hydrologist, Pyromancer, Aethurge,
Calculator, Terraformer only"**. Problems:

1. **It spilled the column** — six display names overflowed the entry's
   kind line and clipped off the page.
2. **It grew with every new class** — each new caster or armoured
   discipline lengthened every robe/plate line, and required a guide
   edit (or a new brittle special-case in the formatter) to render
   cleanly.
3. **The formatter had accreted length-based special cases** —
   `length === 4 → "Mages only"`, `=== 5 → "Mages & Calculator only"`,
   `=== 2 → "Knight & Templar only"` — each one fragile against the next
   roster change.

Meanwhile the underlying data was clean: across all shield/armor/headgear
items there were only ever **three** distinct restriction families —
universal, the Knight line, and the caster line.

## Decision

Replace the enumerations with **three named gear tiers**, shown beside
the item (e.g. "Shield · Heavy", "Armour · Magical"):

- **Universal** — open to every discipline (renders no restriction line,
  unchanged).
- **Heavy** — the armoured line: Knight plate, true shields, heavy
  headgear. Anchored by the Knight.
- **Magical** — the casting line: robes, mage headgear, the off-hand
  books. Anchored by the casters.

Tiers apply only to the three armour-slot kinds (shield, armor,
headgear). Weapons and accessories are universal across the board and
carry no tier.

**Classification is by anchor membership, not exact roster match.**
`build/item-format.ts` holds two anchor sets — `HEAVY_ANCHOR_IDS`
(the Knight) and `MAGICAL_ANCHOR_IDS` (the casters) — and `gearTier()`
asks: does this item's restriction include a heavy anchor? a magical
anchor? It returns the matching tier. A restriction touching **both**
families, or **neither**, throws loudly (no silent mislabel — per the
project's "fail loudly" rule).

## Consequences

- **A new class joins a tier by adding its id to one anchor set** — a
  single line in `item-format.ts` — and every item it can equip
  reclassifies automatically. No per-item edit, no new special-case.
  This was proven mid-arc: when the Battlemage's Chain gained a
  Knight/Templar restriction on the game side, the guide re-read picked
  up "Heavy" with zero formatter change; only the hand-authored note
  needed a wording pass.
- **The brittle length-based special cases are gone** — one membership
  rule replaces three.
- **The tiers are also the sort key** for the Armour Stores
  (`pages/armory.ts` → `armourSortKey`): Universal first, then Heavy,
  then Magical within each kind.
- **In-world vocabulary** — the three tiers are introduced in the
  armour section intro in the instructor's voice; the weapons intro
  carries a forward-pointer since the off-hand shields/books appear in
  the Weapon Racks.

## Trade-offs considered

- **Keep enumerating, just collapse the common cases.** Rejected — it's
  the status quo that was already breaking; each new class re-breaks it.
- **A `gearTier` field on the game-side item definitions.** Rejected —
  the guide is read-only with respect to `../src/`, and the tier is a
  *presentation* grouping, not game state. The data the engine already
  has (`classRestrictions`) is sufficient to derive it.
- **Exact-set matching instead of anchor membership.** Rejected — it's
  precisely the fragility we were removing; membership is what makes new
  classes free.

## Assumption to revisit

The model assumes the heavy and magical lines stay **disjoint** (no
discipline is both). If a future class can wear *both* heavy armour and
mage robes, `gearTier()` will throw on its shared items — by design, as
a signal to revisit the tiers rather than mislabel. At that point the
choice is a new tier (e.g. "Hybrid") or a richer rule.
