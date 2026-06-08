# Session 56 Brief: AI High-Ground Awareness (Positional Substrate)

## Context

S55 closed the Terraformer playtest-fix/polish work. The roster has outpaced the AI for several sessions, and Terraformer + cross-class Worldcraft widened the gap — most of the deferred AI debt (Piece 6) is positional. This session opens the AI arc with its foundation: positional awareness, starting with high ground. It is the prerequisite that fixes the known "AI won't take high ground" behavior **and** gates all of Worldcraft Tier B (perch/wall/denial scoring). See the **AI Positional & Worldcraft blueprint**, Section 4, for the design; this brief implements it.

**Session character:** AI scoring/behavior work — closer in kind to the original tier-2 AI build (per the tier-2 projection ADR) than to the recent content/polish sessions. The defining trait: **the build shape is unusually audit-dependent.** If the move selector already has a tile-quality evaluation hook, this is a focused extension (Small–Medium). If move selection is pure "reach a tile in range to act," it needs a real per-destination scoring loop (Medium–Large). The audit resolves which, and the plan-review checkpoint matters more than usual here.

**Pieces shipping this session:**

1. **`ranged` tag (PREREQ, likely small).** A tag on weapons and/or command sets marking ranged-effect users (bows + offensive magic). The AI reads it to decide whether offensive height-seeking applies to a unit. Chris's read: quick to assemble. Audit confirms whether any equivalent already exists.
2. **Per-destination action-value move scoring (CORE).** The offensive height term. Make the move selector score each candidate destination by the best projected action value achievable *from* that tile, via the existing AI-projection resolver — so a ranged unit prefers elevation when it improves its best shot and declines it when it doesn't. Height falls out of the resolver's existing height-adjusted projection; the AI does not reimplement the +5→2× formula.
3. **Defensive above-melee-reach term (STRETCH, audit-gated).** Value standing above an attacker's melee vertical reach as incoming-damage reduction. Requires an incoming-threat model that may not exist; scope contingent on the audit (A4).

**AI Worldcraft scoring — all tiers — is explicitly out of scope.** This session is the existing roster on existing terrain.

Scope: **Medium, audit-variable** (see session character).

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`AI Positional & Worldcraft blueprint`** — Section 2 (core problem), Section 4 (this session's design), Section 7 (audit targets this brief expands on).
3. **The tier-2 AI ADR** (0033 per the content snapshot's reference list — confirm current number) — the scoring + projection contract this session extends. Especially the projection resolver's role and the existing `score = projectedDamage × killValue × (1 − reactionPenalty)` shape.
4. **`docs/handoff.md`** — S55 close.
5. **The AI move-selection module** (`src/ai/` — audit confirms exact file) — how destinations are currently chosen.
6. **The AI-projection resolver** (the projection half of the three-resolver set) — whether it can be invoked per-candidate-tile cheaply and whether it already reflects height for bows and magic.
7. **Weapon + command-set content** (`src/content/equipment/`, `src/content/abilities/`) — for the `ranged` tag.
8. **`content-snapshot.md` Section 8** — AI-side substrate notes (stale on roster, current on AI shape).

### Paths to survey before planning

This is the load-bearing section this session. Per audit-overturns-spec (10+ sessions running), and because the build shape is genuinely unknown pre-audit:

- **A1 — Current move-destination scoring.** Does the move selector evaluate tile quality at all, or only "is a target reachable/in-range from here"? Is there a hook (a per-destination score function, a candidate-tile ranking) to extend, or does scoring a destination by action-value require a new loop? *This single finding determines session size.* Likely shape: the selector enumerates reachable tiles and picks by proximity-to-target or first-that-enables-an-action; the gap is that it never asks "how good is my best action *from* here."
- **A2 — Projection resolver per-tile cost and height-awareness.** Can the AI-projection resolver be called for a hypothetical caster position cheaply enough to run across many candidate destinations × candidate actions? Does it already fold height into damage for bows? For magic? (Determines D2 and the performance watch.) If it reflects height for bows but not magic, that's a content/resolver question to surface.
- **A3 — Melee vertical range constant.** Confirm the implemented value (2 or 3). Sets the threshold the defensive term keys off.
- **A4 — Incoming-threat / danger model.** Does any model of "which enemies can hit this tile next turn" exist? Determines whether the defensive term (Piece 3) is reachable this session or defers (D1).
- **A5 — Existing `ranged` semantics.** Is there already a tag, weapon property, or targeting attribute that distinguishes ranged from melee that the tag can reuse rather than introduce? (e.g., range > 1, an existing weapon class, a command-set tag.)
- **A6 — FIFO cap eviction confirmation.** Confirm Worldcraft's cap reverts the *oldest* work (Chris's recollection; blueprint Section 5). **Not a blocker for this session** — Tier C dependency only. Fold the confirmation in now so it's settled before Tier C.

## Goal

End state:

**Core:**
- The AI move selector scores candidate destinations by best-projected-action-value achievable from each, using the existing projection resolver.
- A ranged unit (bow or offensive magic, per the `ranged` tag) **prefers an elevated destination when it improves its best shot** — more targets in extended range, or height-boosted damage on a reachable target.
- The same unit **declines elevation when it yields no payoff** — a peak with nothing in extended range does not draw the unit off a better position. (The conditional in blueprint 4.2: the term is marginal payoff, not elevation.)
- Move-and-shoot is preserved: gaining height that still allows acting the same turn is never discounted as a sacrificed turn; a turn-cost discount applies only when the height is reachable by move alone.
- The known "AI Hunter won't take Stonebridge high ground" behavior is resolved as a consequence.

**Prereq:**
- A `ranged` tag (or reused equivalent per A5) exists on weapons/command sets and keys offensive height-seeking.

**Stretch (audit-gated):**
- Most units value standing above an attacker's melee vertical reach as incoming-melee-damage reduction.

**Quality:**
- Tests +TBD (see Implementation work; behavioral scenarios dominate the count).
- New ADR likely *if* this introduces a new per-destination scoring loop (a real change to the AI's decision contract); none if it's a hook extension. Audit determines.
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` — AI positional-behavior watch (over-climbing / tempo loss; passivity regression).
- Vercel pre-flight discipline.
- **Browser verification critical.** Behavior tests assert the scoring math; only a real battle confirms the AI *feels* right. Watch a Hunter (or any bow user) on a map with high ground: does it take a perch that pays off and ignore one that doesn't?

## Pre-implementation plan

Audit-first. **Plan-review checkpoint after audit is mandatory and weightier than usual** — the architecture below is provisional and several decisions can't be made until A1/A2/A4 land.

### Required first step: current-tree audit

Per "Paths to survey." Audit deliverables:

1. **Move-scoring shape (A1)** — reachability-only vs. tile-quality hook. Recommend the cleanest extension point. **Sizes the session.**
2. **Projection per-tile feasibility + height-awareness (A2)** — confirm the resolver can be driven per-candidate-position, and what it reflects for bows vs. magic.
3. **Threat-model presence (A4)** — present or absent; gates the stretch.
4. **`ranged` reuse vs. new (A5).**
5. **Melee vertical range (A3)** and **FIFO confirmation (A6).**

### Architectural decisions (provisional — audit-gated)

After audit:

1. **Per-destination action-value term.** Recommend: extend move-destination scoring to compute, for each candidate tile, the best projected action value achievable from it (best action × best target, via the existing projection resolver), and fold that into the destination score. Reuse the act-side projection rather than a parallel path — the three-resolver discipline is the point; a parallel height-scorer would be the anti-pattern. If A1 finds no per-destination hook, this is the new loop and likely warrants an ADR.
2. **`ranged` tag.** Recommend: a tag the AI reads to gate offensive height-seeking. Reuse an existing distinction if A5 finds one; otherwise add to weapon + command-set data.
3. **Weighting — first-class.** The projected-action-value term enters the destination score directly, able to override a marginal immediate action for a materially better position. The exact blend (how the positional term composes with whatever the move selector already optimizes) is for the implementer to shape against the live scorer — the brief fixes the *intent* (first-class, payoff-conditional), not the coefficients.
4. **Defensive term (stretch).** Only if A4 finds a usable threat model. Recommend: a destination above the melee vertical reach (A3) of enemies that could otherwise reach it reduces projected incoming melee, contributing positively to the destination score. If no threat model exists, defer cleanly — do not build one speculatively this session.

### Decision points

**D1 — Session scope: offensive core only, or include the defensive term?** Recommend offensive core as the spine (Piece 2 + the `ranged` prereq), defensive term as stretch contingent on A4. This was the blueprint's recommendation; carrying it as the working assumption. *Chris to confirm or promote the defensive term to core.*

**D2 — Magic's offensive height benefit.** Gated on A2. If the resolver gives magic a height-boosted projection (range and/or damage), `ranged`-tagged casters seek height offensively for free through the per-destination projection. If it gives magic nothing from height, casters seek height defensively only and the `ranged` offensive gate effectively means bows. *No new formula either way — this is "what does the resolver already do," surfaced for Chris once A2 lands.*

**D3 — ADR or not.** If Piece 2 is a new per-destination scoring loop (a change to the AI decision contract), recommend an ADR capturing the move-scoring model. If it's a hook extension, no ADR. Audit + plan-review settles.

**D4 — `ranged` tag scope.** Whether the tag also needs to encode *which* ability/weapon benefits (e.g., a bow benefits from height differently than a thrown item) or whether a boolean ranged/not is enough for this session. Recommend boolean for now; refine when Worldcraft Tier B needs finer perch valuation. Plan-review confirms.

## Implementation work

Ordered: prereq, then core, then stretch. Provisional pending audit.

### 1. `ranged` tag (PREREQ)

- Audit confirms reuse vs. new (A5).
- If new: add tag to weapon and/or command-set content; populate for bows and offensive-magic command sets.
- AI reads the tag to gate the offensive height term.
- Tests: tag present on expected kits; absent on melee-only kits. ~3-5 tests.

### 2. Per-destination action-value move scoring (CORE)

- Audit confirms the extension point (A1) and projection feasibility (A2).
- Extend move-destination scoring to evaluate best-projected-action-value per candidate tile via the existing resolver.
- Gate the offensive contribution on the `ranged` tag.
- Preserve move-and-shoot: same-turn action value is compared across destinations; no turn-cost discount unless the tile is move-only-reachable.
- Performance: prune candidate destinations and/or candidate actions if the per-tile × per-action projection is costly (see watch-fors). Audit/implementer judges the pruning strategy.
- Tests — behavioral scenarios are the bulk:
  - Bow unit, enemy reachable from both a low tile and a higher tile in extended range → AI selects the higher tile. (positive)
  - Bow unit, height available but no enemy in extended range from it → AI does **not** climb off a better position. (negative — the conditional)
  - Bow unit, higher tile is move-only (can't also shoot) vs. lower tile allows move+shoot this turn → AI does not over-value the unreachable-this-turn height. (move-and-shoot)
  - Melee-only unit → tag absent → offensive height term does not fire. (gating)
  - Regression: no general passivity — units with a strong immediate action still take it rather than wandering toward height. (anti-over-correction)
  - ~12-18 tests, scenario-heavy.

### 3. Defensive above-melee-reach term (STRETCH)

- Only if A4 finds a usable threat model.
- A destination above the melee vertical reach (A3) of enemies that could reach it reduces projected incoming melee → positive destination contribution.
- Tests: unit above attacker's vertical reach scores the safer tile higher; equal-elevation case unaffected. ~5-8 tests if pursued.

### Tests (total)

Estimated +20-30 if offensive-core only; +28-38 if the defensive stretch lands. Scenario tests dominate. Final count audit-dependent.

### UI / behavior surfaces

- In a real battle, ranged units take advantageous high ground and decline pointless high ground.
- The Hunter-on-Stonebridge behavior is visibly fixed.

## Acceptance criteria

**Core:**
- Move selector scores destinations by best-projected-action-value (unit-tested via the scenarios above).
- Ranged unit takes payoff high ground and declines no-payoff high ground (unit-tested + browser-verified).
- No passivity regression — strong immediate actions still fire (unit-tested + browser-verified).

**Prereq:**
- `ranged` tag (or reused equivalent) present and gating the offensive term correctly.

**Stretch (if pursued):**
- Defensive above-reach term contributes; otherwise cleanly deferred and documented.

**Quality:**
- Tests green, 0 failing.
- ADR added if Piece 2 is a new scoring loop (per D3).
- Docs updated (handoff, playtest-watch).
- Vercel pre-flight clean.
- Browser verification: ranged unit high-ground behavior, both the take-it and decline-it cases.

## Out of scope

- **AI Worldcraft scoring — all tiers (A/B/C).** This session is the existing roster on existing terrain. Tier A (Pit/Valley fall damage), Tier B (perch/wall/denial), Tier C (revert traps) all follow.
- **Worldcraft mechanics changes.** None.
- **Default team templates with Terraformer** — content session, standing carry.
- **Calculator team template revision** — standing carry.
- **Marshmoor template-compliance tests** — standing carry.
- **Calculator AI personality variants** — relevant to the temperament dial (blueprint Section 8) but not this session.
- **Math Skill SP scaling review** — watch-for, not this session.
- Cosmetic carries (lightning-mage.ts header, audit-draft archival).

## Files likely touched

Non-exhaustive; audit confirms / corrects.

**Prereq:**
- `src/content/equipment/*` and/or `src/content/abilities/*` — `ranged` tag (audit: which surface).

**Core:**
- The AI move-selection module (`src/ai/` — audit confirms file) — per-destination action-value scoring.
- The AI-projection resolver — possibly a per-position invocation helper, if not already exposed.

**Stretch:**
- AI threat/danger model (path TBD by A4) — defensive term.

**Tests:**
- `src/test/session-56-ai-high-ground.test.ts` (or split offensive/defensive).
- Existing AI behavior fixtures may need updates if destination selection changes.

**Docs:**
- `docs/handoff.md` — session close.
- `docs/playtest-watch.md` — positional-behavior watch.
- A new ADR if D3 resolves toward one.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first with a weighted plan-review checkpoint.** More than usual rides on the audit (A1 sizes the whole session); do not commit to the build shape before plan-review.
- **Prereq, then core, then stretch.** The `ranged` tag is small and unblocks the core. The defensive stretch only if A4 supports it.
- **Browser verification critical.** Scoring tests assert the math; only a real battle confirms the AI feels right and isn't over-climbing or going passive.
- **Vercel pre-flight discipline.** Per standing carry.
- **Mid-session design questions** route through Chris. Most likely surfaces:
  - The first-class weighting blend (how the positional term composes with existing move optimization).
  - Magic's offensive height behavior once A2 lands (D2).
  - Whether the new loop warrants an ADR (D3).
  - `ranged` tag granularity (D4).

## Watch-fors

**Addressed this session:**
- AI high-ground awareness (offensive; defensive if stretch lands).
- The Hunter-won't-take-high-ground behavior.
- `ranged` tag.

**Not addressed — longer-term carry-forward:**
- AI Worldcraft scoring, all tiers (this session is the prerequisite).
- The temperament dial (future-vs-greedy weight) — surfaces here as the first-class weighting call; recurs for Worldcraft tempo and Calculator personality variants.
- All standing carries.

**Watch-fors specific to this session:**

- **Over-climbing / tempo loss.** First-class positional weighting risks the AI abandoning a good immediate action to chase marginal height. The conditional (payoff-only) should prevent it, but watch playtest for units wandering uphill instead of fighting. If it over-corrects, the blend (not the conditional) is the dial to turn.
- **Passivity regression.** Related but distinct: confirm the AI still commits to strong immediate actions. A bow unit that can kill *now* should not climb first. The negative-case and regression tests guard this; browser play confirms.
- **Projection cost.** Best-action-value per candidate destination is combinatorially heavier than the current scorer (destinations × actions × targets). Watch evaluation time, especially for high-Move units on open maps and for the AI's full deployment. Pruning candidate destinations or short-circuiting clearly-dominated tiles may be needed; flag if turn evaluation slows noticeably.
- **Magic vs. bow asymmetry (D2).** If the resolver reflects height for bows but not magic, casters tagged `ranged` will seek height offensively yet gain nothing — a behavior bug masquerading as a scoring choice. Confirm A2 before trusting caster height-seeking.
- **Three-resolver drift.** The whole point is reusing the projection resolver for destination scoring. If a parallel height-scoring path creeps in, live/projection/forecast can diverge. Watch that destination scoring routes through the same resolver the act-side uses.
- **Deployment-phase interaction.** If the move-scorer's positional term also influences (or should influence) initial deployment sorting, note it — deployment role-aware sorting is a separate carry, but the two share "value of a position." Don't scope-creep into deployment, but flag any coupling discovered.

## Estimated size

**Medium, audit-variable.** Offensive core + `ranged` prereq is the spine. Defensive term is stretch.

**Size hinges on A1:**
- Tile-quality hook already exists → focused extension, **Small–Medium.**
- Move selection is pure reachability → new per-destination scoring loop (+ likely ADR), **Medium–Large.**

**Split contingency if budget tightens:**
- `ranged` tag + offensive core = the must-ship spine.
- Defensive term = drop first.
- ADR (if needed) and playtest-watch entries = keep regardless.

**Stretch indicators** (opportunistic, only if core lands early):
- Defensive above-reach term.
- Note any deployment-sorting coupling for a future brief (don't build).
