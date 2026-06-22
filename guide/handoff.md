# Handoff

*Outgoing notes from the Session-70→72 pass — the **Enchanter** (13th
class), the **Protect/Shell ×0.5** + **Aura Mastery** status shifts, the
**Mountain Pass** training field (4th), and a handful of S71 stale-prose
fixes. Both artifacts updated. Driven by `docs/guide-changelog.md`.
Overwritten each session — read every item, then act / promote / drop.*

## Changelog cursor

**Processed through Session 72 (2026-06-22)** — the whole span above the
prior cursor: all three S72 entries (Enchanter, Protect/Shell, Aura
Mastery), the S71 follow-ups/chunks, and S70 (Mountain Pass + split
deployment). The S69 follow-up and below were already processed. Next
guide session starts **above** the topmost "Session 72 follow-up — Aura
Mastery" heading.

## What landed (this session)

PDF rebuilt to **61 pages** (+4: Enchanter spread +2, Mountain Pass +2).
Reference rebuilt clean. **Parity verified across all 13 spreads.**

### Enchanter — thirteenth Specialization spread

Full 6-step recipe, wired as the prior classes. `content/classes/
enchanter.ts` (slotted alphabetically between Calculator and Geosage in
`SPREAD_ORDER`), `classes/index.ts`, `build/spread-context.ts` (portrait
`enchantress_1.png` + ElementId + CLASS_META + order), `styles/
variant-e.css` (**jewel emerald/viridian** `#1f6b54` — Chris's pick, a
bluer/richer green distinct from the Geosage olive and Hunter forest),
`pages/layout.ts` (half-title clause + `thirteen` in NUMBER_WORDS).
Auramancy `commandSetIntro` + notes for the 4 wards/cleanse and the 4
passives; Attack omitted (PA 3 footnote; offence comes from a secondary
set). **Required extra wiring:** added `'enchanter'` to
`MAGICAL_ANCHOR_IDS` in `build/item-format.ts` (it joined the mage-gear
tier — without this the build throws on mage-gear items).

**Fit:** the densest spread in the book (intro + 4 actives + 4 passives).
First draft spilled to 3 pages and broke parity for everything after it;
recovered by tightening every note to ~2 sentences + trimming the brief
and strategy. A header NOTE in the file warns the next editor to budget a
trim before adding anything.

### Status shifts (S72)

- **Protect/Shell ×0.5** (ADR-0121): captured in the Enchanter's
  Protect/Shell notes ("halves … stacking with resistance, not
  competing") and a new **reference §1** line. **Audit was clean** — the
  Defender note already said "halves every physical blow," the Sorcerer's
  Robe note only says "a free Shell"; no "+50 resistance" framing existed
  anywhere, so no fix was needed.
- **Aura Mastery** (ADR-0122): Enchanter spread note + reference §7.

### S71 stale-prose fixes

- **Calculator** (`content/classes/calculator.ts`): Exact Rhythm was
  "Faith and Magical Attack" → now MA-only (heavier); Sculpted
  Enhancement "half-chance" and Engineered Defenses "four-in-five" → both
  reworded to MA-scaled qualitative phrasing (the base chances dropped to
  25/40%, which the §6 facts chips now show — the old fractions would
  have contradicted them).
- **Templar** (`content/classes/templar.ts`): Jump now spends the turn's
  Move — added to the Jump note.

### Mountain Pass — fourth training field (S70)

3-step recipe: `content/training-fields/mountain-pass.ts` (intro, 3
terrain + 2 zone sections, knockback, counsel, legend matching the
elevation ramp), `build/data.ts` (`mountainPassMap()`), `build/
training-fields.ts` (registry). Documents **split deployment zones** (the
new S70 mechanic) in the zone sections — the single-block valley vs the
3-on-SW-massif / 2-on-NE-edge ambush crossfire. Ties to the S69
terrain-as-cover lesson.

## Watch-for / flag

- **PDF now ~96 MB** (13 portraits + the Enchantress at 5 MB + plates).
  Art downsample remains the standing top-priority cleanup — now well
  overdue.
- **Same-named status variants in reference §8:** Haste / Protect / Shell
  each now appear **twice** — a timed *cast* version (`per_unit_ct`) and a
  permanent *equipment-grant* version (`permanent_per_unit_ct`, e.g.
  Defender's Auto-Protect). Real catalog data (distinct status ids, same
  display name), like the two "Regen". Not a bug. If it ever confuses the
  planner, §8 could show the status id to disambiguate — a reference-
  format change, not done here.
- **Enchanter spread is at capacity** (see the file's NOTE). Any future
  tweak to its kit will spill — budget a compensating trim.
- **Vantage +2 → +1** still pending game-side (carried) — four edit spots.

## Considered and rejected

- **Fuller Calculator rewrite** for the Faith-sweep — unneeded; only the
  three contradicting lines wanted fixing.

## Suggested next scope

- Resume changelog-driven maintenance as S73+ lands.
- **Art downsample** — now ~96 MB; overdue.
