# Session 31 Brief: Cluster 5 Content + Resistance-Shift Substrate + Weapon Variance + Equipment-Complete Milestone

## Context

Phase C closes here. Sessions 27-30 delivered the engine substrate for procs, drains, and the four Cluster 3 hooks. Session 29 shipped Equipment Batch A (most weapons, all shields, body armors, head armors, and most accessories). Session 30 shipped Cluster 5 engine substrate (`attack_proc`, `onFinalDamage`, `system_mp_drain`, `riderSource` machinery) and three Session-29 polish fold-ins (per-facing evasion display, forecast hit-chance + range strip, bucket/slot labels). Tests at 816/0 across 68 files.

This session lands:

- **Two small engine seams:** a parametric resistance-shift status type (so the wands' on-hit effects can apply persistent tagged resistance modifications), and weapon-sourced asymmetric variance (so War Axe and Bolt Hammer get the [0.9, 1.3] range the equipment doc specifies).
- **Cluster 5 content authoring:** Bolt Hammer (new); Flametongue update (add Burn proc); War Axe retrofit (asymmetric variance); Wand of Depths and Wand of Deepwood updates (add on-hit resistance shifts); Rasp Pendant (new).
- **Four procced abilities:** the on-hit Lightning spell for Bolt Hammer, the Burn-application proc for Flametongue, and the two wand-shift application procs.
- **Demo loadout assignments:** blue team (Knight, Water Mage, Lightning Mage) gets equipment exposure for first-playtest verification of Session 31 mechanics and several Session 29 / 30 carry-forwards; red Earth Mage gets Wand of Deepwood + Capacitor Ring as Lightning's foil.
- **Equipment doc spec update:** Rasp Pendant simplified to "bonus 10% MP drain" (no damage reduction) per Session 30 mid-session call.

**Equipment-complete milestone reached at end of session.** Triggered check-in: Chris playtests broadly post-handoff. Observations inform whether Session 31.5 (polish) is needed before Session 32 (Phase D kickoff).

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 30 handoff. Cluster 5 substrate landed; fold-ins shipped. The "Empirical-questions checklist for Chris's next playtest" section is the pre-flight verification list for this session.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 31 entry; Session 32 entry for context on what consumes the equipment-complete state.
4. **`docs/twentyOnePlanning/mage-war-equipment.md`** — items being authored or extended this session; the Engine Requirements section calls out the weapon-variance dependency and the Magus Crown wire-in state.
5. **`docs/decisions/0056-...`** (modifyResistance), **`0057-...`** (absorption activation), **`0061-...`** (bilateral loadout), **`0062-...`** (same-team reaction skip), **`0063-...`** (modifyAbilityRange + modifyOutgoingHitChance + classRestrictions + ShieldEquipment), **`0064-...`** (attack_proc + riderSource), **`0065-...`** (onFinalDamage + system_mp_drain). The recent ADR cluster — orientation for substrate this session composes against.
6. **`docs/twentyOneDesign/status-effects.md`** — for the parametric status pattern (Shell, Protect lineage from Session 29); the resistance-shift status follows that shape.
7. **`docs/twentyOneDesign/action-resolution.md`** — for the damage pipeline variance stage; the weapon-variance fork lives there.

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- **Variance pipeline:** `src/engine/damage/` for where variance lives today; confirm sub-stream 0 is the existing variance lane.
- **Weapon equipment type:** `src/engine/catalog/definitions/equipment-base.ts` (or equivalent) for WeaponEquipment shape; where the new `physicalVariance` field slots in.
- **Status definitions:** `src/content/statuses/` for existing parametric status patterns (Shell, Protect); the resistance-shift status is a new sibling.
- **modifyResistance hook:** `src/engine/hooks/runners.ts` for how resistance modifications compose; confirm additive composition across multiple status instances behaves as required.
- **Existing items being extended:** Flametongue, War Axe, Wand of Depths, Wand of Deepwood in `src/content/items/weapons/`. Audit confirms current authoring shape.
- **Existing procable abilities:** `src/content/abilities/` for existing Lightning Strike, Burn application, and status-apply ability shapes; reuse opportunities for the four procced abilities.
- **Demo battle setup:** wherever blue/red team loadouts are currently assigned in demo content. Extension is mechanical.
- **Magus Crown ship state:** confirm whether the +1 Action capacity field is wired in engine (Session 29 shipped the item with `availability: 'available'` per the Equipment Batch A summary). Settle ship state for this session in audit (see decision 7 below).

The plan articulates what exists, what's being refit, what's being added.

## Goal

End state:

**Engine substrate:**

- **Parametric resistance-shift status type.** New status type (recommended: `tagged_resistance_shift`) carries `tagDeltas: Record<TagId, number>` and `displayName: string`. Registers `modifyResistance` handlers per tag in the deltas map. Stacks additively across multiple instances. Battle-long duration.

- **Weapon-sourced asymmetric variance.** Optional `physicalVariance?: { min: number; max: number }` field on WeaponEquipment. Damage pipeline's variance stage forks: physical hits with a wielder weapon that declares `physicalVariance` use that range via uniform_real on sub-stream 0; otherwise existing ability/symmetric variance applies. Deterministic per-action.

**Content authoring (5 equipment items + 4 procced abilities):**

- **Bolt Hammer** (new) — axe, WP 10, Accuracy 75, `physicalVariance: { min: 0.9, max: 1.3 }`, tags: `['axe']`, `attackProcs: [{ chance: 0.25, abilityId: <lightning_strike_ref> }]`.
- **Flametongue** (extend) — add `attackProcs: [{ chance: 0.25, abilityId: 'apply_burn_proc' }]` to existing definition. Verify Fire-tag and elemental wheel interaction intact from Session 29.
- **War Axe** (retrofit) — add `physicalVariance: { min: 0.9, max: 1.3 }` to existing definition. Verify expected-damage math now matches doc spec (~9.9 effective WP).
- **Wand of Depths** (extend) — add `attackProcs: [{ chance: 1.0, abilityId: 'wand_of_depths_apply_shift' }]` to existing definition. Wielder-side range passive (+1H/+1V on water-tagged) intact from Session 29.
- **Wand of Deepwood** (extend) — add `attackProcs: [{ chance: 1.0, abilityId: 'wand_of_deepwood_apply_shift' }]` to existing definition. Wielder-side spell-speed passive (+5 on earth-tagged) intact from Session 29.
- **Rasp Pendant** (new) — accessory, `damageMpDrainPercent: 10`. No damage-reduction effect.
- **Procced abilities** (all `availability: 'hidden'`):
  - **Lightning Strike reference for Bolt Hammer** — see decision 4 below; recommendation is direct reuse of the existing `lightning_strike` ability via abilityId. Display name "Lightning Strike" flows automatically.
  - **`apply_burn_proc`** — single-target Burn application. Audit identifies whether to reuse an existing Burn-applying ability or author a sibling.
  - **`wand_of_depths_apply_shift`** — single-target apply-status; applies `tagged_resistance_shift` with `tagDeltas: { fire: 25, lightning: -25 }`, `displayName: "Wand of the Depths Resonance"` (or similar).
  - **`wand_of_deepwood_apply_shift`** — single-target apply-status; applies `tagged_resistance_shift` with `tagDeltas: { lightning: 25, fire: -25 }`, `displayName: "Wand of the Deepwood Resonance"`.

**Demo loadouts:**

- **Blue Knight:** Bolt Hammer (R), Managuard (L), Silvered Vest (body), Focus Band (head), Tintinibar (accessory).
- **Blue Water Mage:** Wand of Depths (R), Sorcerer's Robe (body), Pointy Hat (head), Lightfoot (accessory).
- **Blue Lightning Mage:** Flametongue (R), Wizard's Robe (body), Pointy Hat (head), Rasp Pendant (accessory).
- **Red Earth Mage:** Wand of Deepwood (R), Capacitor Ring (accessory). Body and head: TBD with Chris during plan-review.
- **Red team other units:** existing default loadouts unless Chris adjusts during plan-review.

**Documentation:**

- Equipment doc update: Rasp Pendant spec change (drop "10% damage reduction" language; reframe as "bonus 10% MP drain").

**Quality:**

- Tests at 816+, 0 failing. New tests proportional to substrate and content items.
- ADRs for: resistance-shift status substrate; weapon-variance fork.
- `docs/handoff.md` updated.

## Pre-implementation plan (required)

Same discipline as previous sessions. Current-tree audit first; architectural decisions surfaced before code.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it. Particularly important for:

- **The variance pipeline stage.** Where variance is read today (likely a uniform_real roll on sub-stream 0 against an `AbilityCommon.damageVariance` symmetric range). The fork condition: physical hit with wielder weapon declaring `physicalVariance` → use weapon range; else existing path.
- **The parametric status pattern.** Confirm Shell/Protect's authoring shape and use it as the template for resistance-shift. Confirm where parametric data is stored on status instances and threaded through hooks.
- **The modifyResistance hook composition.** Confirm multiple status instances stack additively by default in the hook chain. If not, decide whether to land it as part of this session's substrate work.
- **Existing item authorings.** Flametongue, War Axe, Wand of Depths, Wand of Deepwood — confirm current shape so extensions are clean diffs, not rewrites.
- **Existing procable abilities.** Lightning Strike, Burn applications, status-apply abilities — confirm shapes; identify reuse vs. sibling-author decisions.
- **Demo loadout assignment.** Where unit equipment is wired in demo content; how it threads through `createInitialState`.

### Architectural decisions

After the audit:

1. **Resistance-shift status type shape.** Three reasonable shapes:
   - **A — Single parametric type with displayName.** One status type (`tagged_resistance_shift`) carries `tagDeltas: Record<TagId, number>`, `displayName: string`. Mirrors Shell/Protect's parametric pattern from Session 29.
   - **B — Sibling types per source.** Separate status types per wand. More boilerplate; explicit naming on action log; less forward-compatible.
   - **C — Hybrid.** Parametric type, but the procced ability that applies it carries the displayName.

   **Recommendation: A.** Forward-compatible for future resistance-shift content (future wands, status-applying spells, items). Composition stays clean; display name is data, not type discrimination.

2. **Stacking semantics on resistance-shift.** Equipment doc says "Stackable across multiple wand applications." Working assumption: status stacks instances; `modifyResistance` contributions compose additively across instances. Two Wand of Depths hits = +50 Fire/-50 Lightning. Wand of Depths + Wand of Deepwood = zero net (resolves the equipment doc's open question — additive composition produces cancellation).

3. **Resistance-shift duration mechanism.** Equipment doc says "persists for the duration of the battle." Audit reveals what battle-long persistence shapes exist (`permanent_per_unit_ct` with a trigger that never fires? a `duration: 'battle'` discriminator?). Pick the closest fit. **Watch-for:** if no clean battle-long primitive exists today, this becomes a third small substrate item for this session (a `permanent_for_battle` duration kind). Flag during audit.

4. **Procced Lightning Strike sourcing.** Three reasonable shapes:
   - **A — Direct reuse via abilityId.** Bolt Hammer's `attackProcs[0].abilityId` references the existing `lightning_strike` ability. Same definition, same display name, fires via `riderSource: { kind: 'equipment_proc' }`. The MP-cost and Silence bypasses are handled by the rider machinery (Session 30 ADR-0064).
   - **B — Sibling `lightning_strike_proc` ability with same display name.** Separate definition with name match enforced by tracking discipline. Risk: name drift if Lightning Strike is renamed.
   - **C — Sibling ability with shared-displayName constant.** Both abilities reference the same display string.

   **Recommendation: A.** Chris's intent ("I want to make it clear to the player that they're getting the first level spell on the hit") is best served by literally using the first-level spell. The name follows automatically: if Lightning Strike is renamed, Bolt Hammer's procs reflect that change without separate sync. The watch-for is general awareness — Lightning Strike's display name is now player-facing in two contexts (cast menu + Bolt Hammer proc log).

5. **Procced Burn application sourcing.** Audit identifies whether existing Burn-applying content (Smolder or similar) is reusable. Smolder is likely an AoE Fire Mage spell; the proc is single-target. If reuse isn't clean, author a sibling `apply_burn_proc` ability. **Audit confirms.**

6. **Weapon-variance field naming.** `physicalVariance` is the working name. Alternatives: `damageVariance` (matches existing AbilityCommon naming but creates shadow names across types — confusing); `weaponVariance` (redundant on a Weapon type). **Recommendation: `physicalVariance`** — disambiguates from ability-side variance, signals scope (physical hits only).

7. **Magus Crown ship state.** Per the equipment doc's Engine Requirements: "Magus Crown's +1 Action capacity requires the engine to support multiple equipped secondary action command sets per unit. Until it is, Magus Crown either ships disabled or its +1 Action effect is a no-op." Session 29 shipped Magus Crown with `availability: 'available'`. Audit confirms whether the +1 Action capacity is currently wired or a no-op. Two paths:
   - **A — Wire +1 Action capacity now** (likely too large a scope for this session; would need multi-secondary-command-set support, which is a substantial substrate change).
   - **B — Ship Magus Crown as no-op for v1**; flag in equipment doc and as carry-forward; future session (probably 31.5 or Phase F polish) wires it properly.

   **Recommendation: B.** If the +1 Action field is already partially wired but inert, leave it that way and document. If unwired, leave unwired and document. Session 31's scope doesn't include the multi-command-set substrate.

8. **Wand swing ally-targetability.** Equipment doc says: "Targetable on either allies or enemies." This requires basic-attack targeting to accept ally targets when the wielder's weapon is a wand. Current universal `attack` ability presumably targets enemies only. Three shapes:
   - **A — Per-weapon targeting override** on the attack ability (e.g., a `weaponTargetingOverride?: TargetingMode` field on WeaponEquipment).
   - **B — Wand-specific replacement ability** that overrides `attack` for wand wielders.
   - **C — Defer ally-targetability to a future session;** ship Wand of Depths and Wand of Deepwood with enemy-only swings in v1.

   **Recommendation: C.** The on-hit resistance shift mechanic is fully demonstrable with enemy-targeting alone (Wand of Depths on enemy → +Fire/-Lightning shift on enemy → setup for Lightning teammate strikes). Ally-targetability adds tactical depth but isn't load-bearing for first playtest. Flag as carry-forward for a future session; if Chris wants this in v1 instead, recommendation is option A (cleaner long-term shape).

9. **Red team Earth Mage body/head assignment.** Confirmed: Wand of Deepwood + Capacitor Ring on accessory slot. Body and head: defer to plan-review with Chris. Default-fallback if Chris doesn't specify: Wizard's Robe + Pointy Hat (parallel Mage offensive build, providing testing surface against blue Lightning Mage symmetry).

10. **Test strategy.**
    - **Substrate:** unit tests for resistance-shift status composition (single, stacked-same, stacked-cross-wand-cancellation), battle-long duration tick behavior, weapon variance fork (correct range used per weapon, deterministic per-action seed consumption, fallback when weapon doesn't declare variance).
    - **Content:** integration tests per item — Bolt Hammer fires Lightning Strike via riderSource on proc; Flametongue applies Burn via riderSource on proc; Wand of Depths applies tagged_resistance_shift with correct deltas; Wand of Deepwood ditto; Rasp Pendant drains MP via existing system_mp_drain (regression check, since substrate shipped in Session 30).
    - **Demo regression:** battle launches with new loadouts, no crashes, expected initial state.

11. **Order of work.** Substrate first (status type, then variance fork; war axe retrofit lands as variance test fixture). Then content authoring (Bolt Hammer + new abilities; Flametongue update; wand updates; Rasp Pendant). Then loadout assignment. Then equipment doc update. Each step gates on prior tests passing.

12. **31a/31b split allowance.** Surface area is moderate-to-large. Natural seam if needed: 31a (substrate + War Axe retrofit + Bolt Hammer + Flametongue update) / 31b (wand updates + Rasp Pendant + loadouts + doc update). Likely no split needed; raise if audit surfaces complications in either engine seam or in the battle-long duration primitive (decision 3).

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land roughly in this order: substrate first, then content, then loadouts.

### Item 1: Resistance-shift status substrate

- New parametric status type per audit recommendation
- `modifyResistance` handler registration per tag in `tagDeltas`
- Battle-long duration mechanism (existing primitive or new `permanent_for_battle` if audit warrants)
- Additive composition across instances (verify hook chain default; explicit support if not)

### Item 2: Weapon-sourced asymmetric variance

- New optional `physicalVariance?: { min: number; max: number }` on WeaponEquipment
- Damage pipeline variance stage fork: physical hit + wielder weapon declares variance → use weapon range
- Sub-stream 0 (existing variance lane) consumption
- War Axe retrofit: `physicalVariance: { min: 0.9, max: 1.3 }`
- Tests: per-weapon range used; deterministic per-action seed; fallback when no weapon variance declared

### Item 3: Bolt Hammer + Lightning Strike reference

- Item authoring: axe, WP 10, Acc 75, `physicalVariance: { min: 0.9, max: 1.3 }`, `tags: ['axe']`, `attackProcs: [{ chance: 0.25, abilityId: 'lightning_strike' }]`, `availability: 'available'`
- No new ability authoring — reuses existing `lightning_strike` per decision 4
- Integration test: proc fires Lightning Strike via riderSource; MP/Silence bypass works; spell damage scales on wielder's MA

### Item 4: Flametongue extension + apply_burn_proc

- Update existing Flametongue: add `attackProcs: [{ chance: 0.25, abilityId: 'apply_burn_proc' }]`
- Authoring of `apply_burn_proc`: single-target Burn application, `availability: 'hidden'`. Reuse existing Burn-applying ability if audit identifies a clean fit; else sibling-author.
- Integration test: proc applies Burn via riderSource; Burn × Purifier interaction stays correct (no Purifier in loadouts, but the substrate composes)

### Item 5: Wand of Depths extension + wand_of_depths_apply_shift

- Update existing Wand of Depths: add `attackProcs: [{ chance: 1.0, abilityId: 'wand_of_depths_apply_shift' }]`
- Authoring of `wand_of_depths_apply_shift`: single-target apply-status; applies `tagged_resistance_shift` with `tagDeltas: { fire: 25, lightning: -25 }`, `displayName: "Wand of the Depths Resonance"`. `availability: 'hidden'`.
- Integration test: on-hit applies status with correct deltas; stacks on repeat application

### Item 6: Wand of Deepwood extension + wand_of_deepwood_apply_shift

- Update existing Wand of Deepwood: add `attackProcs: [{ chance: 1.0, abilityId: 'wand_of_deepwood_apply_shift' }]`
- Authoring of `wand_of_deepwood_apply_shift`: single-target apply-status; applies `tagged_resistance_shift` with `tagDeltas: { lightning: 25, fire: -25 }`, `displayName: "Wand of the Deepwood Resonance"`. `availability: 'hidden'`.
- Integration test: on-hit applies status with correct deltas; Wand of Depths + Wand of Deepwood cancellation verified additively

### Item 7: Rasp Pendant

- Item authoring: accessory, `damageMpDrainPercent: 10`, `availability: 'available'`
- Integration test: damage dealt triggers `system_mp_drain` via existing Session 30 substrate (regression)

### Item 8: Demo loadout assignment

- Blue Knight: Bolt Hammer / Managuard / Silvered Vest / Focus Band / Tintinibar
- Blue Water Mage: Wand of Depths / — / Sorcerer's Robe / Pointy Hat / Lightfoot
- Blue Lightning Mage: Flametongue / — / Wizard's Robe / Pointy Hat / Rasp Pendant
- Red Earth Mage: Wand of Deepwood / — / [body per plan-review] / [head per plan-review] / Capacitor Ring
- Other red team units: existing default unless plan-review adjusts

### Item 9: Equipment doc update

- Rasp Pendant spec in `docs/twentyOnePlanning/mage-war-equipment.md`: replace "10% of final damage dealt is converted to MP drain (wielder gains, target loses)" with "bonus 10% of final damage dealt converted to MP drain (wielder gains, target loses; no damage reduction)"
- Notes section: keep guardrails and effective-build commentary intact

## Acceptance criteria

**Engine substrate:**

- `tagged_resistance_shift` status: composes additively across instances; battle-long duration verified; correct contribution per tag in `modifyResistance` chain.
- Weapon-sourced variance: physical hits with wielder weapon declaring `physicalVariance` use weapon range; symmetric/ability variance fallback when not declared; deterministic per-action.

**Content:**

- All five new/extended items declared with `availability: 'available'`.
- All four procced abilities declared with `availability: 'hidden'` (or `lightning_strike` reused if decision 4 lands on option A).
- Bolt Hammer procs fire Lightning Strike with correct display ("Lightning Strike" in action log); procced spell scales on wielder's MA per ADR-0064.
- Flametongue procs apply Burn (verifiable in action log).
- Wand of Depths on-hit applies +25 Fire/-25 Lightning resistance shift to target; persists battle-long; stacks additively on repeat hits.
- Wand of Deepwood on-hit applies +25 Lightning/-25 Fire shift; persists battle-long; stacks additively; cancels with Wand of Depths on shared target.
- Rasp Pendant drains 10% of final damage as MP transfer (verifiable via system_mp_drain action log entries; regression on Session 30 substrate).
- War Axe damage now uses [0.9, 1.3] asymmetric variance.

**Loadouts:**

- Blue team launches with Knight / Water Mage / Lightning Mage equipment per agreed setup.
- Red Earth Mage carries Wand of Deepwood + Capacitor Ring; with Capacitor's +100 Lightning res stacked on Earth's natural +50 = +150, incoming Lightning damage triggers absorption (ADR-0057 tag-flip → heal). End-to-end absorption pipeline exercised with real equipment.
- Demo battle launches cleanly with new loadouts; no regression in existing demo behavior.

**Quality:**

- Tests at 816+, 0 failing. New tests proportional to the substrate and content items.
- ADRs written for: resistance-shift status substrate; weapon-variance fork. (Battle-long duration primitive gets its own ADR if added per decision 3.)
- `docs/handoff.md` updated.

**Equipment-complete milestone reached:** all items in `mage-war-equipment.md` shipped to engine, modulo Magus Crown's wire-in state (per decision 7). **Triggered check-in:** Chris playtests broadly post-handoff. Observations inform Session 31.5 (polish) decision and Session 32 (Phase D) brief.

## Out of scope

- **Multi-command-set substrate (Magus Crown +1 Action wire-in)** — engine requirement; defer per decision 7.
- **Wand swing ally-targetability** — per decision 8; defer to future session.
- **Pre-battle UI surfaces** — title screen, battle setup, team builder, deployment phase. Phase E.
- **Map mechanics** — Cluster 6, River Ridge. Sessions 32-33.
- **Additional polish fold-ins** — pacing constants, portrait-ring fitment, tile-info icons, status-badge polarity, etc. Likely Session 31.5 if post-playtest observations warrant.
- **Burn × Purifier playtest** — no Purifier in agreed loadouts; defer to follow-up playtest specifically constructed for this verification.
- **`onTurnStart` symmetric widening** — Session 26 carry; defer until emitter exists.
- **AI active absorption exploitation** — Session 27 carry; tactics-layer pass.
- **AI projection forecast extension via `computeOutgoingHitChance`** — Session 30 carry; optional refinement.
- **`riderSource` double-gating cleanup** — Session 30 carry; low priority.
- **Surrender flow, MVP-unit algorithm, permadeath timer, settings expansion, reactions in projection column** — Phase E/F.

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**Engine substrate:**

- `src/engine/damage/variance.ts` (or wherever variance lives) — weapon variance fork
- `src/engine/catalog/definitions/equipment-base.ts` — `physicalVariance` field on WeaponEquipment
- `src/content/statuses/tagged-resistance-shift.ts` — new parametric status type
- `src/engine/statuses/` (if duration primitive needs widening per decision 3)

**Content:**

- `src/content/items/weapons/bolt-hammer.ts` (new)
- `src/content/items/weapons/flametongue.ts` (extend)
- `src/content/items/weapons/war-axe.ts` (variance retrofit)
- `src/content/items/weapons/wand-of-depths.ts` (extend)
- `src/content/items/weapons/wand-of-deepwood.ts` (extend)
- `src/content/items/accessories/rasp-pendant.ts` (new)
- `src/content/abilities/apply-burn-proc.ts` (new — or reuse identified during audit)
- `src/content/abilities/wand-of-depths-apply-shift.ts` (new)
- `src/content/abilities/wand-of-deepwood-apply-shift.ts` (new)
- `src/content/abilities/lightning-strike.ts` — no change if decision 4 lands on option A; possible re-export if needed

**Demo:**

- `src/content/demo.ts` (or equivalent) — loadout assignments

**Tests:**

- `src/engine/damage/variance.test.ts` (or equivalent) — weapon variance fork
- `src/content/statuses/tagged-resistance-shift.test.ts` — composition tests
- `src/engine/actions/session-31-integration.test.ts` — per-item integration tests
- Demo-launch regression coverage

**ADRs:**

- `docs/decisions/0066-resistance-shift-status.md` (or next available)
- `docs/decisions/0067-weapon-variance-fork.md` (or next available)
- (Optional) `docs/decisions/0068-battle-long-duration.md` if decision 3 adds a duration primitive

**Documentation:**

- `docs/twentyOnePlanning/mage-war-equipment.md` — Rasp Pendant spec update
- `docs/handoff.md` — session handoff

## Workflow notes

- **Plaintext-first review required.** Same discipline as previous sessions.
- **Audit-first within the plan.** Particularly important for: the variance stage's current structure (determines whether the fork is a clean extension or needs untangling); the parametric status pattern (determines whether resistance-shift slots in cleanly); battle-long duration primitive availability (determines whether decision 3 adds a third substrate item); Magus Crown wire-in state (determines decision 7 framing).
- **ADR path is `docs/decisions/`**.
- **Substrate before content.** Resistance-shift status and weapon variance ship first; content authoring depends on both. Loadouts ship last.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: battle-long duration primitive availability; existing-ability reuse identification for procced abilities; red team body/head choices for Earth Mage; any unforeseen complications in the variance fork or status composition.
- **Pre-flight verification before substrate work starts.** Run the Session 30 "Empirical-questions checklist" items (Water Mage F/S/B baseline values; label rendering on existing units; forecast hit-chance + range strip presence on existing abilities). If anything's off, flag before continuing.
- **Equipment-complete milestone triggers check-in.** End-of-session handoff cues Chris's broader playtest. Plan handoff section accordingly: empirical checklist for playtest, organized around what each loadout item exercises.

## Watch-fors

**Addressed this session:**

- Bolt Hammer, Flametongue Burn proc, Rasp Pendant, Wand of Depths on-hit, Wand of Deepwood on-hit (Session 30 carry — Cluster 5 content)
- Weapon-sourced asymmetric variance (Session 29 carry — needed for War Axe and Bolt Hammer)
- Rasp Pendant equipment doc spec drift (Session 30 carry)
- Equipment exposure for first-playtest setup (agreed this session)
- Magus Crown ship-state explicit decision (Session 29 carry — flagged in equipment doc Engine Requirements)
- Wand swing ally-targetability — explicitly deferred this session per decision 8 (new watch-for: future ally-targeting substrate)

**Not addressed this session, longer-term carry-forward:**

- **Lightning Strike name flow to Bolt Hammer proc display** — new this session; if decision 4 lands on option A (reuse), this is automatic. General awareness: Lightning Strike's display name is now player-facing in two contexts.
- **Tintinibar Regen duration verification** — Session 29 carry; first playtest now possible
- **Sorcerer's Robe Move +1 interpretation** — Session 29 carry; first playtest now possible (Water Mage with Sorcerer's Robe + Lightfoot should display Move 6 with base 4)
- **Burn × Purifier action-log readability** — Session 29 carry; no Purifier in agreed loadouts; defer to follow-up playtest
- **Wand swing ally-targetability** — new this session (deferred per decision 8)
- **Magus Crown +1 Action capacity wiring** — engine requirement; deferred per decision 7
- **Procced spell uses caster's MA** — design choice held (Session 30 carry); watch for "boring weapon, op caster" feel in playtest; Bolt Hammer in particular surfaces this (Knight MA 4+2+2 = 8 vs hypothetical Lightning Mage MA 14+ = stronger procs)
- **Cast Shell / Cast Protect substrate** — Session 29 carry; future spells
- **AI projection forecast extension via `computeOutgoingHitChance`** — Session 30 carry; optional refinement
- **`riderSource` double-gating cleanup** — Session 30 carry; low priority
- **AI active absorption exploitation** — Session 27 carry; tactics-layer pass (relevant now that Capacitor + Earth Mage activates absorption in demo)
- **`onTurnStart` symmetric widening** — Session 26 carry; defer until emitter
- **Multiplicative tick-amount stacking** — Session 28 carry; no v1 stacking case
- **Renderer's HP "max" captured at mount** — Session 28 carry; sibling to MP lift
- **Status-badge polarity convention** — Session 22 carry
- **rAF vs setInterval for animation drain** — Session 23 carry
- **AoE preview correctness across all shapes** — Session 23 carry; confirmed shape-agnostic in Sessions 26-30
- **MP / status snapshot ahead-of-tween fix** — Session 22 carry
- **`pa_factor` NotYetImplementedError** — audit E3
- **TS strict-mode test errors** — audit E8
- **Surrender flow** — Session 34 / ADR-0041
- **MVP-unit smarter algorithm** — Session 24 Wave 1
- **Permadeath timer** — Session 24 Wave 1
- **Settings expansion** — Session 24 Wave 1
- **Reactions in projection column** — Session 24 Wave 1
- **Bug 1** (Session 24.5 / ADR-0046) — instrumentation in place; no recurrence in Sessions 25-30
- **Vite HMR cache invalidation** occasional issue
- **Hardcoded team color palette** across three sites — Session 25 carry
- **Active-ring + counterpart-ring rounded-square fitment** — Session 26.5 carry
- **Tile-info effect-icon area** still empty in v1 — Session 26.5 carry
- **Item #5 pacing constants** — Session 26.5 carry; tuneable per playtest
- **Bedrock Stride fall-immunity** untested until River Ridge — Session 33

**Polish accumulation queue (potential Session 31.5):**

Items above tagged with "polish" character — color palette, ring fitment, tile-info icons, pacing constants, status-badge polarity, animation drain, MP/status snapshot. Combined count is sufficient to warrant a polish session between Phase C and Phase D. **Decision deferred until post-playtest observations from this session inform whether 31.5 is needed before Session 32 (Phase D kickoff).**

## Estimated size

**Medium-to-large.** Two small engine seams (resistance-shift status, weapon variance), one possible third substrate item (battle-long duration primitive — settle in audit), six item authorings/extensions, three new procced abilities (Lightning Strike is reused per decision 4 recommendation), demo loadout assignments for four units, one equipment doc update. Engine work is well-bounded per audit; content is dense but mechanical (each item maps to a known engine capability shipped in earlier clusters).

**31a/31b split allowance.** If either engine seam balloons during audit, or the battle-long duration primitive turns out to need its own substrate work and ADR, the natural split is:

- **31a:** Substrate (resistance-shift status, weapon variance, battle-long duration if needed) + War Axe retrofit + Bolt Hammer (which lands as variance test case)
- **31b:** Remaining content (Flametongue Burn proc, both wand updates, Rasp Pendant) + loadouts + equipment doc update

Likely no split needed. Surface the split allowance during plan-review if the audit reveals more than expected.

**Equipment-complete milestone reached at session end.** Triggered check-in follows: Chris playtests broadly; observations feed Session 31.5 decision and Session 32 brief.
