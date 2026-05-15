# Taciturn Player's Guide — Vision & Project Plan

A companion artifact to the Taciturn engine and its first showcase, Mage War. Part reference, part flavor, designed in the spirit of strategy guide / manual hybrids from an era when these documents were authored as artifacts in their own right rather than reduced to wikis.

## The conceit

**Mage War takes place at the Gariland Magic Academy** — the same Ivalice institution where, in another telling, a young Ramza Beoulve and Delita Heiral began their training. The Knight and the four elemental Mages are cadets specializing in their chosen disciplines; the battles are training exercises and academy-sanctioned duels; the equipment is Academy-issued gear from the armory.

**The guide is presented as the cadet's student handbook**, authored by a longtime instructor at Gariland who knows the material intimately and is fond of it. The voice runs throughout: introductions written as a welcome letter; mechanics chapters as combat theory lectures; class spreads as specialization briefs; item catalogs as armory inventories with the Master Armorer's notes; battle locations as training-field summaries. The instructor is unnamed in v1 (referred to as "your instructor," "this instructor," "one" for generalizations) — keeps focus on the material; can be developed later if the voice wants a name.

This framing accomplishes three things at once:
- **Anchors Mage War in Ivalice canon** without depending on FFT's main storyline. Gariland is the setting; the rest is original.
- **Gives the guide natural authority** — a professor explaining material to students is a voice readers already know how to receive.
- **Maps cleanly onto the content categories** — student handbooks already contain orientation, course catalogs, equipment guides, and field-exercise summaries. The structure is recognizable.

## What this is

A printable PDF (also web-viewable) that does three things at once:

- **Reference** — readers can look up a class's stats, an ability's mechanics, an item's properties, and find the answer cleanly.
- **Flavor** — readers encounter the world of Gariland and Mage War in prose, character, and visual identity rather than as bare data.
- **Living document** — the mechanical content auto-updates from the game's content modules when balance shifts, equipment gets reauthored, or new content ships. The instructor's voice (the hand-authored flavor) stays stable; the data side flows automatically.

The guide is a *companion*, not a wiki. It's structured, voiced, and laid out as a unified document — a reader experiences it front-to-back or as a referenced artifact, not as a hyperlinked node graph.

## Inspirations

**The professor-as-author conceit draws from real student handbook traditions** — university course catalogs, academy training manuals, the kind of opinionated curated documents written by faculty who've taught the material for decades and have views about it.

**The presentation craft draws from game guides of the artifact era:**

- **The Earthbound Player's Guide** (Nintendo Power, 1995) — magazine-style layout, mechanical depth woven into prose, the in-world voice that read continuous with the game's tone
- **Gygax-era D&D manuals** — prose-heavy, opinionated, encyclopedic authority that's still warm
- **Nintendo Power-style strategy guides** — editorial personality; in-game art as visual anchor; magazine design as wrapper
- **Infocom feelies** — physical artifacts that extended game worlds outward

The Gariland framing makes the Earthbound-style "in-world voice" feel natural rather than affected: a student handbook *is* an in-world document by definition. The visual identity probably lands closer to D&D manual / Nintendo Power territory than to Earthbound's hand-drawn personality (which depends on custom illustration), but the *voice* can be as continuous-with-the-world as Earthbound's because the conceit demands it.

## Voice and tone

**The Gariland Instructor.** Working voice notes:

- **Formal but not stuffy.** Speaks with the careful diction of someone who teaches for a living and cares about being understood. Occasional Ivalician flavor in word choice ("engagement" for battle, "exercise" for training session, "cadet" for student, "armory" for equipment, "this institution" or "the Academy" for Gariland), but never to the point of parody. The voice should sound like a senior professor with a long career, not a 19th-century scholar.
- **Authoritative on mechanics.** When the guide explains how Charge Time works or what the Bolt Hammer does, the prose reads with the precision of someone who has watched a hundred cadets get this wrong and learned how to explain it clearly.
- **Warm on character.** The instructor is genuinely fond of the material and the students. There's room for occasional considered opinion ("the Bolt Hammer is, in this instructor's view, one of the more elegant teaching weapons in the armory — it rewards a mind willing to compose physical and magical instincts in the same act") and dry observation, but not for sarcasm or undercutting humor.
- **Speaks to "you, cadet"** for direct instruction. Uses "one" for generalizations ("one discovers, in time, that the Knight's value compounds the longer she remains on the field"). Third person for describing absent things or unspecified actors.
- **Mechanical accuracy is non-negotiable.** When the guide quotes a stat or describes an ability's behavior, it should match the engine's actual behavior. The auto-update pipeline solves this.

**What the voice is not:**
- Not jokey, not winking. The instructor takes the material seriously even when amused by it.
- Not condescending. The cadet is treated as capable of complex thought.
- Not breathlessly enthusiastic. The instructor's affection for the material shows in care, not exclamation.
- Not modern. Avoid contemporary idiom ("crush it," "next-level," etc.); the prose lives in Ivalice.

**What FFT contributes:**
- Vocabulary and naming conventions consistent with Ivalician fantasy (already largely in place via Mage War's content)
- Tone reference: FFT's prose style is formal-without-being-stilted, mannered without being affected. Yasumi Matsuno's writing on Ivalice is the target register.
- Specific Gariland touches: references to the Academy's traditions, faculty, training grounds, and (lightly) the broader world of Ivalice without depending on FFT's plot

The voice settles further through the concepting work. The Knight spread is where the instructor's voice will commit to specifics.

## Project structure

```
taciturn/
├── src/                    # game engine + content
├── docs/                   # game design docs, ADRs, roadmap
└── guide/                  # this project
    ├── CLAUDE.md           # operational conventions for guide work
    ├── vision.md           # this document
    ├── art/                # provided assets (class portraits, splashes, etc.)
    ├── content/            # hand-authored instructor's prose
    │   ├── intro/          # welcome letter, framing, world notes
    │   ├── overview/       # combat-theory chapter content
    │   ├── classes/        # one file per class (knight.md, water-mage.md, etc.)
    │   ├── items/          # armorer's notes, item-by-item flavor
    │   └── exercises/      # training-field summaries (River Ridge, future maps)
    ├── pages/              # HTML/JSX page templates per content type
    ├── styles/             # CSS print stylesheets, typography system
    ├── build/              # build pipeline scripts (data import, PDF generation)
    └── output/             # generated PDF
```

The guide folder is self-contained for design and build work but reads upward into `../src/content/` to pull mechanical data at build time. Game content stays the source of truth for stats, costs, ranges, hooks; the guide's `content/` folder holds the instructor's prose and design choices that wrap that data.

## Build pipeline

**HTML/CSS → Paged.js → PDF via headless Chromium.**

Flow:
1. Build script imports relevant TypeScript content modules from `../src/content/` (classes, items, abilities, statuses, maps)
2. Build script reads hand-authored instructor prose from `guide/content/`
3. Page templates compose the mechanical data + flavor + layout into HTML
4. Paged.js (CSS Paged Media polyfill) handles page breaks, running headers/footers, page numbering, marginalia
5. Browser preview during iteration (open the page locally)
6. Single command produces the final PDF (Chromium headless render)

Why this stack:
- **Web-native** matches the project's existing TypeScript/web tooling — no impedance mismatch importing game content
- **Iteration speed** — see layout changes in the browser instantly, no compile cycle
- **CSS is the right tool for magazine layout** — Grid, flexbox, multi-column, full-bleed images are all native
- **Auto-update is trivial** — re-run the build when game content changes; the data flows through

The exact tooling specifics (Paged.js vs Vivliostyle, build framework, etc.) settle in the project-scaffolding session.

## Page typology

Five page categories, each with a distinct template and content rhythm. Each is framed in-world as part of the student handbook.

### 1. Welcome to Gariland — The Introduction

**In-world framing:** A welcome letter from your instructor to the incoming cadet. Introduces the Academy, the cadet's place in it, and what this handbook is for.

**Content:**
- Brief lore: Gariland Magic Academy's place in Ivalice; what the Mage War tradition is (an Academy-sanctioned series of training engagements where specialized cadets test their disciplines against one another); why the handbook exists
- The framing itself — the instructor introduces themselves implicitly (through voice), welcomes the cadet, lays out what to expect from the material ahead
- Visual: probably a single dramatic spread; the title splash image earns its keep here as the Academy's official seal or hero image

**Length:** 2-4 pages

**Voice:** The reader's first impression of the instructor. Settles the tone for the rest of the handbook.

### 2. Foundations of Battle — Mechanics Overview

**In-world framing:** A combat theory primer. The instructor walks the cadet through the principles their training engagements operate under.

**Content covered:**
- Charge Time (CT) and the turn loop — framed as "the rhythm of an engagement"
- The action structure — Primary Action, Secondary Action(s), Reaction, Support, Movement — framed as "the cadet's options each turn"
- Status effects — framed as "lingering conditions one may impose or suffer"
- The elemental wheel — Water/Fire/Earth/Lightning relationships; resistance and absorption — framed as foundational theory ("the Academy holds that the four elemental principles compose a closed cycle of opposition, which you will learn to read on the field")
- Elevation, terrain, knockback, fall damage — framed as "the terrain reads as carefully as your opponent"
- Equipment slots and loadouts — framed as "the cadet's requisitioned gear"
- Hit/evasion/critical mechanics at a high level
- Team builder lightly (more detail in future content)

**Visual:** Diagrams as classroom illustrations. The elemental wheel as a formal diagram (the kind that might hang in a classroom). CT visualized as a meter — perhaps drawn in the margin as a side-bar reference the cadet might dog-ear.

**Length:** 6-10 pages

**Voice:** Patient, didactic, but not condescending. The instructor explaining how the world works to someone capable of understanding.

### 3. Specializations — One Spread Per Class

**In-world framing:** The Academy's course catalog of available specializations. Each spread reads as the instructor's brief on what cadets choosing this path can expect — strengths, common builds, opinions on which equipment suits the discipline.

**Per-class structure** (each class gets a 2-page spread):
- **Portrait** — high-resolution; given visual prominence as the specialization's representative
- **Class name + role tagline** — one line capturing identity ("The Knight: armored melee, the team's anchor")
- **Instructor's brief** — 100-300 words of in-character description of the specialization's character and tactical role
- **Stats at level 25** — clean stat block (HP, MP, PA, MA, Speed, Move, Jump; resistances)
- **Active abilities** — each gets a small entry: name, mechanical description (cost, range, effect), instructor's note (flavor + tactical guidance)
- **Passive abilities** — same structure
- **Specialization strategy note** — a paragraph or two on how the class plays and what builds the instructor finds noteworthy

**Visual:** Heavy use of the portrait; element/slot icons; the stat block as a structured info box; the strategy note as a sidebar. Per-Mage element accent color (Fire/Water/Earth/Lightning); Knight gets a neutral or House-Beoulve-flavored palette.

**Length:** 2 pages per class — 10 pages total for five classes (Knight + four Mages).

**Voice:** Authoritative on mechanics; warm on character. "The Lightning Mage thrives on tempo — every spell she casts opens a window for the next, and one comes to recognize the cadets who instinctively read that rhythm."

### 4. The Armory — Equipment Catalogs

**In-world framing:** The Academy armory's catalog, with the Master Armorer's notes appended by the instructor. Weapons, armor, accessories — what the requisitioning cadet can expect, what the instructor recommends.

**Structure:** Three sections (weapons, armor, accessories) probably running 2-4 pages each.

**Per-item entry:**
- Item name + visual treatment (icon if simple/abstract; typographic prominence otherwise; the occasional small illustration where art exists)
- Class restrictions, if any (framed as "issued to" / "requisitionable by")
- Mechanical data — stats, hooks, costs (table-formatted within the entry)
- Flavor line — 1-3 sentences of personality; sometimes the instructor's note, sometimes ostensibly the Armorer's note
- Tactical use note — when this item shines, brief

**Visual:** Table-heavy but designed; rows have personality. The occasional full-bleed visual break (a weapons-rack spread; an accessory display case) keeps the section from feeling like a database dump.

**Length:** 6-10 pages depending on density and how generous the visual breaks are.

**Voice:** Curatorial. "The Bolt Hammer remains, in this instructor's view, one of the armory's more elegant pieces — it asks the wielder to compose physical and magical instincts in the same act, and rewards those who can."

### 5. Training Exercises — Map and Battle Pages (Future)

**In-world framing:** The Academy's training-field summaries. Each map is a location cadets practice at; the instructor describes the terrain, what skills it tests, what an attentive cadet should notice.

**Per-map structure** (planned):
- Map rendering (top-down view, possibly enhanced with terrain illustration overlays)
- Terrain analysis — key features, elevation profile, water/land, tactical zones
- Common engagement composition (when there's a defined party)
- Instructor's notes — what the cadet should observe, what mistakes are common, what skills the location is designed to develop

**Length:** 2-4 pages per map.

**For Mage War v1:** River Ridge gets a placeholder page authored as the Academy's flagship training field. Future maps as content ships.

## Design system principles

Specifics settle in the Class spread concepting session; what we commit to now:

**Layout philosophy:**
- Print-grid-aware. CSS Grid for major layout, multi-column for body text where appropriate.
- Pages have distinct templates by type (Class spread ≠ Item overview ≠ Foundations chapter) but share a visual identity rooted in the Academy handbook framing.
- Image-driven where possible. Class portraits, map renders, and other in-game art are the visual anchor.

**Typography:**
- Body face: readable on print, with character appropriate to a formal-but-warm handbook. Probably a serif with humanist warmth.
- Display face: something that suggests Ivalician institutional formality — could be a classical serif, a refined blackletter alternative, or a contemporary face with the right tone. Concepting narrows.
- Drop caps at section openings; italics for in-world quotations and flavor inflections.

**Color:**
- Primary palette derives from a "Academy institutional" reading — probably restrained, with deep ink colors and aged-paper warmth as a base.
- Element-wheel colors (Fire/Water/Earth/Lightning) as accent palette on Mage spreads.
- Knight gets a neutral or restrained accent (the Academy seal's palette, House Beoulve, or simply the institutional base).

**Iconography:**
- Element symbols (Fire/Water/Earth/Lightning), equipment slot icons (left hand, right hand, head, body, accessory), status badges (positive/negative/parametric).
- An Academy seal as a recurring visual motif — drop-cap decoration, page-corner emblem, marginalia anchor.
- Probably geometric / heraldic in feel.

**Decorative elements:**
- Borders, dividers, section markers, marginalia frames in a heraldic-handbook style.
- Recurring Academy seal motif.
- Initial drop caps at section openings.
- Background textures gestured toward aged paper without committing to skeumorphism.

## Asset inventory

**Provided** (Chris / external):
- High-resolution class portraits (Knight, Earth Mage, Water Mage, Fire Mage, Lightning Mage) — placed in `guide/art/`
- Title / splash imagery (the splash already shared for the title screen could double as the handbook's hero image)
- Logo / wordmark for Taciturn and Mage War, if commissioned
- Original illustrations, if commissioned — would lift the guide toward "lavishly illustrated artifact"; without them the guide leans toward institutional handbook with portrait visual anchors (still strong)
- An Academy seal / coat of arms, if Chris wants one designed — could be a small commission or a CC-produced geometric mark

**Produced by Claude Code with direction:**
- Layout templates per page type
- Typography system (font pairing applied consistently)
- Color palette tuned for print
- Stat tables, ability entries, item rows with personality
- Decorative borders, dividers, section markers, drop caps, callout boxes, headers/footers
- Simple iconography (element symbols, equipment-slot icons, status badges in their print-optimized form)
- Background textures, geometric patterns, decorative motifs (paper-toned warmth, heraldic dividers)
- Academy seal as a geometric mark, if not externally commissioned
- All data-driven mechanical content (from `src/content/` modules)

**Middle ground — game screenshots and renders:**
- River Ridge as a rendered map anchors training-field pages
- Class portraits in their game-context use cases (in the unit detail panel, in the action menu) are usable visual hooks
- Equipment lacks in-game art but pairs well with descriptive marginalia or schematic equipment-slot iconography

## Phasing

Build path, roughly one Claude Code session per phase:

**Phase 1 — Vision document** (this document, complete on approval)

**Phase 2 — Project scaffolding**
- `guide/` folder structure created
- `CLAUDE.md` authored for guide-folder conventions
- Build pipeline skeleton (Paged.js set up; HTML page template; CSS reset for print; "hello world" PDF render)
- Data-import scaffold (read one class from `src/content/`, render its stat block in an HTML test page)
- Brief project README

**Phase 3 — Knight specialization spread concepting**
- 2-3 layout variants for the Class spread template
- Each variant: typography choices, color usage, portrait placement, ability list rhythm, stat block design, instructor-voice prose committing the voice's specifics
- Chris evaluates; one direction settles; the template becomes the canonical Specialization spread

**Phase 4 — Specialization spreads applied**
- The settled template applied to the four Mages (each with element-themed color accent)
- All five Specialization spreads in their finished form
- Output: a 10-page PDF excerpt that stands on its own

**Phase 5 — Armory pages**
- Weapons / armor / accessories grouped pages
- Auto-imported from item modules; instructor's prose and Armorer's notes hand-authored
- Pagination determines whether items get 6 or 10 pages

**Phase 6 — Welcome + Foundations of Battle**
- Welcome to Gariland spread with title splash
- Foundations chapters (CT, action structure, elements, equipment, status, etc.)
- Voice is most front-and-center here; concepting against the Specialization template's settled identity

**Phase 7 — Assembly and polish**
- All pages composed into the unified PDF
- Front matter (title page, table of contents, instructor's preface?) and back matter (credits, index?) added
- Pagination, typography, color consistency pass
- Final PDF output

**Phase 8 — Future**
- River Ridge training-exercise page (placeholder slot filled when ready)
- Future maps as content ships
- Possible voice/visual revisions if playtest or reader feedback warrants

Each phase ends with a PDF artifact that Chris can review and react to. The guide grows incrementally rather than all-at-once.

## Relationship to the main game roadmap

The guide is a parallel project. It does not block any game roadmap session, and game roadmap sessions do not block the guide. Work proceeds whenever a Claude Code session is allocated to it; the data-update pipeline ensures the guide stays in sync with whatever the game's current content state is.

When game content shifts (a class baseline rebalances, an equipment item gets reauthored, a new ability ships), the next guide build picks it up automatically. Hand-authored instructor prose occasionally needs review when mechanical changes are big enough to invalidate flavor ("Bolt Hammer is the Knight's only Lightning-themed weapon" stops being true if a second one ships), but the cadence is light.

## Open questions for concepting

Things to settle in Phase 3 (Knight specialization spread concepting) or earlier:

**Resolved by the Gariland framing** (no longer open):
- ~~Voice specifics~~ — the Gariland instructor; further specifics commit in the Knight spread
- ~~Use of in-game UI mock-ups~~ — leans toward yes; framed in-world as the simulator displays cadets train on

**Still open for concepting:**
- **The instructor's named-vs-unnamed question.** v1 leans unnamed ("your instructor"); concepting can revisit if the voice wants a specific person.
- **Display typography specifics** — classical serif, contemporary serif with character, blackletter accent? The Gariland framing nudges toward "classical with warmth"; concepting picks the specific face.
- **Color identity per class** — element accent on Mage spreads is settled in principle; concepting decides how strong the per-class theming is and what the Knight palette anchors to.
- **Ability list density** — full-block-per-ability or compact-table-with-flavor-callouts? Affects spread density.
- **Stat block visual treatment** — clean bordered box, sidebar, or inline-with-narrative? Concepting picks.
- **In-game UI mock-up presentation** — when the guide shows the cadet's view of the simulator, is that a literal screenshot, a redrawn schematic, or something in between? Concepting picks based on visual fit.
- **Decorative motif system** — Academy seal placement, recurring heraldic elements, marginalia treatment. Concepting introduces candidates.
- **The Knight's palette anchor** — restrained "Academy institutional"; House Beoulve reference; or class-specific (sword-and-shield warmth)? Concepting picks.

**Follow-on questions surfaced by the framing** (likely to emerge in concepting):
- **How specific does the Ivalice canon get?** Does the guide reference other Academy faculty, specific Ivalician geography (the Order of the Northern Sky, Murond Holy Place, etc.), or stay focused on Gariland itself? The instinct is "stay focused; canon-aware without canon-dependent."
- **Does the framing extend to the title page?** ("The Cadet's Handbook to the Mage War Tradition, Issued by the Faculty of Gariland Magic Academy.") Likely yes; concepting confirms.
- **How does the framing handle the meta-information** (table of contents, page numbers, "this guide is generated by software")? Lean: keep the handbook conceit unbroken; treat technical concerns as quiet design.
- **Will the framing want chapter epigraphs?** (Short in-world quotations at chapter openings — fragments of Academy doctrine, cadet's-handbook proverbs, etc.) Cheap, atmospheric, and easy to add; concepting decides.

---

**Status:** Vision document v2 (Gariland Academy framing). Ready for review. Subsequent phases proceed once this is approved or adjusted.
