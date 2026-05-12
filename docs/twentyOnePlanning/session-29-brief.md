# Session 29 Brief: Equipment Authoring Batch A + Engine Fold-ins

## Context

The engine substrate is complete. Sessions 21-28 collectively delivered: availability tags, deploymentZone, uniform_int initial CT, the four Cluster 3 hooks (`modifyMpCost`, `modifyActionSpeed`, `modifyResistance`, `modifyIncomingStatusApplicationChance`), resistance absorption activation, the contributor registration pattern, `maxMp` introduction with multiplicative stat composition, `modifyBucketCapacity`, and `modifyStatusTickAmount`. Every hook surface needed for Equipment Batch A is live.

This session ships **the bulk of the equipment doc**: every item unlocked by Clusters 3 and 4. Procced weapons (Bolt Hammer, Flametongue's Burn proc) and Rasp Pendant wait for Cluster 5 (Session 30); Wand on-hit target effects wait alongside if the audit reveals they need proc infrastructure. Everything else lands here.

Plus five engine fold-ins concentrated at session start:
1. **Magus Crown engine work** — bucket-capacity model extended to command sets (loadout shape change, `cost` field on `CommandSetDefinition`)
2. **`classRestriction` field on `EquipmentBase`** (audit E7) — required for Knight-only and Mage-only items
3. **Shell and Protect status authoring** — parametric magnitude + duration, Auto-X via existing statusGrants pattern
4. **Same-team reaction skip** — reactions don't fire when `attacker.team === target.team` (single-site filter in reaction enumeration)
5. **Action menu MP / action-speed display threading** — precompute effective values so displayed numbers match committed ones

This is a content-heavy session with focused engine extensions. Expect medium-to-large total scope; the engine fold-ins are non-trivial but well-bounded, and the content authoring is mechanical against the established substrate.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 28 handoff. Note especially: Magus Crown engine requirement flagged; action-menu display threading deferred to this session.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 29 entry; Sessions 30-31 for context on what's deferred.
4. **`docs/twentyOnePlanning/mage-war-equipment.md`** — the equipment doc. Authoring target. Note especially: shield slot rules, classRestriction implications, Auto-status references.
5. **`docs/twentyOnePlanning/mage-war-content-spec.md`** — stat baselines, ability costs, resistance baseline (elemental wheel).
6. **`docs/decisions/0056-...`** through **`0060-...`** — recent ADRs for the substrate this content consumes (contributor map, absorption, maxMp, bucket capacity, status tick).
7. **`docs/decisions/0041-...`** (pause overlay scope) — for context on action-log readability; nothing to revise here.

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/engine/abilities/` and class-loadout shape — for the Magus Crown bucket-capacity work (`secondaryCommandSet: CommandSetId | null` → `secondaryCommandSets: ReadonlyArray<CommandSetId>` or similar)
- `src/engine/catalog/definitions/` — `CommandSetDefinition` (gains `cost` field), `EquipmentBase` (gains `classRestriction` field), status-type definitions for Shell/Protect authoring patterns
- `src/engine/items/contributions.ts` — for any new contributor entries the authored items need
- `src/engine/status/` — Auto-Regen / Auto-Haste pattern as the reference for Auto-Shell / Auto-Protect; existing parametric-magnitude statuses (Burn) as reference for Shell/Protect's magnitude shape
- `src/engine/actions/` — reaction enumeration site for the same-team filter (likely `runOnDamageDealt` or whatever the reaction-trigger chokepoint is)
- `src/ui/action-menu.tsx` — `AbilityButton` and `AbilityListPicker` for the display threading
- `src/ui/use-turn-flow.ts` — for any state plumbing the action menu uses to access state + catalog
- `src/ai/basic.ts` — for AI enumeration of secondary command sets (does it iterate appropriately for a multi-set list?)
- `src/content/classes/` — class loadout entries (currently has single `secondaryCommandSet`; updates to list shape)
- `src/content/battles/demo.ts` — demo battle loadouts (same)
- `src/content/items/` — current item file structure for authoring batch
- `src/content/abilities/` — existing wand attack ability definitions if separate from weapon item definitions

The plan articulates what exists, what's being refit, what's being added.

## Goal

End state:

**Engine fold-ins:**
- **Magus Crown unlocked.** `secondaryCommandSets: ReadonlyArray<CommandSetId>` replaces single-CommandSetId loadout shape; `cost: number` field on `CommandSetDefinition` (default 1); existing `modifyBucketCapacity` hook (Session 28) operates on the new bucket. Magus Crown's +1 capacity allows equipping a second secondary set.
- **`classRestriction` field** on `EquipmentBase` (audit E7); validator rejects equipment placements that violate the restriction.
- **Shell and Protect statuses authored** with parametric magnitude (default 50%) and duration. Auto-Shell and Auto-Protect via existing equipment statusGrants pattern (permanent variant).
- **Same-team reaction skip** at the reaction enumeration site: `if (sourceUnit != null && sourceUnit.team === target.team) return;` Reactions don't fire on allies. Optional `triggerOnAllies?: boolean` field on reaction definitions deferred until future content asks for it.
- **Action menu display threading**: `AbilityListPicker` precomputes effective MP cost and action speed via `computeMpCost` / `computeBaseActionSpeed`; passes numbers to `AbilityButton`. Displayed values match committed values regardless of equipment modifications.

**Content authoring (~20 items, batch A):**

Weapons (non-procced):
- Long Sword (verify current WP per spec)
- Flametongue base (Fire-tagged on damage; Burn proc deferred to Session 31)
- War Axe
- Wand of Depths (wielder-side `resistanceMods: { lightning: 50, fire: -50 }`; on-hit target effects deferred unless audit reveals existing mechanism)
- Wand of Deepwood (wielder-side `actionSpeedModifiers` for Earth-tagged spells; on-hit target effects similarly handled)
- Staff of Power (`mpCostMultipliers: { ...spells: 1.2 }` + MA bonus via statMods)
- Staff of Abundance (`statModsMultiplicative: { maxMp: 1.5 }`)

Shields (Knight-only via classRestriction):
- Escutcheon
- Warrior's Aegis
- Managuard

Body armor:
- Battle Gear (Knight-only)
- Soldier's Leathers (Knight-only)
- Sorcerer's Robe (Mage-only, Auto-Shell)
- Silvered Vest (Mage-only)
- Wizard's Robe (Mage-only)

Head armor:
- Steel Helm (Knight-only, bucket capacity bonus)
- Magus Crown (Mage-only, `bucketCapacityMods: { secondary_command_sets: 1 }`)
- Pointy Hat (Mage-only, `resistanceMods` for status resistance — specifically Silence per spec)
- Guard Cap (universal, `resistanceMods` for all four elements at modest values)

Accessories:
- Diamond Bracelet (verify shipped state; possibly already exists)
- Augmentor (bucket capacity bonus)
- Capacitor Ring (+50 Lightning resist via `resistanceMods`)
- Focus Band (negative-tag status resistance via `incomingStatusModifiers`)
- Purifier (`statusTickAmountMultipliers: [{ factor: 2, statusTag: 'negative' }]`)
- Tintinibar (Auto-Regen via statusGrants — verify if shipped)

Each authored item carries `availability: 'available'` and `classRestriction` where applicable.

Tests at 770+, 0 failing. New tests cover: Magus Crown loadout validation and capacity-gating, classRestriction enforcement, Shell/Protect status effects, same-team reaction skip, AbilityButton display correctness, sample equipment-effect compositions.

## Pre-implementation plan (required)

Same discipline as previous sessions. Current-tree audit first; architectural decisions surfaced before code.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it. Particularly important for:
- Loadout shape (`secondaryCommandSet` consumers — every place that reads or writes the field)
- Reaction enumeration chokepoint (is there one site, or scattered? The same-team filter needs a single-site implementation)
- Wand on-hit effect mechanism (existing infrastructure or Cluster 5 work?)
- Existing status authoring patterns (Auto-X variants, parametric magnitude)

### Architectural decisions

After the audit:

1. **Loadout shape change for Magus Crown.** `secondaryCommandSet: CommandSetId | null` → `secondaryCommandSets: ReadonlyArray<CommandSetId>` (or `secondary_command_sets` per snake_case convention). State the exact bucket id used by the capacity model. State the consumer touchpoints — at minimum:
   - Action menu's Act picker (already flat-lists Attack + command sets as peers since Session 25; change is iterating a list instead of optional-single)
   - AI ability enumeration (iterates equipped command sets when scoring actions)
   - Validator / team builder validation (uses `getCapacity` with `cost`-based gating)
   - Demo battle loadouts (`secondaryCommandSet: 'white_magic'` becomes `secondaryCommandSets: ['white_magic']` for mages, `secondaryCommandSets: []` for Knight)

2. **`CommandSetDefinition.cost: number` field.** Default 1. Future cost-2 command sets fit naturally. State whether the field is required or optional-with-default (probably optional with default 1 to minimize churn on existing definitions).

3. **`classRestriction` field on `EquipmentBase`.** Optional `ReadonlyArray<ClassId>` or `ReadonlySet<ClassId>`. Validator rejects placements that violate. State where the validation fires (`validateEquipmentPlacement` likely) and what error shape it returns.

4. **Shell and Protect status authoring.** Parametric magnitude (default 50%), parametric duration (default TBD — probably 5-6 ticks for spell-cast variants; Auto-X variants apply permanent). State:
   - Status type shape (matches existing parametric-magnitude pattern; Burn is the reference)
   - Effect handler: `modifyDamageReceived` reads damage tags, reduces by magnitude if 'magical' (Shell) or 'physical' (Protect)
   - Auto-X variant: equipment's `statusGrants` applies the status with permanent duration (the Auto-Regen / Auto-Haste pattern)
   - Default magnitude visibility: status applications carry the magnitude as a parameter; renderer/log surfaces it ("Shell -50%" or just "Shell")

5. **Same-team reaction skip implementation.** Single-site filter at the reaction enumeration chokepoint. The audit verifies this is a single site (likely `runOnDamageDealt` or a reaction-trigger function called from it). Implementation: `if (sourceUnit != null && sourceUnit.team === target.team) return;` skipping further reaction handler invocation. Null-handling: `sourceUnit == null` means system damage (fall damage, environmental); reactions fire normally. State the exact filter site and its semantics.

   **Forward-compatibility**: a `triggerOnAllies?: boolean` field on reaction definitions is *not* added in this session. The default behavior (skip when same-team) is what's wanted. The opt-in field opens when future content (berserker-style class, ally-protection reaction) actually needs it.

6. **Action menu display threading.** Audit reveals current `AbilityButton` props and the data flow from `AbilityListPicker`. Approach: precompute effective values at the `AbilityListPicker` level via `useMemo` over the equipped abilities, passing the precomputed numbers down to `AbilityButton` rather than `state` + `catalog`. State the exact prop shape change.

7. **Wand on-hit effects — verify mechanism availability.** The audit verifies whether existing weapon infrastructure supports on-hit status apply (or other on-hit effect application) outside the proc system. If yes, Wand of Depths and Wand of Deepwood ship with on-hit effects. If no, ship with wielder-side effects only and defer on-hit shifts to Session 31 (post-Cluster 5). Same-team reaction skip applies regardless of when the on-hit effects land.

8. **Equipment authoring uniformity.** Each item declares against the established contributor pattern from ADR-0056. State that the authoring is mechanical and that the audit reveals any items requiring effects outside the current vocabulary (which then needs a flag for plan-time decision).

9. **Test strategy.** Per-engine-fold-in tests (loadout validation, classRestriction enforcement, Shell/Protect effects, same-team reaction filter, AbilityButton display). Sample equipment integration tests covering one item per major effect type (e.g., Staff of Power × 1.2 MP composes correctly with `computeMpCost`; Wand of Deepwood +5 actionSpeed for Earth-tagged composes correctly; Capacitor Ring + Earth Mage native Lightning resist hits absorption regime per Session 27 substrate). State coverage plan.

10. **29a/29b split allowance.** Surface area is large but mechanical for the bulk. The engine fold-ins concentrate at session start; if they balloon, propose a split:
    - **29a:** engine fold-ins (Magus Crown loadout, classRestriction, Shell/Protect, same-team reaction skip, display threading) + a small subset of content to verify integration
    - **29b:** remaining bulk content authoring
    
    The audit settles whether splitting is needed.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land in roughly this order: engine fold-ins first (substrate for content), then content authoring against the now-complete substrate.

### Item 1: Magus Crown engine work

- `CommandSetDefinition.cost?: number` field (default 1)
- Loadout shape: `secondaryCommandSet: CommandSetId | null` → `secondaryCommandSets: ReadonlyArray<CommandSetId>`
- Bucket id for the new capacity slot (naming per audit)
- `modifyBucketCapacity` hook already operates against the new bucket (Session 28 substrate)
- Consumer updates: action menu (iterate list), AI (iterate list), validator (gate on capacity + cost), demo loadouts (use list shape)

### Item 2: `classRestriction` field

- Optional field on `EquipmentBase`
- Validator rejects mismatched placements with clear error
- New ADR if the validation pattern deviates from existing precedent

### Item 3: Shell and Protect status authoring

- Status types with parametric magnitude (default 50) and duration
- `modifyDamageReceived` effect reading damage tags ('magical' → Shell, 'physical' → Protect)
- Permanent-duration variant for Auto-Shell / Auto-Protect application

### Item 4: Same-team reaction skip

- Single-site filter in reaction enumeration
- Null-safe (system damage still triggers reactions normally)
- Optional `triggerOnAllies` field deferred

### Item 5: Action menu display threading

- `AbilityListPicker` precomputes effective values via `useMemo`
- `AbilityButton` receives precomputed numbers
- Displays match committed values for divergence-producing items (Staff of Power, Wand of Deepwood)

### Item 6: Equipment Batch A content authoring

All ~20 items declared against the contributor pattern. Each item:
- Carries `availability: 'available'`
- Carries `classRestriction` where applicable
- Effects declared via the appropriate contributor fields (statMods, statModsMultiplicative, resistanceMods, mpCostMultipliers, actionSpeedModifiers, statusTickAmountMultipliers, bucketCapacityMods, statusGrants, incomingStatusModifiers)

Detailed per-item authoring per `mage-war-equipment.md`.

### Item 7: Item integration verification

After authoring, run integration tests covering:
- Sample item from each effect category
- Magus Crown's +1 secondary capacity enabling a second secondary set
- Sorcerer's Robe's Auto-Shell applying Shell with permanent duration
- Purifier × Burn integration (Session 28 substrate now has its consumer)
- Wand of Deepwood +5 actionSpeed for Earth-tagged spells composing through `computeBaseActionSpeed`

## Acceptance criteria

**Engine fold-ins:**
- Magus Crown equippable; +1 secondary command set capacity functional; cost-based gating works
- `classRestriction` enforced by validator with clear error
- Shell and Protect statuses author correctly; Auto-X via statusGrants applies permanent variants
- Reactions skip same-team attackers; system damage still triggers reactions normally
- Action menu's `AbilityButton` displays MP and charge values that match committed values (Staff of Power shows × 1.2 effective MP, Wand of Deepwood shows +5 effective speed for Earth spells)

**Content:**
- All ~20 items in batch A authored, available, classRestricted where applicable
- Each item's declared effects function correctly via existing contributor patterns
- No catalog-load errors at startup; availability validator continues to enforce field presence

**Quality:**
- Tests at 770+, 0 failing
- New tests cover loadout validation, classRestriction enforcement, Shell/Protect, same-team filter, display threading, sample item integrations
- ADRs written for: Magus Crown loadout shape change (substantive); same-team reaction skip semantics (design rule); possibly Shell/Protect if their parametric shape introduces non-obvious choices
- `docs/handoff.md` updated

## Out of scope

**Cluster 5 content (Session 30 substrate → Session 31 content):**
- Bolt Hammer (spell-cast proc rider)
- Flametongue's Burn proc
- Rasp Pendant (MP drain)

**If Wand on-hit effects require Cluster 5 infrastructure** (audit-time determination):
- Wand of Depths' on-hit resistance shift on target
- Wand of Deepwood's on-hit effect (if any beyond wielder-side actionSpeed)

**Other deferrals:**
- `onTurnStart` symmetric widening (Session 26 carry; defer until emitter)
- Renderer's HP-max captured at mount (sibling watch-for to Session 28's MP lift)
- `triggerOnAllies` reaction field (defer until future content requests it)
- Cluster 6 work — map mechanics, deployment phase logged actions (Session 32)
- River Ridge (Session 33)
- Pre-battle UI surfaces (Sessions 34-38)

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Engine:**
- `src/engine/catalog/definitions/equipment-base.ts` — `classRestriction` field, possibly other field additions
- `src/engine/catalog/definitions/command-set.ts` (or similar) — `cost` field
- `src/engine/catalog/definitions/` — Shell/Protect status type definitions
- `src/engine/abilities/` — loadout shape change (secondaryCommandSets), bucket-capacity integration
- `src/engine/actions/validate.ts` (or wherever) — classRestriction enforcement
- `src/engine/actions/` — reaction enumeration site for same-team filter
- `src/engine/status/` — Shell/Protect effects, possibly Auto-X helpers
- `src/engine/items/contributions.ts` — possibly new contributor entries if any new field type emerges from authoring

**Content:**
- `src/content/items/*.ts` — ~20 new or extended item files
- `src/content/statuses/shell.ts`, `protect.ts` — new
- `src/content/classes/` — loadout shape updates
- `src/content/battles/demo.ts` — loadout shape updates

**UI:**
- `src/ui/action-menu.tsx` — `AbilityButton` display threading; AbilityListPicker precompute
- `src/ui/use-turn-flow.ts` — possibly extended for any new menu state

**AI:**
- `src/ai/basic.ts` — secondary command set list iteration (audit-confirmed if changes needed)
- `src/ai/projection.ts` — possibly updated for any new equipment-effect projections

**Tests:**
- New integration tests for each fold-in
- Sample equipment-effect tests
- New ADRs in `docs/decisions/`

**Misc:**
- `docs/handoff.md` — updated

## Workflow notes

- **Plaintext-first review required.** Same discipline as previous sessions.
- **Audit-first within the plan.** Particularly important for: the loadout shape consumer enumeration (Magus Crown work); the reaction enumeration chokepoint location (same-team filter); the Wand on-hit mechanism availability (determines whether on-hit effects land here or wait for Session 31).
- **ADR path is `docs/decisions/`**.
- **Engine fold-ins before content authoring.** Doing the inverse means authoring items against unfinished substrate; the order is fixed.
- **Content authoring is mechanical for the bulk.** If the audit reveals an item requires effects outside the current contributor vocabulary, flag it as a plan-time decision rather than absorbing scope.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: Wand on-hit mechanism if audit reveals it's not yet available; any equipment doc ambiguity discovered during authoring.
- **The integration test calibrated to `demoBattle`'s 6×6 board** stays calibrated. Loadout shape change to `secondaryCommandSets: ['white_magic']` for mages must produce equivalent behavior to the single-CommandSetId version — verify the integration test still passes.

## Watch-fors

**Addressed this session:**
- Magus Crown engine work (Session 28 carry-forward)
- `classRestriction` field (audit E7)
- Shell and Protect status authoring (new content, anticipated by Session 28)
- Same-team reaction skip (new design rule)
- Action menu display threading (Session 27 carry-forward)
- Equipment Batch A content authoring (roadmap Session 29 core)

**Not addressed this session, longer-term carry-forward:**
- Wand on-hit target effects (if audit-deferred to Session 31)
- Cluster 5 procs/drains (Session 30)
- Rasp Pendant, Bolt Hammer, Flametongue Burn proc (Session 31)
- `triggerOnAllies` reaction field (defer until future content)
- AI active absorption exploitation (Session 27 carry; tactics-layer pass)
- `onTurnStart` symmetric widening (Session 26 carry)
- Renderer's HP "max" captured at mount (Session 28 carry; sibling to MP lift)
- Status-badge polarity convention (Session 22 carry)
- rAF vs setInterval for animation drain (Session 23 carry)
- MP / status snapshot ahead-of-tween fix (Session 22 carry)
- `pa_factor` NotYetImplementedError (audit E3)
- TS strict-mode test errors (audit E8)
- Surrender flow (Session 34)
- MVP-unit smarter algorithm (Session 24 Wave 1)
- Permadeath timer (Session 24 Wave 1)
- Settings expansion (Session 24 Wave 1)
- Reactions in projection column (Session 24 Wave 1)
- Bug 1 (Session 24.5 ADR-0046): mid-battle targeting failure; instrumentation in place
- Vite HMR cache invalidation occasional issue
- Hardcoded team color palette across three sites (Session 25 carry)
- Active-ring + counterpart-ring still circles after portrait restructure (Session 26.5 carry)
- Bedrock Stride fall-immunity untested until River Ridge (Session 33)
- Item #5 pacing constants tuneable (Session 26.5 carry)
- Multiplicative tick-amount stacking — design noted (Session 28 carry)
- Burn × Purifier action-log readability — watch first playtest (Session 28 carry)

## Estimated size

Large. Engine fold-ins are non-trivial but concentrated; content authoring is mechanical but voluminous. Session-29 represents the **equipment-complete milestone** — when this lands clean, the equipment doc is shipped end-to-end (modulo Cluster 5's procs/drains for the three procced items). If scope balloons in the audit, the 29a/29b split lines suggested above are the natural seams.
