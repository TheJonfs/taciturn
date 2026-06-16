# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## From S68 — equipment expansion (4 pieces)

Shipped the full S68 brief to main in one commit. **1891 → 1904 tests;
tsc -b + vite build clean; planner reference regenerated.** ADR-0113 (the
one new mechanic).

- **Vicious Dagger** (Knife, WP 5 / Acc 95) — `statMods: { crit_chance: 25 }`,
  `attacker_speed` variance. Pure reuse of the Arcane Lens crit-contributor.
- **Scimitar** (Sword, WP 7 / Acc 95) — `statMods: { spd: 1 }`, **no
  physicalVariance** (sword family is flat `PA × WP` per the planner reference;
  the brief's "Brave-scaled variance" parenthetical was a slip — see below).
- **Wand of Potential** (Wand, WP 2 / Acc 90) — `attackProcs` → hidden
  `wand_of_potential_apply_shift` (`{ water: +25, earth: -25 }`,
  **completing the four-element wand rotation**) + `spellPowerModifiers:
  [{ delta: 1, tagFilter: ['lightning'] }]`.
- **Gauntlet of Might** (Accessory) — `statMods: { pa: 3 }`.

### The one new mechanic (ADR-0113)

`modifySpellPower` joined the closed hook surface (15 → 16), mirroring
`modifyActionSpeed`: hook + runner + `spellPowerModifiers` data field +
`spellPowerContributor`, consumed in `magicalMaPower`. Caster-side, additive
on the magical power coefficient, tag-gated. The AI projection / UI forecast
inherit it for free (they reuse `runDamagePipeline`). New-hook chosen over an
inline weapon read per ground rule #9 (so a future status / class trait can
also grant SP). No AI valuation work — passive/stat-like, reads through the
existing magical path (brief scope).

### Two design calls settled with Chris this session

1. **Resonance shift = `{ water: +25, earth: -25 }`** (not the brief's
   under-specified "lightning variant"). Chris's goal was to *complete the
   four-element wand rotation*; I flagged that his first-stated
   `{ lightning: +25, earth: -25 }` neither completed it (water was the element
   missing a +25; lightning already had both signs) nor matched the wand's
   lightning-support intent (`lightning: +25` hardens the target against
   lightning). He confirmed water/earth. **Consequence:** the wand's *only*
   lightning-specific part is now the SP rider; the Resonance is water/earth
   disruption. Noted in the wand's doc comment + changelog.
2. **SP rider = new `modifySpellPower` hook** (vs inline weapon read).

### Brief slip caught (flag, don't silently change)

The brief's implementation bullet called the Scimitar "Sword family — Brave-
scaled variance band." The canonical planner reference says swords/axes are
**Speed-independent flat `PA × WP`** (no variance), and the existing sword
family (Longsword / Flametongue / Parrying Sword) declares no
`physicalVariance` — only the Knight Sword class (Absolom) is `attacker_brave`.
The acceptance criterion's binding intent ("sidegrade to the Longsword") needs
matching variance behavior, so Scimitar ships with **no** variance. Recorded
in the item's doc comment.

### Feel-pass watch items (added to `playtest-watch.md`)

- **Gauntlet +3** — potent on PA-scaled effects (incl. Thief charm / Steal MP);
  +2 is the flagged fallback if it warps deployment around the one wearer.
- **Vicious Dagger crit stacking** — base 5 + Vicious 25 (+ Lens 10 + Crit
  Modifier) can pass ~40% crit (~+20% avg dmg at ×1.5). Seeds the crit
  archetype; bounded by design. Tune future crit pieces, not this one, if it
  reads oppressive.

### Housekeeping

- **Roadmap unchanged** — content-expansion-pass work tracked via ADR-0113, not
  a numbered mechanism-track item (same rationale as S62/S65/S66/Thief).
- `content-id-registry.md` updated (counts 102→103 abilities, 73→77 items) and
  re-titled "as of S68."
- Guide `item-format.ts` gained a `spellPowerModifiers` line so the planner
  reference surfaces the SP rider (it's a brand-new field the formatter didn't
  know). `build:reference` re-run; the Wand row now reads "Spell Power +1
  (lightning); …Resonance."
- The four pieces are **not** in any default team template / playtest battle yet
  (a small follow-up, same as the Thief carry).

### The other half of the forward plan (NOT this session)

- **Self-state AI beat** — the larger, separately-scoped effort (the AI under-
  plays self-buff-gain / valuing a charm swing / playing around being charmed).
  Blueprint in `docs/thirtyNinePlanning/`. The Thief + this passive gear add
  weight to it; still the real follow-up.

## Still open, NOT touched this session (carried)

- **Taunt redesign** — deferred; needs an attacker-side hit-chance hook + AI
  taunt-awareness; Chris must pin intended effect.
  (`docs/thirtyNinePlanning/taunt-audit.md`.)
- **Templar (S62) balance/feel** — compounded by Battlemage's Chain feeding the
  tanky self-sustainer (watch entry exists).
- **Team-builder follow-ups (S64):** parchment reskin; single-source flavor
  pass; placeholder icons.
- **Thief feel pass** — Momentum tempo, Steal MP mage-counter, Steal Heart /
  charm (all in `playtest-watch.md`); charm scope is control-only (promote to
  friend/foe flip if toothless).
- **S61 standing AI carries:** Layer-2 positional prediction; Worldcraft
  move-then-cast; killValue-weighted Math re-base; Perch move-onto-created-perch;
  default team templates with Terraformer + Thief (+ the S68 gear); roster-wide
  Move-tier discussion; Calculator team-template revision + AI personality
  variants; Marshmoor template-compliance tests; `lightning-mage.ts` stale S20
  header; `draft-terraformer-substrate-audit.md` archival; terrain-transition
  animation; Math Skill SP scaling review.
- **MP-penalty scope (S66)** — extend the AI MP-spend penalty to
  heal/Math/Worldcraft, or keep offence+buff-only? (ADR-0109.)
- **Deployment taxonomy (S66)** — coarse melee/ranged shipped; richer
  tank/skirmisher/artillery/support split is the deferred next step.
