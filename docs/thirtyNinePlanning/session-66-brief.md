# Session 66 Brief — AI Capability Expansion: Knockback, MP Economy, Deployment

*DRAFT for Chris's plaintext review. Three decision points (D1–D3) need settling before
this goes to the implementer. See the AI capability-expansion blueprint for the arc frame
and the inherited constraints.*

## Context

The S56–61 scoring arc taught the AI damage, position, and Worldcraft. Content has since
out-run it: the scorer doesn't reason about knockback consequences, doesn't value MP as a
finite resource (the S65 rebaseline makes AI mages run dry where humans pace), and places
units arbitrarily at deployment. This session re-enters AI work to close three of those
gaps, in three checkpointed chunks. Intent is to attempt all three; the chunks are
independent enough to throttle in-line if size surprises.

All work is bound by the arc's inherited constraints (blueprint): single-move horizon,
offence first-class / non-damage strictly subordinate, compose on existing machinery.

## Inputs

- `ai-capability-expansion-blueprint.md` (arc frame, constraints, sequencing).
- ADRs: the S56–61 arc (0091–0094, esp. **0094 coverage map**), **0105 weaponType**,
  **0108 (S65)** for Bull Rush / knockback substrate and the MP rebaseline.
- The unified scorer (S57, ADR-0092) and its scored candidate pool.
- The Worldcraft fall scoring (ADR-0093) — knockback chunk composes on this.
- The three-resolver projection (live / AI / UI) for post-knockback landing tiles.
- Existing knockback resolution (Bull Rush, Hydrologist AoEs).

## Goal

Teach the AI three newer capabilities, checkpointed:
1. Value knockback for its **hazard/perch consequences**, riding fall scoring.
2. Value MP by **scarcity**, so it conserves when low without hoarding into uselessness.
3. Place units by **role** at deployment, using the coverage map.

## Pre-implementation plan (audit first — audit-overturns-spec expected per chunk)

Before building each chunk, audit current state; the engine may already cover more than
this brief assumes:
- **Knockback:** does the AI projection already compute the post-knockback landing tile,
  and does any Worldcraft-arc fall scoring already fire on knockback-induced falls? (If so,
  chunk 1 may be a thin wiring job rather than new evaluation.)
- **MP:** is there any MP-restore *action* the AI could choose (Ether-equivalent, a
  sustain cast), or is `mana_font` (Circlet) the only restore and purely passive? This
  decides whether chunk 2 is spend-conservation only or also restore-valuation.
- **Deployment:** what drives placement today (creation order? fixed tiles?), and is there
  any role classification, or must role be derived (weaponType is a candidate)?

Report audit findings at the chunk's checkpoint before implementing if they materially
change the chunk's shape.

## Implementation work

### Chunk 1 — Knockback usage  *(checkpoint after)*

When scoring a knockback ability, project the target's post-knockback tile and, if that
tile triggers a fall (Pit/Valley/off-perch), fold the resulting fall damage into the
action's value — reusing the existing Worldcraft fall scoring rather than re-deriving it.
Value the **expected** outcome (knockback chance × consequence), composing on the scorer's
existing probabilistic-effect handling (cf. Lightning Stab's Silence chance).

**D1 — does knockback value pure repositioning, or only damage-consequence?** A clean
shove into open ground deals no fall damage but still displaces the enemy (e.g. away from
your backline). My lean: **consequence-only for v1** (hazard/perch fall) — pure
displacement is non-damage positional value, which is the subordinate-term territory that
needs the careful treatment we're deferring to a later beat. Keeping v1 to fall damage
keeps it first-class and cheap. But your call.

### Chunk 2 — MP economy  *(checkpoint after)*

Add a **scarcity-scaled MP-spend term** to the unified scorer: an action's MP cost incurs
a score penalty scaled by how low the caster's current MP is. Plentiful MP → negligible
penalty (don't distort normal play); MP approaching empty → penalty rises so the AI grows
reluctant to spend its last MP on a marginal cast. The penalty is a **subordinate
modifier** — a genuinely high-value cast (lethal, big AoE) still wins through it; the
penalty only tips *marginal* casts toward conservation. If the audit finds an MP-restore
action, value it higher as MP drops.

**D2 — soft scaled penalty only, or also a hard floor?** The soft penalty makes
conservation emergent. A hard floor ("never spend below N MP unless the cast is
lethal/high-value") is a blunter guarantee against running fully dry. My lean: **soft
penalty only for v1** — it's the same soft-scaled shape the arc already uses, and a hard
floor risks the resource version of the cower problem (AI freezes up hoarding MP). Add a
floor later only if playtest shows the soft term isn't enough. Your call.

### Chunk 3 — Deployment role-aware sorting  *(checkpoint after — first to defer if throttling)*

At deployment, assign units to start tiles by role using the coverage map: melee/front-line
forward onto high-coverage tiles, ranged/casters back onto protected tiles with sightlines.
Separate subsystem from in-battle scoring.

**D3 — role taxonomy + classification source.** What roles, and what derives them? My lean:
a coarse **melee / ranged-or-caster** split for v1 (forward vs protected zones), classified
off **weaponType (ADR-0105)** — which would finally give that banked hook a consumer. A
richer taxonomy (tank / skirmisher / artillery / support) is possible but is more design
than this chunk wants. Your call on both the split and the classification input.

## Acceptance criteria

- **Chunk 1:** in a hand-built scenario (Knight adjacent to an enemy at a Pit edge), the
  AI selects Bull Rush over a plain attack when the fall payoff makes it the higher-scored
  action; selects the plain attack when no hazard is in the knockback direction. Tests
  assert the chosen action and that fall value is folded in at the knockback chance.
- **Chunk 2:** (A) a low-MP mage choosing between a marginal cast and a comparable 0-MP
  basic attack picks the free attack (conserves); (B) a low-MP mage with a high-value cast
  available still casts it (penalty stays subordinate). Both tests pass.
- **Chunk 3:** in a mixed-role deployment, melee units land in forward zones and
  ranged/casters in protected zones per the coverage map; test asserts the role→zone
  assignment.
- Full suite green; `tsc -b` + `vite build` clean. New ADR captures the three terms and
  the D1–D3 calls.

## Out of scope

- Multi-turn MP pacing / lookahead (violates the horizon).
- Stat-attrition / control valuation and burst-CT (future beats per the blueprint).
- Making any non-damage value first-class (subordinate only).
- Feel/visual tuning — that's Chris's post-ship playtest, not this session.

## Files (hedged — audit confirms)

The unified scorer and its candidate-pool scoring; the AI projection (post-knockback tile);
the deployment placement path and the coverage-map consumer; weaponType plumbing if it
becomes the role input; corresponding Vitest specs. ADR for the session.

## Workflow notes

- **Three chunks, stop-and-check after each** — checkpoint back through Chris/planner
  before moving on, especially if an audit reshapes a chunk.
- **Throttle order if size surprises:** defer chunk 3 first (separable, lowest leverage);
  reassess before narrowing chunk 2; chunk 1 is the cheap warm-up and should land.
- **D1–D3 settled by Chris before build.**
- audit-overturns-spec expected per chunk; the brief is over-specified so the audit can
  prune.

## Watch-fors

- **MP penalty must stay subordinate** — the resource version of the cower failure mode is
  an AI that hoards MP and stops casting. Acceptance test B guards this; watch it in tune.
- **Knockback must value consequence, not displacement for its own sake** — don't let the
  AI shove pointlessly, or shove an enemy to safety.
- **Probabilistic knockback (~79%)** — value the expected outcome; reuse existing chance
  handling, don't special-case.
- **weaponType (ADR-0105)** — if chunk 3 uses it, that's the banked hook retired; note it
  in the ADR.

## Estimated size

Large, but chunked and independent. Plausibly one session per Chris's prior experience;
the throttle valve (defer chunk 3) exists precisely if it isn't.
