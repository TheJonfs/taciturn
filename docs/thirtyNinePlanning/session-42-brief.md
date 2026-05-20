# Session 42 Brief: Assassin Class + Two Weapons Substrate + Hallowed Bolt Swap

## Context

S41 closed with the KO/status redesign (ADR-0079), Knight kit refresh (Martial Expertise, Bravestrider, evasion 12/7/0, +2 MP across Battle Skills), and a polish trio (Alchemist tagline, renderer permadeath badge, ActionType-wiring conventions doc). Tests at 1224 / 111.

S42 introduces the **Assassin** as the second physical class beyond the Knight — a Speed-defined glass-cannon with native Two Weapons access, instant-ranged status-application Command Set, and an identity built around action economy and permadebuff pressure.

Three substantive pieces this session:

1. **Assassin class** — full class definition: stats, equipment compatibility, four-ability Command Set, native R/S/M passives.
2. **Two Weapons substrate + unified attack-execution pipeline** — Two Weapons as a Support that allows equipping a second weapon, executed through a refactored attack pipeline that supports multi-swing modifiers in general (Two Weapons today; future "attack twice with each weapon" accessory tomorrow, currently planned for S43).
3. **Hallowed Bolt swap on Knight** — Stasis Sword → Hallowed Bolt; Stop rider → Silence rider. Removes the Stop-on-Knight overlap with the Assassin's Shadow Stitch.

Scope: **Large.** Substrate work plus full class definition plus content swap. Split contingency: 42a/42b along substrate-content seam, decided in plan-review based on audit findings.

## Inputs (read first)

In recommended order:

1. `CLAUDE.md` — project conventions; references `docs/conventions/action-types.md` (S41).
2. `docs/handoff.md` — S41 close. Notable: `isInfiniteDuration` predicate at `engine/status/index.ts`; Martial Expertise as multiplicative-stat-mod precedent (PA × 1.25 via `modifyStatQuery`); Bravestrider's brave +10 lifts Stasis Sword-class apply rates (relevant to Hallowed Bolt calibration).
3. `docs/decisions/0079-ko-status-interaction.md` — KO/status rule. Undermine/Sow Doubt's permanent duration encodes as null-duration → persists through KO automatically.
4. `docs/conventions/action-types.md` — five-sites discipline. Two Weapons may or may not add new ActionTypes (audit confirms).
5. `core-types.md`, `action-resolution.md`, `ct-system.md` — engine model.
6. `ability-format-spec.md`, `ability-slots.md` — passive ability shape + slot conventions.
7. `status-effects.md` — Brave/Faith gating, status duration encoding.
8. `four-mages-design.md` — class structure reference.
9. `mage-war-equipment.md` — weapon roster + slot model (informs Two Weapons substrate).
10. `content-snapshot.md` — Knight stats post-S41 (effective PA 13 with Martial Expertise); reference for Two Weapons damage math.

### Paths to survey before planning

Current-tree audit required. **The attack-pipeline audit is the critical gating step** — what surfaces drives substrate scope and possible 42a/42b split. At minimum survey:

- **Every attack-flavored code path.** Catalog all sites where an attack gets executed: player Attack action; Counter Reaction; Battle Skills (Power Attack, Stasis Sword/Hallowed Bolt); any other ability-triggered attack. For each, identify the entry point and how damage / accuracy / variance / procs / reactions are dispatched. The unified pipeline shape depends on how consolidated these are today.
- **Equipment-slot model.** Currently weapons occupy a primary slot. Audit: is the slot model rigid (one weapon field) or composable (slots as a collection)? Two Weapons' second-slot support depends on the existing shape.
- **Status-formula registry.** How are formulas declared per ability? Is the gate-stat (Brave / Faith) data-driven or hard-coded? Brave-and-Speed and Faith-and-Speed are new variants this session.
- **`attack_proc` substrate** (S30 Cluster-5 + S40 work). Per-swing proc rolling is the expected behavior; audit confirms procs are gated by individual hits, not by attack actions.
- **Remedy predicate behavior.** Does Remedy currently cleanse stat-reduction statuses (PA Down, Brave Down, etc.)? Per Chris's convention, "stat debuffs not Remedy-clearable" — audit confirms or surfaces deviation.
- `src/content/abilities/` — Martial Expertise + Bravestrider as recent precedents; native passive structure.
- `src/content/classes/` — Knight + Alchemist as class definition references.
- `src/ui/` — equipment picker (second-weapon slot); action menu (Command Set additions); team builder (class tagline).

## Goal

End state:

**Class:**
- **Assassin** selectable in team builder. Stats: HP 96 / MP 24 / PA 6 / MA 3 / Speed 14 / Move 4 (5 with native Fleet of Foot) / Jump 4 (5 with Fleet of Foot) / Evades 8/4/0.
- Equipment: Universal armor / helm / accessory; weapons inherit no-class-gating convention.
- Native Support: Two Weapons (free); cross-class cost per D4.
- Native Reaction: Speed Save (cost 1); +1 Speed permanent on hit by enemy.
- Native Movement: Fleet of Foot (free; cross-class cost 1); Move +1, Jump +1.

**Command Set (4 abilities):**

| Ability | Effect | baseFraction | Duration | Gate | MP |
|---|---|---|---|---|---|
| Shadow Stitch | Apply Stop | 60% | 3 turns | Brave | 8 |
| Blowdart | Apply Poison | 80% | infinite | Brave | 8 |
| Undermine | Brave −20 | 80% | infinite (permanent) | Brave | 10 |
| Sow Doubt | Faith −20 | 80% | infinite (permanent) | Faith | 10 |

All four: instant activation, range 4h × 3v with LoS, no damage delivery, no damage-Reaction triggers, 100% delivery on accuracy roll (formula determines status application, not hit-or-miss). Formula multiplier `(0.9 + caster_speed/20)` applied uniformly.

**Two Weapons substrate:**
- Equipping Two Weapons (Support) allows the unit to equip a second weapon alongside the primary.
- PA × 0.75 penalty applied via `modifyStatQuery` (parallel to Martial Expertise's PA × 1.25).
- Multi-swing attack execution: each equipped weapon swings independently within a single attack action — own damage, accuracy, variance, procs; target's Reactions trigger per swing.
- Per-ability multi-swing eligibility configured via `weaponEligibility` predicate on `sourceContext`. Defaults set per D1b.

**Hallowed Bolt swap:**
- Stasis Sword removed from Knight's `freeAbilities` (stays in catalog as cross-class option, per D8 in S41 pattern).
- Hallowed Bolt added: damaging attack with Silence rider. baseFraction calibrated against Bravestrider-enhanced Brave (per D3).

**New formula variants:**
- Brave-and-Speed: `baseFraction × (caster_brave/100) × (target_brave/100) × (0.9 + caster_speed/20)`. Used by Shadow Stitch, Blowdart, Undermine.
- Faith-and-Speed: `baseFraction × (caster_faith/100) × (target_faith/100) × (0.9 + caster_speed/20)`. Used by Sow Doubt.

**Quality:**
- Tests at 1280+ (estimated +50-60 across substrate refactor, Two Weapons, new class, abilities, formula variants).
- ADRs: unified attack pipeline + multi-swing semantics (substantial); new formula variants (smaller).
- `docs/handoff.md` updated.
- Browser verification: Assassin built and exercised through a battle; Two Weapons Knight (cross-class) exercises multi-swing visibly; Hallowed Bolt swap visible in Knight kit.

## Pre-implementation plan (required)

Audit-first per project conventions. **Plan-review checkpoint between audit completion and substrate code-writing.** Two Weapons substrate scope hinges on audit findings; if existing attack-flavored paths are heavily bespoke, consolidation work could grow significantly and demand a 42a/42b split.

### Required first step: current-tree audit

Per "Paths to survey" above. The critical deliverable is a catalog of every existing attack-flavored code path, with an assessment of whether they consolidate cleanly under a unified pipeline or require substantial refactoring. Audit also covers the Remedy predicate behavior question (D2).

### Architectural decisions

After the audit:

1. **Unified attack-execution pipeline shape (per D1a).** Two plausible paths:
   - **Pattern B (recommended) — generic attack hook.** Every attack-flavored action flows through a common `executeAttack(attacker, target, sourceContext)` pipeline. The `sourceContext` carries the action kind plus a `weaponEligibility(weapon)` predicate. Two Weapons doesn't modify the pipeline itself — it just allows equipping a second weapon, which the pipeline naturally iterates over. Future "attack twice with each weapon" accessory layers on as a separate modifier increasing per-weapon swing count via the same pattern.
   - **Pattern D — narrow Two Weapons modifier.** Two Weapons specifically modifies basic Attack only; Counter / Battle Skills remain single-weapon. Smallest substrate scope but forecloses clean composition with the future accessory.
   - **Recommend Pattern B.** Costs more S42 substrate scope but avoids substrate refactor when the accessory lands. Audit confirms feasibility; if consolidation work is too large, split into 42a/42b is the safety valve.

2. **Per-ability multi-swing defaults (per D1b).** For each existing attack-flavored ability, set the default `weaponEligibility`:
   - *Basic Attack*: all equipped weapons → multi-swing.
   - *Counter*: all equipped weapons → multi-swing. Note: target's Counter Reactions still trigger per swing in the other direction (settled in design conversation).
   - *Power Attack*: all equipped weapons → multi-swing (damage Battle Skill; doubling damage is consistent).
   - *Hallowed Bolt* (new): **primary weapon only** → single-swing. Rationale: double Silence procs at Bravestrider-enhanced rate over-tunes the proc rate. Single-swing keeps the Silence calibration interpretable.
   - *Stasis Sword*: removed from Knight freeAbilities; if still equippable cross-class, single-swing for the same reason as Hallowed Bolt (status rider abilities opt out by default).
   - *Taunt*: not an attack flavor; doesn't enter the pipeline.

3. **PA × 0.75 stat composition.** Two Weapons uses `modifyStatQuery` parallel to Martial Expertise. Composition order per established convention: (base PA + equipment bonuses) × 0.75. Knight's Martial Expertise (also a Support, also PA-multiplicative) cannot stack with Two Weapons by Support-slot constraint, but the pipeline composes cleanly if a future ability introduces a second multiplicative.

4. **New formula variants.** Brave-and-Speed and Faith-and-Speed slot alongside existing Brave-and-MA and Faith-only variants. Implementation depends on how data-driven the formula registry is per audit.

5. **Speed Save accumulation pattern.** Each enemy hit grants +1 Speed permanent. **Recommend single status instance with a counter** (cleaner state) over stacking instances (functionally equivalent but messier). Status is positive, infinite duration, persists through KO per ADR-0079; not Remedy-clearable (Remedy targets negatively-tagged).

### Decision points

(Settled in plan-review.)

**D1a — substrate path.** Per architectural decision 1. Recommend Pattern B. Audit confirms scope.

**D1b — per-ability multi-swing defaults.** Per architectural decision 2. Defaults as listed; settle in-session as Chris reviews audit output.

**D2 — stat debuff Remedy clearability.** Audit current Remedy predicate behavior. Per Chris's convention: "stat debuffs not Remedy-clearable" is expected current behavior. If audit confirms, no change needed. If audit shows otherwise, **recommend keeping stat debuffs non-clearable** to preserve Undermine/Sow Doubt calibration as designed.

**D3 — Hallowed Bolt baseFraction.** Stasis Sword's Stop rider previously landed ~32% at Knight baseline (per design conversation). Hallowed Bolt swaps Stop for Silence at parallel baseFraction. With Bravestrider's brave +10 in modern Knight kit, apply rate rises ~32% → ~40-42%. **Recommend: hold baseFraction at Stasis Sword's prior value.** The Bravestrider uplift is a deliberate identity reward for the Bravestrider-built Knight. If playtest reads "too sticky," shave baseFraction; lever is calibratable in a small future tuning pass.

**D4 — Two Weapons cross-class cost.** **Recommend 3.** Two Weapons is high-impact (doubled weapon slots + doubled stat modifiers + doubled procs + doubled reaction triggers in both directions). Cost 3 makes it a deliberate cross-class Support choice. Cost 2 would compete directly with Martial Expertise (also cost 2); cost 3 differentiates. Free native on Assassin.

**D5 — Speed Save trigger gating.** Per Combat Focus precedent (S39): triggers on "hit by an enemy with damage." Clarify edge cases:
- Miss / evaded attack: no trigger.
- Status-only attack (no damage): no trigger.
- Counter-attack damage (Assassin's Counter-equipped target counter-attacks Assassin): yes, triggers (enemy hit with damage).
- Multi-swing attack landing multiple hits: triggers once per swing-that-hits (so up to 2 procs per Two-Weapons enemy attack against the Assassin).

**D6 — Stretch accessory inclusion.** **Recommend out of scope for S42.** Documented as known S43 candidate. The substrate (Pattern B unified pipeline + multi-swing eligibility) is built to support the accessory cleanly when it lands.

**D7 — Command Set MP costs.** Recommend:
- Shadow Stitch: 8 MP (3 castings at base MP 24)
- Blowdart: 8 MP (3 castings)
- Undermine: 10 MP (2 castings)
- Sow Doubt: 10 MP (2 castings)

Tight resource pressure forces tactical decisions. Settle in plan-review.

**D8 — Blowdart's status reference.** **Recommend shared Poison status definition with Geosage** (same DoT mechanics, same tick rate, same null-duration encoding per ADR-0079). Different access path (instant ranged vs charged AoE-rider) is the only distinction. Avoids doubling status surface.

**D9 — Hallowed Bolt naming.** Working name "Hallowed Bolt" — FFT-canonical from Holy Knight set. Alternative: "Lightning Stab" (also FFT canonical). Settle in plan-review or with implementer based on academy-Ivalice tone preference.

## Implementation work

### Class definition

- Add `assassin` class to the class registry. Stats per Goal.
- Equipment compatibility per audit + standard physical-class conventions.
- Native R/S/M passives in `freeAbilities`: Two Weapons, Speed Save, Fleet of Foot.
- Stable class ID; display name "Assassin."

### Two Weapons substrate

- **Pattern B unified attack pipeline (per D1a)**: refactor existing attack-flavored code paths to flow through common `executeAttack(attacker, target, sourceContext)`. The `sourceContext` carries `weaponEligibility(weapon)` predicate with per-ability defaults.
- **Equipment-slot model extension**: secondary weapon slot enabled when Two Weapons Support is equipped. Shape depends on audit findings.
- **PA × 0.75 stat modifier** via `modifyStatQuery` (parallel to Martial Expertise).
- **Per-ability multi-swing defaults (per D1b)**: configure each existing attack-flavored ability with appropriate `weaponEligibility`. Defaults documented in the ADR for future content authors.

### Command Set abilities

Per the Goal table. All four follow the same shape:
- Instant activation (no charge time).
- Range 4h × 3v with LoS.
- No damage delivery; no damage-Reaction triggers.
- Formula variant per gating: Brave-and-Speed or Faith-and-Speed.
- MP cost per D7.

**Shadow Stitch**: Stop, 3-turn finite duration (clears at KO per ADR-0079).
**Blowdart**: Poison (shared definition with Geosage per D8), infinite duration.
**Undermine**: Brave −20, infinite (permanent) duration, not Remedy-clearable per D2.
**Sow Doubt**: Faith −20, infinite (permanent) duration, not Remedy-clearable per D2.

### R/M abilities

**Speed Save** (Reaction, cost 1):
- Trigger: hit by enemy with damage (per D5).
- Effect: +1 Speed permanent, accumulating per single-instance-with-counter pattern.
- Persists through KO per ADR-0079.

**Fleet of Foot** (Movement, cost 1):
- Effect: moveRange +1, jump +1.
- Free on Assassin; cost 1 cross-class.
- Plugs into existing Movement passive pattern (cf. Bravestrider).

### Hallowed Bolt swap

- Remove Stasis Sword from Knight's `freeAbilities` (stays in catalog as cross-class option).
- Add Hallowed Bolt: damaging attack with Silence rider. Uses existing Magebane Silence definition.
- baseFraction per D3.
- MP cost: parallel to Stasis Sword's S41 post-bump value (8 MP).
- Single-swing weaponEligibility per D1b.

### Formula variants

- Brave-and-Speed and Faith-and-Speed variants slot into the formula registry per audit's recommendation.
- Speed term `(0.9 + caster_speed/20)` multiplied onto the existing gate-and-baseFraction product.

### AI handling

Minimal v1:
- Assassin AI uses Shadow Stitch on high-priority enemy targets (high-damage, high-MA, etc.).
- Uses Blowdart for sustained pressure.
- Uses Undermine/Sow Doubt as opening moves against priority enemies.
- Defaults to weapon attacks otherwise.
- Speed-advantage in action economy handled by existing turn-ordering substrate.

### Sample team template

Add a new template featuring the Assassin — composition settled in plan-review. Candidates: Assassin + Knight + 2 Mages (balanced control + burst); Assassin + Knight + Alchemist + Mage (full toolkit demonstration). Names from existing Ivalician pool.

### Tests

Estimated +50-60 tests across:
- **Two Weapons substrate**: equip-second-weapon flow; PA × 0.75 calculation; multi-swing dispatch; per-ability weaponEligibility defaults exercised; refactored pipeline preserves existing single-weapon behavior.
- **Class registry**: Assassin selectable; native passives applied.
- **Command Set abilities**: each applies its status; formula variants compute correctly across Speed values; MP costs deducted; permanence behavior (Undermine/Sow Doubt persist through KO).
- **Speed Save**: trigger gating (hit-with-damage, miss/evade/status-only edge cases); accumulator pattern; persistence through KO.
- **Fleet of Foot**: Move/Jump bonuses apply; native-vs-cross-class cost handling.
- **Hallowed Bolt**: Silence proc rate at calibrated baseFraction; single-swing eligibility preserved.
- **Formula variants**: Brave-and-Speed and Faith-and-Speed compute correctly at various Speed values; backward compatibility with existing Brave-and-MA and Faith-only formulas.
- **Multi-swing interactions**: procs roll per swing; target reactions trigger per swing; stat modifiers compose correctly across swings.

### UI surfaces

- Equipment picker: second-weapon slot conditionally available when Two Weapons equipped.
- Team builder: Assassin tagline (settle wording in plan-review or with implementer).
- Action menu: Assassin's four Command Set abilities with target picker + status-application forecast.
- Unit detail panel: Speed Save accumulator visible; Two Weapons + Fleet of Foot bonuses surfaced.

## Acceptance criteria

**Class:**
- Assassin selectable with correct stats and native passives.
- Two Weapons enables second-weapon slot; PA × 0.75 applies.
- Speed Save accumulates correctly; persists through KO.
- Fleet of Foot bumps Move/Jump.

**Command Set:**
- All four abilities apply their effects at calibrated rates.
- New formula variants compute correctly.
- Stat debuffs persist through KO and not Remedy-cleared per D2 audit outcome.

**Substrate:**
- Unified attack pipeline handles all existing attack-flavored actions.
- Multi-swing dispatch via `weaponEligibility` per ability default.
- Future "attack twice with each weapon" accessory's integration path identified in ADR.

**Hallowed Bolt swap:**
- Knight's Stasis Sword removed from `freeAbilities`; Hallowed Bolt added.
- Silence proc at calibrated rate per D3.
- Stasis Sword remains in catalog as cross-class option.

**Quality:**
- Tests at 1280+, 0 failing.
- ADRs: unified attack pipeline (substantial); formula variants (smaller).
- `docs/handoff.md` updated.
- Browser verification: Assassin exercise through battle; Knight + Two Weapons demonstration of multi-swing; Knight Hallowed Bolt visible.

## Out of scope

- **Stretch "attack twice with each weapon" accessory** (D6) — explicit S43 candidate; substrate built to support.
- **Charm/Seduction** — deferred per earlier discussion; needs team-override substrate, dedicated session.
- **Brave/Faith reduction abilities beyond Undermine/Sow Doubt** — no additional reduction abilities this session.
- **Knight base-PA recalibration** (S41 D2 carry) — playtest-driven future tuning.
- **Pyromancer R/S/M consolidation** (S41 D7 carry) — future R/S/M review pass.
- **AI deployment / random-fill** — Red still uses authored placements.
- **TS strict-mode error pile** (S34 carry) — separate session.
- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session.
- **Calculator class** — future expansion.
- **Additional consumables (Hi-Potion, Holy Water, Elixir)** — future content session.
- **Buff/debuff consumables** — needs `applyStatus` on `ConsumableEffects`.
- **Renderer-side multi-swing animation polish** — basic visual update reuses existing animation pattern; polish is future work.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Engine:**
- `src/engine/actions/execute-attack.ts` (new) — unified attack-execution pipeline.
- `src/engine/actions/reduce.ts` — refactor existing attack handling to flow through unified pipeline.
- `src/engine/items/contributions.ts` — equipment-slot extension for second weapon; PA × 0.75 contribution for Two Weapons.
- `src/engine/status/formula.ts` (or equivalent) — new Brave-and-Speed and Faith-and-Speed variants.
- `src/engine/reducers/abilities/` — Counter, Power Attack, Stasis Sword/Hallowed Bolt: route through unified pipeline.

**Content:**
- `src/content/classes/assassin.ts` (new).
- `src/content/abilities/two-weapons.ts` (new).
- `src/content/abilities/speed-save.ts` (new).
- `src/content/abilities/fleet-of-foot.ts` (new).
- `src/content/abilities/shadow-stitch.ts` (new).
- `src/content/abilities/blowdart.ts` (new).
- `src/content/abilities/undermine.ts` (new).
- `src/content/abilities/sow-doubt.ts` (new).
- `src/content/abilities/hallowed-bolt.ts` (new).
- `src/content/classes/knight.ts` — remove Stasis Sword from freeAbilities; add Hallowed Bolt.
- `src/content/teams/` — sample template featuring Assassin.

**UI:**
- `src/ui/equipment-picker.tsx` — second-weapon slot.
- `src/ui/team-builder-class-picker.tsx` — Assassin tagline.
- `src/ui/action-menu.tsx` — Assassin Command Set actions.
- `src/ui/unit-detail-panel.tsx` — Speed Save accumulator + Two Weapons display.

**Docs:**
- `docs/decisions/0080-unified-attack-pipeline.md` (or next ADR number) — substantial.
- `docs/decisions/0081-brave-speed-faith-speed-formulas.md` (or next ADR number) — smaller.
- `docs/handoff.md` — updated at session close.
- `docs/playtest-watch.md` — append Assassin-related observations.

## Workflow notes

- **Plaintext-first review required.**
- **Audit-first with explicit plan-review checkpoint between audit completion and substrate code-writing.** This session's substrate scope is uniquely audit-dependent — if the existing attack-pipeline code is heavily bespoke, consolidation work could push past session budget and require a 42a/42b split. The checkpoint is the safety valve.
- **Per-ability multi-swing defaults (D1b)** settled in plan-review after audit catalogs existing attack-flavored actions. Defaults should be conservative for status-rider abilities (opt-out where doubling would over-tune).
- **ActionType discipline** per `docs/conventions/action-types.md` (S41). Two Weapons substrate may or may not introduce new ActionTypes; multi-swing is more likely a within-existing-ActionType modification. If new types are added, the five-sites checklist applies.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: substrate scope explosion from heavily bespoke attack paths; per-ability multi-swing default disagreements; Remedy predicate clarification.
- **Phase F session** — capture playtest observations in `docs/playtest-watch.md`. Multi-swing balance, Assassin's permadebuff impact, Hallowed Bolt + Bravestrider synergy all generate signal.

## Watch-fors

**Addressed this session:**
- Assassin class (full kit).
- Two Weapons substrate (unified attack pipeline, multi-swing dispatch).
- Hallowed Bolt swap on Knight (removes Stop overlap with Shadow Stitch).
- New formula variants (Brave-and-Speed, Faith-and-Speed).
- Stat debuff Remedy clearability (audit + settle).

**Not addressed this session, longer-term carry-forward:**
- Stretch "attack twice with each weapon" accessory (S43 candidate).
- Charm/Seduction (team-override substrate, dedicated session).
- Knight base-PA recalibration (playtest-driven).
- Pyromancer R/S/M consolidation (future R/S/M review).
- AI deployment / tactics-layer pass.
- TS strict-mode pile.
- Pass-and-play toggle + dual deployment + battle-loop AI gating.
- Calculator class.
- Additional consumables (Hi-Potion, Holy Water, Elixir).
- Buff/debuff consumables (`applyStatus` extension).
- Renderer-side multi-swing animation polish.

**Watch-fors specific to this session:**

- **Knight + Bravestrider + Hallowed Bolt apply rate.** Bravestrider's brave +10 lifts apply rate over Stasis Sword's prior baseline. May read "too sticky" in playtest; lever is Hallowed Bolt baseFraction or Bravestrider brave magnitude.
- **Speed Save accumulator snowball.** Assassin getting hit early → faster → harder to hit. Likely balanced by HP 96 + 0 back-evade making early hits often lethal, but watch.
- **Multi-swing × Counter Reactions.** A Two-Weapons attacker eats two Counter procs per attack. Watch for whether this discourages multi-weapon use against Counter-equipped targets (good) or makes Counter feel oppressive (bad).
- **Multi-swing × Power Attack.** Knight + Two Weapons + Power Attack + Battle Gear = burst king. Validate balance vs other classes.
- **Stat debuffs persisting through KO + no cleanse.** Per ADR-0079 + D2: once Undermine/Sow Doubt lands, target wears it for the rest of the battle. Strong design; watch for whether early-turn debuff applications feel "locked in" or "fluid."
- **Undermine self-cancellation tension.** Lowering target Brave makes subsequent Brave-gated Assassin moves *less* likely on the same target. Anti-synergy is a design feature; watch for whether this reads as interesting tension or frustration.
- **Sow Doubt's double-edged effect on mage damage.** Reduces target's spells AND your team's mages' damage against them. Net depends on team comp.
- **Assassin's 0 back-evade.** Flanking is brutal; positioning matters intensely. May drive specific battlefield behaviors.
- **Two Weapons cross-class on Knight.** Knight + Two Weapons + dual axes = damage king per earlier math (1634 over 9 turns vs single-weapon Martial Expertise build at 1404). Watch for whether this overshadows Knight + Martial Expertise as default Knight build, or whether the shield-loss trade keeps it a real choice.

## Estimated size

**Large.** Three pieces: full class (medium), substrate refactor (substantial wildcard), Hallowed Bolt swap (small). The substrate refactor is the wildcard — if attack-pipeline consolidation is clean, total scope lands around S39 (Alchemist) size. If existing paths are heavily bespoke, refactor adds to substrate side, pushing toward S39+ or split.

**Split contingency: 42a / 42b along substrate-content seam.**

If split is needed:

- **42a: Substrate** — unified attack-execution pipeline + Two Weapons Support + PA × 0.75 stat modifier + per-ability `weaponEligibility` configuration + new formula variants. No Assassin class yet; substrate exercised through test fixtures and existing classes (Knight gets Hallowed Bolt swap here).
- **42b: Content** — Assassin class + Command Set abilities + Speed Save + Fleet of Foot + sample team template + AI heuristics.

**Recommendation:** plan-review checkpoint after audit completion. If audit reveals attack-pipeline consolidation is invasive (>50% of estimated session budget), split. Otherwise hold as monolith.
