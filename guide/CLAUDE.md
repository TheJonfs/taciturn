# CLAUDE.md — Taciturn Player's Guide

Operational conventions for Claude Code sessions working in this folder. Read this first when starting any guide session, then read `vision.md` for project framing.

## What this project is

A standalone PDF / web-viewable companion to the Taciturn engine and Mage War. Presented as the **Cadet's Handbook to the Mage War Tradition**, authored by an unnamed instructor at the **Gariland Magic Academy** (Ivalice / FFT setting reference). Read `vision.md` in this folder for full framing — this file is the operational layer.

The guide does three things:
1. **Reference** — readers find correct mechanical information about classes, items, abilities, statuses, maps.
2. **Flavor** — readers encounter the in-world Academy voice; the handbook reads continuous with the game's tone.
3. **Living document** — mechanical content auto-updates from `../src/content/`; the instructor's prose stays hand-authored.

## Relationship to the main game

This is a **parallel project**. It does not block, and is not blocked by, game roadmap sessions.

**Reads from `../src/content/` at build time.** The guide imports TypeScript modules directly:
- Classes: `../src/content/classes/*.ts`
- Items: `../src/content/items/**/*.ts`
- Abilities: `../src/content/abilities/*.ts`
- Statuses: `../src/content/statuses/*.ts`
- Maps: `../src/content/maps/*.ts`
- Catalog assembly: `loadDefaultCatalog()` from `../src/content/index.ts`, wrapped by the guide's single data doorway `build/data.ts`

**Never modifies game source.** This folder is read-only with respect to `../src/`. If a guide-build run reveals incorrect or missing game content, surface the issue to Chris — don't patch the game from here.

**Path conventions:**
- Game data: import via `../src/content/...` (relative from `guide/build/` or wherever the build script lives)
- Guide-internal: relative paths within `guide/`
- Output PDF: `guide/output/`

## Folder structure

```
guide/
├── CLAUDE.md              # this file
├── vision.md              # project framing (read after this file)
├── art/                   # provided assets — class portraits, splashes, illustrations
├── content/               # hand-authored instructor's prose
│   ├── intro/             # welcome letter, framing
│   ├── overview/          # combat-theory chapter content
│   ├── classes/           # one .md file per class
│   ├── items/             # armorer's notes per item
│   └── exercises/         # training-field summaries
├── pages/                 # HTML/JSX page templates per content type
├── styles/                # CSS print stylesheets, typography system
├── build/                 # build pipeline (data import, PDF generation)
└── output/                # generated PDF
```

## Voice — the Gariland Instructor

All hand-authored prose lives in the instructor's voice. Specifics in `vision.md`; quick reference here:

**The instructor:**
- Unnamed in v1 ("your instructor," "this instructor," "one" for generalizations)
- Senior faculty at Gariland Magic Academy; has been teaching for many years
- Formal but not stuffy; warm but not effusive
- Authoritative on mechanics; opinionated on tactics; respectful of the cadet's intelligence

**Vocabulary:**
- Battle → engagement
- Training session → exercise
- Student → cadet
- Equipment → armory items / gear / requisitioned gear
- Gariland → "this institution" / "the Academy"
- Other cadets → "your fellow cadets"
- Game session → ~~don't reference~~ (the handbook is in-world)

**Style rules:**
- Second person ("you, cadet") for direct instruction
- "One" for generalizations ("one discovers, in time...")
- Third person for absent things or unspecified actors
- Italics for in-world quotations or flavor inflections
- No modern idiom ("crush it," "next-level"); the prose lives in Ivalice
- No jokes that undercut the voice; dry humor that respects the material is fine

**What the voice is NOT:**
- Not jokey / winking
- Not condescending
- Not breathlessly enthusiastic
- Not modern

**Reference:** Yasumi Matsuno's FFT prose style is the register target. Formal without being stilted; mannered without being affected.

## Build pipeline

**HTML/CSS → Paged.js → PDF via headless Chromium.** Specifics settle during Phase 2 (scaffolding); operational notes here:

1. Build script imports TypeScript content modules from `../src/content/`
2. Build script reads hand-authored prose from `guide/content/`
3. Page templates compose mechanical data + flavor + layout into HTML
4. Paged.js handles page breaks, running headers/footers, page numbering
5. Browser preview during iteration
6. Single command (likely `npm run build:guide` or similar) produces the PDF

**Iteration loop:**
- Open the dev preview in browser; see layout changes live
- Edit templates / styles / content; refresh
- Run the PDF generation step when ready for output review

**When game content changes:**
- Re-run the build; mechanical data flows through automatically
- Review hand-authored flavor for invalidations (rare): if a class's role description references a specific stat value or a unique ability, large balance changes might need a prose review

## Working conventions

**Always preserve the conceit.** Every reader-facing artifact (PDF, HTML preview, error messages in the handbook output) should stay in-character or at minimum stay neutral. Out-of-world breaks (build script output, terminal logs) are fine; reader-facing surfaces are not.

**Mechanical data is sacred.** Never hand-author a stat, cost, range, or hook value in the guide's prose if it could be derived from `../src/content/`. The whole point of the auto-update pipeline is that the data flows in. Hand-authored numbers go stale; imported ones don't.

**Flavor stays in `content/`.** Page templates compose flavor + data; they don't author flavor inline. If a template wants narrative copy, it pulls from a markdown or TypeScript file in `content/`.

**Prefer imports over duplications.** If the game catalog has a value (Knight max HP at level 25, Bolt Hammer's WP, etc.), import it. If the value depends on a computation (level-25 stats derived from base + growth + equipment), implement the computation in the guide's build layer using engine utilities where possible — don't reimplement.

**When in doubt about voice or canon:** ask Chris. The handbook is a creative artifact; voice and canon decisions need designer input. Mechanical accuracy questions can usually be settled by reading the game source.

**When mechanical content is missing or unclear:** flag it to Chris rather than inventing it. A guide that says "the Bolt Hammer drops Lightning Strike on hit at 25%" is correct; a guide that says "the Bolt Hammer also occasionally hums faintly" is fiction the game doesn't support, and should be questioned.

## Phasing

Per `vision.md`, the project proceeds in roughly eight phases, one Claude Code session each:

1. **Vision document** — complete (see `vision.md`)
2. **Project scaffolding** — folder structure, build pipeline skeleton, data-import scaffold
3. **Knight specialization spread concepting** — 2-3 layout variants; settle the Class template
4. **Specialization spreads applied** — Mages get the settled template
5. **Armory pages** — weapons, armor, accessories
6. **Welcome + Foundations of Battle** — intro and mechanics chapters
7. **Assembly and polish** — final PDF
8. **Future** — River Ridge training-field page; future maps

**Current status (keep this current — it's the first thing a new
session reads):** the v1 handbook has been content-complete since Phase
8, and has since grown well past that milestone as the game shipped
content. `output/guide.pdf` is **~61 pages**: title → TOC → welcome →
foundations → *Specializations half-title* (two-column roster) → **13
class spreads** (each verso on an even page, so two-page view shows true
facing pairs) → *Armory half-title* (with a cover plate) → Armory
(Universal/Heavy/Magical gear tiers) → *Training Fields half-title* →
**4 training fields** (River Ridge, Stonebridge, Marshmoor, Mountain
Pass — each with a data-driven SVG map) → colophon.

**Sessions are now maintenance-driven, not roadmap-driven.** The work is
a recurring loop: the game implementer ships changes → records the
player-facing ones in `docs/guide-changelog.md` → a guide session
reflects them. **Read `maintaining.md` for the operational playbook**
(the update loop, the add-a-class / add-a-field recipes, the verso/recto
parity invariant, build/verify commands, the stale-prose audit). The
per-session changelog cursor and transient notes live in `handoff.md`.
**Update this status block** (and the Quick-reference line below) when
the page / spread / field counts change, so the next session starts with
an accurate picture.

## Plan-review and handoff discipline

The guide project mirrors the main game's plan-review and handoff discipline:

**Before substantial work:** the Claude Code session produces a plaintext plan describing what it will do; Chris reviews and approves before code lands.

**At end of session:** a handoff note describes what landed, what was considered, what's deferred. Lives at `guide/handoff.md` (creating it as the project starts to accumulate sessions).

The handoff discipline:
- Overwritten each session, not appended
- Captures things noticed but not acted on; choices considered and rejected; suggested scope or sequencing for the next session; open questions
- Does NOT duplicate the vision doc, ADRs (if we have them), or commit messages

Architecture-level decisions worth a durable record go in `guide/decisions/` as ADRs. The folder exists; the first record is `decisions/0001-gear-tiers.md` (the Armory's Universal/Heavy/Magical gear-tier model). Number new ADRs sequentially.

## Tooling notes

The stack settled long ago (these were open questions in early phases;
recording the answers so they aren't re-litigated):

- **Render pipeline:** HTML/CSS → **Paged.js** → PDF via **Puppeteer**
  (headless Chromium). `build/render-pdf.ts` drives it.
- **Build framework:** **Vite** (build + asset bundling). Entry
  `build/preview-entry.ts` composes the handbook and hands it to
  Paged.js. Commands: `npm run build:guide` (full PDF + planner
  reference). See `maintaining.md §5` for the verify workflow — and note
  the dev server does **not** render styles (Vite serves CSS as JS in
  dev), so verification is on the built PDF, not `npm run dev`.
- **Planner content reference:** a second artifact — a terse,
  mechanical-only mirror of the catalog for the *planner* thread (no
  prose, numbers + one-line effects). `npm run build:reference`
  (`build/reference.ts` → `output/planner-content-reference.md`,
  gitignored); also runs as the tail of `build:guide`. Schema/contract
  is `planner-content-reference.md` (committed). See `maintaining.md §5a`.
- **Module resolution:** path aliases (`@content`, `@engine`) resolve to
  `../src/` via `vite.config.ts`; the build imports game content
  directly. `build/data.ts` is the single data doorway.
- **Fonts:** EB Garamond (body), Cinzel (display), Cormorant (figures /
  stat numerals), Caveat (marginalia) — via `@fontsource/*`.

## What not to do here

- Don't modify `../src/` from this folder
- Don't author mechanical numbers in flavor prose
- Don't break the conceit in reader-facing output
- Don't introduce out-of-world humor in the instructor's voice
- Don't add dependencies to the main game project (the guide has its own `package.json` / `node_modules` if needed)
- Don't author content that depends on FFT plot canon (Gariland setting reference is fine; named FFT characters and storyline events stay out)
- Don't reimplement game logic in the build layer if the engine has utilities for it (level-25 stat computation, equipment composition, etc.)

## Cross-pollination — naming conventions (S38)

The main game now ships an Ivalician/FFT-flavored unit name pool at
`../src/content/names/index.ts` (`ivalicianNames` — currently ~50
entries). The team builder's auto-name and the AI roster both draw
from this pool. The convention is intentional: it coordinates with the
guide's Gariland Magic Academy framing — the cadets a player names
("Cidolfas," "Maerwynn," "Beowulf") sit naturally inside the Cadet's
Handbook's voice.

When authoring example cadet names in handbook content (training
exercises, sidebar examples, illustrative scenarios), prefer drawing
from the same pool — readers loading a default team in-game will see
familiar names from the same vocabulary. Add new names to the pool
when an authoring need warrants; both projects benefit.

The pool is plain TypeScript and can be imported into the guide's
build pipeline alongside the other `../src/content/` reads.

## Quick reference

- Project framing: `vision.md`
- Game data: `../src/content/...`
- Hand-authored prose: `guide/content/...`
- Provided art: `guide/art/...`
- Output: `guide/output/...` (PDF + `planner-content-reference.md`, both gitignored)
- Planner reference: `npm run build:reference`; schema `planner-content-reference.md`, generator `build/reference.ts`, playbook `maintaining.md §5a`
- Voice: Gariland instructor, formal-warm, no modern idiom, mechanical accuracy non-negotiable
- Operational playbook: `maintaining.md` (update loop, recipes, parity, build/verify)
- Architecture decisions: `decisions/` (ADR-0001: gear tiers)
- Current status: ~61 pp, 13 class spreads, 4 training fields; maintenance-driven (changelog → guide)
- Shared name pool: `../src/content/names/index.ts` — Ivalician /
  FFT-flavored names used by the game's team builder and AI; coordinate
  example-cadet names with this pool
