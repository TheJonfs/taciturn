# Roadmap — Sessions 14 through 20

*Planning document — v0.2*

This document plans the next seven Claude Code sessions, covering the introduction of four magical attacker classes (Earth, Water, Fire, Lightning Mage), an expansion of the Knight class, and an AI refresh to keep up with the expanded content surface.

The arc spans approximately the second wave of engine extensions — magical damage, Faith pipeline, charged action lifecycle, AoE damage application, custom-trigger statuses, crit handling — plus the first substantive content beyond the Knight prototype. By the end of session 20, the engine should have most deferred items from session 13's progress report closed, and the playable content surface should support meaningful loadout decisions across five classes.

## Arc summary

| Session | Focus | Engine work | Content work |
|---|---|---|---|
| 14 | Magical damage foundation | Magical damage handler, Faith pipeline, resistance system, MP timing | (none — engine only) |
| 15 | Charged action lifecycle | Charged action entity, Charging status, interruption rules, projection queue integration | First charged ability (test) |
| 16 | Earth Mage (part 1) | Status application formula, status chance modifiers | Earth Mage skeleton: Base spell, Buff, Debuff, Reaction, Support |
| 17 | Earth Mage (part 2) + Knight expansion | AoE damage application, status durations on multiple targets | Earth Mage AoE + Ultimate; Knight Battle Skill expansion |
| 18 | Water Mage | CT push as damage rider, knockback, forced movement collision policy | Water Mage full kit |
| 19 | Fire Mage + custom-trigger statuses | Custom-trigger pattern (generalized from Burn), AoE shape modifiers | Fire Mage full kit + Burn status |
| 20 | Lightning Mage + AI refresh | Crit modifier infrastructure, self-damage, Vulnerable status, magical reactions; AI tier 1.5 | Lightning Mage full kit |

After session 20, you'll have: 5 classes (Knight + 4 Mages), ~15-18 status types, charged actions, magical damage, AoE damage, crits, custom-trigger statuses, knockback, and AI that plays the full content surface competently. That's the foundation for the second wave of class content.

---

## Session 14 — Magical damage foundation

**Type:** Engine-only session. No content beyond minimal proof-of-concept.

**Engine work:**
- Magical damage handler in the damage pipeline.
- Faith pipeline: `Faith_factor = (Faith_user / 100) × (Faith_target / 100)` symmetric application across damage and healing.
- Resistance system: tag-based with the `[-100, 200]` scale. (Type already lands in 13.7; this session wires the resistance stage handler that reads `Unit.resistances` per tag, composes via `signedMax` across multiple tags per ADR-0015, and applies the resistance modifier multiplicatively to damage. Effects with the `'healing'` tag short-circuit per ADR-0016.)
- `evasion_check` stage handler at the target stage, per ADR-0019. Reads target's class evasion (front/side/back from ClassDefinition baselines, already in 13.7) and the action's `hitRoll` field. Auto-hit short-circuits when `hitRoll` is omitted; magical-only damage skips the check.
- Brave/Faith fields on BaseStats are already in 13.7; this session adds the formula consumers (Faith_factor in magical damage, healing).
- MP cost timing: deduct on commit, no refund on fizzle.
- Healing as a tag-flipped variant of the damage pipeline.
- Stat composition for MA (probably already present from prior sessions, verify).
- Magical attacks always land for damage (no hit roll); resistance modifies damage; Faith modifies damage.

**Out of scope this session:**
- Status applications (next session adds the formula).
- Charged actions (session 15).
- AoE damage (session 17).
- Specific spells beyond test scaffolding.

**Verification approach:**
- Test fixture: a unit with MA, casting a hypothetical "test damage" magical ability against a target with Faith and resistance values. Verify damage = `(MA × power × variance) × Faith_factor × resistance_modifier` produces expected numbers across a range of inputs.
- Test fixture: a healing variant verifies negative-resistance absorption case (`resistance > 100` produces healing).
- MP timing test: fizzle path doesn't refund, commit path does deduct.

**Files likely touched:**
- `src/engine/damage/` — magical damage handler.
- `src/engine/types/` — Faith on Unit if not already there, resistance map type.
- `src/engine/catalog/` — damage tag enumeration.
- `docs/decisions/` — ADR for magical damage formula and Faith composition.

**References for Claude Code:**
- `docs/reference/battle-mechanics-guide.md` — the formulas live here. This is the canonical source for what the implementation should match.
- `docs/design/action-resolution.md` — damage pipeline architecture.
- `docs/design/status-effects.md` — hooks the damage pipeline fires on.

**Open questions to settle in-session if they arise:**
- ~~The exact tag composition rule for multi-tagged abilities~~ — settled by ADR-0015 (signed maximum, resistance wins ties).
- Whether the Speed ceiling lands here or with charged actions in session 15.

**Estimated session size:** Medium-heavy. Multiple subsystems land but they're cohesive.

---

## Session 15 — Charged action lifecycle

**Type:** Engine session, with a single test ability for verification.

**Engine work:**
- ChargedAction entity with own CT counter and Action Speed.
- The `actionSpeed` field on `ActiveAbilityDefinition` (already renamed from the old `chargeTicks` in 13.7). When `actionSpeed` is present on a committed UseAbility, the reducer spawns a `ChargedAction` at `ct: 0, speed: actionSpeed` and pairs a Charging status onto the caster; resolution fires when CT reaches the trigger threshold.
- Charging status with `Conditional` duration tied to the charged action's resolution.
- Coordination in the reducer: `use_ability` with `actionSpeed` set creates both ChargedAction and Charging status; resolution removes both.
- Charged actions integrated into CT projection queue alongside units.
- Tile-target validation: the `'tile'` TargetingSpec kind (already in 13.7's TargetingSpec union) is implemented in `validateAction` here. Tile-anchored charged AoE is a session 17 consumer; the validation lands earlier so the type check is real before content arrives.
- Engine-side auto-emit `turn_end` on active-unit KO (ADR-0013 deferred work). Today the demo orchestrator guards against KO'd active units; session 15 promotes the fix to the engine so any caller (a future replay-driven or networked orchestrator) inherits it. The fold-in here is natural because charged-action interruption needs a clean policy on "what happens when the active charge-resolver KO'd themselves."
- Interruption rules per Battle Mechanics Guide:
  - KO during charge → fizzle, no MP refund
  - Stop during charge → pause CT accumulation (charged action carries `paused` flag)
  - Silence during charge (for tagged spells) → fizzle at resolution
  - Don't Act → fizzle at resolution
  - Damage / movement → no interruption
- Target validity at resolution:
  - Tile-anchored AoE → resolves at tile location
  - Unit-anchored AoE → resolves at unit's current position (including KO'd unit's position)
  - Single-target on KO'd target → fizzle
  - Single-target on out-of-range target → resolves anyway (FFT pinning)

**Content work:**
- One simple charged ability — probably a basic "Slow Spell" that takes a few ticks to resolve and reduces target Speed. Used for testing the lifecycle. This is throwaway content; real spells come in session 16+.

**Out of scope:**
- Specific Mage class content (next session).
- Counter-spelling abilities that target ChargedActions in the queue (deferred until specific content needs it; the architecture supports it but no content consumes it yet).

**Verification approach:**
- Test fixture: cast a charged spell, advance CT, verify resolution at expected tick.
- Test fixture: apply Stop during charge, verify pause; remove Stop, verify resume.
- Test fixture: apply Silence during charge, verify fizzle at resolution.
- Test fixture: KO the target, verify single-target charged spell fizzles at resolution but tile-anchored AoE charged spell resolves.
- Replay test: a charged spell fully resolved produces deterministic outcome from action log.

**Files likely touched:**
- `src/engine/types/` — ChargedAction type.
- `src/engine/ct/` — projection queue integration.
- `src/engine/actions/` — `use_ability` reducer for charged path, `charged_action_resolve` system action handler.
- `src/engine/status/` — Charging status type, pause flag interaction.
- `src/content/abilities/` — test charged ability.

**Estimated session size:** Heavy. The charged action lifecycle touches several subsystems and the interruption matrix has many cases. Worth being explicit with Claude Code about scope and verification expectations.

---

## Session 16 — Earth Mage (part 1)

**Type:** Content + targeted engine extension for status application.

**Workflow note:** Per the standing practice, this session uses plaintext-first review for all five ability drafts and any new status type drafts before formalization. See the "Standing practice" section.

**Engine work:**
- Status application formula per Battle Mechanics Guide: `base_chance × Faith_factor × MA_factor × (1 - target_resistance/100) × status_modifiers`. The hit-roll fires inside `applyStatus` as the first non-noop step (after resistance, today a no-op).
- Status chance modifier hook (Earth Support's `× 1.25` is the first consumer).
- Status application pipeline polish: ensure the resistance check, application chance roll, stacking check, and onApply hook flow is clean.
- System actions for status side effects (per ADR-0017): hook handlers gain an optional `emittedActions: SystemAction[]` return slot; the engine appends emissions to the action chain and processes them through the reducer. New action types `status_remove` and `status_decrement_stack` ship with their reducers. Earth Mage may not directly need these, but the broader status surface this session benefits from the machinery; Sleep can be backfilled to use it.
- Spec-driven reaction compiler (per ADR-0017's Implementation note): a function that takes `ReactionAbilityFields` and produces `PassiveHookRegistration[]` consumed by the existing engine machinery. Counter (already shipping as a hand-coded passive) is refactored to use the compiler as the worked example. Earth's Reaction is the first new reaction to flow through it.

**Content work:**
- Earth Mage class definition: stats, default First Action command set, command set ID for Earth's spells. (Note: the `white_magic` command set with Cure already ships from session 13; Earth's Buff is a status-based mechanism — Regen — not a Cure-style direct healing, and is a different system that happens to use the same `applyStatus` machinery.)
- Five of Earth's seven abilities (the non-AoE, non-Ultimate set):
  - **Base spell** (instant or charged TBD per ability spec): magical damage with rider applying `<status>` (probably Move-1/Jump-1 debuff, since that's the Earth identity). Fires status application formula.
  - **Buff**: applies Regen status to ally, Faith-based application chance.
  - **Debuff**: applies Blind + Silence to target, Faith-based.
  - **Reaction (passive)**: on hit, self-buffs Move +1, Jump +1 for short duration.
  - **Support (passive)**: status chance × 1.25 modifier.
- New status types this session introduces:
  - **Regen** (heal-over-time, ticks at unit's CT)
  - **Move/Jump debuff** (additive stat reduction with duration)
  - **Move/Jump self-buff** (additive stat increase with duration; the inverse of above)
  - **Blind** (multiplicative reduction on physical hit chance — needs hook integration)
  - **Silence** (blocks magical/voice-tagged actions — fires `onActionAttempted` to reject)

**Out of scope:**
- Earth's AoE and Ultimate — those land session 17 alongside the AoE engine work.
- Other Mage classes' content.
- The non-expiring Poison status — defer to session 17 as part of broader Earth content; needs the AoE infrastructure to be the primary delivery vector for Poison anyway via the Ultimate.

**Verification approach:**
- Test fixture: Earth Mage casts Base spell on Knight with various Faith/MA combinations; verify damage and status application chance are computed correctly per formula.
- Test fixture: Earth Buff applies Regen to ally; verify ticks happen at the ally's CT cadence.
- Test fixture: Earth Debuff at high vs. low Faith targets demonstrates the symmetric Faith effect.
- Test fixture: Earth Reaction triggers on incoming hit at Brave 100 deterministically.
- Test fixture: Earth Support boosts another character's status application chance correctly.
- Integration test: full battle with Earth Mage vs. Knight, verify all five abilities cast meaningfully.

**Files likely touched:**
- `src/engine/status/` — application formula implementation.
- `src/content/classes/earth-mage.ts` — class definition.
- `src/content/abilities/earth/*.ts` — five ability definitions.
- `src/content/statuses/*.ts` — new status types.
- `src/content/command-sets/earth-spells.ts` — command set definition.

**Estimated session size:** Medium. Status application formula is targeted; content is bounded.

---

## Session 17 — Earth Mage (part 2) + Knight expansion

**Type:** Content + AoE engine extension.

**Workflow note:** Plaintext-first review applies to Earth's remaining abilities, the Knight expansion, and new status types. The engine portion (AoE damage application, knockback) doesn't go through ability review but should produce a brief plaintext design summary before implementation, particularly around the forced-movement-collision policy decision.

**Engine work:**
- AoE damage application: per-target damage roll, per-target status application, deterministic order (stable unit ID), reactions per target.
- AoE shape modifier hook (for Fire's "larger AoE" rider — but lay groundwork in this session since Earth's AoE is the first content consumer).
- Vertical tolerance enforcement on AoE (already designed; first content consumer here).
- Knockback / forced movement: reduce ChargedAction reducer logic for movement during AoE resolution. Forced movement collision policy — pick one of: damage on collision, cancel (knockback fails), or swap. Recommendation: **cancel** (simplest, FFT-faithful).
- **Equipment integration** (per ADR-0014): `Equipment` type on Unit, equipment-slot definitions on classes, the equipped-weapon WP read at the physical base stage. Existing physical handlers (`physicalPaWp`) refactor to compose `PA × WP × power_coefficient`; existing abilities' `power` values are reinterpreted (the old "power = WP × coefficient" splits into the two real factors, so damage numbers stay matched). This lands here because the Knight expansion is the first content that needs WP as a real factor.

**Content work:**
- Earth Mage's remaining two abilities:
  - **AoE spell**: Cross-shape damage with the Move-1/Jump-1 debuff rider and chance to apply.
  - **Ultimate**: Cross-shape with chance of applying Poison + Don't Act + Don't Move. The non-expiring Poison status type.
- Knight expansion:
  - Battle Skill command set fleshed out: Power Attack, Stasis Sword (status applier — applies Stop with low chance, exercises a Knight-as-status-vector pattern), maybe a Taunt or defensive ability.
  - Knight R/S/M abilities. Counter already ships from session 13 (refactored to the spec-driven shape in session 16); this session adds Damage Reduction support and a Knight-flavored movement ability (e.g., a heavy-armor "Slow but Steady" movement passive). Move +1, Float, and Fly already ship as content; new movement passives for the mage classes and Knight should be specifically class-flavored, not duplicates of the existing universals.
  - 1–2 starter equipment items beyond the Knight sword: a stat-buff item (e.g., a Strength Ring giving +1 PA) and a status-applying item (e.g., Boots of Haste granting permanent Haste while equipped) to exercise the equipment integration broadly.
  - Worth aligning with what the AI tier 1.5 work in session 20 will need to test against.
- New status types this session introduces:
  - **Poison (non-expiring)** — variant Poison with no duration tick, cleared only by ability/item.
  - **Don't Act** (already designed; first content consumer)
  - **Don't Move** (already designed; first content consumer)
  - **Stop** (already designed; first content consumer)

**Out of scope:**
- Other Mage classes' content (sessions 18+).
- Persistence of Brave/Faith changes (deferred per Battle Mechanics Guide).

**Verification approach:**
- Test fixture: Earth AoE on a 3×3 cluster of mixed enemies/allies — verify friendly fire, per-target damage rolls, per-target status rolls.
- Test fixture: Earth Ultimate with multiple targets demonstrates the multi-status-application pattern.
- Test fixture: AoE under a multi-layer feature (bridge) hits both layers within vertical tolerance per current spec.
- Test fixture: Knight Stasis Sword applies Stop with appropriate hit chance.
- Test fixture: Knight Counter reaction triggers and resolves correctly.

**Files likely touched:**
- `src/engine/damage/` — AoE damage application.
- `src/engine/map/` — AoE shape modifier hook integration.
- `src/engine/actions/` — forced movement collision logic.
- `src/content/abilities/earth/*.ts`, `src/content/abilities/knight/*.ts`.
- `src/content/statuses/*.ts` — non-expiring Poison, Don't Act, Don't Move, Stop.
- `docs/decisions/` — ADR for forced movement collision policy.

**Estimated session size:** Heavy. AoE damage application is substantial engine work, and the content surface across Earth and Knight is broader than session 16.

---

## Session 18 — Water Mage

**Type:** Content + CT manipulation polish.

**Workflow note:** Plaintext-first review applies to Water's seven abilities and the new Speed-1 status. Water's abilities are the first heavy users of CT push primitives — review should specifically confirm the magnitude of CT effects (`-2 × MA`, `+2 × MA`, +20 from reaction, -10 refund) feel proportionate against expected MA values from the stat tuning ranges.

**Engine work:**
- CT push as damage rider — first major content consumer of the CT push primitive. Implement and integrate cleanly with the damage pipeline so the rider is a clean part of ability resolution.
- Self-CT manipulation by reaction abilities (Water Reaction is "self +20 CT on hit").
- Knockback as a reusable movement effect (laid groundwork in session 17; Water Mage is the heaviest user).
- CT refund mechanism (Water Support: "magic actions refund 10 CT after use") — first consumer of post-action CT recovery hook.

**Content work:**
- Water Mage full seven-ability kit:
  - **Base spell**: damage + (-2 × MA) target CT push.
  - **Buff**: Faith-chance applies (+2 × MA) ally CT.
  - **AoE spell**: damage + Faith chance of knockback 1 space.
  - **Debuff**: Speed -1 status.
  - **Ultimate**: cone shape, always knocks back 1 space.
  - **Reaction**: self +20 CT on hit.
  - **Support**: magic actions refund 10 CT after use.
- New status types:
  - **Speed -1** (multiplicative Speed reduction status; clean addition).

**Out of scope:**
- Other Mage classes (sessions 19, 20).

**Verification approach:**
- Test fixture: Water Base spell pushes target CT correctly; verify projection queue order changes appropriately.
- Test fixture: Water AoE knockback with target adjacent to wall (collision) — verify cancel policy applies.
- Test fixture: Water Buff applies CT gain to ally, ally's projection updates.
- Test fixture: Water Reaction fires on incoming damage; self-CT increases.
- Test fixture: Water Support modifies CT cost of magic actions (this is interesting — it's effectively a partial refund, so the post-action CT cost is reduced by 10).

**Files likely touched:**
- `src/engine/ct/` — CT manipulation primitives, post-action refund hook.
- `src/engine/actions/` — knockback / forced movement integration with damage pipeline.
- `src/content/classes/water-mage.ts`, `src/content/abilities/water/*.ts`, `src/content/statuses/speed-debuff.ts`.

**Estimated session size:** Medium-heavy. CT push integration is the chunky piece; the rest is content work.

---

## Session 19 — Fire Mage + custom-trigger statuses

**Type:** Content + custom-trigger pattern engine extension.

**Workflow note:** Plaintext-first review applies to Fire's seven abilities and the Burn / stat-mod statuses. Burn's design has multiple dimensions worth discussing in plaintext — per-stack damage value, whether the trigger condition is purely CT-100 or has additional gating, how stack count is communicated in the UI, and balance against whether Fire becomes too dominant if Burn is reliable. The custom-trigger engine pattern itself should also have a brief plaintext design summary (it's being formalized as a generalized pattern, not a Burn-specific implementation).

**Engine work:**
- Custom-trigger status pattern. Generalized from the Burn-specific design in the Battle Mechanics Guide. A status type may declare a custom trigger condition (CT 100 reached, damage taken, action attempted, etc.) and an effect on trigger. Distinct from duration-tick and conditional duration modes.
- `STACK_COUNT_ADDITIVE` stacking rule (per ADR-0018; enum value already lands in 13.7 with `apply.ts` throwing on the branch). This session implements the branch — applying to an existing instance increments its stack count; new instance starts with `stacks: 1` (or the application's stack quantity). Burn is the first consumer.
- AoE shape modifier hook (Fire AoE rider: "larger AoE" — already partly groundwork in session 17, formalize here).
- Per-stack damage scaling for stacked statuses (Burn with N stacks deals N × per-stack magnitude per ADR-0018).

**Content work:**
- Fire Mage full seven-ability kit:
  - **Base spell**: damage + rider applies -1 PA, -1 MA (target stat-mod debuff).
  - **Buff**: Faith chance applies +1 PA, +1 MA to ally.
  - **AoE spell**: damage with larger-AoE rider (modifies the shape).
  - **Debuff**: applies Burn stack(s) to target.
  - **Ultimate**: line-shape damage that applies multiple Burn stacks.
  - **Reaction**: applies Burn stack to attacker on hit.
  - **Support**: magic damage also applies 1 stack of Burn.
- New status types:
  - **Burn**: custom-trigger (CT 100 reached on affected unit), damage = stack × per-stack magnitude, decrement stacks via `status_decrement_stack` system action (per ADR-0017); STACK_COUNT_ADDITIVE stacking rule (per ADR-0018).
  - **PA/MA buff/debuff statuses**: additive stat modifiers with duration. Probably one combined "Stat Buff" type with magnitude per stat, or four separate types — content designer call.

**Out of scope:**
- Lightning Mage content (session 20).
- AI awareness of Burn (session 20 includes it as part of tier 1.5).

**Verification approach:**
- Test fixture: apply Burn to a unit, advance CT to 100, verify damage applied and stack decremented.
- Test fixture: stack Burn 3 times on a unit, verify damage progression: 3, 2, 1, 0 across three CT-100 triggers.
- Test fixture: Fire AoE rider modifies shape from base AoE to larger AoE; verify hit count.
- Test fixture: Fire Reaction applies Burn to attacker; verify across multiple incoming hits.
- Test fixture: Fire Support adds Burn stack to all magic damage; verify when Fire Mage casts other elements (interesting interaction — Fire Support is a passive that adds Burn even to e.g. Earth spells).

**Files likely touched:**
- `src/engine/status/` — custom-trigger pattern, generalized.
- `src/engine/map/` — AoE shape modifier hook.
- `src/content/classes/fire-mage.ts`, `src/content/abilities/fire/*.ts`, `src/content/statuses/burn.ts`, etc.
- `docs/decisions/` — ADR for custom-trigger status pattern (formalizes Burn as the first instance and the pattern as architecture).

**Estimated session size:** Heavy. Custom-trigger pattern is real engine work that needs careful design.

---

## Session 20 — Lightning Mage + AI refresh

**Type:** Content + AI tier 1.5 + remaining engine extensions.

**Workflow note:** Plaintext-first review applies to Lightning's seven abilities, Vulnerable, and Crit_modifier statuses. Lightning's Ultimate (×4 damage with self-damage) and Buff (Crit_modifier) are particularly worth careful plaintext discussion — they introduce mechanics that don't appear elsewhere in the four Mages and need calibration. The AI work doesn't go through ability review but should produce a plaintext design summary of tier 1.5 heuristics before implementation, ideally with example scenarios where the AI's decisions differ from tier 1.

**Engine work:**
- Critical hit infrastructure: `crit_chance` and `crit_multiplier` as stat-queryable values via hook, applied during damage pipeline at the variance stage.
- Self-damage as ability cost: caster as target of own ability's damage component. Needs the damage pipeline to handle "ability deals damage to caster" as a clean case.
- Vulnerable status: custom-trigger ("on next damage taken, multiply by 1.5×, then remove self") — second consumer of the custom-trigger pattern from session 19; emits a `status_remove` system action (per ADR-0017) when consumed.
- Magical reactions: Lightning Reaction triggers on any hit with a small magical retaliation. Resolves the deferred question about reaction-on-magical-attack — confirm that Reactions trigger on magical incoming as well as physical, with per-Reaction filtering on `tag` if needed.

**Content work:**
- Lightning Mage full seven-ability kit:
  - **Base spell**: damage with × 1.5 rider.
  - **Buff**: Faith chance applies Crit_modifier status to ally (raises crit chance for duration).
  - **AoE spell**: damage with bonus damage per unit hit (chain damage).
  - **Debuff**: applies Vulnerable to target.
  - **Ultimate**: single target × 4 damage with self-damage equal to some fraction of caster's max HP.
  - **Reaction**: small MA-based damage to attacker on hit.
  - **Support**: MA × 1.25 modifier.
- New status types:
  - **Vulnerable**: custom-trigger on next damage taken; multiplies that damage; removes self.
  - **Crit_modifier**: additive boost to crit chance with duration.
  - **Stat × multiplier**: a multiplicative MA buff (Lightning Support is an equipped passive, not a status, but the status form may be useful for spells).

**AI work (tier 1.5):**
- Status-aware target selection: don't magic-attack Reflect-buffed targets (Reflect not yet implemented but will be soon — defer specifics; the AI should be agnostic to the specific status, just check for damage-blocking conditions before attacking).
- Reaction-aware planning: don't walk into Counter chains; weight target choice by likelihood of Counter triggering.
- AoE handling: AI evaluates AoE abilities by total expected damage across hit cluster, including friendly fire penalty.
- Stat-aware damage projection: AI estimates damage before committing using the actual damage formula, not a stripped-down approximation.
- Two-action turn planning: AI considers Move + Act combinations rather than evaluating each independently.

**Verification approach:**
- Test fixture: Lightning Buff raises a target's crit chance, verify subsequent attacks crit at expected rate.
- Test fixture: Lightning Ultimate against a tank — verify both damage to target and self-damage to caster.
- Test fixture: Vulnerable on a target — verify next damage is multiplied 1.5× and Vulnerable is removed.
- Test fixture: Lightning Reaction triggers on incoming magical hit (verifies the magical-reaction-gating decision).
- AI test: AI vs. Earth Mage with Reflect-equivalent in play — verify AI doesn't waste magic on the protected target.
- AI test: AI evaluates a 3-target AoE vs. single-target attack and picks the better expected outcome.
- Integration: full battle, mixed teams (Knight + 2 Mages each side), AI plays full content surface competently.

**Files likely touched:**
- `src/engine/damage/` — crit handling, self-damage path.
- `src/engine/status/` — Vulnerable status, custom-trigger refinement.
- `src/engine/actions/` — magical reaction gating decision applied.
- `src/ai/` — heuristic improvements.
- `src/content/classes/lightning-mage.ts`, `src/content/abilities/lightning/*.ts`, `src/content/statuses/*.ts`.
- `docs/decisions/` — ADR for magical reactions and crit handling.

**Estimated session size:** Heavy. Lightning Mage hits multiple deferred items at once, plus AI refresh is significant. Could realistically be split if Claude Code reports overload partway through.

---

## After session 20

The state of the project at the end of session 20:

**Content surface:**
- Knight (expanded), Earth Mage, Water Mage, Fire Mage, Lightning Mage. Five classes with full kits.
- ~15-18 status types covering buffs, debuffs, conditions, custom-trigger patterns.
- ~35-40 abilities total (7 per Mage + Knight's expanded set).

**Engine surface:**
- Magical damage handler.
- Faith pipeline (symmetric).
- Resistance system.
- Charged action lifecycle with full interruption matrix.
- Status application formula.
- AoE damage application.
- Custom-trigger status pattern.
- Critical hits.
- Self-damage handling.
- Magical reactions.
- CT manipulation primitives (push, refund).
- Knockback / forced movement.

**AI:**
- Tier 1.5: status-aware, reaction-aware, AoE-aware, stat-aware damage projection, two-action planning.

**Cleanup state (per session 13's progress report — referenced by topic, not numbering):**
- Items that should be closed by session 20:
  - **Charged actions** — closed in session 15.
  - **Magical damage** — closed in session 14.
  - **AoE damage** — closed in session 17.
  - **Per-status tick on skipped turn** — closed during status content sessions.
  - **Engine-side auto-emit `turn_end` on active-unit KO** (ADR-0013 deferred work) — closed in session 15 alongside the charged-action interruption work.
  - **Equipment integration** (per ADR-0014) — closed in session 17 alongside the Knight expansion.
- Items that may still be open:
  - **Teleport movement** — no class in this arc uses it. Defer to wave 2 if a class needs it.
  - **Specific reaction-fizzled action types** — landed if content surfaces it during sessions 17–20.
  - **Specific class-trait equipment integration breadth** — content-driven; the v1 set lands in session 17, more breadth is wave 2.

After session 20 we step back, evaluate, and plan wave 2: the remaining 5-7 classes for v1, second-tier engine work (equipment integration in depth, progression system foundations, spectator/replay UI), and tier 2 AI.

---

## Session ordering rationale

The sequence is engine-light first, content-heavy later, with engine extensions front-loaded where they have the highest content-utility leverage:

- **Sessions 14, 15** are pure engine work. They establish magical damage and charged actions before any class content depends on them. This avoids "build engine work on top of half-implemented engine work."
- **Sessions 16, 17** introduce content (Earth Mage, expanded Knight) once the magical damage and charged-action foundations are solid.
- **Session 17** adds AoE damage as a focused engine extension within a content session. This is the only session where engine and content are tightly coupled — Earth's AoE/Ultimate require AoE damage to ship, and the engine work is bounded.
- **Sessions 18, 19** are content + targeted engine work. Each Mage class's signature mechanic motivates a specific engine extension.
- **Session 20** combines a content class with AI refresh. The AI work is best done after most of the content surface is in place, so the AI can be tested against varied loadouts.

The ordering also distributes "session weight" — heavy engine sessions (14, 15, 17, 19) alternate with lighter content-focused sessions (16, 18, 20), giving Claude Code natural pacing.

## Standing practice: ability review before formalization

For every session that introduces or modifies abilities (16, 17, 18, 19, 20, and any future content sessions), ability authoring follows a two-stage workflow:

**Stage 1 — Plaintext review.** Before writing any formal AbilityDefinition object, Claude Code drafts each ability in plaintext / informal description and discusses it with Chris. Format:

```
Ability: <name>
Type: <active / reaction / support / movement>
What it does: <1-2 sentences in plain English>
Numbers: <power, MP cost, charge speed, status chances, durations, etc.>
Open questions: <anything the spec doesn't fully resolve, anything the implementer is unsure about>
Comparison to similar abilities: <how does this fit relative to other already-defined abilities>
```

The conversation in this stage:
- Confirms the ability matches the design intent in the class brainstorms.
- Calibrates numbers against the Battle Mechanics Guide's typical ranges.
- Surfaces interactions the spec doesn't explicitly cover (does this ability work on charging units? what if the target is KO'd? does the rider stack with itself?).
- Resolves first-pass tuning questions before they get baked into formal definitions.

**Stage 2 — Formal definition.** After plaintext is approved, Claude Code writes the formal AbilityDefinition object per the ability format spec, plus tests, and integrates it into the catalog.

The two stages are not interleaved — Claude Code drafts *all* the abilities for a class in plaintext, gets review, then formalizes them as a batch. This lets Chris see the class as a kit and evaluate balance/coverage before any code lands.

For sessions that primarily extend the engine (14, 15) or do AI work (20's AI portion), this practice doesn't apply — there are no abilities to review. For mixed sessions (e.g., 17's AoE engine work + Earth's AoE/Ultimate abilities), the practice applies to the content portion only.

The same workflow extends to **status type definitions** when a session introduces new statuses. New status types get plaintext review (purpose, behavior, stacking, duration ranges, hook surface) before formal StatusEffectType objects are written.

This adds upfront time to content sessions but compresses revision time later. A plaintext draft that surfaces "this rider should probably scale with caster MA, not be a flat number" is much cheaper to address than the same realization three sessions later when the formal definitions, tests, and balance assumptions all need revisiting.

## Cross-session dependencies

| Session | Depends on | Provides for |
|---|---|---|
| 14 | None new | All subsequent (provides magical damage foundation) |
| 15 | 14 (Faith pipeline, MP timing) | 16+ (charged abilities) |
| 16 | 14, 15 | 17 (Earth content patterns) |
| 17 | 16 (status content), AoE engine | 18-20 (AoE and forced movement) |
| 18 | 17 (forced movement) | 19, 20 (CT manipulation patterns) |
| 19 | 17 (AoE), all prior | 20 (custom-trigger pattern) |
| 20 | All prior | Wave 2 planning |

## Documentation updates per session

Each session should produce:
- Code changes per scope above.
- ADR entries for architectural decisions made in-session (forced movement collision, magical reactions, custom-trigger pattern formalization, etc.).
- Updated `docs/reference/battle-mechanics-guide.md` if formulas evolved.
- Progress notes to inform the next session — same format as session 13's progress report, but focused on what landed and what surfaced.

## Open coordination questions

Things to settle as we go but worth flagging now:

- **Stat curve specifics for the 5 classes.** Each class needs HP/MP/PA/MA/Speed curves. Tuning is iterative, but starting values should be deliberate. Probably draft per-class curves before each class's content session and revise as testing reveals balance issues.
- **Brave / Faith starting values for test units.** Battle Mechanics Guide specifies 100 Brave for testing Reactions deterministically; default Faith probably 60-70 for normal magic interaction. Confirm and document.
- **Status duration values per status.** Battle Mechanics Guide gives ranges; specific values land per-status during their content session.
- **Burn per-stack damage value.** Specifically called out as TBD; pick a small value (probably 5-8 at first) for session 19.

These are content-design decisions rather than architecture. They'll resolve as we move through the sessions.
