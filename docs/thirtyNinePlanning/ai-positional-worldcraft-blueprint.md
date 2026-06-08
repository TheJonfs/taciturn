# AI Positional Awareness & Worldcraft Scoring — Design Blueprint

*Planner-thread draft. Stable reference for the multi-session AI arc that closes Piece 6 (the largest greenfield work in the project). Per-session briefs hang off this; decision points (D-marked) settle on review, audit targets resolve in the implementer's pre-implementation survey.*

---

## 1. Purpose

The roster has outpaced the AI for several sessions, and Terraformer + cross-class Worldcraft widened the gap. This blueprint captures the design for the arc that pays that debt down: teaching the AI positional reasoning, then terrain-creation reasoning. It exists because the arc is multi-session and genuinely novel — the existing scorer has nothing like the reasoning Worldcraft needs — so the design should live somewhere durable rather than only in successive briefs.

---

## 2. The core problem

The tier-2 scorer is greedy-immediate:

```
score = projectedDamage × killValue(target) × (1 − reactionPenalty)
```

It scores "which ability, on which target, right now," and is explicitly insensitive to actionSpeed and nearly blind to position. Worldcraft's value is the opposite of what that measures: **deferred, positional, and team-relative.** A Pillar does no damage and kills no one; its worth is "a tile is now elevation +4, and next turn my bow unit standing there gets range and a damage bonus."

The load-bearing realization: **the AI cannot learn to create good terrain before it can value standing on good terrain.** The known "AI Hunter won't take Stonebridge high ground" bug is the canary — it's the same missing capability as "no Worldcraft scoring," at two different levels. Fix the foundation first.

---

## 3. Arc shape

**Positional awareness → terrain creation.** Worldcraft scoring decomposes into three tiers by how far each work sits from the existing damage paradigm:

- **Tier A — Pit / Valley as fall damage.** Immediate, occupant-paid harm. Fits the existing damage scorer with two additions: fall magnitude is elevation-aware (a drop on already-low ground pays little; the AI must read current elevation), and Valley needs AoE-plus-friendly-fire handling (it drops your own clustered line as readily as theirs). Largely independent — an early win that makes the destructive works competent without any terrain understanding.

- **Tier B — Pillar / Hill / Barrier as positional creation.** Perch value, wall/denial value, line-of-sight denial. Requires the positional-awareness substrate (Section 4) — and that same substrate fixes the Hunter bug. This is the prerequisite that gates the rest.

- **Tier C — Pillar / Hill as revert-triggered traps.** The hardest: model the cap queue, predict *when* a raise reverts, evaluate who's riding it then (including not dropping your own ally). FIFO-dependent (Section 5). Novel reasoning the current scorer has no analog for.

Pillar and Hill appear in both B and C: the same cast is simultaneously a perch (positional) and a loaded trap (deferred), and a strong AI eventually scores both channels plus the team-relative tension — the perch I build for my Hunter is one the enemy Hunter can steal.

**Build order:** positional substrate (Section 4) → Tier A → Tier B → Tier C. Each stage is independently testable before the next lands; this de-risks the multi-session estimate.

---

## 4. Session 1 — High-ground awareness (the positional substrate)

**Thesis.** Enrich the AI's *move-destination* scoring with positional value, starting with high-ground-for-ranged, so the AI seeks height when it converts to a real payoff and declines it when it doesn't.

Worldcraft is **explicitly out of scope** for this session. The deliverable is the foundation everything else builds on, validated against the existing roster (does the Hunter take Stonebridge now? does it decline a peak with no one in range?).

### 4.1 Height value channels

1. **Offensive (ranged users — bows and magic).** High ground extends horizontal range and boosts damage shooting downward. Engine anchor: a **+5 height advantage over the target doubles the damage**. Keyed off a `ranged` tag on the weapon or command set.

   *Architectural move:* the AI does **not** reimplement the height formula. The +5→2× scaling already lives in the engine, and the AI-projection resolver (the shared three-resolver discipline) already computes height-adjusted output. So the offensive term falls out of one change — make the move-scorer evaluate **best-projected-action-value per candidate destination** via the existing resolver, rather than "can I reach a target from here." A higher tile yields a higher projection because the resolver knows it does. This is a smaller lift than it appears.

   *Move-and-shoot is encoded for free:* because destinations are compared by same-turn action value, no turn is ever sacrificed to gain height. A turn-cost discount enters only when the height is reachable by move alone (out of move+act range) — exactly the right place for it.

2. **Defensive (most units, mages especially).** Melee carries a vertical range of 2 or 3 (confirm — A3), so standing above that reach protects from melee entirely. This is the genuinely *new* modeling: it needs an incoming-melee-threat model ("which enemies could reach me here, and does my elevation put me above their vertical reach"), which the AI may not have today. Higher lift than the offensive term; scope depends on the audit.

3. **Fall risk (knock-off / Pit beneath).** Real but small — a second- or third-order consideration. Deferred for the AI; do not model in Session 1.

### 4.2 The conditional — "when high ground is NOT useful"

This is the actual design content, and the harder half. The term is **not** elevation; it's the **marginal payoff the position unlocks for this unit's kit**: enemies brought into extended range, height-boosted damage on reachable targets, a denied or safer angle. A bow unit on a peak with nothing in extended range scores ~0 offensively and should decline the climb. The per-destination-projection framing in 4.1 produces this naturally — an empty peak yields no better projection than flat ground, so it isn't preferred.

### 4.3 Weighting

High-ground value is **first-class** (Chris's call), not a tiebreaker or fallback. It can override a marginal immediate action to take a materially better position. This is the most complex thing to define algorithmically and the actual form is for the implementer to shape against the live scorer; the blueprint fixes the *intent* (first-class, payoff-conditional, offensive term via per-destination projection) and the engine anchor (+5→2×).

This same temperament dial — how much future-positioning outweighs greedy-now — recurs through the whole arc. It later governs "spend a turn building a Pillar instead of attacking," and it connects to the deferred Calculator AI personality variants (Aggressive/Conservative).

---

## 5. Worldcraft mechanical reference (for AI design)

First Action; tile-targeted; instant cast; Arc, range 4. Cadets hold **two** works by default, **four** with Expert Former.

**Cap eviction is FIFO — the *oldest* work reverts when the cap is exceeded.** (Chris's recollection; **verify with implementer — A6**. The carryover insights doc said "LIFO"; treat the guide/Chris as authoritative pending confirmation.) Consequence for play and for Tier C: lay traps early and keepers late — your most recent works endure while older ones revert first.

| Work | MP | Footprint | On cast | On revert |
|---|---|---|---|---|
| **Pillar** | 8 | single tile, +4 | harmless | rider rides it down, takes the fall |
| **Pit** | 8 | single tile, −4 | occupant pays the fall **at once** (deepest immediate harm in the set) | raises gently, free |
| **Hill** | 16 | 3×3 raise | harmless | drops; riders fall (center 3 / cardinal 2 / corner 1) |
| **Valley** | 16 | 3×3 drop | occupants pay the fall **at once**, friend and foe | raises gently, free |
| **Barrier** | 12 | 3–5 walls, no elevation change | impassable + blocks line of sight; HP = **PA × MA**; stand until broken or spent | — |

**Raise / drop asymmetry (the design's spine):** raises (Pillar, Hill) are harmless on cast and harmful on revert — deferred, conditional traps. Drops (Pit, Valley) are harmful on cast and harmless on revert — immediate harm. Barrier carries no fall at all.

**Non-uniform 3×3:** center 3 / cardinal 2 / corner 1, for both Hill (revert fall) and Valley (cast fall). Valley's center pays the biggest immediate fall; a reverting Hill drops its center riders hardest. Fall magnitude on any tile is bounded by current elevation (a drop can't go below the floor).

---

## 6. Decision points

- **D1 — Session 1 scope boundary: offensive-only core, or include the defensive term?** Recommendation: ship the offensive core (4.1.1, the per-destination-projection change) as the spine, treat the defensive term (4.1.2) as a stretch contingent on what incoming-threat substrate the audit finds. Gated on A4. *Chris to confirm appetite.*
- **D2 — Magic's offensive height benefit.** Bows clearly get range + damage. Whether magic gains range, damage, both, or only the defensive channel from height is partly a factual question about the engine (A2) and partly a design call about whether `ranged`-tagged casters should *seek* height offensively. If the engine gives magic no offensive height benefit, the design question dissolves and casters seek height defensively only.

---

## 7. Audit targets for the Session 1 brief

- **A1 — Current move-destination scoring.** Reachability-only, or is there any tile-quality evaluation / a hook to extend? (Audit-overturns-spec bet: there's probably more here than assumed.)
- **A2 — Does the AI-projection resolver expose per-tile best-action-value cheaply,** and does it already reflect height for both bows and magic? Determines D2.
- **A3 — Implemented melee vertical range (2 or 3).** Sets the defensive height threshold.
- **A4 — Incoming-threat / danger modeling.** Does any exist? Determines whether the defensive term is in reach for Session 1 (D1).
- **A5 — The `ranged` tag.** Does it exist on weapons / command sets, or is it new? Chris's read: quick to assemble. Confirm and decide whether assembling it is part of Session 1 or precedes it.
- **A6 — FIFO cap eviction.** Confirm oldest-reverts. Tier C dependency, not a Session 1 blocker — fold in now so it's settled well before Tier C.

---

## 8. Parked — later-arc decisions

- **Tier A:** elevation-aware fall projection; Valley AoE + friendly-fire penalty; whether Pit/Valley reuse the damage-scoring path or get a parallel fall-damage scorer.
- **Tier B:** Barrier denial scoring (pathing-delta + LoS-delta); perch value as a function of `ranged`-kit; the team-relative "this perch helps both sides" tension.
- **Tier C:** cap-queue model; revert-timing prediction; "who rides it when it falls," including refusing to drop your own ally.
- **Temperament dial:** the single future-vs-greedy weight that governs height-seeking, terrain-building tempo, and Calculator personality variants. Worth treating as one tunable concept rather than re-deriving per feature.

---

*End of blueprint. Sits alongside the Session 1 brief when this goes to the implementer.*
