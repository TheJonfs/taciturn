## ADR-0123: AI tuning — MP-bottleneck gate + buff-aware cohesion

**Status:** Accepted
**Date:** 2026-06-23

## Context

Two narrow playtest-surfaced tunes, both refinements to the AI's existing
(good) advance-to-engage behavior — not a rebuild. Neither adds substrate;
both compose on the unified scorer (ADR-0092/0109) and the move-destination
scorer.

1. **A self-restore softlock.** The S66 MP-economy term (ADR-0109) values
   restoring MP purely by how low the recipient's pool is (`mpScarcity`),
   regardless of whether the recipient's best play actually *needs* MP. That
   produces a loop for an MP-light unit that can also *manufacture* MP: a
   low-MP Alchemist whose only offense is the 0-MP bow, holding an Ether,
   scores a self-Ether throw above advancing and loops. The loop is
   self-sustaining — Compound costs 10 MP (`ether.compoundMpCost`) and Throw
   restores PA × 4 (= 32 for an 8-PA Alchemist), so it more than refills.

2. **An AoE-buffer's team scatters.** A team fielding the Enchanter
   (Auramancy: diamond-1 ally buffs) advanced scattered, so the buff landed
   on one ally instead of several. The casting side works (S72); the
   receiving-positioning side was untuned.

The **predictive positional threat-model** (avoid reach, protect units,
deploy against threats) stays deferred; per Chris's design call its
camping/high-ground half is *unwanted* — the AI advancing to engage rather
than turtling a ridge is a feature. Both tunes preserve the aggressive
advance-to-engage default. The two decision points were settled by Chris
before build.

## Decisions

### Chunk 1 — MP-bottleneck gate (the loop fix)

`mpBottleneckFactor(state, catalog, unit) ∈ {0, 1}` gates the Ether
restore-valuation on whether MP is a genuine bottleneck for the
**recipient's** kit, keyed on the kit (not current MP, not the actor).

- **Mechanism (D1: compare best MP-free vs MP-gated play).** Returns 1 when
  the recipient has any MP-gated heal or ally-buff (support has no free
  substitute), any MP-gated debuff-only offensive (same), or MP-gated damage
  whose `power_coefficient` exceeds its best MP-free damage. Otherwise 0 — a
  bow Alchemist (only offense is the 0-MP bow; items cost no MP) has no MP
  bottleneck, so restoring its MP scores 0 and it advances instead of
  looping. Alternatives weighed and rejected: a "has-any-MP-ability"
  heuristic (too coarse — wouldn't distinguish a unit that *prefers* its free
  bow) and an Alchemist-specific narrow fix (leaves the same latent bug for
  any future MP-light unit).
- **General, not Alchemist-specific (D1 breadth).** Correct for any unit and
  cheap; nothing legitimate breaks because the gate keys on "is MP my
  bottleneck," never "am I low on MP." A low-MP MP-dependent caster keeps
  factor 1, so it still values restoring MP it will spend — no
  over-correction.
- **Range-independent by construction** (it inspects the kit, not reachable
  targets), so it gates correctly while the unit is advancing to engage —
  exactly when no offensive scores this turn and the bare Ether-throw would
  otherwise win the pool.
- **Seam.** Applied inside `bestThrowCandidate`'s Ether branch — the single
  place restore is valued — multiplying the per-ally restore value (`continue`
  at factor 0). The offense-side MP-*spend* penalty (ADR-0109) is untouched,
  per the brief's scope.
- Proved by a constructed deterministic repro
  (`session-73-mp-bottleneck.test.ts`): an Alchemist at low MP with an Ether
  and an enemy parked beyond one-move bow reach advances instead of
  self-throwing. The live battle never needs re-creating; the test is the
  fix's verifier. S66's Ether-restore fixture updated to give its recipient a
  real spell loadout (an empty-loadout mage genuinely can't spend MP, and
  rightly scores 0 under the gate).

### Chunk 2 — buff-aware cohesion

A subordinate cohesion term in the move-destination scorer's **pure-advance
regime**: when the team fields an AoE-buffer, among advance destinations
within `COHESION_BAND` tiles of the best forward progress, prefer the one
nearest the buffer.

- **Banded, not weighted (mechanism).** Under Manhattan movement a mild
  distance-blend (`distanceToPriority + w · distanceToBuffer`, w < 1) is
  near-inert: moving toward a perpendicular buffer costs enemy-distance 1:1,
  so a sub-unit weight can never justify it, and the frontier min tile is
  unique so a pure tiebreak never fires. A *band* — accept a tile up to
  `COHESION_BAND` less forward if it is nearer the buffer — is what actually
  clusters. `COHESION_BAND = 1` (playtest dial).
- **Bounded → can't stall (D2: start mild).** The band caps the
  forward-progress sacrifice at one tile, so the team still closes ≥
  moveRange − 1 per turn — it advances grouped, it never sits and waits.
- **Subordinate by construction.** Applied only when the actor is purely
  advancing: no attack reachable from any tile (`bestOffensiveScore === 0`)
  and not a height-seeker chasing a perch (`!positionalActive`). Combat tiles
  and the Hunter's high-ground approach are left untouched, so cohesion never
  overrides engaging, chasing a kill, or earning elevation.
- **Inert without a buffer.** `cohesionAnchor` is null when the team fields no
  AoE-buffer, so `distanceToBuffer` is 0 for all tiles and the selection is
  byte-identical to before — non-Enchanter teams are unchanged (the full
  pre-existing suite passes untouched).
- **Detection.** `isAoeBuffer` = a unit with an active ability that applies a
  buff status (`aiHints.polarity: 'buff'`) over an `effects.aoe` footprint —
  the Enchanter's Auramancy. `cohesionAnchor` picks the nearest such ally
  (lex-id tiebreak), excluding the actor (so the buffer itself doesn't anchor
  on itself; it advances normally and centers its cast on the cluster).
- **Scoping (flagged).** v1 anchors cohesion on the buffer's *current*
  position (a clustering proxy), not a predicted prospective-AoE footprint,
  and gates the buffer itself out. A tighter "within the buffer's projected
  AoE" measure and a buffer-side stay-near-beneficiaries term are deferred —
  the mild proxy is enough for the receiving-side scatter the brief targets.

## Consequences

- Both tunes ride the existing scorer; no new hooks, action types, or
  special-cases. `mpBottleneckFactor`, `isAoeBuffer`, `pickBestMove` are
  exported under `_basicAiInternals` for unit-level tests.
- **Feel is unverified** — all validation is unit-test-only (the PixiJS
  harness can't drive both-AI battles since S70). The over-cluster watch and
  the no-loop confidence both want Chris's in-battle pass; see
  `docs/playtest-watch.md`.
- `COHESION_BAND` is the cohesion-strength dial. Raising it tightens packing —
  watch enemy-AoE clustering, since the AI still can't weigh enemy AoE threat
  (the deferred positional threat-model) and over-packing would feed it.

## Alternatives considered

- **Gate breadth — Alchemist-specific (D1 no):** narrower, but leaves the
  latent bug for any future MP-light unit. The kit-keyed gate is general and
  cheap.
- **Has-any-MP-ability gate (D1 no):** coarser — wouldn't distinguish a unit
  whose best play is its free attack from one whose paid play is genuinely
  better.
- **Weighted distance-blend cohesion (chunk 2 no):** near-inert under
  Manhattan movement at a mild weight, or stall-prone at a strong one. The
  band is bounded and tunable without that failure mode.
- **Cohesion in the joint planner / combat regime (no):** the joint planner
  only produces plans where an Act is reachable; the scatter happens during
  pure advance, which falls to `pickBestMove`. Keeping cohesion out of the
  combat regime is what makes it subordinate.
