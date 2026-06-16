# Maintaining the Guide — operational playbook

The durable how-to for guide-update sessions. `CLAUDE.md` is the
constitution (what the project is, the voice, the rules); this file is
the mechanics (how to actually do the recurring work). Read it when you
start an update session, alongside the changelog and the handoff.

The recurring sessions are all variations on one loop: **the implementer
ships game changes → the changelog records the player-facing ones → a
guide session reflects them.** Most of what follows is about doing that
loop without breaking the layout.

---

## 1. The update loop

1. **Read the changelog cursor.** `docs/guide-changelog.md` (in the game
   repo, *not* here) is a one-way feed: implementer sessions append,
   guide sessions read. **Never write to it from the guide side.** The
   cursor — which session you last processed — lives in `handoff.md`.
   Read top-down until you hit the last-processed entry, then stop.
2. **For each player-facing change, decide its surface.** Three kinds:
   - *Data-only* (a stat, cost, range, restriction): flows in
     automatically via `../src/content`. Usually **no edit** — but
     verify it rendered (see §5) and check for stale *prose* (§4).
   - *New content* (class, item, map): needs new prose + wiring (§2, §3).
   - *Mechanics change to existing content*: the auto-imported facts
     line updates itself, but **hand-authored prose can silently go
     stale** — this is the most-missed case (§4).
3. **Audit before you trust.** Read `../src/content` for the actual
   values — the changelog is a summary and has been wrong (e.g. it once
   said the Templar couldn't equip Knight shields; a later commit added
   it). **Source is the source of truth; the changelog is the pointer.**
4. **Build, verify, fix parity** (§5, §6).
5. **Update the handoff**, advance the cursor, commit (§7).

---

## 2. Adding a class spread (the 6-step recipe)

Done a dozen times; it is a fixed checklist. Say the new class id is
`<id>` and display name `<Name>`, with portrait `art/<id>_1.png`
(already provided by Chris).

1. **Prose** — `content/classes/<id>.ts` exports `<id>Prose: ClassProse`
   (see `content/prose.ts` for the shape). Copy the nearest existing
   class as a skeleton. Fields: `tagline`, `brief`, `abilityNotes`
   (keyed by ability id — must match what the catalog resolves),
   `strategy`, `marginalia`, optional `commandSetIntro`.
   - **Attack is omitted by convention** when the class's basic strike
     is a footnote (Calculator, Terraformer, Templar, Thief all do
     this): just don't author an `attack` note — the template skips any
     ability with no note.
   - **`commandSetIntro`** heads the Active column with a framing block;
     use it when the First Action is a *system/kit* rather than a plain
     list, and to balance a thin active column against many passives.
2. **Registry** — `content/classes/index.ts`: import the prose, add it
   to the `classProse` map.
3. **`build/spread-context.ts`** — four edits in this one file:
   - `import <id>PortraitUrl from '../art/<id>_1.png';`
   - add `'<id>'` to the `ElementId` union
   - add `<id>: { element: '<id>', portraitUrl: <id>PortraitUrl }` to
     `CLASS_META`
   - add `classId('<id>')` to `SPREAD_ORDER` (**alphabetical by display
     name** — confirm the display name, not the id; e.g. `lightning_mage`
     sorts as "Aethurge")
4. **Palette** — `styles/variant-e.css`: add `.v-e--<id>` with
   `--accent`, `--band`, `--band-label`. Pick a hue **distinct from its
   neighbours in the book** — there are a dozen now, so check the
   existing block; warm/cool and light/dark both matter for telling
   spreads apart on a flip-through.
5. **Half-title brief** — `pages/layout.ts` (`specializationsHalfTitle`):
   the prose brief names each discipline; add a clause for the new one.
   The "N disciplines, N spreads" count auto-derives from
   `SPREAD_ORDER.length` (covered through "twelve" in `NUMBER_WORDS`).
6. **Build, verify, and check parity** (§5, §6). New spreads are the
   single most common cause of a parity break.

Nothing else lists classes — TOC, half-title list, and spread render all
iterate `SPREAD_ORDER`/`classProse`, so they pick the new class up free.

## 3. Adding a training field (the 3-step recipe)

1. **Prose** — `content/training-fields/<id>.ts` exports `<id>Prose:
   FieldProse` (shape defined in `river-ridge.ts`): intro, terrain
   sections, zone sections, knockback, counsel, and a `legend` of colour
   swatches (match the colours to `build/diagrams.ts`'s elevation ramp).
2. **Map accessor** — `build/data.ts`: import the map from
   `@content/maps/<id>.ts` and add a `<id>Map()` function.
3. **Registry** — `build/training-fields.ts`: append `{ prose: <id>Prose,
   map: <id>Map() }` to `TRAINING_FIELDS`. TOC, the Part-Five half-title
   list, and the chapter render all iterate it; the data-driven SVG map
   renders the grid with no template change.

## 4. The stale-prose audit (the most-missed step)

When the changelog reports a *mechanics change to existing content*, the
auto-imported **facts line** (e.g. "Arc, range 4 · Spell Power 8")
updates itself from source — but the **hand-authored prose** beside it
does not. Past misses that shipped or nearly shipped:

- Seven spells went arc → straight-line; prose still said "arc range"
  (and would have contradicted the "Line" chip beside it).
- Phoenix Down became KO-only; an Alchemist marginalia still said "a
  Phoenix Down on a living ally is mercy" — now flatly false.
- Cure's area changed cross → diamond; the note still said "cross".

**The habit:** for every changed ability/item/stat, `grep` the prose
(`content/`) for its name and the old descriptor, and read the note —
don't assume the data flow covered it. Verbs and shapes ("arc", "cross",
"+1 Move", "full damage") are the usual culprits, because they're
flavour the data line doesn't dictate.

## 5. Build & verify

- **Build:** `npm run build:guide` (= `vite build && tsx
  build/render-pdf.ts`). Produces `output/guide.pdf`. (`output/` is
  gitignored — the PDF is a build artifact, never committed.)
- **The dev server does not work for verification** — Vite serves the
  CSS as JS in dev, so the styled page only exists in the PDF. All
  visual verification is on the built PDF.
- **Rasterise pages to look at them:** `pdftoppm -f <p> -l <p> -r 95
  -png output/guide.pdf /tmp/pg` then Read the PNG. `pdftotext -f <p>
  -l <p> output/guide.pdf -` for text checks.
- **Data-level checks without a full build:** a throwaway `tsx` script
  can import `build/data.ts` and `build/item-format.ts`/`ability-
  format.ts` to print computed facts (tiers, stat lines, ability
  facts). **It cannot import `build/compose.ts` or
  `build/spread-context.ts`** — those pull a `?raw` SVG import that
  Node/tsx can't resolve (`Unknown file extension ".svg"`). That error
  in a probe is a tsx limitation, not a real bug; the browser build
  handles it fine. Verify those paths through the PDF instead.

## 6. The verso/recto parity invariant — and the fit budget

**Invariant:** every class spread must open on an **even (verso/left)**
page, so the two-page view shows a true facing pair (portrait+brief on
the left, repertoire on the right). The chapter dividers use
`break-before: right` to land on recto; the spreads rely on staying an
even number of pages each.

**The trap:** a class spread that overflows from 2 pages to 3 shifts
**every subsequent spread's parity** — and the symptom (spreads landing
on odd pages) shows up pages away from the cause. A *net-new* ability
note costs roughly **a third of a page**; the densest spreads (four
actives, or an intro block plus many passives — Calculator, Terraformer,
Templar, Thief) have the least slack and spill first.

**The discipline:** when you add a note to a spread, **budget a
compensating trim in the same spread up front** rather than chasing the
spill afterward. Tighten the brief, the longest ability notes, or a
two-paragraph strategy down to one — the marginalia often already
carries the line you're cutting.

**The parity check** (run after every build that touched a spread):

```bash
for name in Aethurge Alchemist Assassin Calculator Geosage Hunter \
            Hydrologist Knight Pyromancer Templar Terraformer Thief; do
  pg=$(for p in $(seq 10 40); do
    if pdftotext -f $p -l $p output/guide.pdf - 2>/dev/null \
       | grep -v '^\s*$' | grep -v '^[0-9]*$' | sed -n '2p' \
       | grep -qE "^${name}$"; then echo $p; break; fi
  done)
  [ $((pg % 2)) -eq 0 ] && echo "$name p$pg OK" || echo "$name p$pg RECTO-FAIL"
done
```

(Update the name list as the roster grows; the masthead-line is the 2nd
non-blank, non-folio line on each verso.) A spread spilling as the
**last** item in the chapter won't fail this check — but it's still a
flaw; confirm the final spread is 2 pages by checking the page after it
isn't its content.

## 7. Closing a session

- **Handoff** (`handoff.md`) — overwrite (don't append): what landed,
  the **changelog cursor** (which session you processed through),
  watch-fors, considered/rejected, suggested next scope.
- **Commit** — guide-side files only; never stage anything under
  `../src/` (the game side; it has its own commits). Stage by explicit
  path, not `git add .`, so game-side WIP and untracked docs don't get
  swept in. The repo is shared `main`; guide and game commits interleave.
  One commit per logical bundle. Commit-message footer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- **Keep `CLAUDE.md`'s status current** — its "Current phase" /
  "Quick reference" lines drift; update the page/spread/field counts
  when they change so the *next* session isn't misled on page one.

---

## Architecture notes worth knowing

- **Gear tiers** (Universal / Heavy / Magical) replace per-item class
  enumerations on armour-slot gear. Classified by *anchor membership*
  in `build/item-format.ts` (`gearTier`): a restriction touching the
  Knight → Heavy, touching a caster → Magical. **A new class joins a
  tier by adding its id to an anchor set** — no per-item edit. See
  `decisions/0001-gear-tiers.md`.
- **The build reads `../src/content` directly** at build time; the guide
  never duplicates a game value it can import. The single data doorway
  is `build/data.ts`; formatters are `build/item-format.ts` and
  `build/ability-format.ts`. Everything mechanical traces through those.
- **`art/` is read-only source.** Crops/treatments are done in CSS
  (`object-fit`), not by committing derived images — see the title-page
  seal and the half-title plates (`object-fit: cover`).
