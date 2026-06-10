# Session 60 Brief: arc→straight_line LoS pivot + Barrier denial

## Context

S59 shipped the coverage map + defensive term + Tier C, and validated initially (2-1 mirror split, ~1s perf). Barrier denial was deferred for a content reason: its line-of-sight lever is **inert** — every ranged *damage* attack is `arc` (lobs over walls), so a barrier currently blocks nothing damaging. This session does the **content pivot** that makes LoS meaningful, then builds **Barrier denial** on top.

**The content pivot is a shared design decision, structured as a gate.** The implementer catalogs the ranged attacks (it can check how they all resolve in code far faster than we can reason abstractly — Chris's call); **Chris makes the arc→straight_line cut** from that catalog; the implementer applies it. The cut is **not autonomous.**

**Two things make this more than a small enabler:**
1. The cut has **balance reach beyond Barrier.** Flipping bows to `straight_line` changes *all* ranged combat — cover (terrain, units, barriers) starts mattering to every archer, and it interlocks with the high-ground bow play shipped in S56. That's the biggest lever and likely wants its own playtest.
2. **The cut's breadth determines the session split** (the audit-determines-split pattern). A broad cut (bows) is a meta change that should be validated before Barrier denial builds on it → S60 = cut + playtest, Barrier → S61. A narrow/spice cut → bundle cut + Barrier denial in S60. Chris's call at the gate decides which.

The 4th and final threat-model consumer — **role-aware deployment sorting** — remains out of scope; it's the clean next-after-Barrier item.

Scope: **Medium–Large, gate-variable** (the cut's breadth sets it).

## Inputs (read first)

1. **`CLAUDE.md`** — conventions.
2. **Blueprint** — S59 status (the "Barrier denial is a content problem" insight; the ~1s perf baseline), §3 (threat model / four consumers), §4.1.2.
3. **`docs/decisions/0094`** (coverage map — `buildCoverageMap`, `threatsToTile`, **`withBarrier`** hypothetical, the `validate.ts`-mirrored reach/LoS path) and **`0095`** (defensive term).
4. **`src/ai/threat/coverage-map.ts`** — `withBarrier` + `threatsToTile` already honour both pathing- and LoS-deltas; the denial scorer consumes them.
5. **`src/content/abilities/`** — the ranged attacks to catalog.
6. **`validate.ts`** — the rangeMode / LoS gate the coverage map mirrors; the source of truth for how `straight_line` resolves.
7. **`taunt`** — the lone existing `straight_line` ability, as the reference for LoS resolution.

### Paths to survey before planning

- **B1 — Ranged-attack catalog (the content audit).** `grep rangeMode src/content/abilities/`. For every ranged *damage* attack, produce a table: current rangeMode, effective horizontal reach, element/type, and a one-word trajectory descriptor (arrow / bolt / beam / lobbed / detonating / area). This table is the surface for Chris's cut.
- **B2 — Offence-side LoS handling.** The coverage map (threat side) honours `straight_line` LoS. Does the **offence** projection — the AI deciding to *fire* — also respect it, i.e., will it correctly **not** value a shot blocked by terrain/units once the attack is `straight_line`? Likely inherited (offence mirrors `validate.ts` too), but a universal-`arc` history means it may never have been exercised. A gap here is a bug the content flip would surface.
- **B3 — Barrier candidate space.** How to enumerate candidate barrier lines (3–5 tiles × orientations × positions) near a vulnerable ally, and how hard to bound it against the ~1s baseline. **Perf is the headline.**
- **B4 — Self-obstruction.** Barriers are impassable and blind to sight **for both teams.** Confirm `withBarrier` lets the scorer measure the barrier's cost to the *AI's own* units (blocked approach / blocked shots), so denial can be scored as a **net** benefit, not just the ally-protection half.

## Decision gate — the arc→straight_line cut (Chris)

After B1, the implementer surfaces the catalog; **Chris makes the cut.** Framework to inform it (not pre-bake):

- **Trajectory plausibility** is the natural axis: flat/fast → `straight_line` (arrows, bolts, beams, magic missiles); lobbed/area → `arc` (catapult shots, thrown bombs, detonating fireballs, meteor).
- **Bows are the big lever.** Flipping them adds roster-wide cover counterplay and richens the high-ground game (height still grants range, but intervening terrain can now break the shot — already consistent in the coverage map). It's also the largest balance perturbation.
- **Central vs. spice dial:** convert many (cover becomes a core mechanic, Barrier denial fires often) vs. a few signature attacks (cover is spice, denial is niche).
- **Blast-radius recommendation:** a conservative first cut limits balance risk and lets Barrier denial ship same-session; flipping bows is high-justification but high-impact and is the case for splitting (cut + dedicated playtest, then Barrier in S61).

## Goal

**Content pivot:**
- B1 catalog produced; Chris's cut applied (chosen attacks → `straight_line`).
- Offence-side LoS confirmed correct (AI won't value blocked `straight_line` shots); fixed if B2 finds a gap.

**Barrier denial (if it lands this session — see split):**
- Score a candidate barrier by the **net coverage-delta**: reduction in enemy reach/LoS to a vulnerable ally (`threatsToTile` live vs. `withBarrier`) **minus** the barrier's cost to the AI's own offense/movement (B4).
- Candidate placements **bounded** to hold the ~1s perf baseline.
- A barrier that protects a squishy scores; one that walls nothing, or that mainly blocks the AI's own line, doesn't.

**Quality:**
- Tests +TBD.
- ADRs: Barrier denial its own; the content cut documented (an ADR or a content-decision note, per its breadth).
- Docs updated; Vercel pre-flight.
- **Human playtest, esp. if bows flip** — ranged-combat feel under cover is a meta change; plus Barrier behavior and perf. Log watch entries.

## Pre-implementation plan

Audit-first, with an explicit decision gate. **B1 catalog → Chris's cut (gate) → apply → [Barrier denial, if not split].** Plan-review confirms the split.

### Required first step: audit
1. **B1 catalog** for the cut.
2. **B2 offence-side LoS** — confirm or flag a gap.
3. **B3 candidate-bounding** strategy against ~1s.
4. **B4 self-obstruction** measurability via `withBarrier`.
5. **Recommended split** (bundle vs. cut+playtest-then-Barrier), tied to the cut's breadth, ratified at plan-review.

### Architectural decisions (provisional)
- **Content cut:** apply rangeMode flips per Chris's gate decision (content-only change; the coverage map already honours `straight_line`).
- **Offence-side LoS:** if B2 finds the offence projection doesn't gate blocked `straight_line` shots, fix it to mirror `validate.ts` (no parallel LoS logic — resolver discipline).
- **Barrier denial:** net coverage-delta scorer over bounded candidate barrier lines, reusing `threatsToTile` / `withBarrier`. Barrier is a `tile_set` cast (the S7 off-map bounds fix already covers enumeration safety).

### Decision points
- **D1 — the cut** (Chris, from B1). The brief cannot pre-settle it; this is the gate.
- **D2 — bows in or out of the cut.** The high-impact call. If in, recommend treating S60 as cut + playtest and splitting Barrier to S61. *Chris.*
- **D3 — session split: bundle, or cut+playtest then Barrier?** Follows D2/breadth. *Plan-review.*
- **D4 — Barrier denial: score net benefit (incl. self-obstruction) or ally-protection only for v1?** Recommend **net** — an ally-protection-only scorer will wall the AI's own units in. Gated on B4. *Confirm.*
- **D5 — candidate-bounding strategy** (B3). *Plan-review.*

## Implementation work

Per the split.

### 1. Content pivot
- Apply Chris's rangeMode flips.
- Offence-side LoS fix if B2 surfaces a gap.
- Tests: flipped attacks resolve as `straight_line` (blocked by wall/terrain/unit); AI offence does not value a blocked shot. ~6-12 tests.

### 2. Barrier denial (if not split out)
- Net coverage-delta scorer over bounded candidate lines; `threatsToTile` live vs. `withBarrier`; subtract self-obstruction.
- Tests: barrier that cuts an enemy approach/LoS to a squishy scores; empty wall ~0; a barrier that mainly blocks the AI's own line is *not* chosen; perf within budget on a bounded candidate set. ~12-20 tests.

### Tests (total)
~18-32 depending on the split.

## Acceptance criteria

- **Content:** Chris's cut applied; flipped attacks LoS-blockable; AI offence respects the block (unit-tested; playtest-logged if bows flip).
- **Barrier denial (if it lands):** net denial scored, self-walling avoided, empty walls declined, perf within ~1s-ish on bounded candidates (unit-tested; playtest-logged). Else cleanly deferred to S61.
- **Quality:** tests green; ADR(s) / content-decision note; docs updated; Vercel clean; watch entries.

## Out of scope

- **Role-aware deployment sorting** — the 4th consumer; next-after-Barrier.
- **Layer-2 prediction; Worldcraft move-then-cast; killValue-weighted Math re-base; "move onto a created perch"** — standing AI carries.
- Non-LoS content rebalancing beyond the rangeMode cut.
- Standing carries (templates, Move-tier discussion, cosmetic items, etc.).
- **`templar-male.png`** — resolve as a one-off (commit or remove); not session work.

## Files likely touched

Non-exhaustive; audit confirms.
- `src/content/abilities/*` — rangeMode flips (the cut).
- Offence-side projection / `validate.ts`-mirroring scorer — only if B2 finds an LoS gap.
- `src/ai/threat/` or Worldcraft scoring — Barrier denial scorer (consumes `threatsToTile` / `withBarrier`).
- `src/test/session-60-*.test.ts`.
- `docs/handoff.md`, `docs/playtest-watch.md`, ADR(s) / content-decision note.

## Workflow notes

- **Plaintext-first review required.**
- **The cut is a Chris decision surfaced from the audit — never autonomous.** Catalog → gate → apply.
- **Split decision at plan-review:** broad cut (bows) → cut + playtest this session, Barrier denial → S61; narrow cut → bundle.
- **Browser verification human-only**; the ranged-combat feel under cover is the thing to watch if bows flip.
- **Vercel pre-flight discipline.**
- **Mid-session design questions** route through Chris — most likely the cut itself (D1/D2) and the net-benefit framing (D4).

## Watch-fors

**Addressed this arc:** Barrier denial (the deferred Tier B half); the content substrate (LoS) that made it meaningful.

**Carry-forward:** role-aware deployment (4th consumer, unblocked); standing carries.

**Specific to this session:**
- **Perf is the headline.** Barrier denial's per-candidate `withBarrier` recomputes sit on the ~1s baseline. Bound candidates hard (B3); flag if think-time climbs noticeably.
- **Self-walling (B4/D4).** Barriers block both teams. A denial scorer that ignores self-obstruction will trap the AI's own units or block its own shots. Net-benefit scoring + a watch in play.
- **Offence-side LoS (B2).** Once attacks are `straight_line`, the AI must not value a shot through a wall. The coverage map honours LoS; confirm the offence side does, or it's a live bug.
- **Cut blast radius.** Flipping bows changes ranged combat globally and re-touches the high-ground meta (height grants range; terrain now breaks shots). Consistent in the coverage map, but the *feel* needs human eyes — hence the split recommendation if bows flip.
- **Don't over-cut.** Converting too many attacks at once makes the balance change hard to attribute in playtest. A smaller cut is easier to read and reverse.

## Estimated size

**Medium–Large, set by the cut.** A narrow cut + Barrier denial bundles into one session. A broad cut (bows) is its own meta change worth a playtest, splitting Barrier denial to S61.

**Split contingency:**
- Floor: the content catalog + Chris's cut + offence-side LoS correctness. This alone is a shippable, playtestable unit.
- Barrier denial: bundles if the cut is narrow; slips to S61 if the cut is broad or perf-bounding proves fiddly.
- Self-obstruction net-scoring stays part of Barrier denial whenever it lands (not an optional add).
