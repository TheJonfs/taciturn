# Session 13.7 Plan — Reconciliation Resolution

This session implements the resolutions to the reconciliation report. It produces six ADRs, updates three reference documents, refactors a small set of catalog types and definitions, and updates the roadmap. After this session, sessions 14-20 can proceed against a clean foundation.

This is an "infrastructure and documentation" session — minimal new behavior, mostly type cleanup, name normalization, and recording of decisions. No new abilities, statuses, or game mechanics ship.

## Workflow

This session should produce its work as a sequence of small commits, not one large commit. Each ADR is its own commit; doc updates are separate commits; code refactors are commits per file or logical group. This makes review and rollback easier.

For each ADR-and-implementation pair: write the ADR first, capturing the decision and rationale. Then make the code/doc changes that implement it. The ADR is the durable record; the code/doc changes operationalize it.

For pure naming/structural drift fixes (no design decision involved), no ADR is needed — just the doc and code updates.

When the session reaches a checkpoint where all changes for a given category are complete, run the test suite. The test suite should pass at every checkpoint. If a refactor breaks tests, fix the tests in the same checkpoint commit (most of these refactors should produce only mechanical test updates — type renames, etc.).

## ADRs to draft

Six ADRs land in this session. Each is short (target: half a page or less). Numbering continues from the existing ADR sequence.

### ADR: Equipment integration deferred to session 17

**Decision:** WP becomes a real factor in physical damage in session 17, alongside Knight expansion. Until then, abilities continue to embed WP into their `power` field. The migration path: rename `power` to `power_coefficient` semantically (the field name stays), and the equipment system will multiply `WP × power_coefficient` at damage time.

**Rationale:** Earlier sessions deferred equipment because no class needed weapon-specific behavior. The mage arc benefits from equipment integration because the Knight expansion in session 17 is the first time a weapon would meaningfully affect damage formulas. Folding the integration into session 17 is more efficient than building equipment infrastructure in isolation.

**Consequences:**
- Session 17 scope expands to include: WP as a real factor in physical damage, basic equipment definitions (Knight gets a sword; 1-2 other equipment pieces with stat-buff or status-applying effects to exercise the engine).
- Current physical handlers (`physicalPaWp` etc.) refactor to read WP from equipment when present, falling back to current behavior.
- Existing abilities continue to work; their `power` field semantically becomes `power_coefficient`.

### ADR: Multi-tag damage composition tiebreaker

**Decision:** When an ability's damage carries multiple tags (e.g., a holy fire spell tagged both `fire` and `holy`) and the target has resistances of equal absolute value, the *signed maximum* (most resistance, least weakness) wins.

**Example:** Target has `holy: +50, fire: -50`. Holy fire spell hits. Composition takes `+50` (resistance), not `-50` (weakness).

**Rationale:** Ties on absolute value should default to the less impactful outcome. The alternative ("weakness wins ties") creates surprising damage spikes from compounding tags that feels chaotic. Resistance-wins-ties matches the conservative "designed unit can't be made suddenly squishy by a tag interaction" principle.

**Consequences:** Multi-tag damage composition implements a `signedMax(resistance_a, resistance_b, ...)` function that returns the maximum signed value across applicable tags. Document in the Battle Mechanics Guide.

### ADR: Healing opts out of resistance modulation

**Decision:** Abilities with the `healing` damage tag opt out of resistance modulation entirely. Other tags on the ability (e.g., `holy`) do not apply resistance to the healing amount.

**Rationale:** The alternative ("resistance reduces healing through non-healing tags") creates pathological cases — a unit with high holy resistance can't be healed by a holy-tagged Cure spell. Players don't want this; design space doesn't benefit from this complication. The cleaner rule: healing is healing; resistance applies to damage, not healing.

**Consequences:**
- The damage pipeline's resistance stage checks `if effectTags.includes('healing')` and short-circuits the resistance computation for healing effects.
- Cure can keep its `holy` tag (for purposes of "this is holy magic" classification) without the tag affecting healing amount.
- An ability with multiple effects, some damage and some healing, runs each effect through its own resistance check independently — damage effects respect tag resistance; healing effects don't.

### ADR: System actions for status side effects (Sleep wake, Burn decrement, Vulnerable consume)

**Decision:** Hook handlers can return a list of system actions to be processed after the current action's resolution completes. The engine adds these to the action chain. This is the mechanism for status state changes that happen as side effects of other actions.

**Examples:**
- Sleep's `onDamageReceived` handler returns `[{ type: 'status_remove', target: self, statusType: 'sleep' }]` when the unit takes damage.
- Burn's custom trigger fires at CT 100 and returns `[{ type: 'status_decrement_stack', target: self, statusType: 'burn' }]` after dealing damage.
- Vulnerable's `onDamageReceived` returns `[{ type: 'status_remove', target: self, statusType: 'vulnerable' }]` after multiplying incoming damage.

**Rationale:** Hook handlers shouldn't mutate state directly — that breaks the "state changes go through the reducer" invariant. The cleanest solution is to extend hooks to emit system actions, which the engine then processes through the reducer. This generalizes to all "status reacts to something by changing itself" patterns.

**Consequences:**
- Hook handler signatures grow an optional `emittedActions: SystemAction[]` return field. Handlers that don't emit actions return an empty list (or omit the field).
- The engine's action chain processes emitted actions after the parent action completes.
- Two new system action types land: `status_remove` and `status_decrement_stack`. Both are reducers that modify status state.
- This pattern is used by Sleep (session 14 prep, lands when first ability needs it), Burn (session 19), and Vulnerable (session 20).

**Implementation note:** Land the infrastructure in session 16 alongside Earth Mage, since Earth introduces several statuses that benefit from the same machinery. Sleep and other status work that needs side effects can use it once it's in place.

### ADR: STACK_COUNT_ADDITIVE stacking rule

**Decision:** A new stacking rule, `STACK_COUNT_ADDITIVE`, is added to the `StackingRule` enum. It increments stack count on existing instance, distinct from `STACK_ADDITIVE` (which adds magnitudes).

**Distinction:**
- `STACK_ADDITIVE`: adds magnitudes. Used for statuses where multiple sources contribute additively to a numeric strength (e.g., Strength Up: stacking +1 from one source and +2 from another yields +3).
- `STACK_COUNT_ADDITIVE`: increments stack count. Used for statuses where stack count itself drives behavior (e.g., Burn: 3 stacks deals 3× damage on trigger; new application adds 1 stack regardless of magnitude).

**Rationale:** Burn wants stack-count semantics; existing `STACK_ADDITIVE` only supports magnitude addition. Combining both into one rule with a flag would create tag-dependent semantics. Separate rules keep each rule's behavior unambiguous.

**Consequences:**
- New enum value. Status definitions choose between additive-magnitude and additive-count behavior at design time.
- Burn declares `stackingRule: 'STACK_COUNT_ADDITIVE'` plus `customTrigger.decrementStacksOnTrigger: true`.
- Lands in session 19.

### ADR: Physical hit roll location in damage pipeline

**Decision:** A new stage handler, `evasion_check`, runs at the `target` stage of the damage pipeline. It computes the hit chance per the Battle Mechanics Guide's formula, rolls against it, and sets `hit = false` on the context if the roll fails. The `finalize` stage reads `hit` and sets `finalDamage = 0` if false.

**Rationale:** Target evasion is target-side data, so the target stage is the natural tier. A pre-stage gate that early-exits would require a different control flow; using an existing stage with a check handler keeps the pipeline uniform.

**Consequences:**
- Pipeline stages stay at seven; no new stage introduced.
- `evasion_check` handler is registered in the default ruleset's `target` stage handler list.
- Critical hits, which fire at variance stage, run after evasion_check has settled `hit`. If `hit = false`, variance/crit stages still run but produce no damage because finalize sets `finalDamage = 0`.
- Auto-hit abilities skip `evasion_check` (the handler reads ability metadata and short-circuits if `auto_hit` is set or if `hitRoll` is omitted).

## Document updates

### Battle Mechanics Guide updates

- **Brave/Faith placement:** Add a brief note in the Stats overview that Brave and Faith are stored on the unit's BaseStats alongside other primary stats; the "character layer" model is about progression durability across battles, not per-battle storage.
- **MA_factor in status application formula:** Add explicit comment that the `0.9 + MA/10` shape is a v1 starting point; revisit after Earth Mage testing reveals typical MA values in play.
- **Hit roll stage:** Add a sentence in the hit chance section noting that the evasion check fires at the target stage of the damage pipeline.
- **Healing opts out of resistance:** Replace any text suggesting healing rolls against tag resistance with the new rule. Specifically: ensure the resistance section and the healing section both document this.
- **Multi-tag composition tiebreaker:** Update the multi-tag composition rule from "highest absolute resistance wins" to "signed maximum (resistance wins ties)" with the example.

### Ability Format Spec updates

This is the doc with the most revisions. Roughly in order:

- **`displayName` → `name`:** rename across all definition types (ClassDefinition, AbilityDefinition, StatusEffectType, CommandSetDefinition).
- **`bucketCost` → `baseCost`:** rename in AbilityDefinition.
- **`abilityType` 4-way → `kind` 2-way:** Replace the discriminator with `kind: 'active' | 'passive'`. Passive abilities carry their `bucket` field as the subdiscriminator. Update the example abilities (Earth Reaction, Earth Support) to reflect the new shape.
- **`actionSpeed` (rename from `chargeTicks`):** Update `ActiveAbilityFields` field naming. Make explicit: omit for instant; present means charged. Add note that ChargedAction is spawned at `ct: 0, speed: actionSpeed`.
- **TargetingSpec extension:** add `'tile'` to the targeting union. Document the `AbilityTarget` payload shape per kind: `'self' → undefined`, `'single_unit' → { unitId }`, `'tile' → { position }`.
- **AoE multi-layer semantics:** change the description of `multiLayerBehavior` to "per-(x,y) within the AoE footprint" with explicit example.
- **`auto_hit` flag handling:** confirm the spec uses "omit `hitRoll` = auto-hit" approach (not an explicit `auto_hit: true` field). Update the guide if it implies otherwise.
- **STACK_COUNT_ADDITIVE rule added:** add to StackingRule enum, document its distinction from STACK_ADDITIVE, update Burn example.
- **`bucketCapacities` field on ClassDefinition:** drop from the spec for v1.
- **`tags` taxonomies:** drop `ClassTagId` for v1 (no consumer). Add `AbilityTagId` as an open string with note that it's used for ability classification (`voice`, `magical`, etc.) and is referenced by gating logic in hooks (Silence blocks `voice` actions, etc.).
- **Reaction shape per ADR:** update ReactionAbilityFields to be the spec-driven schema that the new compiler consumes. Counter and Earth Reaction are the worked examples.

### Roadmap updates

- **Session 14 scope:** add `evasion_check` stage handler implementation (per hit-roll ADR). Add `Brave` and `Faith` to BaseStats. Note that resistance system on Unit lands here.
- **Session 15 scope:** expand to include the engine-side auto-emit `turn_end` on active-unit KO fix (per ADR-0013 deferred work). Note `actionSpeed` rename of the old `chargeTicks`. Add the `tile` targeting kind extension.
- **Session 16 scope:** add the system-actions-for-status-side-effects infrastructure (per ADR). Add the spec-driven reaction compiler. Refactor existing Counter ability to use the new schema. Note that the status application formula's hit-roll location lands here, inside `applyStatus`.
- **Session 17 scope:** explicitly include equipment integration. Add 1-2 equipment items beyond Knight's sword (a stat-buff item, a permanent-status item) to exercise the equipment integration broadly.
- **Session 19 scope:** add `STACK_COUNT_ADDITIVE` rule introduction, alongside Burn's custom-trigger pattern.
- **Stale references cleanup:**
  - Session 17 plan: note that Counter already exists; the work is to refactor it under the new spec-driven schema, not introduce it.
  - Session 16/17 movement abilities: note Move+1, Float, Fly already ship; new movement abilities for Earth/Water should be specifically Earth/Water-flavored, not duplicates.
  - Session 16: note that Cure / White Magic command set already exists; Earth's Buff/Regen is a different mechanism.
- **Post-session-20 deferred items:** renumber references to match progress.md's actual numbering, or use textual references instead of "Item 4".

## Code refactors

These follow from the doc updates. Most are mechanical.

### Catalog type renames

- `displayName` → `name` across all definition types in `src/engine/catalog/definitions/`.
- `bucketCost` → `baseCost` in AbilityDefinition (the engine already uses `baseCost`; the spec was wrong; verify).
- `chargeTicks` → `actionSpeed` in ActiveAbilityDefinition. Update all consumers (the reducer for use_ability, the ChargedAction spawn logic, any tests that reference the old name).

### Type extensions

- Add `'brave' | 'faith'` to `StatName`. Add `brave` and `faith` fields to `BaseStats`.
- Add `'earth'` to `DamageTag`. Document the convention that classes/abilities introducing new tags must extend the union in the same change.
- Add `resistances: ReadonlyMap<TagId, number>` (or appropriate shape) to `Unit` type.
- Add `evasion: { front: number; side: number; back: number }` to ClassDefinition baselines.
- Extend `TargetingSpec` to include `'tile'`. Update validation in `validateAction` to dispatch on kind.
- Extend `StackingRule` enum to include `STACK_COUNT_ADDITIVE`. Update stacking logic in `apply.ts` to handle the new case (when applied, increment instance stack count; on duration tick or other trigger, behavior depends on the status type's customTrigger).
- Extend hook handler return shape to optionally emit system actions (`emittedActions: SystemAction[]`). Update existing handlers to either omit the field or return empty list explicitly.
- Add `status_remove` and `status_decrement_stack` system action types. Add reducers for each.

### Refactoring of existing definitions

- Counter ability gets refactored to use the spec-driven reaction shape. The existing hand-coded passive hooks in `counter.ts` become the auto-generated output of the new reaction compiler from a `ReactionAbilityFields` spec.
- Cure ability: clarify its tag handling now that healing opts out of resistance. Likely no behavior change yet (resistance not applied to healing per ADR), but document why holy tag is retained vs. dropped.

### New utility code

- The reaction compiler: a function that takes `ReactionAbilityFields` and produces `PassiveHookRegistration[]`. This compiler is what Counter, Earth Reaction, Fire Reaction, Water Reaction, Lightning Reaction will all flow through. Lives in `src/engine/abilities/` or `src/content/builders/` — choose based on whether it's catalog-side or content-side.

## Validation

After all changes:
- Test suite passes.
- Catalog loads cleanly with all existing content.
- The 2v2 demo battle from session 13 still runs and produces the same outcomes (this is a real regression check — the ability format changes shouldn't change any battle behavior).
- Code review: no remaining references to the old field names (`displayName`, `bucketCost`, `chargeTicks`).

## What's NOT in this session

To be explicit about scope:

- No new abilities, statuses, classes, or items.
- No new gameplay mechanics.
- No content authoring (Earth Mage, etc. — those are session 16+).
- No engine work beyond the structural changes documented above (specifically: no magical damage handler — that's session 14; no charged action lifecycle — that's session 15).
- No AI work.
- No renderer or UI work.

This is a foundation-cleaning session. After it, sessions 14-20 proceed against a clean spec, clean naming, and clean architectural base.

## Estimated session size

Larger than a typical implementation session but bounded. The work is mostly mechanical with several focused architectural decisions captured as ADRs. Six ADRs to draft, ~10-15 type/naming refactors, three reference docs updated, no new gameplay code.

If the session feels overloaded partway through, the natural split is:
- 13.7a: ADRs + doc updates (purely textual work).
- 13.7b: Code refactors implementing the documented decisions.

Recommend trying as a single session first; the work is interrelated enough that splitting introduces coordination overhead.

## Handoff to session 14

After this session completes:
- The three reference documents (Battle Mechanics Guide, Ability Format Spec, Roadmap) are aligned with each other and with the engine code.
- Six new ADRs document the architectural decisions resolved from the reconciliation report.
- Catalog types and field names are normalized.
- Counter has been refactored to demonstrate the new spec-driven reaction pattern.
- The system-actions-for-status-side-effects infrastructure is in place (or planned for first use in session 16, depending on what feels right during implementation).

Session 14 then starts with the magical damage handler work as planned, against a clean foundation.
