# Session 49 Brief: Calculator Class + Math Skill Substrate + Level System

## Context

S48 closed with the 5v5 unlock (variable-length `BuiltTeam` shape, MAX 5/MIN 1, both maps expanded to 5v5), team export utility, three new default templates (Gravity Well, High Ground, Mage War), ability tooltips, Bulwark Stance suppression, content-id-registry full reconciliation, and a tuning bundle (Landwalker scoped to Move+1, Float hidden, Quickstep description, Charged Attack ×1.5→×2.0 with 6 MP cost). 1399 tests / 119+ files.

S49 introduces the **9th class — Calculator** — together with its two defining substrate pieces: **Math Skill** (parameter-based broad-range instant-cast targeting) and the **Level system** (slot-based level assignment with HP/MP/dominant-stat modifiers). This is a substrate-heavy content session comparable to S45's scope.

The session has six substantive pieces:

1. **Math Skill targeting substrate.** New ability category whose targets are calculated from parameter × value across all units on the battlefield (CT, Height, Level, Current HP × Prime, 3, 4, 5 = 16 combinations). Friendly fire applies; self-targeting allowed.

2. **Level system substrate.** Slot-based level assignment (slot 1 = L25 baseline; alternating outward to L24/26/23/27 etc.). Level modifies HP/MP (±10% per ±1) and dominant-stat (±1 at ±2). Locked at team-build; immutable through battle.

3. **Calculator class.** Stats per blueprint (HP 101, MP 47, PA 5, MA 8, Speed 7, Move 2, Jump 2, 7/3/0 evades), Mage + Universal armor, native R/S/M (Cornered Focus, Mathematician, Thoughtful Pacing).

4. **Five Math Skill abilities.** Precision Fire, Targeted Treatment, Exact Rhythm, Sculpted Enhancement, Engineered Defenses. Plus one new status type (Engineered Defenses' resistance + evasion buff).

5. **Calculator team template.** Chris authors mid-session via the S48 exporter; implementer integrates as late commit.

6. **Math Skill UI + AI scoring.** Targeting preview UI for human controllers; simple max-EV scoring for AI controllers.

Scope: **Large.** Comparable to S45 (Hunter + bows + multiple substrate pieces). Audit-first with explicit plan-review checkpoint between audit completion and substrate code-writing.

## Inputs (read first)

In recommended order:

1. `CLAUDE.md` — project conventions; ActionType-wiring discipline.
2. `docs/handoff.md` — S48 close; Vercel TS-cache lesson.
3. `calculator-blueprint.md` (from outputs) — design spec; **authoritative** for stats, abilities, R/S/M, substrate decisions.
4. `docs/decisions/0079-ko-status-interaction.md` — relevant to infinite-duration buffs (Sculpted Enhancement, Engineered Defenses).
5. `docs/decisions/0080-unified-attack-pipeline.md` — substrate reference for hook patterns.
6. `docs/decisions/0081-statuses-and-formulas.md` — Brave/Faith/Speed formulas (Math status applications use Faith-gating; the "missing MA factor" mentioned by Chris will surface in audit).
7. `docs/decisions/0085-vertical-axis-targeting-rules.md` — recent precedent for targeting substrate changes.
8. `core-types.md`, `action-resolution.md`, `ct-system.md`, `status-effects.md` — foundational.
9. `class-design.md`, `ability-format-spec.md`, `ability-slots.md` — class authoring patterns.

### Paths to survey before planning

Audit determines specifics. The audit's central deliverable is scope-per-piece for the substrate work:

- **Targeting system shape.** Currently abilities target specific tiles or units (single or AoE). Math Skill targets a *calculated set* of units — fundamentally different. Audit: is there a "filter all units by predicate" model that can absorb Math Skill, or does this need new pipeline?
- **Level concept in current state.** Likely absent (all classes baseline-25-implicit). Audit: confirm no level concept exists, or if it does, what shape it takes.
- **Stat modifier pipeline.** Per existing convention "additive first, multiplicative last." Audit: does the pipeline support per-unit pre-equipment modifiers (Level system would apply before equipment), or does this need a new stage?
- **MA factor on Math Skill status abilities.** Per Chris's note: the MA factor already exists and works correctly in Mage-class status appliers (Flametongue Burn, Brine Slow, etc.). The concern is specifically whether the Math Skill status-only abilities (Sculpted Enhancement, Engineered Defenses) — which don't scale with SP — include the MA factor in their hit-chance calculation. Audit: verify presence on these Math abilities; add if absent. Narrow Calculator-specific scope; no impact on existing status appliers.
- **Faith factor application.** Math abilities use SP × MA × Faith Factor (damage/heal/CT formulas). Confirm the Faith factor is uniformly available in the resolution pipeline; reuse rather than re-implement.
- **AoE preview UI.** Math Skill needs a "show me the units this calculation would hit" preview. Audit: is the existing AoE preview infrastructure extensible to non-AoE targeting predicates, or does Math Skill need its own preview component?
- **AI ability evaluation.** Audit: does the AI's ability-scoring framework cover non-AoE, non-single-target abilities? Math Skill's scoring needs to enumerate units matching each parameter-value combination and score them collectively.
- **Magus Crown interaction.** Magus Crown adds a secondary command set with -3 MA. Audit confirms: a Calculator with Magus Crown gets Math Skill + secondary + secondary at MA 5 (Calculator base 8 - 3). No special handling needed for Math Skill — flows through existing substrate.

## Goal

End state:

**Math Skill substrate:**
- Parameter-targeting predicate evaluates `(parameter, value)` across all units, returning the matching set.
- Resolution pipeline applies the ability's effect to each matching unit; friendly fire respected; self-targeting respected.
- Targeting UI shows the would-be-hit set with team-color coding before commit.
- AI evaluator enumerates the 80-option space (5 abilities × 4 parameters × 4 values) and scores per expected damage / heal / status application.

**Level system substrate:**
- Slot-based level assignment in team-builder: slot 1 = L25, alternating outward.
- HP/MP modifier: ±10% per ±1 from baseline.
- Dominant-stat modifier: ±1 at ±2 from baseline. Each class declares its dominant stat in class definition.
- Display: small level badge next to unit name in team-builder; effects implicit (not displayed in stat panel).
- Locked through battle; no in-battle level mutation.

**Calculator class:**
- ClassDefinition per blueprint stats.
- Mage + Universal armor.
- Three native R/S/M: Cornered Focus (Reaction, MA +1 on hit, cost 1), Mathematician (Support, +1 SP on Math + per-target MP multiplier 3→1, cost 2), Thoughtful Pacing (Movement, MP +2 per space moved, cost 1).

**Math Skill abilities:**
- Five abilities per blueprint, with status types as needed (Engineered Defenses status is new).

**Calculator team template:**
- Authored by Chris mid-session via S48 exporter.
- Default slot placement: Calculator at slot 3 (L26) for unrestricted Level math (immune to self-hit on Level calcs).
- Integrated as late commit.

**UI:**
- Math Skill picker with parameter/value selection + target preview.
- Level badge in team-builder roster cards.
- Math Skill ability tooltips (extending S48's tooltip work).

**Quality:**
- Tests +50-80 (estimated; substrate + class + abilities + Level + AI + template).
- ADRs: 0086 for Math Skill substrate; 0087 for Level system. (Or combined into one if the audit surfaces tight coupling.)
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated with Calculator-specific watch-fors.
- `docs/content-id-registry.md` Calculator additions.
- Browser verification: Calculator selectable, Math Skill targeting works end-to-end, Level system displays, team template loads, AI-controlled Calculator plays sensibly.

## Pre-implementation plan

Audit-first per project conventions. **Plan-review checkpoint between audit completion and substrate code-writing** — substrate scope is the variable that determines monolithic vs. split.

### Required first step: current-tree audit

Per "Paths to survey" above. The audit's deliverable: scope-per-piece table for the seven audit targets. Categorize each as additive / localized refactor / cross-cutting refactor (per S45/S47 precedent).

Likely outcomes per the audit-overturns-spec pattern (S40, S42, S43, S45, S47):
- Targeting system probably extends additively (parameter predicate + matching-set enumerator).
- Level system probably new ground (no existing level concept); shape depends on stat-modifier pipeline.
- Math Skill UI may absorb into existing ability-picker pattern.
- AI evaluator probably extends additively (per-ability scoring hook).

### Architectural decisions

After audit:

1. **Math Skill targeting predicate.** Recommend: ability definition gains `mathSkill?: true` flag (or equivalent type discriminant). When set, the ability's targeting is parameter-based; controller selects `(parameter, value)`; engine enumerates matching units. Resolution applies the ability's effect to each matching unit.

2. **Level system in unit state.** Recommend: `Unit.level: number` added (default 25 if not specified). Level set at team-build time from slot index. Modifiers applied in stat-resolution pipeline: HP/MP multiplied by `1 + 0.1 × (level - 25)`; dominant stat additive `+1 if level >= 27, -1 if level <= 23`. Class declaration adds `dominantStat: 'pa' | 'ma' | 'speed'`.

3. **Magus Crown + Math Skill.** No special handling. Magus Crown adds a third command set with -3 MA per existing substrate; Math Skill works through it like any other command set. Calculator + Magus Crown = Math + secondary + secondary at MA 5. Mage + Magus Crown + Math secondary = native spells + Math + tertiary at MA 8-9 depending on equipment. The MA penalty hurts both Mage's spells AND Math damage — natural balance.

4. **Faith factor on Math damage.** Reuse existing Faith factor (caster_faith × target_faith / 10000). Math damage = `SP × MA × Faith_factor`. Identical formula to mage spells.

5. **Math status applications.** Math Skill status-only abilities (Sculpted Enhancement, Engineered Defenses) are non-SP moves; their hit-chance must include the caster's MA factor — which already works correctly in Mage-class status appliers. Audit verifies the MA factor is applied on these Math abilities; adds it if absent. Narrow Calculator-specific scope; no ripple to existing status appliers (Shadow Stitch, Pin Down, Magebane, etc., which already work correctly).

6. **AI Math Skill scoring.** Simple v1: enumerate the 80 options (5 abilities × 4 parameters × 4 values); for each, enumerate matching units; compute expected damage/heal/status outcome; pick highest-scored option. Aggressive vs. Conservative variants deferred per blueprint.

### Decision points

(Settled in plan-review.)

**D1 — Math Skill substrate scope.** Audit-driven. Additive / localized / cross-cutting determines monolithic vs. split.

**D2 — Level system substrate scope.** Audit-driven. Likely new ground; could ship before Calculator if scope demands (gives team-building immediate value).

**D3 — Calculator stats.** Per blueprint: HP 101, MP 47, PA 5, MA 8, Speed 7, Move 2, Jump 2, 7/3/0 evades, Mage + Universal armor. Confirmed in plan-review.

**D4 — Calculator R/S/M.** Per blueprint:
- *Cornered Focus* (Reaction, cost 1): MA +1 on hit, accumulating, subject to per-enemy-turn cap (Speed Save / Updraft precedent).
- *Mathematician* (Support, cost 2): +1 SP on Math + per-target MP multiplier 3→1.
- *Thoughtful Pacing* (Movement, cost 1): MP +2 per space moved at turn end.

**D5 — Math Skill abilities.** Per blueprint, all five:
- *Precision Fire* (SP 3, fire, 50% Burn proc per target)
- *Targeted Treatment* (SP 4, heal)
- *Exact Rhythm* (SP 2, CT push, clamped at 0)
- *Sculpted Enhancement* (50% base, PA Up + MA Up infinite stackable)
- *Engineered Defenses* (80% base, +10 elemental resistance + 5% evasion infinite stackable)

**D6 — Engineered Defenses status definition.** New status type. Stores: resistance bonus (per element), evasion bonus (front/side/back), stack count, duration (infinite). Stackable per Chris's settling.

**D7 — Sculpted Enhancement & Engineered Defenses stackability.** Both stackable per Chris's settling. PA Up / MA Up already stackable per existing substrate. Engineered Defenses new status — defined as stackable.

**D8 — AI deployment role-aware sort.** Deferred per Chris. Calculator deploys via current HP-only heuristic in S49; tactical deployment is a known issue with playtest signal accumulating across multiple class additions.

**D9 — Calculator team template.** Chris authors mid-session via S48 exporter. Recommend Calculator at slot 3 (L26) for unrestricted Level math. Template name candidates (from blueprint): The Algorithm, Cold Equations, The Coefficient, Equation of State. Chris picks during authoring.

**D10 — MA factor on Math Skill status abilities.** Math Skill status-only abilities (Sculpted Enhancement, Engineered Defenses) are non-SP moves; their hit-chance calculation must include caster's MA factor. Mage-class status appliers (Flametongue Burn, etc.) already use this pattern correctly. Audit verifies MA factor presence on the Math abilities; small additive fix if absent. Narrow scope — no impact on existing status appliers and their base-chance calibration.

## Implementation work

### Math Skill substrate

- Add `mathSkill?: true` discriminant (or equivalent) to ability definition.
- Parameter targeting predicate: given `(parameter, value)`, enumerate all units where:
  - `parameter == 'ct'`: `unit.ct % value == 0` (or `isPrime(unit.ct)` for prime)
  - `parameter == 'height'`: `tileElevation(unit.position) % value == 0` (or prime)
  - `parameter == 'level'`: `unit.level % value == 0` (or prime)
  - `parameter == 'currentHp'`: `unit.currentHp % value == 0` (or prime)
- Resolution pipeline: apply ability effect to each matching unit; respect friendly fire intent (damage hits all matching; heal hits all matching; status applies to all matching per existing rules).
- Self-targeting: Calculator is included in matching set if their parameter matches.
- KO'd / removed unit exclusion: confirmed via audit (likely KO'd excluded, removed always excluded).

### Level system substrate

- `Unit.level: number` field added.
- Slot-to-level mapping: slot 1 = 25, slot 2 = 24, slot 3 = 26, slot 4 = 23, slot 5 = 27, slot 6 = 22, slot 7 = 28 (pattern preserves on expansion).
- Class declaration: `dominantStat: 'pa' | 'ma' | 'speed'`.
- Stat resolution: at unit instantiation, after class base stats and before equipment modifiers:
  - HP_modified = HP_base × (1 + 0.1 × (level - 25))
  - MP_modified = MP_base × (1 + 0.1 × (level - 25))
  - dominant_stat_modified = dominant_stat_base + (1 if level >= 27, -1 if level <= 23, 0 otherwise)
- Team-builder displays level badge per slot.

### Calculator class

- ClassDefinition with stats per D3.
- Native R/S/M per D4.
- Math Skill command set as primary; standard cross-class secondary access.
- Mage + Universal armor.

### Math Skill abilities

Per D5. Each ability:
- **Precision Fire:** mathSkill targeting; damage = SP × MA × Faith; element = fire; on-hit 50% (Faith-gated, +MA factor when audit fixes formula) Burn proc.
- **Targeted Treatment:** mathSkill targeting; heal = SP × MA × Faith.
- **Exact Rhythm:** mathSkill targeting; CT reduction = SP × MA × Faith (clamped at unit.ct = 0).
- **Sculpted Enhancement:** mathSkill targeting; 50% base (Faith-gated) to apply PA Up + MA Up (infinite, stackable).
- **Engineered Defenses:** mathSkill targeting; 80% base (Faith-gated) to apply Engineered Defenses status (infinite, stackable; +10 elemental resistance per element + 5% evasion per facing).

### Engineered Defenses status (new)

- Status definition with stackable property.
- Per-stack effect: +10 to each elemental resistance (Fire, Water, Earth, Lightning, Holy, Dark), +5% to Front/Side/Back evasion.
- Duration: infinite.
- Tagged appropriately for Remedy interaction (likely NOT remedy-clearable since it's a buff; confirm in plan-review).

### Calculator team template

- Implementer ships exporter integration ready in early commit.
- Chris exports a Calculator-featuring 5-unit team mid-session.
- Late commit integrates the new template into `defaultTeamTemplates`.
- Default slot placement: Calculator at slot 3 (L26).

### Math Skill UI

- Math Skill picker: choose ability → choose parameter → choose value → preview matching units → confirm.
- Preview displays matching units with team-color coding (friend/foe distinction).
- Mouse-hover or keyboard navigation to cycle parameters/values.
- Reuse existing tooltip infrastructure (S48) for Math Skill ability descriptions.

### AI Math Skill scoring (v1)

- For each turn the AI controls a Math Skill user:
  1. Enumerate all 80 (ability × parameter × value) combinations.
  2. For each, enumerate matching units.
  3. Score each option:
     - Damage abilities: sum (enemy_damage) - (ally_damage); pick highest positive.
     - Heal abilities: sum (ally_heal_value) - (enemy_heal_value, weighted by enemy threat); pick highest positive.
     - Status apply: sum (enemy_debuff_value) - (ally_debuff_value), or (ally_buff_value) - (enemy_buff_value).
  4. Pick the highest-scoring option that exceeds some threshold (e.g., > 30 damage net, or > 1 expected status application).
  5. Default to physical attack if no Math option scores well.
- Aggressive / Conservative variants deferred per blueprint.

### MA factor on Math Skill status abilities

- Audit verifies Math Skill status-only abilities (Sculpted Enhancement, Engineered Defenses) include the MA factor in their hit-chance calculation.
- If absent, implementer adds — reuses the pattern already working in Mage-class status appliers.
- Small additive fix; narrow scope.
- No impact on existing status appliers (Shadow Stitch, Pin Down, Magebane, Blowdart, etc.); their base chances stay calibrated as-is.

### Tests

Estimated +50-80 tests:
- Math Skill targeting predicate (parameter × value enumeration): ~10
- Math Skill resolution pipeline: ~5
- Math Skill UI: ~5
- Level system slot mapping: ~5
- Level system stat modifiers (HP/MP/dominant-stat): ~5
- Calculator class definition: ~5
- Native R/S/M passives (Cornered Focus, Mathematician, Thoughtful Pacing): ~10
- Math Skill abilities (5): ~20
- Engineered Defenses status: ~3
- AI Math Skill scoring: ~5
- Calculator team template: ~3
- MA factor on Math status abilities (Sculpted, Engineered hit-chance with MA): ~3

### UI surfaces

- Class picker shows Calculator.
- Team-builder Level badge per unit slot.
- Math Skill picker (new UI panel for Math abilities).
- Targeting preview overlay (Math Skill cast).
- Tooltips for Math Skill abilities.

### Documentation

- `docs/decisions/0086-math-skill-substrate.md` (or combined with Level into 0086).
- `docs/decisions/0087-level-system.md` (or combined as above).
- `docs/handoff.md` updated.
- `docs/playtest-watch.md` updated.
- `docs/content-id-registry.md` Calculator additions.

## Acceptance criteria

**Math Skill substrate:**
- Math Skill ability picker functional; can choose parameter + value and preview targets.
- Resolution applies effect to all matching units; friendly fire respected; self-targeting respected.
- AI plays Calculator sensibly (picks scoring options; doesn't repeatedly hit own team for no reason).

**Level system:**
- Team-builder shows level per slot.
- HP/MP modifiers apply correctly at battle start.
- Dominant-stat modifier applies correctly.
- Levels stable through battle (no in-battle changes).

**Calculator class:**
- Selectable in class picker.
- Stats match D3.
- Native R/S/M apply correctly (Cornered Focus accumulates MA; Mathematician applies SP boost + MP discount; Thoughtful Pacing recovers MP).

**Math Skill abilities:**
- Precision Fire: damage + Burn proc work; AoE resolution across matching enemies + allies.
- Targeted Treatment: heal works; matching allies + enemies (the latter accidentally) receive HP.
- Exact Rhythm: CT push works; clamps at 0.
- Sculpted Enhancement: PA Up + MA Up application; stacks across casts.
- Engineered Defenses: new status applies; stacks; resistance + evasion buffs read correctly.

**Calculator team template:**
- Authored team loads correctly.
- Calculator at slot 3 (L26) confirmed.

**Quality:**
- Tests at 1449-1479, 0 failing.
- ADR(s) committed.
- `docs/handoff.md` + `docs/playtest-watch.md` + `docs/content-id-registry.md` updated.
- Browser verification: Calculator end-to-end (selection, build, deploy, battle, Math casts, Level effects, AI play).
- **Vercel pre-flight:** `rm node_modules/.tmp/tsconfig.app.tsbuildinfo` before final `tsc -b` to mirror fresh-build behavior (per S48 lesson).

## Out of scope

- **AI deployment role-aware sorting** (carry; deferred to dedicated session).
- **AI Math Skill Aggressive/Conservative variants** (blueprint notes; deferred to playtest-driven tuning).
- **Calculator stretch abilities** (Status-debuff Math, Drain Math, Banish Math — possible v2 additions; not v1).
- **Equipment expansion** (Hi-Potion / Holy Water / Elixir + accessories) — later.
- **Charm/Seduction substrate** — dedicated future session.
- **Pyromancer R/S/M consolidation** — future R/S/M review.
- **Knight-flavored defensive Movement passive** (Bulwark Stance replacement, S48 carry) — separate content session.
- **Speed Save / Updraft per-swing reaction cap** (S42 D5 deviation) — Cornered Focus inherits the same throttle, but the formal codification is a separate carry.
- **Renderer-side multi-swing animation polish** (S42 carry).
- **Hill-height adjustment on Stonebridge** (S47 D9) — playtest-driven.
- **Asymmetric siege scenario for Stonebridge** (S47 D8) — future content session.
- **Terrain bar mid-battle vanishing** (S46 carry) — pending repro.
- **ActionType-wiring smoke test** (S44/S48 carry) — assessed as low-value relative to existing TS coverage; deferred.
- **Calculator level mutation abilities** (e.g., "Level Shift" — change a unit's level mid-battle) — future class consideration; out of scope.
- **Larger teams beyond 5v5** — v1 ceiling.
- **Team import** functionality — not requested.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Substrate:**
- `src/engine/targeting/math-skill.ts` (new) — parameter-based targeting predicate.
- `src/engine/level/level-modifiers.ts` (new) — Level stat modifier application.
- `src/engine/types/unit.ts` (or equivalent) — `Unit.level` field.
- `src/engine/types/class.ts` — `dominantStat` field on ClassDefinition.
- `src/engine/types/ability.ts` — `mathSkill?: true` discriminant.
- `src/engine/status/status-application.ts` (or equivalent) — MA factor fix.

**Content:**
- `src/content/classes/calculator.ts` (new).
- `src/content/abilities/math-skill/` (new directory):
  - `precision-fire.ts`
  - `targeted-treatment.ts`
  - `exact-rhythm.ts`
  - `sculpted-enhancement.ts`
  - `engineered-defenses.ts`
- `src/content/passives/cornered-focus.ts`, `mathematician.ts`, `thoughtful-pacing.ts` (new).
- `src/content/statuses/engineered-defenses.ts` (new status type).
- `src/content/teams/calculator-template.ts` (new; integrated late commit).

**UI:**
- `src/ui/team-builder/roster-card.tsx` — Level badge.
- `src/ui/battle/math-skill-picker.tsx` (new) — targeting UI.
- `src/ui/battle/math-skill-preview.tsx` (new) — matching-units overlay.

**AI:**
- `src/ai/math-skill-scoring.ts` (new) — v1 max-EV evaluator.

**Tests:**
- Substrate fixtures across multiple files.
- Class kit test for Calculator.
- Math Skill ability tests.
- Level system tests.
- AI tests.

**Docs:**
- `docs/decisions/0086-math-skill-substrate.md`, `0087-level-system.md` (or combined).
- `docs/handoff.md` — at session close.
- `docs/playtest-watch.md` — Calculator + Math Skill watch-fors.
- `docs/content-id-registry.md` — Calculator additions.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first with plan-review checkpoint.** Substrate scope is the variable.
- **Vercel pre-flight discipline.** Per S48 carry: `rm node_modules/.tmp/tsconfig.app.tsbuildinfo` before final `tsc -b`. Catches the cached-build-passes-fresh-build-fails class of bug.
- **ADR for substrate.** Math Skill is meaningful new substrate; Level is meaningful new substrate. Either separate ADRs (0086, 0087) or combined (0086) — implementer's call based on coupling found in audit.
- **Iterative template authoring** per S48 pattern. Implementer ships everything else first; Chris exports Calculator team mid-session; implementer integrates as late commit.
- **MA factor on Math Skill status abilities.** Audit verifies Sculpted Enhancement and Engineered Defenses include the MA factor in their hit-chance calculation (the same pattern that already works correctly in Mage-class status appliers). Small additive fix if absent. Narrow Calculator-specific scope — no rebalance ripple to Shadow Stitch / Pin Down / Magebane / etc.
- **AI Math Skill scoring is new substrate** — v1 simple max-EV is sufficient; sophistication deferred.
- **Math Skill UI is the player-experience risk.** The mechanic is complex; the UI needs to make the parameter/value choice + target preview clear at a glance. Implementer surfaces UI sketches for plan-review if uncertain.

## Watch-fors

**Addressed this session:**
- Calculator class.
- Math Skill substrate.
- Level system substrate.
- 5 Math Skill abilities.
- Calculator R/S/M passives (Cornered Focus, Mathematician, Thoughtful Pacing).
- Engineered Defenses status.
- Calculator team template.
- Math Skill UI + AI v1.
- MA factor verification on Math Skill status abilities.

**Not addressed this session, longer-term carry-forward:**
- All standing carries (Equipment expansion, Charm/Seduction, R/S/M consolidations, etc.).
- AI deployment role-aware sorting (deferred; Calculator sharpens case further).
- AI Math Skill personality variants.
- Calculator stretch abilities (Status-debuff Math, Drain Math, Banish Math).

**Watch-fors specific to this session:**

- **Math Skill targeting UX clarity.** The mechanic is complex (parameter × value × matching set). Watch whether players can read the preview at a glance; if not, UI iteration needed.
- **Self-damage from Math.** Players will accidentally hit themselves with damaging Math (especially when not at L26). Tooltip / preview UI should make this visible; watch first-pass feedback.
- **Friendly fire on Math.** "I damaged my own ally" moments are expected as a feature. Watch whether the experience reads as "interesting trade-off" or "frustrating mistake."
- **Exact Rhythm snowball.** Multi-target CT push every Calculator turn could lock out enemies. Chris will stress-test; lever is SP reduction or cooldown if it snowballs.
- **Sculpted Enhancement stackable buffs.** Across multiple casts, party stats compound. Watch whether decisive or just feels like Calculator earning a slow setup.
- **Engineered Defenses stackable buffs.** Same concern at higher base rate (80%). Lever is non-stackable rule if it runs away.
- **Calculator at L26 (slot 3).** Naturally optimal placement for Level math. Watch whether everyone defaults to this and the mechanic becomes predictable, or whether other slot placements stay viable for different tactical reasons.
- **MA factor on Math status abilities (Sculpted, Engineered).** Audit confirms / adds MA factor in hit-chance calculation; reuses pattern from Mage-class status appliers. No expected ripple to other status appliers' rates.
- **AI Math Skill quality.** v1 simple max-EV may pick options that look weird to a human (hitting many allies for slight enemy hits). Watch whether AI play feels intelligent or arbitrary.
- **Magus Crown + Math interactions.** Calculator + Magus Crown = 3 command sets at MA 5; Mage + Magus + Math secondary = native + Math + tertiary at MA 8-9. Watch whether these are interesting build options or auto-picks for one or the other.
- **Calculator deployment placement.** HP-only sort puts Calculator (HP 101) middle of zone; tactical identity wants back. Carry forward as AI deployment role-aware case continues to sharpen.

## Estimated size

**Large.** Substrate-heavy. Comparable to S45 (Hunter + bows substrate).

**Split contingency:**

- **49a**: Math Skill substrate + Level system substrate + Calculator base class (stats + R/S/M only, no Math abilities yet).
- **49b**: Five Math Skill abilities + Engineered Defenses status + Calculator team template + Math Skill UI + AI scoring + MA factor status fix.

Or alternatively:

- **49a**: Level system substrate (standalone — adds team-building depth immediately, can ship without Calculator) + Calculator base class.
- **49b**: Math Skill substrate + abilities + UI + AI + template.

Per the audit-overturns-spec pattern, monolithic is plausible if substrate audits land additive. Plan-review checkpoint determines.

**Stretch indicators** (if cleanup completes early):
- Refactor the per-class `dominantStat` declaration to cover all 9 classes consistently (will need to anyway for Level system; opportunity to standardize).
- AI Math Skill scoring's per-ability heuristics refinement.
- `playtest-watch.md` triage pass (carry items accumulating; opportunistic cleanup).

These are pure-housekeeping; not core scope.
