# Session 73 — AI tuning: MP-bottleneck gate + buff-aware cohesion

*Two narrow tunes surfaced by playtest, both refinements to the AI's existing (good)
advance-to-engage behavior — not a rebuild. (1) A rare self-restore **softlock**: an MP-light
unit at low MP loops on MP-restore instead of advancing, because the MP-economy term values
MP-restore generically regardless of whether the unit needs MP. (2) An AI **Enchanter buffs but
its team scatters** out of the Auramancy AoE — train cohesion so buffs hit multiple. The deferred
positional threat-model stays deferred; per Chris's design call its camping/high-ground half is
**unwanted** — the AI advancing to engage rather than turtling the ridge is a feature.*

## Inputs

- The unified scorer / leaf scorers and the **MP-economy term** (ADR-0109: the `(1 − mp/maxMp)²`
  scarcity penalty and the value it places on restoring MP).
- The **Alchemist** kit: compound (creates stockpile items incl. Ether), Throw Item (consumes a
  stockpile item, not MP), and the 0-MP bow basic attack — i.e. an MP-light unit that can also
  *manufacture* MP, the unique conjunction behind the loop.
- The move-destination / positioning scorer (where a cohesion term composes).
- The Enchanter's **Auramancy** (diamond-1 AoE buffs) and the S72 note that AoE-buff *valuation*
  was left untuned (casting works; receiving-positioning doesn't).
- Playtest findings (this round): the engagement drive already exists; the loop is MP-state- and
  Alchemist-specific; Calculator and charm read well; the Enchanter buffs but allies don't cluster.

## Goal

1. **Eliminate the self-restore softlock** by gating MP-restore value on whether MP is genuinely a
   bottleneck for the unit's best play, and prove it with a **constructed deterministic repro**.
2. **Add buff-aware cohesion** — the AI advances *clustered* when it fields an AoE-buffer so
   Auramancy lands on multiple allies, **without** a wait-to-soak stall.
3. **Preserve the aggressive advance-to-engage default** — introduce no camping or passivity.

## Pre-implementation plan (audit)

- **MP-restore valuation:** where the MP-economy term assigns value to restoring MP / low-MP states,
  and whether that value is gated by MP-*need* at all today. Find the cleanest gate: a unit whose
  best play is MP-free (a bow basic attack) has no bottleneck → MP-restore should score ~0; a unit
  whose offense is MP-gated keeps valuing it. Determine the gate's breadth (general vs Alchemist-
  specific) from the code.
- **Confirm the loop mechanics:** does compounding cost ~the MP that consuming returns (a neutral,
  infinitely repeatable loop)?
- **Construct the deterministic repro:** one Alchemist, low MP, an Ether in stockpile, an enemy
  parked just outside bow range. The scorer should currently pick compound-Ether over advance and
  loop. This is the red test and the fix's verifier — the live battle never needs re-creating.
- **Cohesion seam:** how the move-destination scorer chooses tiles while advancing, and where a
  "stay within our buffer's prospective AoE / near beneficiaries" term composes — subordinate to
  the advance and to any combat action.

## Implementation work

### Chunk 1 — MP-bottleneck gate (the loop fix)  *(checkpoint after)*
- Land the constructed repro test first (red): the trigger state loops.
- Gate MP-restore/economy value by whether MP is a genuine bottleneck for the unit's best available/
  near-future play (MP-free offense → restore ~0; MP-gated offense → unchanged). Exact form per the
  audit.
- Green: the repro advances + engages; a low-MP **MP-dependent caster still** values restoring MP it
  will actually spend (no over-correction); full-MP behavior unchanged.

### Chunk 2 — buff-aware cohesion  *(checkpoint after)*
- Add a subordinate cohesion term to move-destination scoring, triggered by the team fielding an
  AoE-buffer: while advancing, prefer destinations that keep the buffer's intended beneficiaries
  within its prospective AoE / grouped — without halting the advance.
- Tune so the team advances grouped and Auramancy lands on multiple, but no unit waits in place to
  soak, and the term never overrides engaging or chasing a kill.

## Acceptance criteria

- The constructed Alchemist repro advances + engages instead of looping; the deterministic test
  passes. (The fix is proved by the test, not by live repro.)
- A low-MP MP-dependent caster still values MP-restore appropriately — the gate distinguishes
  MP-free offense from MP-gated offense and does not blanket-kill restore value.
- The aggressive advance-to-engage default is intact (no new camping or idling).
- An AI team with an Enchanter advances clustered so Auramancy hits multiple allies; no wait-to-soak
  stall; cohesion stays subordinate to engaging.
- Suite green; `tsc -b` + `vite build` clean; ADR.

## Out of scope

- The **predictive positional threat-model** (avoid reach, protect units, deploy against threats) —
  deferred. Its camping/high-ground-optimization half is *unwanted* (engagement-bias is the design
  intent).
- The far-end self-preservation refinement (don't single-file into an obvious kill-zone) — later and
  lighter; aggression is the preferred default for now.
- Any broader AoE-buff valuation overhaul (casting already works) and any offense-side change to the
  MP-economy term beyond the restore-value gate.
- Charm under-valuing high-utility steals (untested vs larger parties; low priority).

## Open questions (audit / tuning, not blocking)

- **Gate breadth:** the audit decides whether the MP-need gate is general (any unit) or narrowed to
  the Alchemist's neutral item-loop. Lean general — it's correct regardless and cheap — but the
  audit (or a low-MP-non-Alchemist probe) confirms nothing legitimate breaks.
- **Cohesion strength:** playtest-tuned; start mild (see the over-cluster watch-for).

## Files (hedged — audit confirms)

The leaf scorers / MP-economy value and the MP-bottleneck gate; the move-destination/positioning
scorer and the AoE-buffer detection for cohesion; ADR; Vitest (the constructed repro + cohesion
tests).

## Watch-fors

- **Gate over-correction** — a legitimately MP-dependent caster at low MP must *still* value
  restoring MP it will spend. The gate keys on "is MP my bottleneck," not "am I low on MP." Don't
  blanket-zero restore value.
- **Cohesion over-clustering into enemy AoE** — the AI can't yet weigh *enemy* AoE threat (that's the
  deferred threat-model), and Chris already saw two Enchanters die to one AoE. Keep cohesion mild and
  subordinate so it doesn't pack units into a one-spell-kills-several position. Improving our buff
  uptake must not manufacture enemy-AoE kills.
- **Cohesion stalling** — must not reintroduce wait-to-soak passivity; the team advances grouped, it
  doesn't sit and wait.
- **Camping creep** — preserve the aggressive default; neither tune should make the AI more passive.

## Estimated size

Small-to-medium. The loop fix is a targeted, principled gate proved by a constructed deterministic
test — bounded. Cohesion is a subordinate positioning nudge, tuning-sensitive but small. No new
substrate; smaller than a class, a focused tuning session.
