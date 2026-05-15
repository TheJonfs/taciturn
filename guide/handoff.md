# Handoff

*Outgoing notes from the Phase 8 session — River Ridge + spread parity.*
*Overwritten each session — read every item, then act / promote / drop.*

## What landed

**The v1 handbook is content-complete.** `output/guide.pdf` is now
**27 pages**, full reading order:

1. Title page
2. Table of contents
3. Welcome to Gariland
4–6. Foundations of Battle
7. *Specializations half-title*
8–9. Knight  ·  10–11. Earth Mage  ·  12–13. Water Mage  ·  14–15. Fire Mage  ·  16–17. Lightning Mage
18–22. The Armory
23. *Training Fields half-title*
24–26. **River Ridge**
27. Colophon

Two new pieces of work:

- **Two-page-view spread parity is fixed.** The new "Part Three — The
  Specializations" half-title sits before the spreads and shifts each
  spread's verso onto an *even* page (Knight 8, Earth 10, Water 12,
  Fire 14, Lightning 16). In a two-up reader, each pair (verso/recto)
  now reads as a true facing spread instead of "previous-class
  abilities | next-class portrait." A matching half-title precedes the
  Training Fields chapter for the same architectural symmetry.

- **River Ridge** is in (`pages/training-field.ts` +
  `content/training-fields/river-ridge.ts` + `styles/training-field.css`).
  A data-driven SVG map render (`build/diagrams.mapDiagram`) reads
  `riverRidge` from `@content/maps/` and lays out 14×14 tiles coloured
  by elevation, with translucent overlays on the team deployment zones,
  coordinate labels, a north marker, and a legend. The instructor's
  prose covers the terrain (the Ridge, the River, the Plain), the
  three tactical zones (Western Passage, Eastern Perch, Water Lane),
  the knockback character of the falls, and a closing counsel.
  *Tactical commentary is mine to the best of my read of the design
  doc; the write-through pass is the moment to refine it.*

## How to add a future training field

The chapter uses a generic `pages/training-field.ts`; right now it
hardcodes `riverRidgeProse` and `riverRidgeMap()`. To add a second
field, generalise: take a `FieldProse` argument, take the map as
argument, and have `composeHandbook()` iterate a `TRAINING_FIELDS`
list. The shape is already there — `FieldProse` is exported from
`content/training-fields/river-ridge.ts`.

## Watch-for / flag to Chris

- **Tactical commentary in River Ridge** is my best read; you'll want
  the write-through to sharpen it. I leaned on the design doc's "three
  zones" framing and the knockback-tier observations directly.
- The handbook now lives in nine named `@page` rules (default, title,
  toc-default, halftitle, welcome, foundations, variant-e, armory,
  training, colophon). The weathered-background recipe is duplicated
  across most of them — the Phase 7 note still stands: this is the cost
  of correct per-chapter `@top-center` headers in Paged.js.
- Still ~44 MB; downsample is the planned publication step.

## Considered and rejected

- Holding River Ridge to two pages — three reads better, with the map
  on its own page-third and the prose with room to breathe.
- A separate "How to add a field" code path — left the per-field
  generalisation as a real but small refactor when the second field
  arrives, rather than building speculative machinery now.

## Suggested next scope

The roadmap's v1 content is done. Honest next sessions:

1. **Chris's write-through pass** — the long-flagged "single
   write-through" of the prose. Sharpen ability notes that read as
   evocative-but-vague (you noted some passive notes don't land
   mechanically), tighten the River Ridge tactical commentary, settle
   any remaining wording.
2. **Publication-time art downsample** — a build-layer pass that
   downsizes the five portraits + the seal to print-appropriate DPI,
   shrinking the PDF from ~44 MB to something publishable.
3. **Future training fields** — when the game ships a second map,
   generalise `pages/training-field.ts` and add it to the chapter.

The handbook reads, end to end, as the Cadet's Handbook the vision doc
described.
