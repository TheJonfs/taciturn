# Session 52 Brief: Marshmoor (Third Map) + Bow Horizontal Range From Height + Terraformer Substrate Audit

## Context

S51 closed with the universal off-hand opening (zero substrate per audit; six new pieces), Wand of the Depths refit, Aether Bloom queue-tower preview fix, and Calculator base MA bump. 1457 → 1465 tests.

S52 ships the **third map (Marshmoor)** as the primary content addition, plus a **bow horizontal range from height** mechanic that we've been carrying as a future addition since the Hunter shipped in S45, plus a **Terraformer substrate research/audit deliverable** that prepares for the eventual Terraformer class implementation arc.

**Session character:** primary content (map + mechanic) + research deliverable (audit). Three discrete pieces:

1. **Marshmoor** — 16×16 wetlands map with two corner deployment zones, two corner peaks, and central flat patches.
2. **Bow horizontal range from height** — FFT-canon mechanic: ranged weapons get +1 horizontal range per -2 vertical delta downward to target. Genericized as a data field on weapons.
3. **Terraformer substrate audit** — research deliverable. Implementer reads the Terraformer blueprint, surveys current terrain-handling code, identifies what mutable-terrain-state substrate would require, produces a design doc. No substrate implementation.

Scope: **Medium.** Map + mechanic are bounded; audit is investigation that produces a planning artifact.

## Inputs (read first)

In recommended order:

1. `CLAUDE.md` — project conventions.
2. `docs/handoff.md` — S51 close, including the `aoeVerticalToleranceModifiers` substrate pattern, `tagFilter` source inconsistency note, and Two Weapons UX gap (dismissed but documented).
3. `terraformer-blueprint.md` (from outputs) — **important context for the audit deliverable.** Read end-to-end before substrate-audit work begins.
4. `docs/maps/stonebridge.md` (or equivalent) — second-map reference; Marshmoor follows similar data-driven patterns.
5. `docs/decisions/0083-weapon-substrate.md` — existing bow + weapon-range model; bow range from height extends this.
6. `docs/decisions/0085-vertical-axis-targeting.md` (S47 ADR if exists) — vertical-tolerance patterns; possibly informs how height-delta is computed for the bow range mechanic.
7. `core-types.md`, `map-and-battlefield.md` — current map model and terrain conventions.

### Paths to survey before planning

Audit determines specifics. Per the audit-overturns-spec pattern (eight sessions running through S51), substrate scope may be smaller than expected:

- **Map registration mechanism.** Stonebridge's S47 pattern. Marshmoor should slot in identically; audit confirms the registration path is uniform.
- **Bow range calculation site.** Where is horizontal range resolved at firing time? Existing code probably reads `weapon.range`; the new mechanic adds a height-delta term. Audit identifies the calculation site and consumers (live engine, AI projection, UI forecast — the three-shared-resolver pattern from S42).
- **AI ranged scoring elevation awareness.** Existing AI Hunter enumeration considers reachable tiles within bow range. The new mechanic means range varies by target — a Hunter on a peak can hit tiles farther than the base range. AI enumeration needs to factor in.
- **UI target-select extended range visualization.** The Hunter's target-select highlights tiles within range. With height-delta range, the highlighted set varies depending on shooter elevation. UI rendering needs to compute the extended set.
- **Existing bow inventory.** Riptide Bow, Highland Hunters' bow (if separate), any others. All need the new field declared.
- **Terraformer substrate audit scope.** Mutable terrain state, terrain object system (Barrier), effect queue, fall-damage on revert, pathfinding interaction, AI awareness, damage-type extensions. Audit covers all of these in survey form; design doc orders them by dependency.

## Goal

End state:

**Marshmoor:**
- Map registered in catalog; loadable in team builder; deployable in battle.
- 16×16 elevation grid per the data Chris provided.
- Deployment zones at (13,0)-(15,2) and (0,13)-(2,15), each 9 tiles. Intentional elevation asymmetry within zones (e.g., (15,0)=4, (1,14)=4) preserved — documented as visual variety, not gameplay-affecting.
- Map documentation at `docs/maps/marshmoor.md`.

**Bow horizontal range from height:**
- New `rangeFromHeightBonus?: { perDeltaVertical: number, deltaHorizontal: number }` field on weapon definitions.
- All existing bows (Riptide Bow, others per audit) declare the field with values `perDeltaVertical: 2, deltaHorizontal: 1` (FFT canon).
- Range calculation at firing time reads the field; for each -2 vertical delta (shooter higher than target), +1 horizontal range applies.
- AI ranged scoring factors extended range into enumeration.
- UI target-select shows the extended range tiles when shooter has elevation advantage.
- Genericized: any future ranged weapon can opt in by declaring the field.

**Terraformer substrate audit (research deliverable):**
- Document at `docs/decisions/draft-terraformer-substrate-audit.md` (or similar — not an ADR yet; this is design-doc-shaped).
- Survey current terrain-handling code across engine (movement validation, pathfinding, AoE shape computation, AI scoring, renderer).
- Identify what changes mutable-terrain-state would require at each touch point.
- Surface "audit-overturns-spec" findings — places where the codebase is already structured well for terrain mutation, vs. places where significant work would be needed.
- Outline the substrate work ordered by dependency: mutable terrain state → effect queue → fall damage on revert → terrain objects (for Barrier) → pathfinding interaction → AI awareness → damage type extensions (for Damage Split).
- Initial scope estimate per piece. The deliverable doesn't commit to implementation; it informs the Terraformer substrate session(s).
- **Important:** read the Terraformer blueprint (`terraformer-blueprint.md`) end-to-end before starting this audit. The blueprint provides the design context that scopes what substrate is needed.

**Quality:**
- Tests +15-25 (map + bow mechanic; audit produces no tests).
- ADR: 0088 if bow range mechanic is substantial enough to warrant; inline notes otherwise. (Marshmoor is content; not an ADR. Audit produces a design doc, not an ADR.)
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated (Marshmoor pacing, bow range tactical shifts, Tidewalker valuation).
- `docs/content-id-registry.md` updated for Marshmoor and any bow field additions.
- Browser verification: Marshmoor loadable in team builder; battle deploys both zones; bow range visualization shows correctly on elevated shooter.

## Pre-implementation plan

Audit-first per project conventions. **Plan-review checkpoint between audit completion and substrate/content code-writing.** Substrate audit is partly its own deliverable (the Terraformer prep) and partly informs the bow range mechanic's implementation shape.

### Required first step: current-tree audit

Per "Paths to survey" above. Audit deliverables:

1. **Map registration path** — confirm Marshmoor slots into existing registry uniformly.
2. **Bow range calculation site and consumers** — three-resolver pattern confirmation.
3. **Existing bow inventory** — list of weapons needing the new field.
4. **AI ranged scoring** — where Hunter enumeration computes reachable tiles.
5. **UI target-select** — where extended-range tiles get rendered.
6. **Terraformer substrate scope** — produced as separate audit-deliverable doc, no implementation.

### Architectural decisions

After audit:

1. **Bow range genericization.** Recommend: data field `rangeFromHeightBonus` on weapon definition with `perDeltaVertical` and `deltaHorizontal` params. Other ranged weapons (future) opt in by declaring the field. Engine reads at range-resolution time. Clean and shows in tooltips naturally.

2. **Height-delta direction.** Mechanic only applies when shooter is *higher* than target (i.e., vertical delta negative or zero). Shooter below target gets no bonus (and no penalty per current model — that's a separate design question, defer).

3. **Range bonus calculation.** Per the formula: `bonus_horizontal = floor((shooter_elevation - target_elevation) / perDeltaVertical) × deltaHorizontal`. Floor to ensure integer range increments; only positive bonus (no penalty for shooting upward, just no bonus).

4. **AI enumeration.** Hunter's ranged enumeration loops over reachable tiles. For each shooter position, compute extended range per the current shooter elevation, then enumerate targets within that range. Modest additional computation.

5. **UI extended-range visualization.** When Hunter target-selects, the highlighted tile set extends per the shooter's current elevation. Visual update only.

6. **Marshmoor deployment-zone asymmetry handling.** Document the asymmetry as intentional in the map's documentation; no engine work needed.

7. **Terraformer substrate audit scope.** Survey-only; no implementation. Output is a design doc, not engine work. The doc orders substrate pieces by dependency and provides scope estimates.

### Decision points

(Settled in plan-review.)

**D1 — Bow range field naming.** `rangeFromHeightBonus` proposed. Other candidates: `heightRangeBonus`, `elevationRangeBonus`, `verticalRangeBonus`. Recommend `rangeFromHeightBonus` for clarity (it's a horizontal-range bonus that comes from height advantage).

**D2 — Height-delta floor or ceiling?** Recommend floor (only complete -2 deltas count). Alternative: ceiling (rounds up — shooter 1 elev higher gets +1 horizontal). Floor is FFT-canon per Chris's note.

**D3 — Negative direction (shooter below target).** Recommend no penalty (consistent with existing range mechanics). Could add a penalty in future tuning if needed.

**D4 — Existing bow field updates.** Riptide Bow and any other existing bows get `rangeFromHeightBonus: { perDeltaVertical: 2, deltaHorizontal: 1 }` declared.

**D5 — Marshmoor deployment-zone asymmetry.** Preserve as-is (intentional visual variety). Document in map doc.

**D6 — Terraformer substrate audit ordering.** Recommend dependency-ordered: mutable terrain state (foundation) → effect queue / revert mechanic (depends on terrain state) → fall damage on revert (depends on both) → terrain objects for Barrier (somewhat parallel; depends on damage pipeline) → pathfinding interaction (depends on terrain state) → AI awareness (depends on all above) → damage type extensions (parallel; for Damage Split). Audit may surface different ordering after survey.

**D7 — Substrate audit deliverable format.** Recommend a structured design doc at `docs/decisions/draft-terraformer-substrate-audit.md`. Sections per substrate piece; each piece has: current state, what changes are needed, dependency notes, scope estimate. Becomes input for the eventual Terraformer substrate session(s).

## Implementation work

### Marshmoor map

- Map data file at `src/content/maps/marshmoor.ts` (or equivalent path).
- 16×16 elevation grid per Chris's data.
- Deployment zones defined: NE at (0,13)-(2,15), SW at (13,0)-(15,2). 9 tiles each.
- Map name: "Marshmoor".
- Registry integration in `src/content/maps/index.ts`.
- Map documentation at `docs/maps/marshmoor.md` capturing: overall theme (wetlands), tactical features (corner peaks, central flat patches, water mobility considerations), deployment zone intentional asymmetry, Tidewalker valuation note.
- Tests: map loads, deployment zones validate, terrain reads work, integration with team builder, integration with battle deployment. ~5-8 tests.

### Bow horizontal range from height

- New field `rangeFromHeightBonus?: { perDeltaVertical: number, deltaHorizontal: number }` on weapon type.
- Existing bows updated to declare the field (Riptide Bow and others per audit).
- Range calculation site: extend to compute height-delta bonus when shooter elevation > target elevation. Per S42 three-resolver pattern: live engine, AI projection, UI forecast all share the same resolver.
- AI ranged scoring: enumeration accounts for extended range based on shooter's current elevation.
- UI target-select: extended range tiles render correctly when shooter has elevation advantage.
- Tests: bow range with height (multiple delta scenarios); AI enumeration with extended range; UI rendering; regression tests for existing bow behavior. ~8-12 tests.

### Terraformer substrate audit (research deliverable)

- **Required pre-step:** implementer reads `terraformer-blueprint.md` end-to-end.
- Survey current terrain-handling code across:
  - Map data and terrain state model (`src/engine/maps/`, `src/engine/terrain/`)
  - Movement validation (`src/engine/movement/`)
  - Pathfinding (cached vs. fresh; invalidation logic)
  - AoE shape computation (terrain-elevation reads during AoE resolution)
  - AI scoring (terrain reads during decision-making)
  - Renderer (terrain rendering, animation infrastructure)
- For each piece of substrate listed in the Terraformer blueprint, identify:
  - Current state of relevant code
  - What changes mutable-terrain-state would require
  - Whether existing code is well-structured for the change ("audit-overturns-spec" likely) or whether significant refactor is needed
  - Dependency on other substrate pieces
  - Initial scope estimate (small / medium / large)
- Produce design doc at `docs/decisions/draft-terraformer-substrate-audit.md` (or similar).
- Doc structure per substrate piece:
  - **Current state** of relevant code
  - **Changes required** for mutable state support
  - **Dependencies** on other pieces
  - **Scope estimate**
  - **Open questions / decisions** for the future substrate session
- No engine code changes; this is a research deliverable.

### Tests (total)

Estimated +15-25 tests across map and bow mechanic. Audit produces 0 tests.

### UI surfaces

- Marshmoor visible in map selection UI (team builder + battle setup).
- Bow target-select shows extended range when shooter has elevation advantage.
- Map preview correctly renders Marshmoor's elevation profile (lots of water, scattered land, corner peaks).

## Acceptance criteria

**Marshmoor:**
- Loadable; deployable; both deployment zones place units correctly; intentional asymmetry preserved.
- Existing teams playable on Marshmoor (default templates + user-created teams).
- Map documentation reflects design intent.

**Bow range mechanic:**
- Hunter shooting from elev 6 at target on elev 1 has +2 horizontal range bonus (5-1)/2 = +2.
- Hunter shooting from elev 1 at target on elev 6 has no range bonus.
- AI Hunter targets reachable tiles per extended range when elevated.
- UI shows extended range tiles correctly.
- Existing bow behavior at equal elevation preserved.

**Terraformer substrate audit:**
- Design doc produced and committed.
- All substrate pieces from the blueprint surveyed.
- Findings actionable for the eventual Terraformer substrate session(s).
- Implementer's S52 read of the blueprint becomes context for the audit; if blueprint and audit findings conflict, audit flags the disagreement for design discussion.

**Quality:**
- Tests at 1480-1490, 0 failing.
- Docs updated.
- Browser verification: Marshmoor loads and battles correctly; bow range visualization works; Hunter elevation pairs surface correctly.
- Vercel pre-flight discipline.

## Out of scope

- **Terraformer substrate implementation.** Audit is research deliverable; substrate work happens in future session(s).
- **Terraformer class definition / abilities.** Future content session(s) after substrate.
- **Hill-height adjustment on Stonebridge** (S47 D9 carry — Stonebridge tuning, not Marshmoor).
- **Asymmetric siege scenario for Stonebridge** (S47 D8 carry).
- **AI deployment role-aware sorting** (longer-term carry; not Marshmoor-specific).
- **Equipment expansion** (Hi-Potion / Holy Water / Elixir consumables; other accessories).
- **Calculator stretch abilities** (Status-debuff Math, Drain Math, Banish Math).
- **Calculator AI personality variants.**
- **Damage Reduction restoration** (S50 suppression correct).
- **Charm/Seduction substrate.**
- **Speed Save / Updraft / Cornered Focus per-swing reaction cap codification** (S42 D5 deviation).
- **Renderer-side multi-swing animation polish.**
- **Terrain bar mid-battle vanishing repro** (still pending).
- **ActionType-wiring smoke test.**
- **Larger teams beyond 5v5.**
- **Team import functionality.**
- **Default team templates updated for off-hand gear** (closed last session via natural team revision; remaining template work would be a content-discussion session, not this one).
- **Negative-direction range penalty** (shooter below target). Currently no penalty for shooting upward; tuning consideration only.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Marshmoor:**
- `src/content/maps/marshmoor.ts` (new).
- `src/content/maps/index.ts` — registry addition.
- `docs/maps/marshmoor.md` (new).
- Tests for map registration and deployment.

**Bow range mechanic:**
- `src/engine/weapons/types.ts` — `rangeFromHeightBonus` field on weapon type.
- `src/engine/weapons/range.ts` (or equivalent) — range calculation with height-delta.
- `src/content/weapons/bows.ts` (or equivalent paths) — existing bow declarations.
- `src/ai/ranged-scoring.ts` (or equivalent) — extended range enumeration.
- `src/ui/target-select.ts` (or equivalent) — extended range visualization.
- Tests across these paths.

**Terraformer substrate audit:**
- `docs/decisions/draft-terraformer-substrate-audit.md` (new — research deliverable).
- No engine code changes.

**Docs:**
- `docs/handoff.md` — at session close.
- `docs/playtest-watch.md` — new watch-fors.
- `docs/content-id-registry.md` — Marshmoor + any bow inventory updates.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first with plan-review checkpoint.** Especially for the bow range mechanic — substrate scope influenced by audit (existing range calculation site shape).
- **The Terraformer blueprint is required reading** for the substrate audit deliverable. Implementer should not start audit work until they've absorbed the blueprint's design.
- **Substrate audit is investigation, not implementation.** Resist the temptation to start implementing during audit — the deliverable IS the audit doc.
- **Vercel pre-flight discipline.** Per S48–S51 carry.
- **Browser verification.** Marshmoor needs real-deployment exercise (not just synthetic); bow range visualization needs a Hunter-on-peak exercise.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces:
  - Bow range field naming finalization (`rangeFromHeightBonus` or alternative).
  - Existing bow inventory completeness (audit may find bows the spec missed).
  - Substrate audit scope clarifications (e.g., "should I survey the renderer's terrain animation infrastructure as part of this?").

## Watch-fors

**Addressed this session:**
- Marshmoor (third map).
- Bow horizontal range from height (FFT-canon mechanic; long-carried since S45).
- Terraformer substrate audit deliverable (prep for future substrate session).

**Not addressed this session, longer-term carry-forward:**
- All standing carries.
- Terraformer substrate implementation (next session in the Terraformer arc).
- Terraformer class implementation (subsequent sessions).

**Watch-fors specific to this session:**

- **Marshmoor setup-phase length feel.** Manhattan distance 26 tiles between deployment zone centers — longest setup phase yet. Watch whether 4-6 turn pre-engagement window feels right or drags.
- **Marshmoor's water-mobility burden on melee classes.** Knight in heavy armor crossing wetlands without Tidewalker takes ~26 move points for the 13-tile crossing. Watch whether Marshmoor genuinely shifts class viability (Hydrologist demand spikes; Knight feels constrained).
- **Bow range tactical shifts.** Hunters on Marshmoor's corner peaks (elev 5 and 6) shooting downward at elev 1-2 targets gain +2 or +3 horizontal range. Watch how much this empowers archer-led comps; may surface as a balance concern.
- **Corner peak claim races.** Both deployment zones have a "natural" near peak. Watch whether deployment + initial movement encourages racing for peaks vs. center engagement.
- **Tidewalker valuation in AI deployments.** AI role-aware deployment sort is a carry; with Tidewalker being significantly more valuable on Marshmoor, this surfaces the question more sharply. Not addressed this session, but watch the symptom.
- **Bow genericization for future ranged weapons.** The `rangeFromHeightBonus` field is designed for genericity. Watch whether any future ranged weapon's needs reveal field-design gaps (e.g., does it need a max-bonus cap? An elevation-direction toggle? Distance-falloff variations?).
- **Terraformer substrate audit findings.** What the audit surfaces will shape the eventual Terraformer substrate session's scope significantly. Watch for "audit-overturns-spec" findings — places where mutable terrain state is easier than the blueprint assumed.

## Estimated size

**Medium.** Map + mechanic are bounded; audit is investigation with bounded deliverable.

**No split contingency anticipated.** Items independent; if budget tightens, prioritize Marshmoor (content) > bow range (mechanic) > substrate audit (research deliverable). The audit can extend into a follow-up session if needed — it's a planning artifact, not blocking.

**Stretch indicators** (opportunistic):
- Calculator team template integration (S49/S50/S51 carry; still waiting on JSON).
- Tidewalker AI scoring weighting boost on water-heavy maps (audit-surfaced if implementer has time).
- Existing bow tooltips updated to reflect new range mechanic prominently.
- Marshmoor compliance tests for default team templates (verify Gravity Well, High Ground, Mage War all deploy correctly on the new map).

These are pure housekeeping; not core scope.
