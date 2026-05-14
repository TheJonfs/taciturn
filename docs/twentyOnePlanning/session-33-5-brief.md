# Session 33.5 Brief: Post-River-Ridge-Playtest Bug Fixes + Float Redesign + Polish

## Context

Session 33 closed Phase D content (River Ridge playable, terrain-tag abstraction shipped, 960/0 across 80 files). Chris's first River Ridge playtest surfaced five bugs (two KO-state issues, one animator state-sync issue, one battle-end off-by-one, and minor UX gaps), a Float redesign call (universal terrain-cost flattener), and a small set of polish + content adds. Session 33.5 addresses these before Session 34 begins Phase E (title screen + battle setup).

End of session: clean playtest state on River Ridge; Phase E ready to kick off.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 33 handoff. Particularly the "Limitations + watch-fors" section (Float redesign options, HMR-stale-catalog gotcha, cliff-edge thickness tuning candidate).
3. **`docs/decisions/0070-...`** — KO'd-target healing gate at the absorption tag-flip path. The Cure-on-KO bug extends this principle to other heal application sites.
4. **`docs/decisions/0072-...`** — Cliff-edge rendering convention with the categorical thickness tiers being adjusted this session.
5. **`docs/decisions/0073-...`** — Terrain-tag abstraction + `defaultTerrainCosts` merge. The Float redesign composes against this substrate.
6. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 34 entry for context on what 33.5 prepares for.
7. **`docs/twentyOneDesign/mage-war-equipment.md`** — for Red Lightning Mage loadout authoring (Staff of Power, Wizard's Robe, Purifier specifications).

### Paths to survey before planning

Current-tree audit required. Particularly:

- **Heal application sites.** All paths where a unit's HP goes up. ADR-0070 gated `applyDamageToTarget`'s healing branch (absorption tag-flip path); audit needs to enumerate every other site — Cure action resolution, Regen tick application, Buff ability healing, any direct vitals writes — and identify which lack the KO'd-target gate.
- **KO transition handling.** When HP drops to ≤0, what state mutations fire? Is the unit's KO state set atomically, or in separate steps that can be partially applied? When HP rises from 0 (the bug-2 scenario), what state should be reset, and is it all reset symmetrically?
- **Animator snapshot writes.** Where `UnitVisualSnapshot` gets updated on damage/heal/KO transitions. Bug 4's path: engine correctly KO'd; visual didn't update. Likely the animator's snapshot write is conditional on action outcome and missed the blocked-heal-on-KO'd case.
- **Battle-end check timing.** Where the scheduler tests for victory condition. The "one more turn fires after all enemies eliminated" bug is likely a check-vs-advance ordering issue.
- **`computeMovementProfile` hook chain.** Float's redesigned handler hooks here via `modifyTerrainCosts`. Audit confirms the hook iteration pattern + how registry-tagged handlers compose.
- **Charged action detail view + queue tower click.** Where the detail view mounts when clicking a charged action from the queue tower. Tooltip wire-in adds `DetailHover` wrapping around the ability name (mirrors S31's unit detail panel pattern).
- **HMR catalog reload path.** `BattleView.tsx`'s `useMemo(() => loadDefaultCatalog(), [])`. Audit identifies the cleanest invalidation hook.
- **Pacing constants.** Where AI turn pacing + charged action animation timing live. Item #5 pacing constants from S26.5 — finally tuneable with real playtest data.

The plan articulates what exists, what's being refit, what's being added.

## Goal

End state:

**Bug fixes (5):**

1. **KO state respect at all heal application sites** (bugs #2 and #3). ADR-0070's principle extended uniformly — no heal of any kind can apply to a KO'd target. Bug #2 (Cure on KO'd target raising HP 0→35) and bug #3 (ghost unit at 1 HP after Tidal Wave dealing 78 to a 75 HP unit) both resolve. Likely a new ADR codifying KO state invariants across all damage/heal application sites; the symmetry of the KO transition (HP=0 → KO'd; HP>0 → alive) ensured.

2. **Animator state-sync on KO transition** (bug #4). When a unit transitions to KO'd in engine state, the visual snapshot reflects KO regardless of subsequent action outcomes. Engine correctly KO's the Earth Mage and gates the absorption heal per ADR-0070; the visual snapshot follows the engine state rather than failing to update because no action outcome triggered a snapshot write.

3. **Battle-end check ordering** (bug #5). Battle-end victory condition fires at the correct moment in the turn cycle — no extra turn fires after all enemies of a side are eliminated.

**Float redesign (per Chris's call):**

4. Float modifies all terrain costs to `min(currentCost, 1)`. Tag-agnostic; iterates the terrain registry. Forward-compatible for future high-cost terrains (swamp, sand, mud). Differentiates against Walk-on-Water (water-only) and Fly (Float + ignore elevation). `availability: 'available'`.

**Dev-loop polish:**

5. **HMR-stale-catalog fix.** `BattleView.tsx` invalidates the catalog memo on hot-reload so class baseline edits take effect without a hard refresh.

**Renderer polish:**

6. **Cliff-edge thickness bump.** Per Chris's playtest read: thicken all categorical bins to find the right exaggeration. Starting proposal: Δ=1 → 2px (was 1); Δ=2-3 → 3px (was 2); Δ≥4 → 5px (was 3). Iterate during plan-review or in-session based on visual read.

**UI extensions:**

7. **Tooltip wire-in on charged action detail view.** Clicking a charged action in the queue tower opens the detail view; the ability name in that view gets `DetailHover` wrapping mirroring the unit detail panel pattern from S31.

**Pacing:**

8. **AI turn + charged action pacing tuning.** Slow the animation resolution per Chris's playtest read (fast-moving multi-action sequences are hard to parse). Specific timing values settle in plan-review.

**Content:**

9. **Red Lightning Mage loadout authoring.** Currently equipment-less; ship a loadout that exercises currently-unexercised content. Recommendation:
   - **Staff of Power** (right hand) — first staff weapon exercise (+4 MA, +20% MP cost)
   - **Wizard's Robe** (body) — +4 MA / -25 elemental res (matching Blue Lightning Mage's glass-cannon profile)
   - **Pointy Hat** (head) — Mage default
   - **Purifier** (accessory) — exercises long-deferred Burn × Purifier playtest (Blue Lightning Mage's Flametongue procs Burn → lands on Red Lightning Mage with Purifier → action-log readability check)

**Quality:**

- Tests at 960+, 0 failing. New regression tests proportional to bug fixes.
- ADR for KO state invariants (likely warranted per the heal-site enumeration).
- `docs/handoff.md` updated.

## Pre-implementation plan (required)

Same discipline as previous sessions. Bug-fix priority order; Float redesign and polish bundled in.

### Required first step: current-tree audit

The bug cluster (#2/#3) requires careful diagnostic. For each bug:

**Bug #2/#3 — KO state respect cluster.**

- Enumerate ALL heal application sites in the engine. At minimum: `applyDamageToTarget`'s healing branch (gated per ADR-0070); Cure ability resolution; Regen tick application (`regenOnTick`); Buff ability healing if it routes differently; any direct `vitals.hp` writes elsewhere.
- For each site, check whether the KO'd-target gate is present. Document the gap.
- Trace the bug-2 scenario: Maelstrom knockback → KO of Fire Mage → Cure cast on Fire Mage (by whom?) → HP rose from 0. The "Cure cast on Fire Mage" path is the prime suspect; check whether Cure's targeting permits KO'd targets and whether its application path has a gate.
- Trace the bug-3 scenario: After bug-2 healed Fire Mage to 35 HP, then second Cure to 75, then Tidal Wave for 78 damage. Result: HP=1, red X displayed, no KO in log, unit continues taking turns. Likely the unit's KO state was only partially cleared when bug-2 raised HP from 0 — re-application of damage that should re-KO doesn't fully process. Audit the HP-rise-from-zero path: what state should be reset (active flag, turn order participation, etc.) and is it all reset?
- Likely conclusion: a single helper (`canApplyHeal(unit): boolean`, or `applyHealSafely`) consolidates the KO check; all heal sites route through it. Plus symmetry of KO transition: HP=0 transitions to KO atomically; HP-rise from 0 either (a) is fully gated and never happens, or (b) fully resets the KO state if it happens.

**Bug #4 — animator state-sync.**

- Identify where `UnitVisualSnapshot` is updated on KO transitions. Audit whether the snapshot write is conditional on action outcome (e.g., only fires when damage/heal applies non-zero).
- The scenario: Earth Mage at low HP → Knight's lethal hit → engine KO's the unit, snapshot writes KO indicator → Lightning Strike fires on now-KO'd Earth Mage → absorption tag-flip would heal but ADR-0070 gate blocks → since the heal was blocked, no snapshot write fired → snapshot remains in pre-KO state (visible HP, no red X).
- Likely fix: snapshot write fires unconditionally on the KO transition itself, OR the snapshot derives from engine state via a polling mechanism rather than action-outcome-driven writes.

**Bug #5 — battle-end ordering.**

- Locate the scheduler's victory-condition check. Likely fires at turn-start or turn-end transition; the off-by-one suggests it fires after advancing rather than before, OR fires only at certain action-resolution boundaries.
- Quick fix: check victory condition immediately after any KO action resolves (not at next turn boundary).

**Float redesign.**

- Confirm Float's existing handler shape. Pre-S33 keyed on water; post-S33 keys on `'water'` tag (registry-fed). New design keys on no tag (iterates all registered terrains).
- Substrate change is small: handler iterates `terrainRegistry.values()` and sets cost to `min(currentCost, 1)` for each.

**HMR-stale-catalog.**

- `BattleView.tsx`'s `useMemo(() => loadDefaultCatalog(), [])` — confirm where Vite's HMR signals fire and how to invalidate.

**Cliff-edge thickness.**

- Current bins (ADR-0072): Δ=1 → 1px; Δ=2-3 → 2px; Δ≥4 → 3px.
- Proposed bump: Δ=1 → 2px; Δ=2-3 → 3px; Δ≥4 → 5px. Plan-review confirms or adjusts.

**Charged action tooltip.**

- Locate the charged action detail view (mounted when clicking from queue tower). Identify where the ability name renders.
- Wrap with `DetailHover` per S31's pattern; the existing `formatAbilityDetail` formatter already handles the content.

**Pacing constants.**

- Locate the pacing constants module (per Item #5 from S26.5).
- Identify AI turn pacing + charged action animation timing values.
- Plan-review proposes new values (current ones probably are tuned for testing speed, not playtest readability).

### Architectural decisions

After the audit:

1. **KO state invariant codification.** The bug #2/#3 cluster suggests ADR-0070's principle is correct but was applied at one site instead of uniformly. Two reasonable shapes:
   - **A — Per-site gates.** Each heal application site adds its own KO'd-target gate. Simple; risk of future heal-site additions missing the gate.
   - **B — Centralized helper.** A single `canApplyHeal(unit): boolean` or `applyHealSafely(state, unit, amount)` helper. All sites route through it. Adding a new heal site automatically inherits the gate.
   
   **Recommendation: B.** Single point of enforcement; future-proof. ADR codifies the invariant ("no heal can apply to a unit with HP ≤ 0").

2. **HP-rise-from-zero symmetry.** Once the gates from decision 1 are in place, can HP rise from 0 happen at all? Two paths:
   - **A — Fully blocked.** HP=0 is terminal; no heal can apply; Raise / Revive abilities (future content) explicitly bypass the gate via a typed flag.
   - **B — Allowed via reset path.** If HP rises from 0, the unit's KO state is fully reset (active flag cleared, turn order rejoined, etc.).
   
   **Recommendation: A.** Cleanest invariant; future Raise/Revive abilities are explicit about the transition rather than relying on side-effects of healing. Aligns with FFT precedent (Cure can't revive; Raise is the explicit reviver).

3. **Animator KO snapshot timing.** Two reasonable shapes:
   - **A — Snapshot writes unconditionally on the KO transition.** The damage action's reducer signals a "unit KO'd this step" event; the animator's flash finalize writes the KO snapshot regardless of subsequent action outcomes.
   - **B — Snapshot polls engine state.** Animator reads `state.units[unitId].vitals.hp` directly each frame; visual derives from engine state.
   
   **Recommendation: A.** Matches the existing animator pattern (snapshot writes settle on action outcomes; HP/MP/status updates fire at flash finalize per S31.5). Polling would change the architecture more substantially.

4. **Battle-end check placement.** Two reasonable shapes:
   - **A — Check after every action resolution.** Victory condition tested immediately after each action's reducer commits. Earliest possible detection.
   - **B — Check at turn-end transition.** Existing-pattern; just ensure it fires at the right edge of the turn (probably after KO action processes, before next turn starts).
   
   **Recommendation: A.** The bug suggests B has a subtle off-by-one; A removes the timing ambiguity. The check is cheap (counts units per team); no perf concern.

5. **Float redesign confirmation.** Per Chris's call: universal terrain-cost flattener. Tag-agnostic; iterates the terrain registry; applies `min(currentCost, 1)`. No ADR needed (Float's redesign is a content change against existing substrate; ADR-0073's tag abstraction unchanged).

6. **HMR catalog invalidation shape.** Two reasonable shapes:
   - **A — Catalog as useMemo dep with Vite HMR hook.** `useMemo(() => loadDefaultCatalog(), [hmrSignal])`; HMR signal updates on relevant file changes.
   - **B — Accept the dev-loop quirk; document.** Hard refresh remains the workaround; document in dev guide.
   
   **Recommendation: A.** Small fix; significantly improves dev loop. Audit confirms which Vite HMR hooks are cleanest to consume.

7. **Cliff-edge thickness new bins.** Plan-review proposes specific values:
   - Starting proposal: Δ=1 → 2px; Δ=2-3 → 3px; Δ≥4 → 5px.
   - Iteration in-session if the bump still reads insufficient or now reads excessive.
   - ADR-0072 updated with the new convention if it lands.

8. **Pacing constants new values.** Plan-review proposes specific timing values for AI turn pacing + charged action animation. Calibrate against Chris's playtest pace request ("a lot happens faster than is easy to parse").

9. **Red Lightning Mage loadout final shape.** Plan-review confirms the recommended setup or adjusts. Of note: Purifier on Red Lightning Mage paired with Blue Lightning Mage's Flametongue Burn proc closes the Burn × Purifier playtest carry-forward.

10. **Test strategy.**
    - **Bug fixes:** regression tests for each — KO'd unit cannot be healed by Cure/Regen/etc.; HP-rise-from-zero is blocked; animator snapshot reflects KO on transition; battle-end fires immediately on last-enemy elimination.
    - **Float redesign:** Float-equipped unit on a multi-cost terrain map (synthetic test) has all costs reduced to 1.
    - **HMR fix:** mostly manual verification (dev-loop change); type-check passes.
    - **Cliff-edge bump:** existing snapshot tests update to new bin values.
    - **Tooltip wire-in:** smoke test that the wrapper renders.
    - **Pacing:** no test needed (visual timing).
    - **Loadout:** existing battle-config test extends to verify the new loadout composes.

11. **Order of work.** Bug fixes first (priority by severity: KO state cluster → animator state-sync → battle-end). Then Float redesign. Then dev-loop fix. Then polish (cliff thickness, tooltip wire-in, pacing). Then content (Red Lightning Mage loadout). Each step gates on prior tests passing.

12. **33.5a/33.5b split allowance.** Surface area is moderate. Most likely split point if needed: KO state investigation balloons (e.g., heal-site enumeration is larger than expected) → 33.5a (bug cluster + battle-end + Float redesign) / 33.5b (polish + content). Likely no split needed.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land in priority order: critical bug fixes first, Float redesign next, polish + content last.

### Item 1: KO state respect — heal-site gates (bugs #2 + #3)

- Per decision 1: centralized `canApplyHeal(unit)` or `applyHealSafely` helper
- Per decision 2: HP-rise-from-zero fully blocked; future Raise/Revive bypasses via typed flag (no v1 content, so the bypass is unimplemented but architecturally available)
- Sweep all identified heal application sites; route through the helper
- ADR codifies the invariant
- Regression tests: Cure on KO'd target no-ops; Regen tick on KO'd target no-ops; Buff Regen application on KO'd target no-ops; absorption tag-flip on KO'd target still no-ops (ADR-0070 regression)
- Bug #3 verification: HP cannot rise above 0 if it was 0

### Item 2: Animator KO snapshot write (bug #4)

- Per decision 3: snapshot writes unconditionally on KO transition
- Damage action reducer signals a "unit KO'd this step" event; animator's flash finalize writes the KO indicator
- Regression test: a Knight's lethal hit on Earth Mage produces a snapshot with `koTransition: true`; the visual state correctly displays KO indicator

### Item 3: Battle-end check ordering (bug #5)

- Per decision 4: check after every action resolution
- Locate the victory-condition predicate; insert the check post-action-commit
- Regression test: action that KO's the last enemy unit immediately triggers battle-end; no extra turn fires

### Item 4: Float redesign

- Float's `modifyTerrainCosts` handler iterates `terrainRegistry.values()` and sets cost to `min(currentCost, 1)`
- Test: Float-equipped unit on synthetic high-cost-terrain map has all costs at 1
- Documentation: equipment doc (Mage War equipment) and design doc (movement abilities) updated to reflect the new Float behavior

### Item 5: HMR-stale-catalog fix

- Per decision 6: catalog as useMemo dep with Vite HMR signal
- Implementation: subscribe to relevant Vite HMR hooks; invalidate the memo on content-file reloads
- Manual verification: edit a class baseline, save, observe the UI reflects the change without hard refresh

### Item 6: Cliff-edge thickness bump

- Per decision 7: update the thickness map in `cliff-edge-layer.ts` to new bin values
- ADR-0072 updated with the new convention if it lands
- Snapshot tests update to match
- Visual verification: River Ridge cliff edges read with the new exaggeration

### Item 7: Charged action tooltip wire-in

- Locate the charged action detail view mount point (queue tower click handler)
- Wrap ability name with `DetailHover` per S31's unit detail panel pattern
- Smoke test: hover the ability name in the detail view; tooltip renders

### Item 8: Pacing constants tuning

- Per decision 8: update pacing constants module with new timing values
- Specific values per plan-review (informed by Chris's playtest pace request)
- Manual verification: AI turns + charged action sequences are more readable

### Item 9: Red Lightning Mage loadout

- Per decision 9: Staff of Power (R) + Wizard's Robe (body) + Pointy Hat (head) + Purifier (accessory)
- Existing battle-config test extends to verify the new loadout composes
- The Burn × Purifier interaction is now playtest-exercisable

## Acceptance criteria

**Bug fixes:**

- A KO'd unit cannot have HP raised by any heal application path (Cure, Regen, absorption, etc.) — uniform behavior across all sites.
- HP cannot rise above 0 if the unit was at 0 HP — the KO transition is one-way in v1.
- When a unit transitions to KO'd, the visual snapshot correctly displays the KO indicator (red X, greyed out, HP bar at 0) regardless of subsequent action outcomes.
- Battle-end fires immediately when the last enemy unit is eliminated — no extra turn after.

**Float redesign:**

- A Float-equipped unit on River Ridge has water_shallow cost 1 (reduced from 2) and water_deep cost 1 (reduced from 3).
- On a synthetic high-cost-terrain map (e.g., test fixture with swamp at cost 4), Float reduces all costs to 1.

**Dev-loop:**

- Editing a class baseline (e.g., updating `canEnter` in a test) takes effect after a regular Vite reload; no hard refresh required.

**Renderer:**

- Cliff edges read with the new thickness exaggeration; sheer perches more pronounced; gentle slopes still visible.

**UI:**

- Hovering an ability name in the charged action detail view shows the tooltip.

**Pacing:**

- AI turns and charged action sequences are paced for playtest readability (specific values per plan-review).

**Content:**

- Red Lightning Mage launches with the new loadout (Staff of Power + Wizard's Robe + Pointy Hat + Purifier); battle-config integration test passes.
- Burn × Purifier action-log readability now exercisable in River Ridge battle.

**Quality:**

- Tests at 960+, 0 failing. New regression tests proportional to bug fixes.
- ADR codifying KO state invariants.
- ADR-0072 updated with new cliff-edge thickness bins if they land.
- `docs/handoff.md` updated.

## Out of scope

- **Phase E surfaces** — title screen, battle setup, team builder, deployment phase UI. Sessions 34-37.
- **Tooltip Option B authored-description pass** — post-current-roadmap.
- **AI active absorption exploitation** — S27 carry; tactics-layer pass deferred.
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry; optional refinement.
- **Polish #5 statuses portion** — S31.5 carry; not the same root cause as bug #4 (which is about KO transitions, not status badges).
- **`UnitVisualSnapshot.maxHp` field cleanup** — S31.5 carry; tiny but defer unless audit reveals overlap with bug #4.
- **Action-log "collapse setup" toggle** — Chris confirmed pre-battle entries are fine for now; release-build suppression captures the longer-term need.
- **River Ridge balance tuning** — needs more playtest data; future session.
- **Map validator @ team-builder time** — Phase E concern.
- **Procced Lightning Strike action-log attribution** — S30 carry; Chris didn't flag confusion this playtest; defer.
- **Rasp Pendant drain attribution** — S30 carry; same disposition.
- **Magus Crown +5 MA / +25% MP cost tighteners** — calibration carry; ongoing playtest read.
- **Cliff-edge tier values beyond the bump** — iterate in-session if the proposed bump reads wrong; otherwise the new bins hold until next playtest.
- **`isWaterTile` pathfinding predicate consulting registry** — no v1 case; S33 carry.
- **`buildBattle` test-fixture extraction** — triggers at fourth duplication; S33 added third.
- **Surrender flow, MVP-unit algorithm, permadeath timer, settings expansion, reactions in projection column** — Phase E/F.

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**Engine — KO state cluster:**

- `src/engine/actions/heal-helpers.ts` (new — or wherever the helper lives) — `canApplyHeal` / `applyHealSafely`
- `src/engine/actions/reducers.ts` — Cure / Regen / Buff heal sites route through helper
- `src/engine/damage/handlers.ts` — `applyDamageToTarget`'s healing branch already gated (ADR-0070); regression confirms
- `src/engine/statuses/regen.ts` — `regenOnTick` heal application gated
- `src/engine/scheduler/battle-end.ts` (or equivalent) — battle-end check ordering

**Engine — Float redesign:**

- `src/content/abilities/float.ts` — handler iterates terrain registry; tag-agnostic

**Renderer / Animator:**

- `src/renderer/animator.ts` — snapshot KO transition write
- `src/renderer/cliff-edge-layer.ts` — new thickness bins
- `src/renderer/constants.ts` — pacing constants (if they live here)

**UI:**

- `src/ui/queue-tower.tsx` (or wherever the charged action detail view lives) — `DetailHover` wire-in
- `src/app/BattleView.tsx` — HMR catalog invalidation

**Content:**

- `src/content/battles/river-ridge-battle.ts` — Red Lightning Mage loadout

**Tests:**

- `src/engine/actions/session-33-5-integration.test.ts` (new) — bug-fix regression coverage
- `src/engine/scheduler/battle-end.test.ts` — battle-end ordering
- `src/content/abilities/float.test.ts` — Float redesign
- `src/renderer/cliff-edge-layer.test.ts` — new thickness bins
- `src/content/battles/river-ridge-battle.test.ts` — Red Lightning Mage loadout

**ADRs:**

- `docs/decisions/0074-ko-state-invariants.md` (or next available) — heal-site gates + HP-rise-from-zero symmetry
- `docs/decisions/0072-...` — updated if cliff-edge thickness bump lands

**Documentation:**

- `docs/twentyOneDesign/mage-war-equipment.md` — Float spec update (universal terrain-cost flattener)
- `docs/twentyOneDesign/movement-abilities.md` (or equivalent) — Float design doc update
- `docs/handoff.md` — session handoff

## Workflow notes

- **Plaintext-first review required.**
- **Diagnostic-first within the plan.** The KO state cluster needs careful audit of all heal application sites before the fix lands; don't pre-commit to a fix shape before the diagnostic runs.
- **ADR path is `docs/decisions/`.**
- **Bug-fix priority order:** KO state cluster (#2/#3) → animator state-sync (#4) → battle-end (#5) → Float redesign → polish → content.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: KO state helper shape (decision 1); HP-rise-from-zero symmetry call (decision 2); cliff-edge thickness bump value (decision 7) if first iteration reads wrong; pacing constant values (decision 8) if first values feel wrong.
- **In-session iteration expected** on cliff-edge thickness and pacing constants. Chris's playtest reads will inform whether the first proposed values land.
- **Equipment-complete + Phase D content milestones hold.** No new substrate or content milestones this session.

## Watch-fors

**Addressed this session:**

- KO state respect across all heal application sites (bugs #2 / #3)
- Animator state-sync on KO transition (bug #4)
- Battle-end check ordering (bug #5)
- Float redesign per Chris's call (Walk-on-Water concept stays available for future content; Float is now the universal terrain-cost flattener)
- HMR-stale-catalog dev-loop fix
- Cliff-edge thickness bump per Chris's playtest read
- Charged action detail view tooltip wire-in
- Pacing constants tuning per Chris's playtest read
- Red Lightning Mage loadout — exercises Staff of Power, Purifier (closes Burn × Purifier playtest carry-forward)

**Not addressed this session, longer-term carry-forward:**

- **Suppress pre-battle init entries in release builds** — new carry from this playtest read; longer-term polish
- **Phase E surfaces** — Sessions 34-37
- **Walk-on-Water passive** — future content; substrate ready
- **River Ridge balance tuning** — open considerations from `river-ridge.md`
- **Future maps / terrain types** — beyond v1
- **Layered maps** — beyond v1
- **`map-and-battlefield.md` open questions** — AoE multi-layer, friendly pass-through, LoS tie-breaking, unit-blocking-LoS, forced movement collision, trigger tile semantics, hit-chance/cover from elevation
- **Procced Lightning Strike action-log attribution** — S30 carry
- **Rasp Pendant drain attribution** — S30 carry
- **`UnitVisualSnapshot.maxHp` field cleanup** — S31.5 carry
- **Polish #5 statuses portion** — S31.5 carry; UnitVisualSnapshot.statuses ahead-of-tween settle
- **Wand swing ally-targetability** — S31 carry
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry
- **Procced spell uses caster's MA** — S30/S31 carry; ongoing playtest
- **Magus Crown +5 MA / +25% MP cost tighteners** — calibration carry
- **Tintinibar Regen tuning** — initial read reasonable; ongoing
- **Sorcerer's Robe Move +1** — initial read reasonable; ongoing
- **Status-badge polarity convention extension** — chip pre-icons if status lists grow
- **Team color palette → engine `Team` shape** — long-term
- **Tooltip Option B authored-description pass** — post-current-roadmap
- **`onTurnStart` symmetric widening** — S26 carry
- **Multiplicative tick-amount stacking** — S28 carry
- **`onFinalDamage` fires on absorbed hits but handlers gate** — design pattern
- **Forecast facing uses actual attacker→target geometry** — S30 carry
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in** — S30 carry
- **Constant-map labels don't carry icons today** — S28 polish
- **`pa_factor` NotYetImplementedError** — audit E3
- **TS strict-mode test errors** — audit E8
- **Surrender flow** — S34 / ADR-0041
- **MVP-unit smarter algorithm** — S24 Wave 1
- **Permadeath timer** — S24 Wave 1
- **Settings expansion** — S24 Wave 1
- **Reactions in projection column** — S24 Wave 1
- **Forecast accuracy row visibility** — S30 reject; revisit if confusion surfaces
- **Hit-chance and cover modifiers from elevation differential** — `map-and-battlefield.md` open question
- **`fillVitalsFromComputedMaxes` ordering invariant** — S32 carry; holds for v1
- **`buildBattle` test-fixture extraction** — triggers at fourth duplication
- **`isWaterTile` predicate** — registry consultation if non-water-tagged terrain ever at elev 0/1
- **Bedrock Stride ongoing playtest read** — integration-tested in S33; real playtest still pending real knockback-off-perch scenario

## Estimated size

**Medium.** The KO state cluster (bugs #2/#3) is the largest individual item — diagnostic-first investigation, possibly an ADR, sweep across heal application sites. Animator state-sync (bug #4) is moderate. Battle-end (bug #5) is small. Float redesign is small. Polish items are individually small.

**33.5a/33.5b split allowance** reserved if the KO state investigation reveals more heal-application sites than expected:

- **33.5a:** Bug fixes (KO state cluster + animator + battle-end) + Float redesign
- **33.5b:** Polish (cliff thickness, tooltip wire-in, HMR fix, pacing) + content (Red Lightning Mage)

Likely no split needed.

**End of session: clean playtest state ready for Phase E (Session 34 = title screen + battle setup).**
