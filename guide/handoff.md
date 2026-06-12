# Handoff

*Outgoing notes from the S60–S62 guide update — the Templar (eleventh
class spread), the Templar arc's new equipment, and the S60
line-of-sight change. This was the first pass driven by the new
`docs/guide-changelog.md` feed (the implementer-writes / guide-reads
channel) rather than a hand walk of git history. A follow-on
Armory-tiers refactor (below) landed in the same session, after the
S60–S62 commit `562eb9e`.*
*Overwritten each session — read every item, then act / promote / drop.*

## Armory gear tiers — follow-on refactor (uncommitted at time of writing)

Chris's call: the Armory's class-restriction lines were enumerating
disciplines (e.g. "Geosage, Hydrologist, Pyromancer, Aethurge,
Calculator, Terraformer only"), which spilled the column and grew with
every new class. Replaced the enumerations with **three gear tiers** for
the armour slots (off-hand/shield, body, head):

- **Universal** — open to all (renders no restriction line, as before).
- **Heavy** — the armoured line: Knight plate + true shields; currently
  Knight + Templar.
- **Magical** — the casting line: robes, mage headgear, the Books;
  currently the four elemental Mages + Calculator + Terraformer.

Weapons and accessories are all universal, so the tiers touch only
shield/armor/headgear. Entries now read e.g. "Shield · Heavy",
"Armour · Magical".

**Implementation (`build/item-format.ts`):** replaced `restrictionText`
(and the brittle length-based special cases — `length===4` Mages,
`===5` Mages+Calculator, `===2` Knight&Templar) with a single
`gearTier(item)` classifier. It works by **anchor membership**, not
exact-roster match: a restriction listing the Knight → Heavy; one
listing any caster (`HEAVY_ANCHOR_IDS` / `MAGICAL_ANCHOR_IDS`) →
Magical. **So a future class added to either family is picked up with no
guide edit** — which is the whole point of Chris's framing ("future
classes get Universal plus one of Heavy/Magical"). To add a class to a
line, add its id to the relevant anchor set. The classifier throws
loudly if a restriction spans both lines or fits neither (no silent
mislabel, per CLAUDE.md).

- `ItemFacts.restriction` (string) → replaced by `ItemFacts.tier`
  (`'heavy'|'magical'|undefined`) + `tierLabel` ("Heavy"/"Magical").
- `pages/armory.ts`: kind line renders `tierLabel`; `armourSortKey`
  now sorts by tier rank (Universal → Heavy → Magical) via `describeItem`,
  replacing the old `restrictionRank` + its duplicate `MAGE_CLASS_IDS`.
- In-world explainer added to the **armour** section intro (defines the
  three classes in the instructor's voice, and notes the off-hand
  shields/books catalogued in the weapon racks share the system); a
  one-line forward-pointer added to the **weapons** intro since a reader
  meets "Shield · Heavy" there first.

Verified: all 19 restricted armour-slot items classify correctly (3+4
armour, 3+3 headgear, 3+3 shields), zero throws, no enumerated class
lists remain on any kind line, no dangling references to the removed
symbols. 53 pages, clean build. **Not yet committed** — commit this
separately from `562eb9e` (it's a distinct, self-contained change).

## Changelog cursor

**Processed through Session 62** of `docs/guide-changelog.md`. Next
guide session starts at the first `## Session NN` above S62. S61 was a
no-op (AI-only); S60–S62 are all reflected below. (The changelog is a
one-way feed: implementer sessions append, guide sessions only read —
do **not** write to it from the guide side.)

## What landed

`output/guide.pdf` rebuilt clean at **53 pages**, ~81 MB (+2 pages and
~5 MB over the prior 51pp/76MB — the Templar's 2-page spread and its
3.2 MB portrait; the equipment notes, Foundations paragraph, and spell
fixes absorbed into existing flow). Build: `npm run build:guide`.

### Templar — eleventh Specialization spread (S62)

A hybrid holy knight (White-Mage healing/revival + Dragoon leap).
Wired exactly as the Calculator / Terraformer were:

- `content/classes/templar.ts` — `templarProse`, slotted alphabetically
  **between Pyromancer and Terraformer** in `SPREAD_ORDER`. Tagline +
  brief, a **Templar Arts** `commandSetIntro` (Cure / Raise / Jump —
  per Chris's call, to balance the thin 3-active column against the four
  innate passives), notes for the 3 arts + 4 innate passives (Emissary
  of Murond, Monkeygrip, Unified Calling, Faithstrider), strategy, four
  marginalia.
- **Attack omitted** (no authored note → template skips it), as with the
  Calculator/Terraformer: the Templar's weapon story lives in Jump
  (PA × WP, ×2 with a Lance), so the bare strike is a footnote.
- Wiring: `content/classes/index.ts`, `build/spread-context.ts`
  (portrait `templar_1.png` + `CLASS_META` + `'templar'` ElementId +
  `SPREAD_ORDER`), `styles/variant-e.css` (new `.v-e--templar` —
  **deep amethyst** `#4f2d7f`, deliberately richer/bluer than the
  Aethurge's grayer electric `#5b3a78` so the two purples stay distinct
  across the book; Chris's call), `pages/layout.ts` (half-title brief +
  auto "eleven disciplines, eleven spreads").

**Two prose-vs-data subtleties handled in the prose, not the band:**
- **Move 2 → 3.** The stat band reads `class.movement.moveRange` = base
  **2**; innate Faithstrider lifts it to 3 only at runtime. The
  Faithstrider note says so explicitly ("Move 3 in play") so the band's
  2 doesn't read as a contradiction.
- **Back evade 2.** The Templar is the first class to break the
  universal back-zero (Eva 10/6/2). Flagged in a marginalia line as a
  genuine novelty, not a typo.

Verified: spread fits its two-page facing (p28 verso / p29 recto, even
parity), counsel closes cleanly, stat band correct, amethyst palette
distinct from the Aethurge, all eleven spreads still on even/verso pages.

### New equipment — three Armory notes (S62)

All universal weapons (no class restriction); authored in the weapon
racks:

- **Defender** (Knight Sword) — placed after Absolom. WP 11, Brave-
  variance, grants **Auto-Protect** (50% physical reduction, standing
  and free). Note leans on the aura as the point, and that *any* class
  can requisition it (weapons are universal).
- **Lance** & **Imp Halberd** — a new "Lances" subsection (after the
  swords block, before the knives). Two-handed reach weapons (range 2,
  height 4) that **pierce** the tile behind the target (friend or foe).
  Lance WP 10 = the striker; Imp Halberd WP 8 / +1 MA = the healer/Jump
  build. Notes flag the Templar's ×2 Jump-with-Lance and the pierce's
  friendly-fire risk.

### Templar shares Knight gear — restriction lines auto-updated

Nine Knight-restricted items now list `templar` in source, so the
formatter renders them **"Knight & Templar only"** (3 shields —
Escutcheon, Warrior's Aegis, Managuard; 3 body — Soldier's Leathers,
War Plate, Spiked Mail; 3 head — Steel Helm, Tactical Mask, Crusader's
Helm). **Note:** the guide-changelog's S62 entry is *stale* on this —
it says "not Knight shields," but commit `480a62b` later added Templar
shield access, and Chris confirmed it. Source (`classRestrictions`) is
authoritative and the guide follows it; the shields are shared. No
prose hand-asserts "Knight only" anywhere, so nothing else needed
fixing — but if a future pass adds Knight-gear flavor, mind the
Templar now shares it.

**Formatter touch:** added a 2-class restriction case to
`build/item-format.ts` → `"X & Y only"` (was a bare `"X, Y only"`
comma), matching the "Mages & Calculator only" house style. Applies to
all nine shared items.

### S60 line-of-sight — Foundations note + two stale-spell fixes

Seven bolt/beam spells went arc → straight-line (ADR-0097) and can now
be blocked by cover. The auto-imported facts line already flipped these
seven to **"Line, range 4"** (verified: Lightning Bolt, Scorch, Water
Lash, Megavolt, Chain Lightning, Fireball, Flame Lance). Two had
hand-authored prose that still said **"magical damage at arc range"**,
which now both contradicted the chip and misdescribed the trajectory:

- **Scorch** (`content/classes/fire-mage.ts`) and **Water Lash**
  (`content/classes/water-mage.ts`) — rewrote both full + compact notes
  to "straight line" and folded in the cover caveat.

Per Chris, also added a **cover / line-of-sight paragraph** to the
Foundations "Reading the Ground" section — a genuinely new foundational
rule the chapter didn't cover. It draws the bolt-vs-lob distinction
(straight-line spells blocked by terrain/bodies/barriers; bows and
arcing/lobbed attacks still reach over cover) without naming the seven
spells, so it stays current as the spell list shifts.

**Checked and deliberately left alone:** the Aethurge spread doesn't use
the word "arc" for Lightning Bolt/Megavolt, so no edit was needed there.
The three *unaffected* arcing attacks (Rock Toss, Tidal Wave, Maelstrom)
still render "Arc"/"Cone from caster" correctly. Earth Mage's "arc
range" wording is for Rock Toss, which did **not** change — left as is.

## Watch-for / flag

- **PDF is ~81 MB.** The art downsample is now badly overdue — eleven
  portraits + seal + splash dominate. The biggest single distribution
  win available; would more than halve the file at no print-DPI loss.
- **Worldcraft still has no per-work data line** (carried from last
  pass): the Terraformer's five works show only MP/range, not the
  elevation deltas / Barrier HP, because the ability formatter has no
  `worldcraft` effects arm. Same shape would apply if any future class
  needs custom effect surfacing. Not blocking.
- **Templar Jump renders "Arc, range 6."** Correct — Jump genuinely
  lobs (no LoS), unlike the seven S60 spells. No action; noting so a
  future reader doesn't "fix" it.

## Considered and rejected

- **An intro block-less Templar (3 plain actives).** Rejected per
  Chris — the Templar Arts commandSetIntro heads the column and
  balances it against the four passives, matching the two other
  system-led classes (Calculator, Terraformer).
- **Ecclesiastical-gold Templar palette.** The portrait's gold trim
  tempted it, but the Alchemist already owns brass/amber; deep amethyst
  (Chris's pick) keeps the holy-knight identity and separates cleanly
  from the Aethurge's purple.
- **Naming the seven spells in the Foundations cover note.** Kept it to
  the bolt-vs-lob *principle* so the chapter doesn't go stale when the
  affected list changes; the per-spell truth lives in each spell's
  facts line and note.
- **Editing `docs/guide-changelog.md`.** It's a one-way
  implementer→guide feed; the guide side reads, never writes. Cursor
  recorded here instead.

## Suggested next scope

- **Art downsample** for distribution — now clearly the top cleanup.
- **Write-through** on this session's new prose (the Templar spread, the
  three equipment notes, the Foundations cover paragraph) if the voice
  wants tuning — drafted against catalog mechanics, character is yours.
- **Future training fields / classes** as they ship; the pipelines are
  proven (class wiring done five times now, training-field three).
