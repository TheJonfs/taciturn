# Session Brief — AI: self-state valuation (offense half)

*The tractable half of the remaining AI work: teach the scorer to reason about unit
**state** as a scored dimension — reactive and current-state-based, no prediction. The
predictive positional threat-model (avoid reach, protect units, position against threats)
is **deliberately deferred** to be driven by the upcoming major-expansion conversation;
do not build it here. Also carries a report-back investigation on Vantage/Barrier LoS
geometry. Closes the AI capability-expansion arc's near-final beat.*

## Context

The AI reasons about damage, position, Worldcraft, MP economy, knockback (S56–66). It
does **not** reason about unit state — it can't value gaining a good state (a charm swing,
buffs on itself) or removing a bad one (an ally it should free from charm), and it ignores
that some enemies grow when hit. The roster makes this visible: the Thief is live but its
charm and buff-steal are AI-invisible, and the grow-when-hit reaction cluster (Cornered
Focus, Speed Save, Updraft, Combat Focus, …) spans most classes. This beat adds a
self-state dimension to the unified scorer, in the same subordinate-scaled-term shape as
the MP economy term (S66) — and under the same non-negotiable **cower discipline**:
non-damage state value is a tie-break, never a first-class goal.

## Inputs

- **`ai-capability-expansion-blueprint.md`** — arc frame + inherited constraints.
- The unified scorer (ADR-0092) and the MP-economy term (ADR-0109) as the **template** for
  a subordinate scarcity/state-scaled scoring term applied in the leaf scorers.
- The Thief's `enthralled` charm + `effectiveController` (ADR-0111) — a charmed unit is
  already AI-controlled via `effectiveController`, so *playing* the puppet is largely free;
  the work is valuing the *decision* to charm.
- The grow-when-hit reaction set (`planner-content-reference.md` §7: Cornered Focus, Speed
  Save, Updraft, Combat Focus, …).
- The Calculator Math-skill scoring path (for the killValue re-base).
- Vantage / coverage-map / LoS code (ADR-0115) — for the investigation only.

## Goal

Teach the scorer to value unit-state changes, all strictly subordinate:
1. **Gain a good state** — the charm action-economy swing (Steal Heart) and buffs gained on
   self (Steal Buffs' gain side, self-buffs).
2. **Remove a bad state** — free a charmed ally (value attacking an `enthralled` ally for
   the break).
3. **Respect enemy state** — subordinately disvalue *feeding* a grow-when-hit enemy with a
   non-lethal hit.

Plus: the killValue-weighted Math re-base (carry triage), and a report-back on the
Vantage/Barrier LoS geometry. Defer the predictive threat-model.

## Pre-implementation plan (audit + investigation)

Audit:
- How does the scorer currently value self-buffs / heals (does any partial buff-value exist
  to build on or avoid double-counting)?
- Can the AI target an `enthralled` *ally* at all? (Ally-targeting is normally suppressed —
  the break-a-charm term needs a controlled exception.)
- Shape of the Calculator Math-skill target scoring (for the killValue re-base).

Investigation (report-back — **no code change** unless trivial and Chris greenlights from
the report):
- Explain the LoS calculation as a function of computed elevation, and how Vantage's +2
  feeds it.
- Does a Barrier tile have a **"tallness"** (number of vertical steps it blocks)? Is that a
  tunable parameter? Report the answer so Chris can decide whether cover-height-vs-elevation
  is a dial worth turning.

## Implementation work

### Chunk 1 — gain a good state  *(checkpoint after)*

- **Charm swing (Steal Heart):** value the cast by the action-economy delta — roughly the
  target's threat-value × the charm's effective duration (the enemy loses those turns and
  you gain them). This makes the AI pick Steal Heart on a high-value target when the swing
  beats its alternatives. (Playing the puppet afterward rides `effectiveController` — no
  extra work.)
- **Buff-gain:** a subordinate bonus for actions that grant the actor buffs — Steal Buffs'
  gain side (on top of its strip/deny value, which is debuff-shaped and more legible) and
  self-buffs. Bounded so a real attack still wins.

### Chunk 2 — handle bad / enemy state  *(checkpoint after)*

- **Break-a-charm (priority):** value attacking an `enthralled` *ally* = (break chance) ×
  (value of freeing: stop it acting against you + regain it). Requires a guarded exception
  to ally-targeting — **must not** leak into attacking non-charmed allies.
- **Don't-feed-the-snowball (cut-candidate):** a heavily-subordinate negative on a
  *non-lethal* hit against a grow-when-hit enemy (read from its reaction loadout). The
  cower-riskiest term — it must only break ties toward a non-accumulator; the AI still
  attacks the accumulator when it's the best or lethal option. If it proves cower-prone or
  low-value, drop it; break-a-charm is the higher-value half.

### Chunk 3 — carry triage  *(checkpoint after; first to throttle)*

- **killValue-weighted Math re-base** — the Calculator's field-wide targeting should weight
  actually-killing targets appropriately.
- **Close the dropped carries** in the blueprint + ADR (rather than carry them forever):
  Worldcraft move-then-cast, Perch-onto-created-perch, Calculator personality variants, and
  the MP-penalty-scope extension (playtest already mooted it). Layer-2 positional prediction
  folds into the future threat-model beat, not here.

## Acceptance criteria

- AI selects Steal Heart on a high-value valid target when its swing-value beats
  alternatives; does not Steal-Heart-spam over lethal plays (the 24-MP / ~31% gate should
  keep EV honest, but verify).
- AI values a buff-gain/Steal-Buffs subordinately — takes it when otherwise idle, but a
  genuine attack still outscores it.
- AI attacks a charmed ally to free it when break-value justifies; **never** targets a
  non-charmed ally.
- With don't-feed-snowball on: AI prefers a non-accumulator target only on a tie; still
  attacks an accumulator when best/lethal (cower-guard test).
- Calculator Math targeting weights kills correctly.
- LoS/Vantage/Barrier geometry documented in the handoff (+ ADR note); blueprint updated to
  mark this beat done, the threat-model deferred, and the dropped carries closed.
- Suite green; `tsc -b` + `vite build` clean; new ADR.

## Out of scope

- **The predictive positional threat-model** — avoid enemy reach, protect vulnerable units,
  position/deploy against threats. Deferred, expansion-driven. (Vantage's coverage-map
  read is its only down payment; leave it there.)
- Burst-CT valuation (Rapids Rush unshipped).
- Any Vantage/Barrier LoS **code change** — the investigation is report-only unless trivial
  and greenlit.

## Files (hedged — audit confirms)

The unified scorer / leaf scorers (the self-state terms); the AI ally-targeting path
(break-a-charm exception); a reaction-loadout lookup (grow-when-hit); the Calculator Math
scoring; the blueprint + ADR; Vitest specs throughout.

## Workflow notes

- Three chunks, checkpoint after each. **Throttle:** defer chunk 3 first; within chunk 2,
  don't-feed-snowball is the cut-candidate before break-a-charm.
- The **cower discipline is the cross-cutting risk** — every term here is a subordinate
  tie-break; the acceptance tests pin "a real attack still wins" for each.
- The investigation is report-only; flag at its checkpoint if the geometry suggests a tuning
  change worth Chris's call.

## Watch-fors

- **Cower** — the named failure mode for all three terms. Self-state and don't-feed-snowball
  especially must never make the AI passive or buff-itself-forever.
- **Break-a-charm leak** — guard hard against targeting non-charmed allies.
- **Charm over-valuation** — the AI shouldn't pass up lethal/decisive plays to charm; lean on
  the existing cost/land gates plus a bounded swing-value.
- **Investigation scope** — don't let the LoS report balloon into a Barrier-geometry refactor
  unless Chris greenlights from the findings.

## Estimated size

Medium. Three subordinate scoring terms composing on the MP-economy-term pattern; the
break-a-charm ally-targeting exception is the fiddliest piece; the carry triage and the
investigation are light. Smaller than a class, larger than the equipment pass.
