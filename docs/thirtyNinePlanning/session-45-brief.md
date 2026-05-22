# Session 45 Brief: Hunter Class + Longbow + Riptide Bow + Supporting Substrate

## Context

S44 closed the TS strict-mode pile (279 → 0 errors), restored `npm run build` as the typecheck gate, and surfaced three latent bugs (AI's `VULNERABLE_MULTIPLIER` typo, action-log debug rendering, `generatedReactions` annotation drift). 1285 tests, 115 files. Maintenance break complete; back to content.

S45 introduces the **Hunter class** (8th class, balancing the roster at 4 physical / 4 magical), the **Longbow** and **Riptide Bow** weapon class, and the supporting substrate to make ranged-instant-damage a viable tactical niche. This is the largest content session in a while — comparable to S42 (Assassin + Two Weapons + Lightning Stab + Offering) in scope.

The session has four substantive pieces:

1. **New weapon-class substrate.** Three new properties: `twoHanded` (gates off-hand + shield), `minRange` (range floor for attacks), and target-context height-delta variance (extends the S40 dynamic-variance substrate). One new hook: `modifyAccuracy` (parallel to `modifyStatQuery` for unit stats, but applied to per-weapon/per-ability accuracy).

2. **Hunter class.** Native stats + R/S/M (Updraft-named Reaction, Eagle Eye Support at cost 2, High Jump Movement at cost 1) + Command Set (Pin Down, Charged Attack, Scramble) + base stat profile.

3. **Two bows:** Longbow (WP 7 / Acc 33, the "snipe at range" weapon) and Riptide Bow (WP 5 / Acc 33 + water-flavored CT-push proc, audit-symmetric to Hydrologist's CT-manipulation math).

4. **Team template:** at least one Hunter-featuring template to demonstrate the kit and enable team-builder + AI-deployment play.

Scope: **Large.** Plausible split into 45a (substrate + Longbow + Hunter base class) / 45b (Riptide Bow + polish + template) if audit reveals substrate complexity. Audit-first per project conventions; plan-review checkpoint between audit completion and substrate code-writing.

## Inputs (read first)

In recommended order:

1. `CLAUDE.md` — project conventions, ActionType-wiring discipline.
2. `docs/handoff.md` — S44 close (strict-mode pile resolved; latent bug context).
3. `docs/decisions/0080-unified-attack-pipeline.md` — S42 attack substrate (S45 builds on this).
4. `docs/decisions/0081-statuses-and-formulas.md` — Brave/Faith/Speed formulas and status calibration (Pin Down formula consistency).
5. `docs/conventions/action-types.md` — wiring discipline (multiple new ActionTypes this session).
6. `core-types.md`, `action-resolution.md`, `ct-system.md` — foundational; particularly the CT system for Riptide Bow's push mechanic.
7. `equipment-design.md` (or whatever the current equipment doc is) — current weapon model, equipment slot rules.
8. `damage-resolution.md` — for the variance pipeline (target-context extension); accuracy resolution.
9. `class-design.md` — Hunter is class #8; review pattern from prior classes (Assassin most recent).
10. Hydrologist ability definitions (water-mage spells with CT manipulation) — for Riptide Bow audit-symmetric math.

### Paths to survey before planning

Audit determines specifics. Important: this session has more new substrate than the average class addition (S39 Alchemist, S42 Assassin), so the audit's substrate-readiness assessment is uniquely critical.

At minimum survey:

- **Equipment slotting / two-handed rule.** Currently no two-handed weapons exist; the slotting system has main-hand, off-hand, shield, and accessory slots. Audit: does the current model accommodate a "two-handed" weapon property cleanly, or is the off-hand+shield assumption baked in? Likely a small extension — a `twoHanded: true` field on the weapon definition + validation that disables off-hand and shield slots when equipped — but confirms scope.

- **Range-check predicate.** Currently checks max horizontal range (and vertical, where applicable). Audit: is the range check a single function that we extend with `minRange`, or are there multiple range-check call sites that need parallel updates? Single-function-extension is the cleanest path.

- **Dynamic-variance substrate (S40 extension).** Knives use Speed-based variance via the variance stage hook — this is attacker-context (the attacker's own Speed). Bows use target-context (the height delta between attacker and target). Audit: does the existing variance pipeline pass both attacker and target context into the variance function, or only attacker? If only attacker, we extend the signature.

- **Accuracy resolution path.** Accuracy is per-weapon/per-ability rather than a unit stat. Audit: where is the final accuracy calculation? Is there a single point to inject a `modifyAccuracy` hook (parallel to `modifyStatQuery`), or does accuracy get computed in multiple places? Single-point injection is the cleanest path.

- **Charge-time substrate.** Spells use charge times for CT-delayed resolution. Audit: is the charge-time mechanism gated to spell-flavor abilities, or general to "any action with `chargeTime: N`"? Charged Attack is a physical bow attack that uses charge time — needs the latter.

- **Movement-action substrate (Scramble).** Most actions are attacks or status appliers. Scramble is an action that performs a movement step (1 tile with relaxed jump). Audit: does the current action system handle "action that moves the unit" as a category? Or does Scramble need to be expressed as a special action type? The Alchemist's Compound is closest (action-no-target); Scramble is action-with-tile-target.

- **CT push / CT manipulation.** Audit how Hydrologist's water spells manipulate CT (push back, slowdown, etc.). The Riptide Bow's on-hit proc should be mechanically symmetric. Either Hydrologist has a direct CT-push effect we mirror, or there's a substrate to build atop.

## Goal

End state:

**Substrate:**
- `twoHanded?: boolean` property on weapon definition; equipment slotting rejects off-hand and shield when equipped.
- `minRange?: number` property on weapon/ability definition; range-check predicate enforces it.
- Target-context height-delta variance: variance functions can read both attacker and target position for variance calculation.
- `modifyAccuracy` hook on classes/abilities (parallel to `modifyStatQuery`); multiplies the per-attack accuracy at resolution.
- Charge-time substrate handles physical-flavor abilities (not just spells).
- Action system supports "movement action" category (Scramble fits cleanly).

**Hunter class:**
- Base stats (audit-finalized within ranges; see D1).
- Native R/S/M: Updraft (Reaction), Eagle Eye (Support), High Jump (Movement).
- Command Set (name TBD, see D10): Pin Down, Charged Attack, Scramble.
- ClassDefinition + abilities registered with content-id-registry alongside reconciliation (per S44 deferred maintenance item — this session is a natural place to fold in).

**Weapons:**
- **Longbow:** WP 7, Acc 33, Min Range 2, Max Range 5, Vertical Infinite, height-delta variance, two-handed.
- **Riptide Bow:** WP 5, Acc 33, Min Range 2, Max Range 5, two-handed, on-hit CT-push proc (math per D9 / Hydrologist audit).

**Team template:**
- At least one team template featuring a Hunter as primary class. Demonstrates the kit; AI deployment heuristic uses it.

**Quality:**
- Tests +50-80 (estimated; substrate + class + abilities + weapons + interactions).
- ADRs: 0083 for weapon substrate (two-handed, min range, target-context variance, accuracy hook); possibly 0084 for charge-time-generalization if substrate work warrants.
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated with new watch-fors (Hunter positional dynamics, bow accuracy, elevation safe zones).
- Browser verification: Hunter is selectable, both bows usable, native passives + Command Set fire correctly, height-delta variance produces correct damage, accuracy multiplier applies, Hunter can be cross-classed.

## Pre-implementation plan

Audit-first per project conventions. **Plan-review checkpoint between audit completion and substrate code-writing** — substrate scope is the variable that determines monolithic vs. 45a/45b split.

### Required first step: current-tree audit

Per "Paths to survey" above. The audit's deliverable is an assessment of whether each substrate piece is:

- **Additive** (clean fit, small extension to existing) → monolithic session feasible.
- **Localized refactor** (one or two functions need signature changes) → still monolithic, with plan-review confirmation.
- **Cross-cutting refactor** (many call sites need updates) → split into 45a (substrate + minimal class) / 45b (full kit + Riptide Bow + template).

Per S40, S42, S43 precedent: audits have consistently found the engine cleaner than initially feared. Plausibly this audit lands clean too. But it's not guaranteed — multiple substrate pieces compound risk.

### Architectural decisions

After audit:

1. **Two-handed property.** Recommend: `twoHanded?: boolean` field on weapon definition; validation in `EquipmentSlotting` (or equivalent) rejects assignment to off-hand + shield slots when active. Two Weapons substrate's `modifyDualWield` hook returns false-or-skip when main hand is two-handed (audit confirms exact integration point).

2. **Minimum range.** Recommend: `minRange?: number` on weapon/ability; default 1 (= adjacent allowed) when omitted. Range-check predicate adds a single condition: `range >= minRange`. Cross-class interaction: Battle Skills using a two-handed bow inherit its minRange (Knight + Longbow + Lightning Stab cannot fire adjacent).

3. **Height-delta variance.** Recommend: variance functions receive `{attacker, target, action}` context. Bows compute `Max(0, 1 - (target.height - attacker.height) / 5)`. Existing knife variance reads only `attacker` from the context (Speed-based); backward-compatible. Substrate change is to the variance function signature, called once per damage resolution.

4. **`modifyAccuracy` hook.** Recommend: parallel pattern to `modifyStatQuery`. Each registered passive can return an accuracy multiplier (default 1.0). At accuracy resolution, multipliers compose multiplicatively (additive-first, multiplicative-last per established convention). Eagle Eye returns `2.0`. Other future passives can hook this for accuracy mods.

5. **Charge-time generalization.** Recommend: confirm charge-time mechanism isn't spell-gated. If it is, refactor to support physical-flavor abilities. Charged Attack uses identical mechanics (Action Speed, tile target, hits empty space if target leaves).

6. **Movement action.** Recommend: Scramble registered as an action type with `actionFlavor: 'movement'` (or equivalent); resolves by moving the unit to the targeted tile with jump-relaxed pathing (delta 5). No MP cost.

7. **CT push mechanic.** Per D9 audit; symmetric to Hydrologist's CT manipulation.

### Decision points

(Settled in plan-review.)

**D1 — Hunter class stats.** Audit-driven within these ranges:
- HP: 110-120 at L25 (higher than Assassin 96, less than Knight 140).
- MP: 24-32 (light caster supplement; bow attacks don't use MP).
- PA: 6-7 (medium-strong physical).
- MA: 3-4 (light secondary).
- Speed: 8-10 (medium; less than Assassin 14, more than Geosage).
- Move: 4 (standard).
- Jump: 3 (base; High Jump native passive brings to 5).
- Evades: 6-3-0 (medium front; light side; back exposed).

Recommend: HP 116, MP 28, PA 6, MA 3, Speed 9, Move 4, Jump 3, Evades 6/3/0.

**D2 — Pin Down base chance.** Recommend **raise to 50% from Chris's initial 33%**. At Hunter Speed 9, Brave 70 caster vs Brave 70 target, formula factor (0.9 + 9/20) = 1.35:
- 33% base × 0.49 × 1.35 ≈ 22% net → ~0.88 EV at 4-turn Slow (below break-even)
- 50% base × 0.49 × 1.35 ≈ 33% net → ~1.32 EV at 4-turn Slow (above break-even, action-cost-only worth using)

At 50% base, Pin Down lands in similar EV territory to Magebane Silence and Shadow Stitch as a Brave-gated action-cost-only status applier. Settle in plan-review.

**D3 — Pin Down duration.** Recommend 4 turns (standard mid-range from the 3/4/6/10 palette). Slow is a high-value status; 4 turns is a meaningful window without being decisive.

**D4 — Charged Attack Action Speed.** Audit existing spell Action Speeds for the right calibration band. Recommend: medium speed (charges in ~1 enemy turn for a Speed-9 caster). Tuning lever is the Action Speed value; calibrate against Hydrologist's Brine and Geosage's Earth Quake.

**D5 — Scramble values.** Confirmed in design: range 1 tile, jump delta 5. Recommend: action cost only, no MP cost. Verify substrate handles "action with tile target that moves the unit" cleanly.

**D6 — Reaction name.** Suggestions: Updraft, Skyborne, Mountainborn, Wing-and-a-Prayer, Heightened Resolve. Recommend **Updraft** for flavor consistency with other R/S/M passive names (single evocative noun: Inner Warmth, Combat Focus, Travel Preparations).

**D7 — Eagle Eye cost.** Recommend cost 2 (matches Two Weapons / Martial Expertise impact tier). At cost 1, Eagle Eye becomes too easy to slot cross-class; at cost 2, it forces a meaningful Support choice (Eagle Eye OR Martial Expertise OR Two Weapons).

**D8 — High Jump cost.** Recommend cost 1 per single-effect Movement ladder (Move +1, Tidewalker, Quickstep all cost 1; dual-effect at cost 2). Single-effect Jump +2 = cost 1.

**D9 — Riptide Bow CT-push specifics.** **Audit-driven.** Audit Hydrologist's CT-manipulation spells (likely Tide Surge / Rapids Rush or similar) for their existing math. Riptide Bow's proc should be mechanically symmetric to that math. Settled by audit findings + Chris's review.

Initial proposal for plan-review reference: ~30% proc rate, push target's CT back by some value tuned against the typical CT progression (so it feels like meaningful timing slip, not full-turn delay). No Brave gate (it's not a status application, just a numeric change). Final values per audit + Chris.

**D10 — Command Set name.** Suggestions: Marksmanship, Archery, Hunter's Eye, Pursuit, Skirmishing. Recommend **Marksmanship** for thematic fit (focused on aimed shots and positioning).

**D11 — Class name.** Suggestions: Hunter, Ranger, Archer, Stalker. Recommend **Hunter** for compactness and tactical neutrality (Ranger implies forest/woodland; Archer is over-narrow to the weapon; Stalker reads sinister and overlaps with the Assassin's flavor).

## Implementation work

### Substrate additions

**Two-handed weapon property:**
- Add `twoHanded?: boolean` to weapon definition (catalog).
- Update equipment slotting validation: rejects off-hand and shield assignment when main-hand is two-handed.
- Two Weapons substrate's `modifyDualWield` hook returns no-dual-wield when main hand is two-handed.
- Tests: equipment validation; Two Weapons + Longbow → single-weapon equip; The Offering + Longbow → 2 shots from one weapon.

**Minimum range:**
- Add `minRange?: number` to weapon/ability definitions; default 1 when omitted.
- Range-check predicate enforces both min and max; rejects targets too close or too far.
- Tests: Longbow cannot fire adjacent; Longbow can fire at range 2-5; vertical range still infinite (separate axis).

**Target-context variance:**
- Extend variance function signature: `(context: { attacker, target, action }) → number`.
- Longbow's variance function: `Max(0, 1 - (target.height - attacker.height) / 5)`.
- Existing knife variance reads only attacker.Speed; backward-compatible.
- Tests: same-height = 1.0; 4 above = 0.2; 5+ above = 0; 5 below = 2.0; intermediate values; large positive deltas don't produce negative damage (Max clamp).

**`modifyAccuracy` hook:**
- New passive hook returning accuracy multiplier (default 1.0).
- Accuracy resolution: composes all active multipliers multiplicatively.
- Eagle Eye implementation: returns 2.0 on attacks using physical-attack accuracy.
- Tests: bare bow shot = 33% × 1.0 = 33%; bow shot with Eagle Eye = 33% × 2.0 = 66%; stacking with future hooks composes correctly.

**Charge-time generalization:**
- Confirm charge-time mechanism handles physical-flavor abilities.
- Charged Attack uses charge time + tile target; resolves with extra damage if target on tile.
- Tests: Charged Attack hits target still on tile; misses (no damage) if target moved off; Action Speed produces expected resolution timing.

**Movement action (Scramble):**
- Register action with `actionFlavor: 'movement'` or equivalent.
- Resolution: moves unit to targeted tile with relaxed jump (delta 5) using existing pathfinding (or a parameterized variant).
- No MP cost; action cost only.
- Tests: Scramble lands the unit on the target tile; respects delta-5 jump limit; can leap onto cliffs; cannot pass through impassable tiles.

### Hunter class

**ClassDefinition:**
- Stats per D1 (audit-finalized within recommended ranges).
- Native R/S/M: Updraft (Reaction), Eagle Eye (Support), High Jump (Movement).
- Cross-class costs per D6, D7, D8.

**Native R/S/M:**

*Updraft (Reaction):*
- Jump +1 permanently for the battle when hit.
- Accumulates (each hit adds another +1).
- Cost 1 (cross-class).

*Eagle Eye (Support):*
- Multiplies physical-attack accuracy by 2.0.
- Hook: `modifyAccuracy`.
- Cost 2 (cross-class).

*High Jump (Movement):*
- Jump +2 (single-effect, additive).
- Hook: `modifyStatQuery` for jump stat.
- Cost 1 (cross-class).

**Marksmanship Command Set:**

*Pin Down:*
- Instant action; weapon range; no damage.
- Base 50% chance to apply Slow for 4 turns.
- Formula: Brave-gated (caster_brave/100 × target_brave/100) × (0.9 + caster_speed/20).
- Animation: existing status-applier animation with bow-themed VFX.

*Charged Attack:*
- Charged action (Action Speed per D4); tile target; weapon range and accuracy.
- Damage: PA × WP × variance × ~1.5 (extra-damage multiplier; calibrate against Cyclone or other charged physical-like baselines if any exist).
- Hits target on tile at resolution; misses (no damage) if target moved off.

*Scramble:*
- Action; tile target within 1 horizontal, delta 5 jump.
- Moves unit to target tile.
- No damage, no MP cost.

### Weapons

**Longbow:**
- WP 7, Acc 33, Min Range 2, Max Range 5, Vertical Infinite, two-handed.
- Variance: `Max(0, 1 - (target.height - attacker.height) / 5)`.

**Riptide Bow:**
- WP 5, Acc 33, Min Range 2, Max Range 5, two-handed.
- Variance: same as Longbow.
- On-hit proc: CT push (chance and magnitude per D9 audit).

### Team template

At least one Hunter-featuring template:
- Hunter as primary class (with Longbow or Riptide Bow).
- 3 other classes filling out the team (mix of front-line and ranged-support).
- Ivalician names; equipment loadouts.
- Authored deployment placements.

Recommendation (settle by plan-review): "Highland Hunters" or similar — Hunter + Knight (front-line tank) + Geosage (status pressure) + Hydrologist (CT control). Or play with other combinations.

### Tests

Estimated +50-80 tests:
- Substrate: ~20 (each substrate piece: 2-5 tests).
- Hunter class definition: ~5.
- Updraft Reaction: ~5.
- Eagle Eye Support: ~5.
- High Jump Movement: ~3.
- Pin Down: ~7 (base chance, Brave gates, Speed scaling, duration, formula).
- Charged Attack: ~5 (charge resolution, target-on-tile hit, target-moved miss, range/accuracy).
- Scramble: ~5 (movement, jump delta, target validation).
- Longbow / Riptide Bow stats + variance: ~10.
- Riptide Bow CT-push proc: ~5.
- Team template loading: ~2.
- Cross-class interactions: ~5 (Knight + bow, Knight + Eagle Eye, The Offering + bow, etc.).

### UI surfaces

- Class picker shows Hunter.
- Equipment picker shows Longbow and Riptide Bow; off-hand + shield slots gray out when two-handed equipped.
- Marksmanship command set in unit menu (Hunter primary or cross-class).
- Charged Attack uses tile-targeting UI (existing spell UI).
- Scramble uses tile-targeting UI (existing movement UI? — audit confirms).
- Pin Down feedback animation; Slow status icon.
- Riptide Bow CT-push feedback (visible CT change on target).
- Tooltips describe two-handed, min range, and height-delta variance.

## Acceptance criteria

**Substrate:**
- Two-handed flag gates off-hand + shield correctly; Two Weapons rejects when main hand two-handed.
- Min range rejects too-close targets; max range still enforced.
- Height-delta variance produces correct damage at various elevation deltas; clamps at 0.
- Accuracy multiplier hook composes correctly; Eagle Eye produces 66% net on bare-bow shots.
- Charge-time handles Charged Attack; resolution and tile-still-occupied behavior correct.
- Movement-action substrate handles Scramble; jump delta 5 leap works.

**Hunter class:**
- Hunter selectable as primary or secondary.
- Native R/S/M passives apply correctly (free for primary, costed cross-class).
- Marksmanship Command Set fires; Pin Down lands at expected rate; Charged Attack resolves with extra damage; Scramble repositions.

**Weapons:**
- Longbow and Riptide Bow equippable.
- Longbow attacks: WP 7 × PA × variance × accuracy ≈ expected damage; respects min range and vertical infinite.
- Riptide Bow attacks: WP 5 × ... × proc CT push at expected rate and magnitude.

**Quality:**
- Tests at 1335-1365 range, 0 failing.
- ADR 0083 (weapon substrate) committed; ADR 0084 if charge-time generalization warrants its own.
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated with Hunter-specific watch-fors.
- Browser verification: Hunter in a team, both bows attacking, height-delta variance visible in damage values, Eagle Eye in action.

## Out of scope

- **Calculator class** (9th class, magical-knowledge specialist) — later in roadmap.
- **Second map design** — was S46 candidate; may shift depending on S45 outcome.
- **5v5 unlock** — later in roadmap.
- **Equipment expansion (Hi-Potion / Holy Water / Elixir + accessories)** — was S45 candidate, displaced by Hunter session; later.
- **Charm/Seduction (team-override substrate)** — dedicated future session.
- **Pyromancer R/S/M consolidation** (S41 carry) — future R/S/M review session.
- **Knight base-PA recalibration** (S41 D2 carry) — playtest-driven.
- **AI deployment role-aware sorting** (S43 carry) — playtest-driven.
- **Speed Save per-swing reaction cap** (S42 D5 deviation) — design-flavored.
- **Renderer-side multi-swing animation polish** (S42 carry).
- **Permadeath badge first-playtest visual read** (S41 carry).
- **Pass-and-play UX refinements** (S43, playtest-driven).
- **content-id-registry.md reconciliation** (S44 carry) — recommendation: fold in opportunistically this session since adding Hunter naturally touches the registry.
- **Border/borderColor React dev warnings** (S43 + S44 carry) — cosmetic; defer.
- **`assignAiTeamNames` removal** (S43 + S44 carry) — defer.
- **ActionType-wiring smoke test** (S44 carry) — defer; this session adds multiple ActionTypes, so the smoke test would benefit but is independently sized.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Engine (substrate):**
- `src/engine/catalog/weapons.ts` (or equivalent) — `twoHanded`, `minRange` fields.
- `src/engine/equipment/slotting.ts` (or equivalent) — two-handed slot rules.
- `src/engine/damage/variance.ts` (or equivalent) — target-context signature extension.
- `src/engine/damage/accuracy.ts` (or equivalent) — modifyAccuracy hook composition.
- `src/engine/actions/charge-time.ts` (or equivalent) — physical-flavor generalization.
- `src/engine/actions/movement-action.ts` (new or extension) — Scramble action category.

**Engine (Hunter class):**
- `src/content/classes/hunter.ts` (new) — ClassDefinition.
- `src/content/abilities/marksmanship/` (new directory) — Pin Down, Charged Attack, Scramble.
- `src/content/passives/updraft.ts`, `eagle-eye.ts`, `high-jump.ts` (new) — R/S/M passives.
- `src/content/weapons/longbow.ts`, `riptide-bow.ts` (new) — bow definitions.

**Engine (Riptide Bow CT push):**
- Audit-determined location — likely a passive or hook tied to the weapon for the on-hit proc.

**Content:**
- `src/content/teams/templates/` — at least one new Hunter-featuring template.
- `src/content/names/` — verify Ivalician name pool sufficient for Hunter team.

**UI:**
- `src/ui/equipment-picker.tsx` — two-handed slot gray-out.
- `src/ui/action-menu.tsx` — Marksmanship command set rendering.
- Charged Attack and Scramble use existing tile-targeting UI; minor additions for action-flavor branding.

**Tests:**
- `src/engine/damage/__tests__/variance.test.ts` — target-context variance.
- `src/engine/damage/__tests__/accuracy.test.ts` — modifyAccuracy.
- `src/content/classes/__tests__/hunter.test.ts` — class definition.
- `src/content/abilities/__tests__/marksmanship.test.ts` — Command Set.
- `src/content/passives/__tests__/eagle-eye.test.ts`, etc.
- `src/content/weapons/__tests__/longbow.test.ts`, `riptide-bow.test.ts`.

**Docs:**
- `docs/decisions/0083-weapon-substrate.md` — two-handed, min range, target-context variance, accuracy hook.
- `docs/decisions/0084-charge-time-generalization.md` — possibly, if substrate warrants its own ADR.
- `docs/handoff.md` — updated at session close.
- `docs/playtest-watch.md` — Hunter-specific items.
- `docs/content-id-registry.md` — Hunter additions + opportunistic backfill if time permits.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first with explicit plan-review checkpoint** between audit completion and substrate code-writing. Substrate scope is this session's largest variable.
- **Multiple new ActionTypes this session** — Pin Down, Charged Attack, Scramble all need ActionType wiring per `docs/conventions/action-types.md`. Strict adherence.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: substrate audit revealing complexity in any of the four new pieces (two-handed, min-range, target-variance, accuracy hook); Hydrologist CT-math audit producing a value range different from the brief's recommendations; movement-action substrate not cleanly accommodating Scramble; balance calibration of Pin Down base rate.
- **Phase F session** — playtest signal continues to accumulate. New watch-fors get added to `docs/playtest-watch.md`.
- **Riptide Bow audit-symmetry** — D9's audit of Hydrologist CT manipulation is itself a planner-touched moment. Implementer should surface what they find with proposed values; planner + Chris confirm.

## Watch-fors

**Addressed this session:**
- New weapon substrate (two-handed, min range, target-context variance, accuracy hook).
- Hunter class (8th class, balances physical roster).
- Longbow + Riptide Bow weapons.
- Charge-time substrate generalization (if needed per audit).
- Movement-action substrate (Scramble).
- Hunter-featuring team template.

**Not addressed this session, longer-term carry-forward:**
- Calculator class (9th, magical-knowledge specialist).
- Second map design — was S46 candidate; may shift.
- 5v5 unlock — later in roadmap.
- Equipment expansion (Hi-Potion / Holy Water / Elixir + accessories) — displaced.
- Charm/Seduction substrate.
- Pyromancer R/S/M consolidation.
- Knight base-PA recalibration.
- AI deployment role-aware sorting.
- Speed Save per-swing reaction cap.
- Renderer-side multi-swing animation polish.
- Permadeath badge first-playtest visual read.
- Pass-and-play UX refinements.
- Border/borderColor React dev warnings.
- `assignAiTeamNames` removal.
- ActionType-wiring smoke test.

**Watch-fors specific to this session:**

- **Bow accuracy calibration.** Eagle Eye at 2× on bare 33% = 66% net. Real play may show this is too low (Hunter feels unreliable) or too high (Hunter dominates). Levers: base accuracy on bows, Eagle Eye multiplier value, or both.
- **Elevation safe zones from Longbow's 5-cap.** Maps with cliffs ≥5 tiles tall become bow-immune zones. River Ridge's west high ground likely falls here. May be a feature (positional gameplay matters) or a watch (one-sided dynamics in archer comps).
- **Pin Down EV in real play.** 50% base × 0.49 × 1.35 ≈ 33% net is the recommended calibration; actual play may show it lands too often or not often enough. Levers: base rate, duration, formula factor.
- **Riptide Bow CT push tuning.** Magnitude and proc rate determined by audit + playtest. Likely needs tuning rounds.
- **Charged Attack Action Speed calibration.** Goal is "slow targets can't escape, fast targets can." Real play surfaces the exact threshold. Speed-9 Hunter charging against Speed-9 to 14 targets is the calibration band.
- **Scramble action use frequency.** If Hunter players never use Scramble (always move before firing), it's a wasted slot. If they use it constantly (panic-leap from melee), it's overpowered or the bow's min-range is too punishing. Tune the bow's min-range and Hunter Speed/Move to balance.
- **The Offering + bow combo.** Two ~66% accuracy shots per turn at range with elevation bonuses. May be too strong as a build; The Offering's -2 PA tax + accessory slot cost should balance, but worth tracking.
- **Knight + bow + Lightning Stab as a ranged status applier.** Confirmed enabled by design choice; playtest will show whether it's a tactical option or an oppressive auto-pick.
- **Two-handed + Two Weapons interaction.** Equipment system handles it correctly per substrate; watch for edge cases in equipment-picker UI (does it show off-hand grayed correctly? Two Weapons toggle disabled correctly?).
- **AI Hunter deployment placement.** AI deployment heuristic is HP-only; Hunter with HP 116 lands middle of the team's deployment zone. May or may not be tactically right for the Hunter role (which wants high ground or back-line). Lever for future role-aware sort.

## Estimated size

**Large.** Comparable to S42 (Assassin + Two Weapons substrate + Lightning Stab + Offering — landed monolithic after audit found existing substrate consolidation).

**Split contingency:** If audit reveals substrate complexity beyond what S42-style additive work permits, split into:

- **45a:** Substrate (two-handed, min range, target-context variance, accuracy hook, charge-time generalization, movement-action) + Longbow + Hunter base class (stats + native R/S/M + Pin Down + Scramble). Charged Attack might land here or in 45b depending on charge-time substrate work.
- **45b:** Riptide Bow + Hydrologist CT-symmetry audit + Charged Attack (if not in 45a) + Hunter team template + UI polish.

**Recommendation:** Plan-review checkpoint after audit. Decide on split based on audit findings. Lean monolithic if substrate is mostly additive; split if cross-cutting refactor surfaces.

**Stretch indicator:** if the substrate audit lands clean and the implementer has tail budget after the primary work, fold in `content-id-registry.md` reconciliation (S44 carry — Hunter additions are a natural place to touch the registry anyway). Other S44 deferred items (border warnings, `assignAiTeamNames` removal, ActionType-wiring smoke test) are independent and not natural folds.
