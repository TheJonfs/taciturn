# AI Capability-Expansion Blueprint

*Durable multi-session reference, sibling to `ai-positional-worldcraft-blueprint.md`
(the S56–61 arc). That arc taught the scorer damage, position, and Worldcraft. Since
then, content has out-run the AI again — the roster gained strategic dimensions the
scorer doesn't comprehend. This blueprint scaffolds the effort to close that gap.*

## Inherited constraints (non-negotiable — carried from the first arc)

- **Single-move horizon.** No multi-turn planning. Every new term must be evaluable
  from the current move alone. Resource/tempo "pacing" must be reframed as per-action
  valuation, never lookahead.
- **Offence first-class; non-damage subordinate.** Damage/kill value may dominate the
  score. Non-damage value — displacement, MP conservation, control, stat deltas — must
  be a SUBORDINATE modifier/tie-break, never a first-class goal. (The cower-term lesson:
  a first-class defensive term turned the AI passive.)
- **Compose, don't special-case.** Extend the unified scorer's candidate pool, the
  coverage map, and the three-resolver projection. New dimensions ride existing
  machinery (knockback rides Worldcraft fall scoring; MP rides the scored pool).
- **Cadence.** Substrate → playtest → tune → playtest. Automated tests validate AI
  *decisions*; *feel* needs Chris's browser pass (the PixiJS harness can't drive battles).

## The dimensions (the gap), by leverage-per-cost and tractability

### Session 66 — scoped (this beat)
1. **Knockback usage** — value knock-into-hazard / off-perch, riding fall scoring.
   Cheap, offensive, low-risk. The clean re-entry.
2. **MP economy** — scarcity-scaled MP-spend penalty so the AI conserves when low and
   values a top-up when able. The motivating dimension (the MP rebaseline makes AI
   mages run dry). Tractable as per-action valuation; NOT pacing.
3. **Deployment role-aware sorting** — place units by role using the coverage map.
   Separable pre-battle subsystem; the cuttable tail. Candidate first consumer of the
   banked `weaponType` hook (ADR-0105) for role classification.

### Future beats — deferred, with reasons
- **Stat-attrition / control valuation** (Brine −Speed, Combat Focus, offensive Stop) —
  HARD. Non-damage, diffuse payoff; must be valued as a subordinate term without
  recreating the cower problem. Its own session.
- **Burst-CT value** (Rapids Rush) — premature; the ability isn't shipped.
- **Standing AI carries (S61):** Layer-2 positional prediction; Worldcraft
  move-then-cast; killValue-weighted Math re-base; Perch move-onto-created-perch;
  Calculator AI personality variants.

## Sequencing logic
Knockback and MP both touch the in-battle scorer → done together (one dive). Deployment
is a separate subsystem → last, and first to be cut if size surprises. MP is the
priority of the three; if throttling hits, defer deployment before narrowing MP scope.
