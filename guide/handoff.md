# Handoff

*Outgoing notes from the Session 74 pass — four new caster accessories
(the headline), plus two S74 rules changes (Charged Attack tile-targeting
and buff non-stacking). Both artifacts updated. Driven by
`docs/guide-changelog.md`. Overwritten each session — read every item,
then act / promote / drop.*

## Changelog cursor

**Processed through Session 74 (2026-06-26).** S73 was a no-op (AI-only).
Processed all of S74: the four accessories, the two bundled teams
(no guide surface — skipped), Charged Attack retargeting, and buff
non-stacking. Next guide session starts **above** the "Session 74"
heading.

## What landed (this session)

PDF stayed at **61 pages** (the four accessory entries fit within the
Armory's existing pages); parity verified across all 13 spreads. The
reference rebuilt clean.

### Four new accessories (the headline)

Three of the four carry **new hook fields** the shared `item-format.ts`
didn't render — so, like the Wand of Potential before them, they'd have
silently shown only their stat mod. Extended `hookEffects` to render all
four (one fix, both artifacts):
- `battleStartCt` → "Begins the battle at full CT (acts first)" (Greaves
  of Seraphis, +Speed).
- `damageCtDrainPercent` → "Spell damage drains target CT by N% of
  damage dealt" (Ring of Caliora, +MA).
- `spellPowerModifiers.perExtraTarget` → "Spell Power +1 per target
  beyond the first" (Glove of Metria, +MA) — extended the existing
  spell-power rendering.
- `outgoingStatusMagnitudeMods` → "Applied Burn magnitude ×2" (Pendant
  of Lumara, +MA).
Hand-authored flavor+tactical notes for all four in
`content/items/index.ts` (after Gauntlet of Might). Verified on PDF
armory p47 and reference §3.

### S74 rules changes

- **Charged Attack now tile-targeted** (Hunter): rewrote the
  `charged_attack` note — it commits to a tile and whiffs if the target
  steps off before it resolves (was a unit-tracking guaranteed hit).
  Kept length-neutral to protect the Hunter spread's 2-page fit.
- **Buff forms don't stack** (ADR-0124): a new Enchanter marginalia
  ("a gear buff and its cast twin no longer stack — bless the cadet who
  carries none") and a reference §1 line. The at-capacity Enchanter
  spread absorbed the marginalia without spilling (marginalia render in
  the margin, not the recto flow).

## Watch-for / flag

- **PDF ~96 MB** — art downsample remains the standing top-priority
  cleanup (overdue).
- **`item-format.ts` is now the catch-all for item hook rendering** —
  five S70+ item mechanics (spell power, per-extra-target SP, battle CT
  seed, CT drain, outgoing-status magnitude) live in `hookEffects`. A new
  item mechanic that adds a field will again need a rendering branch here
  or it drops silently. This is the recurring "Wand of Potential" trap;
  check `item-format` whenever the changelog adds an item with a rider.
- **Enchanter spread at capacity** (carried) — now with a 5th marginalia;
  still 2 pages, but no slack. Budget a trim before adding.
- **Same-named status variants** in reference §8 (Haste/Protect/Shell ×2)
  and **Vantage +2→+1** game-side tuning — both carried, unchanged.

## Considered and rejected

- **Listing the two new bundled teams** (Claude's Bulwark / Answers).
  The guide doesn't enumerate team-builder presets anywhere, so there's
  no surface to update — skipped, as the changelog itself allowed.

## Suggested next scope

- Resume changelog-driven maintenance as S75+ lands.
- **Art downsample** — ~96 MB; overdue.
