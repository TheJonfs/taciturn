# Handoff

*Outgoing notes from the read-through pass 1 — Chris's first round of
written feedback applied across layout, format, and prose.*
*Overwritten each session — read every item, then act / promote / drop.*

## What landed

Chris's `feedback/Guide_Feedback_1.md` is fully applied. The handbook
is still **27 pages** with the same chapter ordering and verso/recto
spread parity preserved (Knight 8, Earth 10, Water 12, Fire 14,
Lightning 16). The work split three ways:

### Template / cross-page changes

- **Page-frame SVG** (`art/page-frame.svg`) — bottom lozenge moved from
  y=1081 to y=1059 so it intersects the bottom rules in the same way
  the top lozenge intersects the top rules. Symmetric now.
- **Title page** (`styles/front-matter.css`) — seal up to 2.6in, title
  to 56pt, subtitle to 24pt, institution / imprint / edition all
  scaled up. Uses much more of the page; reads as a proper title page.
- **Table of contents** — given its own `@page toc-default` rule with
  the weathered, filigree-framed background (was previously bare); body
  font sizes lifted by ≈6pt across all entry tiers (entry 11.5→16pt,
  sub 10.5→14.5pt, group 9→13pt, title 28→34pt).
- **Running header position** — every chapter's `@top-center` declaration
  picked up `vertical-align: bottom; padding-bottom: 0.05in;` so the
  header sits at the bottom of its margin box, well clear of the top
  diamond. Touched: `base.css`, `welcome.css`, `foundations.css`,
  `variant-e.css`, `armory.css`, `training-field.css`.
- **Specialization stat band** (`styles/variant-e.css`) — labels
  6.6pt → 8.2pt and `font-weight: 700`. HP / MP / PA / MA / SPD / MOVE /
  JUMP / EVA all read as proper headings now.
- **Repertoire mechanical line** (`pages/variant-e.ts`) — the redundant
  "First Action ·" prefix is dropped on every active-skill line (every
  active in the section is a First Action by construction), and
  `.v-e__ability-facts` font lifted 7.8pt → 8.6pt.
- **Foundations figures** (`styles/foundations.css`) — captions
  8.5→10pt, all SVG diagram text classes scaled (`.d-label` 8.5→10.5px,
  `.d-num` 11→13.5px, etc.), bucket / terrain figure text enlarged.
  Inter-section spacing tightened so the chapter still fits in three
  pages — Foundations had to stay 3pp or the spread half-title would
  fall on an even page and break the verso/recto facing pairs. The
  `.foundations-section` margin and figure margin both tightened; the
  CSS comment in the file now flags this as a load-bearing constraint.
- **Bucket figure** — capacity number now properly centred within its
  flex row (`min-height: 1.2em`, `display: flex; align-items: center`),
  doesn't crash into the "capacity" label below.

### Formatter (cross-cutting content)

- **`Spell Power N` notation** for magical damage
  (`build/ability-format.ts`) — `damageText()` checks for the `magical`
  tag and emits `Spell Power N` (using `power_coefficient`) instead of
  `Magical damage (×N)`. Physical damage retains its existing form.
- **Coupled-status coalescing** — consecutive `statusEffects` with
  `linkRoll: true` on the second collapse into one line:
  `Applies PA Down and MA Down (60%)` for Fire Strike,
  `Applies PA Up and MA Up (80%)` for Fire Embrace. The percentage
  comes from the first (head) entry; an `n>2` case would join with
  Oxford comma via the new `joinAnd()` helper.
- **Stack quantity surfaced** — `stackQuantity > 1` on a single status
  reads as `Applies 2 stacks of Burn (80%)` (Spark). Previously just
  `Applies Burn (80%)`, which understated Spark's payoff.

### Per-page prose edits

All landed; quick page-by-page index for the next pass:

- p. 3 signature: "Professor Claude, on behalf of the Gariland Magic
  Academy" (`content/intro/welcome.ts`)
- p. 4 CT prose: "She acts when her CT comes full." + Cadet's Options
  paragraph rewrite (`content/foundations/index.ts`)
- p. 5 bucket figure caption: "The five buckets of abilities, with the
  capacity of each." (`pages/foundations.ts`)
- p. 6 Requisitioned Gear: "Five slots: a weapon in one hand or the
  other, a shield or second weapon in the off hand of those trained in
  such, protection for the head and for the body, and an accessory."
- p. 10 Earth Mage brief: *constraint* (was *certainty*)
- p. 11 Earth Mage Attack note: rewritten to acknowledge the Wand of
  the Deepwood
- p. 13 Water Mage Attack note: rewritten to acknowledge the Wand of
  the Depths
- p. 14 Fire Mage brief sentence 2: "one of the most fragile cadets…
  and yet, the one the opponent most wants gone" (was "the most
  fragile cadet" — Lightning is in fact more fragile)
- p. 17 Lightning Mage Attack note rewritten; Magnetic Mark note
  changed "every blow" → "the blow" (Vulnerable consumes on next hit)
- p. 19 Staff of Abundance Use line: "her casts arrive a touch slower
  for it" (was "quickens her casts a touch" — Action Speed −5 is
  slower)
- p. 21 Magus Crown Use line: "another command set" (was "second
  secondary command set")
- p. 23 Training Fields half-title: "Mage War is fought on one of
  them." (dropped "v1") (`pages/layout.ts`)
- p. 25 River Ridge "The River": "deep water triples it" (dropped
  "nearly" — engine cost is exactly 3×)

### Verification done in source

- **Spark**: confirmed `stackQuantity: 2` on a single 80% Faith × MA
  roll (`src/content/abilities/spark.ts`). Now reflected in the
  formatter; the prose still doesn't quote a stack count, which is
  fine — the line carries it.
- **Magnetic Mark**: confirmed Vulnerable is consumed on the next damage
  hit (engine note in `magnetic-mark.ts`), so "the blow" not "every
  blow" is correct.
- **Staff of Abundance**: `actionSpeedModifiers: [{ delta: -5 }]` —
  negative is slower. Prose corrected.
- **Deep water cost**: `defaultTerrainCosts` has `water_deep → 3` vs
  default 1. Exactly triple, not "nearly".

## Watch-for / flag to Chris

- **`guide/.claude/launch.json`** now also defines `guide-dev` (port
  5181) for the guide's vite dev server, alongside the existing
  `taciturn-game` config. Use `guide-dev` for guide preview work.
- **The dev server preview is *broken-ish* for visual verification**:
  Vite serves CSS files as JS modules in dev (the `?url` import returns
  a URL whose response is an HMR-wrapped JS payload, not raw CSS), so
  Paged.js loads no styles and the preview falls back to browser
  defaults. The PDF render path uses `vite preview` (the production
  preview server), which serves CSS as static files — that *does*
  work. So: for visual verification, run `npm run build:guide` and
  inspect `output/guide.pdf` directly. If you want a styled live
  preview during iteration, run `npm run build:html` then
  `vite preview` separately. Worth properly fixing one day; not blocking.
- **Foundations spacing is now load-bearing**. Don't loosen the
  `.foundations-section` or `.foundations-fig` margins — the chapter
  must stay in 3 pages so the spread half-title falls on an odd page
  and Knight verso falls on page 8 (even). The CSS comment flags it.
  If a future content addition pushes Foundations onto a 4th page, you
  need to either tighten further or reflow the half-title to absorb it.
- **PDF still ~45 MB** — art downsample remains the publication
  pre-pass.

## Considered and rejected

- **Hand-writing the coupled status into the instructor note** — would
  have been a one-line content fix for Fire Strike / Fire Embrace, but
  it embeds mechanical truth in flavour, which CLAUDE.md says not to
  do. Generalised the formatter instead so future linked-roll spells
  inherit the behaviour.
- **Padding-top on `@top-center`** for the running-header shift —
  considered as the more explicit approach, but `vertical-align:
  bottom` reads as the spec-correct intent and worked first try.
- **Reverting the figure text bumps** when Foundations spilled to 4
  pages — Chris asked for larger figure text, so the right move was
  to tighten the inter-section spacing instead.

## Suggested next scope

The roadmap remains: write-through pass, art downsample, future
training fields. The feedback file Chris staged
(`feedback/Guide_Feedback_1.md`) is the first of presumably several
read-through rounds — expect more passes of the same shape.

If a write-through pass comes next, the natural follow-ups in this
file's vicinity:
- Lightning Mage's brief still calls her "the lowest pool of health"
  and "the most frightening cadet in the Mage War" — which are both
  fine, but worth a careful pass alongside the new Fire Mage brief
  for consistency of register.
- Earth Curse's mechanical line is "Applies Blind (50%) · Applies
  Silence (50%)" (independent rolls, by design). The instructor's note
  flags the independence well. Worth checking the other dual-roll
  spells (none currently exist in the catalog) read the same way if
  any ship.

The handbook continues to read end to end as the Cadet's Handbook the
vision doc described — now sharper for the read-through pass.
