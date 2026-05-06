# Reconciliation report — battle-mechanics-guide.md, ability-format-spec.md, roadmap-sessions-14-20.md

Reviewer's note: I read the new docs end-to-end, the existing design docs in dependency order, the architecture overview, the session 13 progress and handoff notes, ADRs 0008–0013, and the engine code that the new docs would touch (types, catalog definitions, hook signatures, damage pipeline, status apply, scheduler, validation). I have not changed anything; this report is structured by the categories you asked for, with each finding noting the location in both the new docs and the existing code/docs, the issue, and a suggested resolution direction.

---

## 1. Conflicts

### 1.1 Damage formula structure (Battle Mechanics Guide vs. damage pipeline implementation/ADR)

- **New doc:** [battle-mechanics-guide.md:88-90](docs/battle-mechanics-guide.md) gives `base_damage = PA × WP × power_coefficient` and `final_damage = base_damage × variance × resistance_modifier × critical × physical_modifiers`. Variance default range `[1.0, 1.0]`. Critical hits `1.5×` baseline 5%.
- **Code:** [physicalPaWp in handlers.ts:33-43](src/engine/damage/handlers.ts:33) implements `baseDamage = PA × power` (no WP factor; the `WP` is only present in a comment). [Attack ability](src/content/abilities/attack.ts:28-34) carries `variance: { min: 0.9, max: 1.1 }`, while [cure.ts:29-33](src/content/abilities/cure.ts:29) carries `variance: { min: 0.95, max: 1.05 }` — divergent from the guide's "default `[1.0, 1.0]`" + "Most weapons `[1.0, 1.0]`."
- **Issue:** The guide treats WP as a separate factor (eventually sourced from equipment per progress.md item 4), and asks for deterministic damage by default. The current implementation collapses WP into the ability's `power` and ships variance on every existing ability. Handlers.ts even comments that "when equipment lands, the equipped weapon's WP composes here instead of the ability's own coefficient" — which acknowledges this divergence is a known temporary stand-in.
- **Resolution direction:** No code change required for sessions 14–20 *unless* the equipment integration lands inside session 17 (Knight expansion). Surface for design discussion: when does WP become real? The guide assumes a `WP` factor exists separately; the roadmap doesn't allocate a session for equipment plumbing and the progress doc keeps it deferred. Decide whether sessions 14–20 should keep the current `power = PA × WP × coefficient` simplification or whether equipment must land first.

### 1.2 Charged-spell CT cost — guide vs. CT-system design doc / progression queue

- **New doc:** [battle-mechanics-guide.md:328-330](docs/battle-mechanics-guide.md) says casting a charged spell consumes the standard turn budget (Move+Act = 100 if Move was used, else Act-only).
- **Existing doc:** [ct-system.md:26-32](docs/design/ct-system.md) and ADR-0003 define the same CT cost categories and the projection-after-trigger constant. Roadmap session 15 will spawn a `ChargedAction` on commit and remove it on resolve.
- **Issue:** Not actually a conflict, but worth flagging — the guide's "the charged action enters the projection queue with its own Action Speed and CT counter, independent of the caster's CT" needs explicit clarification on **whether the caster's CT is reset on the cast turn or only on charge resolution**. ADR-0003 says the projection-after-trigger assumes Move+Act; ADR-0011 has the scheduler advance CT in one place. Implementation in session 15 needs to settle: does the caster's `turn_end` after committing a charged spell deduct the standard CT cost (as if the cast itself consumed Act) or zero CT (the cast's effect is deferred)?
- **Resolution direction:** Update ct-system.md or add an ADR in session 15 stating the rule explicitly. Recommended: caster's turn_end deducts standard Act-only / Move+Act per the guide — this matches FFT behavior and the existing reducer's bookkeeping needs no special case.

### 1.3 Sleep wakes on damage — guide vs. status-effects design

- **New doc:** [battle-mechanics-guide.md:140 (turn-skip context)](docs/battle-mechanics-guide.md) (and ADR-0011's reference to it) implies Sleep is a turn-skip status that wakes on damage.
- **Existing code:** Sleep is not yet in the catalog. ADR-0011 explicitly anticipates Sleep registering both `queryTurnSkipped` and `onDamageReceived`/`onApply` to remove itself.
- **Issue:** Not a hard conflict — the guide's note matches ADR-0011's design — but neither doc explicitly says "Sleep wakes itself by removing the Sleep status from inside `onDamageReceived`." The status-effects design doc currently lacks a section on "self-removing on event," and the v1 hook list doesn't expose a way for a hook handler to mutate state. The existing hook runners are read-modify-or-fire-and-forget, not state-modifying.
- **Resolution direction:** Surface for design discussion before session 16 (which introduces status-applying abilities) or 17 (Stop is in scope). Decide: does Sleep emit a system action `status_remove` on damage, or does the `onDamageReceived` hook gain a "removeSelf" return shape, or is it a separate `onWake` predicate? Add an ADR; update status-effects.md.

### 1.4 Resistance "highest absolute resistance wins" for multi-tagged abilities — vs. composition rules

- **New doc:** [battle-mechanics-guide.md:227](docs/battle-mechanics-guide.md) states multi-tagged abilities use "highest absolute resistance wins" composition. Same doc's stat-modifier section (line 297-300) says multiplicative stat modifiers compose multiplicatively.
- **Issue:** "Highest absolute" tag composition is a non-standard rule not yet captured anywhere in design docs or ADRs. The implementation will need to choose what `|resistance|` means when one tag is `+50` (resistant) and another is `-50` (weak) on the same hit — both have absolute value 50; the guide's rule produces a tie. Roadmap session 14 names this as "an open question to settle in-session if it arises."
- **Resolution direction:** Decide and ADR before session 14. Recommend: tie → take the *negative* (weakness wins ties, more dramatic outcomes), or take the *highest signed value* (resistance wins ties, more conservative). Either choice is fine; just pick once.

### 1.5 Magnitude semantics for multiple Haste sources — guide vs. status-effects open question

- **New doc:** [battle-mechanics-guide.md:295-296](docs/battle-mechanics-guide.md) says multiplicative stat modifiers compose multiplicatively across all sources: `Spell-Haste 1.5× × class-Haste 1.2× = 1.8× total`.
- **Existing doc:** [status-effects.md:217-218](docs/design/status-effects.md) flags this exact question as "lean toward 'different sources don't stack as same status; they both register hooks and the hook system composes their effects' — but worth confirming with a concrete example."
- **Issue:** The guide settles the question; status-effects.md still flags it as open.
- **Resolution direction:** Update status-effects.md to remove the open question and reference the guide's rule. No code change needed; the current `runModifyStatQuery` collector already runs handlers in source-tier order and threads through, so multiplicative composition is what happens by default.

### 1.6 Damage tag set — DamageTag union vs. guide's tag list

- **New doc:** Battle Mechanics Guide uses tags like `holy`, `fire`, `ice`, `lightning`, `mental`, `physical`, `magical`, `time`, plus damage-action tags `weapon`, `voice`. The ability format spec adds `earth` (in `tags`).
- **Code:** [damage.ts:28-37](src/engine/types/damage.ts:28) declares `DamageTag = 'physical' | 'magical' | 'weapon' | 'holy' | 'dark' | 'fire' | 'ice' | 'lightning' | 'healing'` — a closed union, no `earth`.
- **Issue:** Earth Mage content (session 16/17) requires `earth` as a damage tag. Adding it requires editing `DamageTag`. The guide says "Damage tags and status tags are the same namespace," implying a single open string union or a unified enum. Current code keeps them in separate places: `DamageTag` is a closed union in `engine/types/damage.ts`, while `StatusTag` is `string` (open) in `engine/types/status-tag.ts`.
- **Resolution direction:** Surface for design discussion before session 16. Three options:
  1. Add `earth` (and any other v1 tags) to `DamageTag` whenever a class introduces them; document the convention. Smallest change.
  2. Promote `DamageTag` to an open string union to match `StatusTag`. Simpler authoring; loses some compile-time safety.
  3. Unify damage and status tags as the guide implies (single `Tag` type).
  
  Recommend option 1 with an ADR documenting the convention. The current closed-union shape catches typos in handlers, which is a real benefit.

### 1.7 Status application formula — `MA_factor = 0.9 + MA/10` vs. magnitude semantics

- **New doc:** [battle-mechanics-guide.md:257-258](docs/battle-mechanics-guide.md) defines `MA_factor = 0.9 + MA_user / 10`. For MA at low end (3), factor ≈ 1.2; for MA at typical mid-tier 8-10, factor ≈ 1.7-1.9.
- **Existing code:** No status application formula yet — `applyStatus` runs unconditionally (per [apply.ts:50](src/engine/status/apply.ts:50): "Resistance check — no-op until Unit.resistances lands").
- **Issue:** This is **fine** as scoped to session 16, but worth flagging that the guide's formula assumes a hit-roll *gate* in front of `applyStatus` that doesn't exist yet. Session 16's "Engine work" lists "status application formula" — the work needs to introduce the roll *and* decide where it lands (before `applyStatus` enters its current pipeline, or as a new step at the start of `applyStatus`).
- **Resolution direction:** Confirm in session 16 plan. Recommend: roll happens inside `applyStatus` as the first non-noop step (after resistance, which is also no-op today). Outcome carries `kind: 'rolled_failure'` discriminant in `StatusApplicationResult`.

---

## 2. Ambiguities

### 2.1 What "AoE multiLayerBehavior: 'highest' | 'lowest'" actually means

- **New doc (ability spec):** [ability-format-spec.md:156](docs/ability-format-spec.md) declares `multiLayerBehavior?: 'all' | 'highest' | 'lowest'; default 'all'`.
- **Existing code/design:** [aoe.ts](src/engine/map/aoe.ts) implements only the `'all'` behavior. [map-and-battlefield.md:151](docs/design/map-and-battlefield.md) flags multi-layer behavior as an open question with the same options.
- **Issue:** The spec asserts the field exists with three values, but no design has settled. "Highest" and "lowest" are ambiguous: is it the highest-layer tile in the AoE footprint *globally* (so the AoE only affects, e.g., the bridge tiles even if some are high and some are low), or per-(x,y) (within each column, only the highest-qualifying layer)? The latter is what's implied by the existing design doc, but the spec doesn't say.
- **Resolution direction:** Surface for design discussion. Recommend per-(x,y) semantics — that's the FFT-style interpretation and matches the design doc's example (fireball under bridge). Update the spec wording.

### 2.2 ReactionAbility's `triggerCondition` vs. existing Counter implementation

- **New doc (ability spec):** [ability-format-spec.md:413-428](docs/ability-format-spec.md) defines `ReactionAbilityFields` with `triggerOn: HookName[]`, `triggerCondition?: TriggerCondition`, and `effects: AbilityEffect[]`. Spec carries a `customBraveCheck` field.
- **Existing code:** [counter.ts](src/content/abilities/counter.ts:25-53) implements Counter as a `PassiveAbilityDefinition` with raw `passiveHook('onActionTargeted', ...)` registrations — there is no `triggerOn`/`triggerCondition` decomposition. The spec's "effects + triggerCondition" model is a *higher-level abstraction* than what the engine currently consumes.
- **Issue:** The spec presents reactions as data-driven (effects + condition + Brave check). The current engine resolves reactions as **arbitrary hook handlers** that decide everything inline. To make the spec real, session 16 (or 19/20 when more reactions ship) needs to introduce a generic reaction-builder that compiles the spec into hook handlers — *or* reactions stay author-coded (passive hooks) and the spec is documentation rather than schema.
- **Resolution direction:** Surface for design discussion. Two viable paths:
  1. **Spec-driven reactions:** The catalog grows a builder that translates `ReactionAbilityFields` into `PassiveHookRegistration`s. Pays off when many reactions ship. Likely lands in session 19 (Fire's reaction) or 20 (Lightning's).
  2. **Spec is documentation, reactions stay code:** The new format spec serves as guidance for ability authors, but the actual `AbilityDefinition` type stays as it is. Reactions are still `PassiveAbilityDefinition`s with hand-coded hooks.
  
  Recommend deciding now; it affects all five mage classes' reactions in 14–20.

### 2.3 Where `Brave` and `Faith` actually live on `Unit`

- **New doc:** [battle-mechanics-guide.md:28-30](docs/battle-mechanics-guide.md) says Brave/Faith are character-layer (persistent across battles); [battle-mechanics-guide.md:475-533](docs/battle-mechanics-guide.md) describes their formulas.
- **Existing code:** [unit.ts](src/engine/types/unit.ts:23-40) has no `brave` or `faith` field. [stats.ts](src/engine/types/stats.ts:15-26) has only `spd`, `pa`, `ma`, `maxHpBase`.
- **Issue:** Sessions 14, 16, 20 all assume Brave/Faith are queryable from a unit. The roadmap (session 14) lists "Faith on Unit if not already there" in *Files likely touched*. Where do they live structurally? The guide says "character layer" (persistent), but `Unit` is a per-battle entity. Two reasonable shapes:
  1. Add directly to `BaseStats` (alongside `spd`, `pa`, `ma`).
  2. Add a separate `Unit.character: { brave, faith }` field reflecting the layered model.
- **Resolution direction:** Decide in session 14. Recommend option 1 for v1 simplicity (BaseStats already has everything else); the layered character/class/equipment/status model is computed by `modifyStatQuery`, so where `brave` is *stored* is independent of where it's *modified*. The roadmap's "Open coordination question" about Brave/Faith starting values implicitly assumes per-unit values; session 14 should put them on `BaseStats` and add `'brave' | 'faith'` to `StatName`.

### 2.4 `auto_hit` flag — guide implies it; spec doesn't include it

- **New doc:** [battle-mechanics-guide.md:171-172](docs/battle-mechanics-guide.md) says "Some abilities are flagged `auto_hit: true` — these bypass the hit roll entirely. Most heals and most utility abilities are auto-hit."
- **New doc (ability spec):** [ability-format-spec.md:138-171](docs/ability-format-spec.md) — `ActiveAbilityFields` has `hitRoll?: HitRollSpec` (omit for auto-hit) but doesn't define `HitRollSpec`'s shape. No explicit `auto_hit: true` field.
- **Issue:** Two ways to express "this ability auto-hits": omit `hitRoll` (per spec, implicit) or set `auto_hit: true` (per guide, explicit). The spec's "omit for auto-hit" is more elegant, but the guide makes it sound like an explicit flag.
- **Resolution direction:** Pick one and update the doc that doesn't match. Recommend the spec's "omit `hitRoll` = auto-hit" approach. Update the guide.

### 2.5 What does Cure being `'arc'` actually mean for v1 healing?

- **Existing code:** [cure.ts:21-25](src/content/abilities/cure.ts:21) sets `rangeMode: 'arc'` and tags include `'holy'` and `'healing'`.
- **New doc (guide):** [battle-mechanics-guide.md:227](docs/battle-mechanics-guide.md) says multi-tag composition is highest absolute resistance wins. With Cure being `holy` *and* `healing`, "holy" resistance would shift the healing amount under the formula. But [battle-mechanics-guide.md:131-132](docs/battle-mechanics-guide.md) says "Healing doesn't roll against resistance (you can't 'resist' healing in v1)."
- **Issue:** Cure has a `holy` tag. If a future status applies `holy` resistance, does Cure's healing reduce? The guide's "no resistance against healing" rule and the multi-tag rule conflict. Code today doesn't apply resistance at all, so no observable bug — but session 14 will land resistance and the conflict surfaces.
- **Resolution direction:** Update guide. Suggested rule: when an ability's tags include `healing`, all resistance-against-non-healing-tags (`holy` etc.) are ignored. Or alternatively: drop the `holy` tag from Cure so it's only `healing`. Surface for design discussion.

### 2.6 Hit roll location relative to the seven-stage damage pipeline

- **New doc (guide):** [battle-mechanics-guide.md:154-172](docs/battle-mechanics-guide.md) presents physical hit determination as one formula at-resolution. [battle-mechanics-guide.md:151](docs/battle-mechanics-guide.md) says "crit roll happens during damage pipeline at the variance stage, after the hit determination."
- **Existing code:** [pipeline.ts:54-83](src/engine/damage/pipeline.ts:54) initializes `hit: true` and lets handlers override; the comment in [damage.ts:80-84](src/engine/types/damage.ts:80) says "v1 ships with no evasion handlers, so the orchestrator initializes `hit: true` and lets future handlers override."
- **Issue:** The pipeline architecture supports it — but where in the seven stages does hit determination fire? "After base, before attacker"? Or as a pre-stage gate that early-exits the pipeline (skipping all stages and finalizing damage = 0)? Roadmap session 20 says crit modifier fires at the variance stage; doesn't say where the hit roll fires.
- **Resolution direction:** Surface for design discussion before session 20 (when the hit-roll path becomes load-bearing). Recommend: a new stage handler `evasion_check` that runs at the `target` stage (target's evasion is target-side) and sets `hit = false`, and `finalize` reads `hit` and sets `finalDamage = 0`. No new pipeline stage required.

---

## 3. Naming and terminology drift

### 3.1 Targeting mode strings

- **New doc (ability spec):** Uses `'melee' | 'straight_line' | 'arc' | 'self'` for `targetingMode`.
- **Existing code:** [ability-definition.ts:36](src/engine/catalog/definitions/ability-definition.ts:36) has `RangeMode = 'melee' | 'straight_line' | 'arc'` — no `'self'`. `'self'` is folded into `TargetingSpec.kind: 'self'`.
- **Issue:** The new spec collapses targeting mode and target-self-flag into a single field; the engine separates them (`TargetingSpec` is a discriminated union; for `'self'` no range is needed). This is a real shape difference, not just a name drift.
- **Resolution direction:** When the schema becomes load-bearing (session 16), keep the engine shape and update the spec to match — the engine's `TargetingSpec` discriminated union is more rigorous. Or, alternatively, write a content-side translator that maps the spec form to the engine form. Recommend the former (update the spec).

### 3.2 `bucketCost` vs. `baseCost`

- **New doc (ability spec):** [ability-format-spec.md:117](docs/ability-format-spec.md) names the field `bucketCost`.
- **Existing code:** [ability-definition.ts:30](src/engine/catalog/definitions/ability-definition.ts:30) names it `baseCost`.
- **Issue:** Same concept, two different names. The engine's `baseCost` is the *pre-modifier* cost (class can drop to 0); the spec's `bucketCost` is just the cost.
- **Resolution direction:** Update the new spec to use `baseCost`. The engine name better captures the per-character cost computation pattern.

### 3.3 `displayName` vs. `name`

- **New doc:** [ability-format-spec.md:24-25](docs/ability-format-spec.md) uses `displayName` consistently across `ClassDefinition`, `AbilityDefinition`, etc.
- **Existing code:** All catalog definitions use `name` (see [class-definition.ts:40](src/engine/catalog/definitions/class-definition.ts:40), [ability-definition.ts:24](src/engine/catalog/definitions/ability-definition.ts:24), [status-effect-type.ts:13](src/engine/catalog/definitions/status-effect-type.ts:13)).
- **Issue:** Pure naming drift.
- **Resolution direction:** Update the spec to use `name`. (Alternative: rename `name` → `displayName` everywhere in code — far more invasive, no real payoff.)

### 3.4 `abilityType: 'active' | 'reaction' | 'support' | 'movement'` vs. `kind` discriminator

- **New doc (spec):** [ability-format-spec.md:113](docs/ability-format-spec.md) uses `abilityType` as the four-way discriminator.
- **Existing code:** [ability-definition.ts:107-124](src/engine/catalog/definitions/ability-definition.ts:107-124) uses `kind: 'active' | 'passive'` — *two-way*, not four. The R/S/M discrimination happens via the `bucket` field.
- **Issue:** Architectural difference: the engine treats reactions, supports, and movement passives as a *single* kind (`passive`), distinguished by which Passive bucket they live in. This isn't drift — it's by design (all three flavors share the same hook surface). The spec breaks them apart.
- **Resolution direction:** Update the spec to match the engine: top-level `kind: 'active' | 'passive'`; passive variants live in their respective `bucket`s. Or surface for design discussion if there's a reason to treat them as four kinds (none is apparent). Recommend the former.

### 3.5 `actionSpeed` vs. `chargeTicks`

- **New doc:** [ability-format-spec.md:149](docs/ability-format-spec.md) uses `actionSpeed?: number` ("omit for instant; present means charged"). [battle-mechanics-guide.md:336-344](docs/battle-mechanics-guide.md) likewise uses Action Speed values (Quick/Fast/Standard/etc., 5-100+).
- **Existing code:** [ability-definition.ts:114](src/engine/catalog/definitions/ability-definition.ts:114) uses `chargeTicks: number` ("0 = instant").
- **Issue:** *Different names for different concepts.* Action Speed is the rate of CT accumulation per tick; chargeTicks (in the existing code's comment) is "the initial CT-shaped charge time" — but ChargedAction has both `ct` and `speed` fields per [charged-action.ts:18-20](src/engine/types/charged-action.ts:18). Currently `chargeTicks` is overloaded. The guide's mental model (Action Speed → charge resolves at known tempo) and the field name `chargeTicks` (charge time in ticks) are inconsistent with each other and with the existing ChargedAction shape.
- **Resolution direction:** **Surface for design discussion as part of session 15 scope.** The naming needs to land for the first charged ability. Two coherent options:
  1. Active abilities declare `actionSpeed: number` (CT per tick, omit for instant). When committed, a `ChargedAction` is spawned with `ct: 0`, `speed: actionSpeed`, and triggers when its CT reaches 100. This matches the guide and ct-system.md.
  2. Active abilities declare `chargeTicks: number` (number of ticks to wait, 0 = instant). The ChargedAction's `speed` is derived: `speed = TRIGGER_THRESHOLD / chargeTicks`.
  
  Recommend option 1 — the design doc and guide both say Action Speed. Rename `chargeTicks` → `actionSpeed` in `ActiveAbilityDefinition`. Document that the ChargedAction is spawned at ct=0, speed=actionSpeed.

### 3.6 `bucketCapacities` ergonomic mismatch on `ClassDefinition`

- **New doc (spec):** [ability-format-spec.md:48](docs/ability-format-spec.md) says `ClassDefinition.baselines.bucketCapacities?: Partial<Record<BucketId, number>>` — a *class-level override* on top of the v1 default.
- **Existing code:** [class-definition.ts:38-44](src/engine/catalog/definitions/class-definition.ts:38) does not have any `bucketCapacities` override. Bucket capacities currently live only on the ruleset; classes don't override them today.
- **Issue:** The spec adds a class-level override path that doesn't exist. Roadmap doesn't allocate work to add it.
- **Resolution direction:** Either drop from the spec for v1 (capacity overrides per class are deferred until a class needs them), or add the field + capacity-composition logic in the appropriate session. Recommend dropping for v1 — defer until a class needs it.

### 3.7 `tags` on classes and abilities

- **New doc (spec):** Classes have `tags?: ClassTagId[]` and abilities have `tags: AbilityTagId[]`. Status types have `tags: StatusTagId[]`. Damage tags (`damageTags`) appear separately on `DamageEffect`.
- **Existing code:** Status types have `tags: ReadonlyArray<StatusTag>` (open string). Class definitions have **no** `tags` field. Ability definitions have **no** `tags` field. `DamageSpec.tags: ReadonlyArray<DamageTag>` (closed union).
- **Issue:** The spec introduces three new tag taxonomies (ClassTagId, AbilityTagId) that don't exist in the engine. They're presented as if already a thing.
- **Resolution direction:** Surface for design discussion. If the new taxonomies are needed, add them as catalog fields when their first consumer ships. Recommend: drop ClassTagId for v1 (no consumer); AbilityTagId is needed for content like Silence (`voice` tag) and the Fire Mage's "magic actions also apply Burn" support — add it in session 16 when Silence ships.

### 3.8 `StatusInstance` doesn't have `stacks` initialization for `STACK_ADDITIVE` Burn

- **New doc (spec):** [ability-format-spec.md:540-549](docs/ability-format-spec.md) defines Burn with `stackingRule: 'STACK_ADDITIVE'` and `customTrigger.decrementStacksOnTrigger: true`.
- **Existing code:** [status.ts:35-36](src/engine/types/status.ts:35) has `stacks?: number` as optional. [stacking.ts (used by apply.ts)](src/engine/status/stacking.ts) implements STACK_ADDITIVE by adding magnitudes (per [stacking-rule.ts:10](src/engine/types/stacking-rule.ts:10): "magnitudes add; duration refreshes"). The `stacks` field is currently for STACK_INDEPENDENT.
- **Issue:** The Burn design wants a *stack count* that decrements on trigger. The existing `STACK_ADDITIVE` rule adds *magnitudes*, not stack counts. Burn's design wants a third behavior: stack-count-based trigger damage. Either (a) Burn re-purposes the magnitude as stack-count, (b) STACK_ADDITIVE is modified to add stacks, or (c) a new stacking rule is introduced.
- **Resolution direction:** Surface for session 19. Recommend: Burn uses `stacks` (not magnitude) as its stack count. STACK_ADDITIVE rule grows a per-status flag declaring whether stacks or magnitudes accumulate. Or: introduce `STACK_COUNT_ADDITIVE` and let Burn use that.

---

## 4. Missing prerequisites

### 4.1 Resistance system on `Unit`

- **Where assumed:** Battle Mechanics Guide repeatedly references `target_resistance` per tag. Session 14 plan calls out "Per-tag storage on Unit, additive composition across sources, multiplicative onto damage."
- **Missing:** [unit.ts](src/engine/types/unit.ts:23-40) has no `resistances` field. Also referenced as a no-op in [apply.ts:50](src/engine/status/apply.ts:50) ("Resistance check — no-op until Unit.resistances lands").
- **Action:** Land in session 14. Add `Unit.resistances: ReadonlyMap<TagId, number>` (or similar). Update the `applyStatus` resistance check and the magical/status formula handlers to read it.

### 4.2 Faith and Brave on Unit

- See 2.3 above.

### 4.3 Per-class evasion (Front/Side/Back)

- **Where assumed:** [battle-mechanics-guide.md:438-447](docs/battle-mechanics-guide.md) tabulates Front/Side/Back evasion per class. [ability-format-spec.md:47](docs/ability-format-spec.md) declares `baselines.evasion: { front: number; side: number; back: number }`.
- **Missing:** [class-definition.ts](src/engine/catalog/definitions/class-definition.ts) has no evasion fields.
- **Action:** Surface for design discussion. The hit-chance formula needs evasion *and* a facing-relative-to-attacker computation. Roadmap doesn't explicitly allocate this — recommend adding to session 14 (alongside Faith/resistance) since the physical hit roll is part of "magical damage foundation"'s symmetry.

### 4.4 Status application chance roll inside `applyStatus`

- See 2.6 above. Needs to land in session 16.

### 4.5 Charged-action lifecycle

- **Where assumed:** Session 15 entirely. Ability format spec declares `actionSpeed` field with semantic.
- **Missing:** [reducers.ts:211-215](src/engine/actions/reducers.ts:211) currently throws `chargeTicks > 0 not implemented yet`. Scheduler treats charged actions in projection but doesn't emit `charged_action_resolve` (per progress.md item 1: "the scheduler currently picks turn_start as the only trigger kind"). The Charging status type doesn't exist in `src/content/statuses/`.
- **Action:** Session 15 must land all of: `reduceUseAbility` charged path, scheduler emitting `charged_action_resolve`, Charging status type, Stop's `paused` flag (per [battle-mechanics-guide.md:367-371](docs/battle-mechanics-guide.md)). Note: the `paused` flag on `ChargedAction` doesn't exist in the type yet ([charged-action.ts:15-23](src/engine/types/charged-action.ts:15)). Add it.

### 4.6 `getCommandSet`, `getAbilitiesInCommandSet` — already present

- Confirmed already plumbed (catalog has `CommandSetDefinition` with `abilities: AbilityId[]`).

### 4.7 AoE damage application (per-target loop)

- **Where assumed:** Session 17 plan.
- **Missing:** [reducers.ts:234-251](src/engine/actions/reducers.ts:234) handles only single-target damage. [progress.md:79-83](docs/progress.md) explicitly notes "v1 abilities are all `single_unit`. The reducer's per-target loop is implied but not exercised."
- **Action:** Session 17 needs to grow `reduceUseAbility` to handle `aoe` targeting (and update `validateAction` for `tile` target kinds).

### 4.8 Tile-anchor and unit-anchor target kinds in `AbilityTarget`

- **Where assumed:** Session 17 / 18 (knockback against tile-anchored AoE), session 15 (charged AoE on tile).
- **Existing code:** Per [ability-definition.ts:51-57](src/engine/catalog/definitions/ability-definition.ts:51), `TargetingSpec` is `'self' | 'single_unit'`. The `AbilityTarget` payload type includes `'tile'` (per the validate.ts source) but `validateAction` only handles `'self'` and `'unit'`.
- **Action:** Session 15 (which adds tile-anchored charged AoE) must extend the `TargetingSpec` union and validation accordingly. This is non-trivial — flag for the planner.

### 4.9 Custom-trigger status pattern

- **Where assumed:** Session 19. Spec defines `customTrigger` field with `triggerEvent` enum.
- **Missing:** [status-effect-type.ts:11-19](src/engine/catalog/definitions/status-effect-type.ts:11) has no `customTrigger` field. The hook list ([hooks.ts:43-153](src/engine/hooks/hooks.ts:43)) has no event corresponding to "unit_ct_threshold" — the closest is `onTurnStart`, but Burn fires *before* the unit's turn starts (when CT *first* reaches 100).
- **Action:** Session 19 needs to introduce both the `customTrigger` field and the trigger-firing hookpoint. Recommend implementing it via a new `onCtThresholdReached` hook fired by the scheduler when a unit crosses CT 100 (before `turn_start` commits).

### 4.10 CT push primitive as an effect

- **Where assumed:** Session 18. Spec defines `CTPushEffect`.
- **Existing:** No CT push primitive in the action lifecycle today. ct-system.md ("First-class CT operations") names it as one of the three ops, but no engine code writes a CT push.
- **Action:** Session 18 introduces it. Naming question: does CT push happen as part of the `use_ability`'s outcome (a `ctPush` field per target), or as a generated system action `ct_push`? Recommend the latter — keeps CT mutation in the scheduler/turn layer, consistent with ADR-0011.

### 4.11 Knockback / forced movement primitive

- **Where assumed:** Session 17. Per [ability-format-spec.md:237-241](docs/ability-format-spec.md), `KnockbackEffect` declares `direction: 'away_from_caster' | 'random' | 'toward_caster' | 'random_cardinal'`.
- **Missing:** No knockback primitive in code. The `onMoveStep` hook ([hooks.ts:139-142](src/engine/hooks/hooks.ts:139)) is currently typed `unknown`/`unknown` — it's a stub.
- **Action:** Session 17. Open question: does knockback emit a `move` system action with a special "forced" flag, or a new `forced_move` action? Surface for design before session 17.

### 4.12 Magical damage handler / `magical_ma_power`

- **Where assumed:** Session 14.
- **Missing:** No `magical_*` handler in [default-handlers.ts](src/engine/damage/default-handlers.ts). The default ruleset's stage list ([default.ts:44-52](src/content/rulesets/default.ts:44)) includes only `physical_pa_wp` and `healing_base` at the base stage.
- **Action:** Session 14 — add `magical_ma_power` (or similar), wire into `defaultDamageHandlers`, append to the default ruleset's `base` stage list.

---

## 5. Stale assumptions (post-session-13 progress)

### 5.1 New roadmap doesn't reflect existing Counter content

- **New doc:** Session 17 plan says "Knight R/S/M abilities with basic content: a Counter reaction, Damage Reduction support, maybe a Walk on Water movement."
- **Reality:** Counter is **already shipped** in v1 ([counter.ts](src/content/abilities/counter.ts)) as part of session 13's 2v2 demo. The roadmap proposes adding it in session 17.
- **Resolution direction:** Update session 17 plan to reflect that Counter already exists. Either drop the line or specify "expand Counter (e.g., add range gating per the open content/design question in progress.md)."

### 5.2 Cure / White Magic command set

- **New doc:** Roadmap session 16 introduces Earth Mage with command set `earth_spells`. The first explicit reference to a healing-style command set in the new docs is in session 16's Earth Buff (Regen).
- **Reality:** The `white_magic` command set with Cure already ships from session 13.
- **Resolution direction:** Acknowledge in session 16 plan: White Magic is the existing healing model; Earth's Regen is a different mechanism (status-based, not direct healing). The plan implicitly assumes Cure exists (since it references existing healing pipeline).

### 5.3 Move +1 already shipping

- **New doc:** Roadmap session 16/17 lists movement abilities like "Walk on Water" and the spec lists Move +1 as a generic example.
- **Reality:** Move +1, Float, and Fly already ship as content (see [src/content/abilities/](src/content/abilities/)).
- **Resolution direction:** Update spec/roadmap to reference these as already-existing examples rather than to-be-introduced.

### 5.4 Roadmap's "Item 4 (per-status tick on skipped turn)" note

- **New doc:** [roadmap-sessions-14-20.md:386](docs/roadmap-sessions-14-20.md) ("After session 20") says "Item 4 (per-status tick on skipped turn) — closed during status content sessions."
- **Reality:** progress.md numbers items differently. Item 4 in progress.md is "Equipment composition with damage formulas," not "per-status tick on skipped turn." The skipped-turn flag is bullet point 4 under "Engine policy / cleanup gaps."
- **Resolution direction:** Re-number the references in roadmap-sessions-14-20.md to match progress.md's numbering, or use textual references instead.

### 5.5 ADR-0013 KO bug — engine-side fix not in roadmap 14-20

- **New doc:** Roadmap doesn't allocate a session for the engine-side auto-emit `turn_end` on active-unit KO that ADR-0013 deferred.
- **Reality:** ADR-0013 explicitly carries this forward as candidate scope. Sessions 14-20 don't pick it up. The orchestrator-side guard handles it for now; if a second orchestrator ships in this window (e.g., a network or replay-driven one), the bug surfaces again.
- **Resolution direction:** No urgent action — the orchestrator guard is sufficient. Surface for design discussion: **does the engine-side fix want to ride alongside session 15 (charged actions, where mid-charge KO becomes a real surface)?** A charged-action caster KO'd before resolution needs to interact with this — explicitly flagged in [battle-mechanics-guide.md:351](docs/battle-mechanics-guide.md). Recommend folding the engine-side auto-emit into session 15 since the surface area overlaps.

### 5.6 The `aoe` field on `ActiveAbilityDefinition`

- **New doc (spec):** Active abilities have an `aoe` field per [ability-format-spec.md:152-158](docs/ability-format-spec.md).
- **Reality:** [ability-definition.ts](src/engine/catalog/definitions/ability-definition.ts) has no `aoe` field; targeting is single_unit-only. The AoE shape support exists in [aoe.ts](src/engine/map/aoe.ts) (footprint resolution), but no AbilityDefinition consumes it.
- **Resolution direction:** Add the field in session 17 (when Earth's AoE ships). Schema needs `aoe: { shape: AoeShape; verticalTolerance: number; multiLayerBehavior: 'all' | ...; friendlyFire?: boolean }`. Note: spec says `friendlyFire?: boolean` defaulting to true; guide says friendly fire defaults ON for ALL abilities including healing. Make sure session 17 honors the default.

### 5.7 Initial CT formula `'speed_with_variance'` already shipped

- **New doc:** Doesn't reference the formula; treated as a tuning concern.
- **Reality:** Per session 9 and ADR-0011, both `'fixed'` and `'speed_with_variance'` initial-CT formulas exist; the default ruleset is on `'fixed'`. Battle Mechanics Guide doesn't reference initial CT at all.
- **Resolution direction:** No action; flagging for completeness. The handoff/progress already note this.

### 5.8 Damage `tags: ['holy']` on Cure may break "absorb" formula

- **New doc:** [battle-mechanics-guide.md:204-206](docs/battle-mechanics-guide.md) says resistance 200 = full absorption (negative-resistance flips damage to healing).
- **Existing code:** Cure tags itself with `holy`. If a future Reflect-Holy mechanic exists, holy-200 unit + Cure → "Cure becomes damage" by the formula. But Cure already produces healing.
- **Resolution direction:** See 2.5 — the rule needs clarifying. The healing tag should opt out of resistance modulation entirely.

---

## 6. Questions for the design team

A condensed list of items that need a design call before session 14 starts. Many are noted in earlier sections; this is the top-of-mind ask.

1. **Where do Brave and Faith live on `Unit`?** (BaseStats vs. a separate character field; my recommendation: `BaseStats` for v1.) Item 2.3.
2. **Does the equipment integration (item 4 in progress.md) land before or alongside session 14?** The Battle Mechanics Guide assumes WP is a real factor in physical damage; current code embeds WP in `power`. Item 1.1.
3. **Reactions: spec-driven schema (compiled to passive hooks) or hand-coded passive hooks staying authoritative?** Picks the model for sessions 16–20. Item 2.2.
4. **Damage tag union: keep closed (extend per-session) or open it to string?** Item 1.6.
5. **Multi-tag damage composition: what wins on absolute-value ties?** Item 1.4.
6. **Healing's interaction with non-healing damage tags (`holy`, etc.) on the same ability:** does Cure's `holy` tag trigger `holy` resistance? Item 2.5.
7. **Sleep wake-on-damage mechanism:** new hook return shape, system action, or `onWake` predicate? Item 1.3.
8. **Naming: `actionSpeed` vs. `chargeTicks` for charged abilities — which lands in the AbilityDefinition?** Item 3.5.
9. **`abilityType` (4-way) vs. `kind` (2-way) discriminator on AbilityDefinition.** Pick one for the spec. Item 3.4.
10. **AoE multi-layer "highest"/"lowest": per-(x,y) or globally over the footprint?** Item 2.1.
11. **Burn stacking model:** stacks vs. magnitude vs. new STACK_COUNT_ADDITIVE rule? Item 3.8.
12. **Engine-side auto-emit `turn_end` on active-unit KO** — fold into session 15 alongside charged-action interruption, or keep deferred? Item 5.5.
13. **Tile-anchored vs. unit-anchored `AbilityTarget`** — extend the TargetingSpec union; what shape? Item 4.8.
14. **Status application formula's MA_factor** — confirm the `0.9 + MA/10` shape lands as-is in session 16, or revise after seeing typical MA stat values. Item 2.7 (overlap).
15. **Where does the physical hit roll fire in the seven-stage pipeline?** Item 2.6.

---

## Summary

The three new documents are well-thought-through but were drafted somewhat in isolation from the current code state. The biggest reconciliation costs cluster in three areas:

1. **Naming and shape drift in the ability format spec.** ~6-8 small renames/restructures (`bucketCost`→`baseCost`, `displayName`→`name`, `abilityType`→`kind`, `actionSpeed`/`chargeTicks` choice, the four-way passive split, etc.) — each individually trivial; they'll add up if not cleaned before session 16.

2. **Real engine surface that needs design decisions before sessions 14–17 can proceed cleanly.** Brave/Faith placement, resistance shape on Unit, hit-roll location in the pipeline, charged-action naming, AoE target/anchor extensions, Sleep/wake mechanism, and the reactions-as-data question.

3. **Stale assumptions about post-session-13 state.** Counter, Cure, Move +1, Float, Fly already ship; the roadmap occasionally re-introduces them. Easy fixes.

I'd recommend, before session 14 starts: (a) a design pass to settle the questions in section 6; (b) a quick spec edit pass to align names with the engine; (c) an addendum or ADR documenting the resolution of the multi-tag composition rule, the Brave/Faith placement, and the actionSpeed/chargeTicks naming. These would fit inside a single planning conversation and meaningfully reduce session 14's design surface.