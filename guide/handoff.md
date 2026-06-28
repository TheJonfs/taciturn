# Handoff

*Outgoing notes from the Session 75–76 pass — the **Monk** (14th class),
the **Twist Headband** (headgear), and the S75 **Stop-disables-reactions**
rule. Both artifacts updated. Driven by `docs/guide-changelog.md`.
Overwritten each session — read every item, then act / promote / drop.*

## Changelog cursor

**Processed through Session 76 (2026-06-28).** Processed all of S76 (the
Monk) and S75 (Stop reactions, Twist Headband; the T-Munny team, the
target-color UX, and the revive-highlight fix have no guide surface and
were skipped; the test-runner / gender-export items are non-player-facing).
Next guide session starts **above** the "Session 76" heading.

## What landed (this session)

PDF rebuilt to **63 pages** (+2 for the Monk spread; the Twist Headband
fit within the Armory's existing pages). Parity verified across all 14
spreads. Reference rebuilt clean.

### Monk — fourteenth Specialization spread

Full 6-step recipe. `content/classes/monk.ts` (slotted alphabetically
between Knight and Pyromancer in `SPREAD_ORDER`), `classes/index.ts`,
`build/spread-context.ts` (portrait `monk_1.png` + ElementId + CLASS_META
+ order), `styles/variant-e.css` (**saffron / marigold gold** `#c0902f` —
Chris's pick, a clear yellow-gold distinct from the Knight oxblood and
Pyromancer burnt-orange that flank it), `pages/layout.ts` (half-title
clause + `fourteen`). Martial Arts `commandSetIntro` + the 5 actives
(Chakra + 4 Fists) and 3 passives; **Attack omitted** — the PA² punch is
explained in the Barehanded note instead, saving a recto slot.

**Two Monk-specific wrinkles handled:**
- **Slot restriction:** the Monk is *head + accessory only* (no body /
  weapon / off-hand). Enhanced `gearAccess()` in `build/reference.ts` to
  read `equipmentSlots` and surface this — §5 now reads "head + accessory
  only" instead of a misleading "universal". No gear-tier anchor change
  (the Monk isn't in any item's restrictions).
- **Reference ⚠ markers:** the loud-marker discipline caught the gaps —
  Counterpunch / Barehanded / Vigilance needed `PASSIVE_EFFECTS` entries,
  and Bear's Heave (a grapple-throw with no structured damage/status) an
  `ACTIVE_EFFECTS` one. Also augmented the 4 Fists + Chakra so §6 shows
  the **element + stance** each sets (the Monk's defining mechanic, which
  the structured fields don't carry). Reference now clean.

**Fit:** as dense as the Enchanter (intro + 5 actives + 3 passives).
First draft spilled to 3 pages; trimmed every note tight (the Enchanter
lesson) to land 2 pages.

### Twist Headband (S75)

Universal headgear, +10 HP / +2 PA — armory note in
`content/items/index.ts` (after Guard Cap). The note flags it as the
Monk's natural head (PA monostat, head + accessory the only slots).
Auto-flows to reference §4. Renders on armory p46.

### Stop now disables reactions (S75, ADR-0131)

A reference §1 line (Stop suppresses all reactions; Don't Act doesn't),
and folded into the Assassin's **Shadow Stitch** note ("stilled of every
reaction while it holds — its Counter, its Damage Split, silent").

## Parity — two spills caught and fixed

The Monk (new, dense) **and** the Assassin (my Shadow Stitch clause grew
an already-at-capacity spread) both spilled to 3 pages — Calculator
through Monk went RECTO-FAIL. Fixed by tightening the Monk's notes and
compressing the Shadow Stitch note *below* its original length. Re-ran
the §6 parity check: all 14 spreads back on even/verso. Lesson stands:
the Assassin (5 actives) is as tight as the dense intro-block spreads;
budget a trim before touching it.

## Watch-for / flag

- **PDF ~98 MB** (14 portraits + plates) — art downsample is now well
  overdue; the standing top-priority cleanup.
- **Monk spread at capacity** (note in the file) — any kit tweak spills.
- **The Assassin spread is also at capacity** — re-confirmed this session.
- Carried: same-named status variants in §8 (Haste/Protect/Shell ×2 +
  the four Stances now too), `item-format` as the item-rider catch-all,
  Vantage +2→+1 pending game-side.

## Considered and rejected

- **A separate Attack note for the Monk** — folded the PA² punch into
  Barehanded instead (density; the punch *is* Barehanded's effect).

## Suggested next scope

- Resume changelog-driven maintenance as S77+ lands.
- **Art downsample** — ~98 MB; overdue.
