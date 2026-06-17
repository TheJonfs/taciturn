## ADR-0116: AI self-state valuation — charm/steal swing, break-a-charm, Math kill re-base

**Status:** Accepted
**Date:** 2026-06-17

## Context

The near-final beat of the AI capability-expansion arc
(`docs/thirtyNinePlanning/ai-capability-expansion-blueprint.md`). The scorer
reasoned about damage, position, Worldcraft, MP, and knockback (S56–66) but not
about unit **state**: it couldn't value gaining a good state (a charm swing,
stolen buffs) or removing a bad one (an ally it should free from charm). This
session adds a self-state dimension as **reactive, current-state-based** scoring
terms — no prediction. The **predictive positional threat-model** (avoid reach,
protect units, deploy against threats) is deliberately **deferred** to the
upcoming major-expansion conversation; the deferred don't-feed-the-snowball term
folds into it.

Every term obeys the arc's non-negotiables: single-move horizon, offence
first-class / non-damage **strictly subordinate** (the cower discipline), and
compose on the unified scored pool rather than special-casing. Two design calls
were settled with Chris before build (see below).

## Decisions

### Chunk 1 — gain a good state (Steal Heart, Steal Buffs)

Two previously-AI-invisible Thief actives become scored pool candidates:

- **Steal Heart (charm):** scored by the action-economy swing — `output ×
  charmDuration × contestChance × CHARM_SWING_DAMPING_FACTOR (0.5)`, minus the
  MP-spend penalty. `output` is the **damage-output proxy** (D-A below): the
  target's strongest projected attack. The contest land-gate
  (`computeThiefContestChance`, exported from the status barrel) keeps the EV
  honest (~31% naked → ~58% set up). Declines a harmless target (0 output) and
  loses to a lethal finish.
- **Steal Buffs:** scored as a transfer — `stealableBuffCount ×
  STEAL_BUFF_VALUE_PER_BUFF (18) × contestChance`, minus MP penalty. 0 against a
  bare target, so the AI peels a buffed backliner and ignores an unbuffed one.

**Self-buffs need no new term (audit finding):** the only *chooseable* self-buffs
are `single_unit` ally buffs, already scored by `scoreAllyBuff` with the actor as
a same-team target (`livingAllies` includes self). The rest (Cornered Focus,
Combat Focus, Earth Resilience, Speed Save, Updraft, Tidal Pull) are auto-fired
reactions the scorer never chooses, and the lone `kind:'self'` ability (Compound)
is not a buff. No speculative `self`-targeting machinery built (YAGNI).

- **D-A — threat-value = damage-output proxy (Chris's call):** value charm and
  break-a-charm against the target's strongest projected attack, not a presence
  (maxHp) or MA×#offensives proxy. Values charming/freeing a hard hitter, not a
  tank. Known limitation: undervalues a pure-support target (a charmed healer
  reads as 0 output) — consistent across cast and break; revisit if it bites.

### Chunk 2 — break a bad state (break-a-charm)

When an own ally is `enthralled` (control-override — it acts for the enemy),
attacking it scores a candidate: `output × remainingPuppetTurns ×
BREAK_CHARM_VALUE_FACTOR (1.0) × CHARM_BREAK_CHANCE (0.5)` minus the friendly
damage the attack costs. `CHARM_BREAK_CHANCE` matches `enthralled`'s 50%
on-damage break. Excludes a 0-damage hit (never rolls the break) and any KO'ing
hit (don't kill the unit we want back); the smallest-damage breaking attack
therefore scores highest.

This is the **only path that offensively targets a same-team unit**, guarded hard
to fire solely on `isControlOverridden` allies — it can never leak onto a
non-charmed ally. `validateAction` already permits friendly-fire `single_unit`
targeting (`friendlyFire: true`, the charm puppet rides it), so **no engine
change was needed** for the exception.

- **Deferred: don't-feed-the-snowball (Chris's call).** The subordinately-negative
  term against feeding a grow-when-hit enemy was the brief's explicit cut-candidate
  and the most cower-prone. Deferred entirely into the future predictive
  threat-model beat; break-a-charm is the higher-value half and got the session's
  cower-risk budget.

### Chunk 3 — carry triage

- **Math kill re-base:** the Calculator's Precision Fire option now
  killValue-weights its per-target damage (enemy positive, friendly-fire ally
  negative), the same scale attacks use (`projectedDamage × killValue`). A
  field-wide cast that catches a near-dead enemy now competes commensurably with
  a direct kill — **closing ADR-0092's deferred "Math under-competes on wounded
  targets" limitation.** `killValue` extracted to `src/ai/kill-value.ts` (shared
  by `basic.ts` and `math-skill-scoring.ts`, avoiding a circular import). Heal /
  CT / buff Math options stay raw net-team-value — they aren't kills and keep
  their own tuned coefficients.

- **Dropped carries closed** in the blueprint (no longer carried forever):
  Worldcraft move-then-cast, Perch move-onto-created-perch, Calculator AI
  personality variants, and the S66 MP-penalty-scope extension (playtest mooted
  it). Layer-2 positional prediction folds into the deferred threat-model beat.

### Investigation (report-only — no code change; see handoff)

LoS/Vantage/Barrier geometry documented for Chris's dial decision: LoS
interpolates the ray elevation linearly between (Vantage-boosted) attacker and
target endpoints; a **Barrier's "tallness" is `BLOCKER_HEIGHT = 1`, a single
module-private constant** in `line-of-sight.ts` shared with `blocks_los` terrain
columns — **not** a per-barrier or per-tile parameter (`BarrierState` is only
`{hp, ttl, ownerId}`). Cover-height-vs-elevation is therefore a one-knob,
all-or-nothing global today; making it a real dial means either bumping that
constant (affects all blockers) or adding a height field to the tile/barrier and
threading it through `tileBlocksAt`. Full report in `docs/handoff.md`.

## Consequences

- Three subordinate self-state terms ride the existing scored pool — no new
  hooks, action types, or engine changes. `computeThiefContestChance` exported.
- The arc's near-final beat is **done**; the predictive threat-model and the
  dropped carries are closed/deferred in the blueprint.
- **Feel is unverified** (the PixiJS harness can't drive battles). The cower
  watches (charm-spam, support cower), the break-a-charm guard, and the Math
  re-base all need Chris's in-battle pass — see `docs/playtest-watch.md`.
- 1919 → 1935 tests; tsc + vite build clean. Dials logged in playtest-watch.md.

## Alternatives considered

- **Presence (maxHp) or MA×#offensives threat proxy (D-A no):** maxHp ranks
  tanks over glass cannons; MA×#offensives misses physical attackers. The
  damage-output projection is the principled middle.
- **Build don't-feed-the-snowball now (deferred):** the most cower-prone term,
  low value; deferred to the threat-model beat rather than spend cower budget on it.
- **Engine-side friendly-fire targeting exception for break-a-charm:** unnecessary
  — `validateAction` already allows it; the guard belongs in the AI builder.
