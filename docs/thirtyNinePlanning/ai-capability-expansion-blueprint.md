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

### Session 69 — scoped (DONE, ADR-0116)
The self-state beat — the tractable, reactive/current-state half:
1. **Gain a good state** — Steal Heart charm swing (damage-output proxy ×
   duration × contest chance) + Steal Buffs transfer. Self-buffs needed no new
   term (the only chooseable ones already score via the ally-buff path).
2. **Break a bad state** — break-a-charm: attack an `enthralled` ally to free
   it, guarded to never leak onto a non-charmed ally.
3. **Carry triage** — killValue-weighted Math re-base (closes ADR-0092's
   limitation); dropped carries closed (below).

The **don't-feed-the-snowball** term was deferred entirely (Chris's call): the
brief's cut-candidate, most cower-prone, lowest-value — it folds into the
threat-model beat.

### Future beats — deferred, with reasons
- **Predictive positional threat-model** — avoid enemy reach, protect vulnerable
  units, position/deploy against threats; plus don't-feed-the-snowball. The
  remaining large AI gap; **expansion-driven** (deferred to the major-expansion
  conversation). Vantage's coverage-map read (ADR-0115) is its only down payment.
- **Stat-attrition / control valuation** (Brine −Speed, Combat Focus, offensive Stop) —
  HARD. Non-damage, diffuse payoff; must be valued as a subordinate term without
  recreating the cower problem. Its own session.
- **Burst-CT value** (Rapids Rush) — premature; the ability isn't shipped.

### Closed carries (no longer tracked — S69)
The long-standing S61 standing-AI carries are resolved or folded:
- **killValue-weighted Math re-base** — DONE (S69, ADR-0116).
- **Layer-2 positional prediction** — folded into the deferred threat-model beat.
- **Worldcraft move-then-cast**, **Perch move-onto-created-perch** — closed as
  out-of-scope for the single-move utility-candidate boundary; revisit only if a
  future move-aware utility pass is scoped.
- **Calculator AI personality variants** (Aggressive/Conservative, Brief D8) —
  closed; the single max-EV scorer suffices, no demand surfaced.
- **S66 MP-penalty scope extension** (to heal/Math/Worldcraft) — closed; playtest
  mooted it (the soft offence+buff penalty was enough).

## Sequencing logic
Knockback and MP both touch the in-battle scorer → done together (one dive). Deployment
is a separate subsystem → last, and first to be cut if size surprises. MP is the
priority of the three; if throttling hits, defer deployment before narrowing MP scope.
