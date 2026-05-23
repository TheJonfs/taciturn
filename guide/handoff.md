# Handoff

*Outgoing notes from the Stonebridge + spell-vertical / AoE-tolerance
session — second training field added, training-field machinery
generalised, AoE shape rendering reworked around the implementer's
correction.*
*Overwritten each session — read every item, then act / promote / drop.*

## What landed

The guide is in sync with main as of S47. **40 pages**; verso/recto
parity preserved across all eight spreads; both half-titles (Part Four
Armory, Part Five Training Fields) on right-hand pages.

### Stonebridge — the Academy's second training field

- `content/training-fields/stonebridge.ts` — full FieldProse:
  intro, four terrain sections (Bridge, River, Corner Hills, Keep),
  three tactical zones (Bridge Charge, Keep Door, Hill Roost),
  knockback section that names the three signature falls, instructor's
  counsel. Sits in three pages, matching River Ridge.
- `content/training-fields/river-ridge.ts` — `FieldProse` interface
  gained `id` (for the `#ch-{id}` anchor and TOC link) and `legend`
  (the previously hardcoded swatch list); River Ridge picked them up
  with its existing six tiers.
- `build/training-fields.ts` (new) — `TRAINING_FIELDS` registry
  pairs each field's prose with its catalog map. Compose layer +
  TOC + Training Fields half-title all iterate this; adding a third
  field is now (a) author its FieldProse, (b) append the entry,
  (c) the page template handles the rest.
- `build/data.ts` — `stonebridgeMap()` added alongside
  `riverRidgeMap()`.
- `pages/training-field.ts` — generalised to a function of
  `(prose, map)`; an `allTrainingFields()` helper renders every
  registered field in order. Legend is now per-field.
- `build/diagrams.ts` — rampart tiles (S47 Stonebridge terrain) render
  as stone-grey (`#7d756a`) rather than as another elevation tier, so
  the keep's architecture is visible at a glance. The aria-label is
  now generic (the previous "River Ridge battlefield map…" was
  hardcoded).
- `pages/layout.ts` — Specializations half-title brief updated to add
  "the Hunter from the perch"; Training Fields half-title now iterates
  `TRAINING_FIELDS` (lists both fields, drops the v1 "Mage War is
  fought on one of them" line). TOC's Training Fields entries iterate
  the registry too.

### Spell-vertical + AoE-shape formatter rework

S47 made two ruleset-level changes (spells reach any vertical;
`aoeVerticalTolerance` 1 → 3). Surfacing those forced a careful pass
on what gets rendered per spell.

**`build/ability-format.ts`:**
- **"any elevation" dropped from range lines.** S47 made vertical 99
  (the unbounded sentinel) the universal default for both bows and
  spells, so it's now the baseline and stays implicit. A bounded
  self-move whose vertical exceeds its horizontal — Scramble's
  1-horizontal × 5-vertical leap — still surfaces explicitly.
- **AoE shape rendering reworked** after the implementer correction:
  `rangeMode` governs how the caster *aims* (the target tile is the
  aim point), and `effects.aoe.shape` + `anchorMode` describe what
  actually gets *hit*. The formatter was conflating the two — Maelstrom
  and Flame Lance read as "Arc, range 4 · Area effect" while their
  shapes are a caster-anchored cone and line respectively. Now:
  - `tile` → `"Area effect"`
  - `diamond` / `square` / `cross` → `"Diamond, radius N"`,
    `"Square, radius N"`, `"Cross, radius N"`
  - `cone` → `"Cone from caster, reach N"` (where N = `rows.length`)
  - `line` → `"Line from caster, length N"`
  - `custom` → `"Area effect, custom shape"`
  The rangeMode line (Arc, range 4) stays — it's the aim envelope —
  but the shape line now tells the reader what footprint actually
  lands. Maelstrom's mechanical line and prose line up; Flame Lance's
  too.
- **AoE vertical-tolerance surfaces only when per-ability override.**
  The ruleset's `aoeVerticalTolerance: 3` is the universal default;
  repeating "(vertical 3)" on every AoE adds wrap risk for no
  information. Only abilities that override (Flame Lance's
  `verticalTolerance: 5`) surface their number, as
  `"(vertical 5)"` appended to the shape text.

## Watch-for / flag to Chris

- **Maelstrom and Flame Lance source-data follow-ups (the implementer
  thread).** Both have `rangeMode: 'arc'` — *correct*, that's how the
  caster aims. The shape is in `effects.aoe.shape`, which the formatter
  now reads. **Open follow-up on the game side:** the catalog still has
  `aoe.shape: { kind: 'line', length: 4 }` for Flame Lance; you noted
  it should reach 5. One-line fix in
  `src/content/abilities/flame-lance.ts` and the guide picks it up on
  the next build. No guide change required.
- **Flame Lance's vertical tolerance override.** The catalog sets
  `aoe.verticalTolerance: 5` on Flame Lance (kinematic-stop line — it
  terminates on a wall taller than 5). The guide now surfaces that as
  `"(vertical 5)"` on the mechanical line. The prose doesn't
  separately call it out — the number is in the line.
- **`@page :blank` handling.** Adding a third training field (or any
  chapter that flips parity) will trigger an auto-inserted blank if
  `break-before: right` lands an odd-page chapter on an even page.
  Currently one such blank exists at page 24, between the Pyromancer
  recto (23) and the Armory half-title (25). Stays as designed.
- **Hunter's elevation identity is softened now that spells reach any
  vertical too.** The Hunter prose still claims "she answers the field
  at a range and from a height most cadets cannot reach" — that read
  as bow-unique when written; now it's about *standing* on perches
  others can't reach, not about *shooting* there. Defensible but
  worth flagging for the write-through pass.
- **Dev server still doesn't load styles** (Vite serves CSS as JS in
  dev — flagged sessions ago). All verification via
  `npm run build:guide` + `output/guide.pdf`.
- **PDF ~55 MB.** Art downsample remains overdue, more so with two
  new portraits + a second map.

## Considered and rejected

- **Updating `src/` to fix Maelstrom (rangeMode → cone) directly.**
  Per the guide's read-only-on-`src/` rule, asked first; Chris chose
  "you'll fix src/ separately" — and then the implementer's note
  showed the source data was actually right all along and the formatter
  was the wrong layer. Net: no `src/` changes, formatter rework was
  the correct fix.
- **Adding a Foundations sentence about the new AoE 3-elevation
  tolerance.** Tried `"a spell's *area* splashes only within three
  elevations of where it lands — a diamond across deep water and the
  bank above will catch one side, rarely both"`; it pushed Foundations
  from 3 to 4 pages and triggered an orphan + parity blank. Reverted.
  The per-AoE mechanical line ("(vertical N)" when non-default)
  communicates the per-ability case; the universal default reader
  learns by playing.
- **Showing `"any elevation"` on every spell line** now that S47 made
  it universal. Removed: it adds noise to every spell without
  differentiating anything. Bows are no longer distinctive on
  vertical reach — only on the height-delta damage curve, which their
  variance line already reports.
- **Showing `"(vertical 3)"` on every AoE line.** Removed: same logic
  — the ruleset default doesn't need to be repeated. Per-ability
  overrides do.
- **Suffixing every AoE label with `"AoE"`** (`Diamond AoE, radius 1`).
  Dropped: implicit from context — the entry is in the effects list,
  the reader knows the shape describes the splash. Saves a few chars
  per AoE entry, which mattered for keeping the Geosage recto on one
  page.

## Suggested next scope

Roadmap unchanged. The Maelstrom / Flame Lance source-data follow-ups
on the game side are the natural next thing the guide is waiting on;
the formatter is ready for whatever lands. After that, the
write-through pass and the art downsample remain.
