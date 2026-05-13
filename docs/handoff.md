# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

What belongs here:

- Things noticed but not acted on.
- Implementation choices considered and rejected.
- Suggested scope or sequencing for the next session.
- Watch-for items and open questions that aren't ADR-worthy.

What does *not* belong here:

- Decisions (those are ADRs).
- What changed (that's the commit message).
- System design (that's the design docs).
- Long-running plan (that's `docs/roadmap.md`).
- Comprehensive progress / deferred-work review (`docs/progress.md` is the durable home for that — refreshed periodically, not session-by-session).

---

## From session 2026-05-12 (Session 31 — Cluster 5 content + 3 substrate adds + equipment-complete milestone + post-handoff polish folds)

Session 31 landed the Cluster 5 content (Bolt Hammer, Flametongue Burn proc, Rasp Pendant, both wand on-hit shifts), the three substrate items that the content needed (`tagged_resistance_shift` status, `physicalVariance` weapon-side variance fork, `riderSource` bypass extended to `actionSpeed` and Act budget), plus end-to-end demo loadouts that exercise the substrate. After Chris's first-playtest run surfaced a UI gap (white-screen crash on Rasp Pendant's `system_mp_drain` emission), the session also folded in the missing UI cases at four sites, defensive exhaustiveness checks at two switch sites, and an Option-A hover-tooltip pass for abilities and equipment in the unit detail panel + ability menu. Tests: **846 passing across 70 files, 0 failing** (up from 816 in Session 30). +30 new tests across `session-31-integration.test.ts` (22) and `detail-text.test.ts` (8).

**Equipment-complete milestone reached.** All items in `docs/twentyOneDesign/mage-war-equipment.md` are now shipped to the engine. Magus Crown's +1 Action capacity is wired end-to-end and exercised in the demo via the Red Fire Mage.

### Scope completed

**Engine substrate (3 items):**

1. **`tagged_resistance_shift` parametric status (ADR-0066).** New status type carrying per-instance `customState: { tagDeltas: Record<DamageTag, number>; displayName: string }`. Registers one `modifyResistance` handler that reads from `ctx.instance.customState`. Stacking rule `STACK_INDEPENDENT` so each application is a distinct instance, and the additive `runModifyResistance` chain composes deltas naturally. Duration `'permanent'` (no tick, no expiry by time). First consumers: Wand of the Depths / Wand of the Deepwood on-hit shifts. Future consumers (Wand of Embers, Wand of Storms per the equipment doc's "Future wands" note) reuse the type with different deltas.

2. **`physicalVariance?: { min: number; max: number }` on `WeaponEquipment` (ADR-0067).** Optional weapon-side variance band; the pipeline `varianceRoll` stage forks via a `resolveVarianceBand(ctx, env)` helper. Physical hits with a wielder weapon declaring `physicalVariance` use the weapon's band; magical damage and weapons without the field fall through to ability-side `ctx.variance` (which is `{1, 1}` for the universal Knight `attack`). Sub-stream 0 unchanged — the fork picks the band, not the lane. Replay determinism preserved.

3. **`riderSource` bypasses `actionSpeed` charge + Act budget validation/decrement (ADR-0068).** Extends the rider bypass surface from three sites (ADR-0064) to five. Rider casts (`riderSource !== undefined`):
   - `reduceUseAbility` skips `commitCharged` regardless of `ability.actionSpeed`; rider casts resolve instantly.
   - `validateAction` skips the `actsAvailable > 0` check; rider casts use `getActorIfActive` instead of `getCurrentTurnActor + budget check`.
   - `reduceUseAbility` skips `decrementActBudget`; the wielder paid for the swing's Act, and the proc rides the swing.
   
   Surfaced from Session 31's first end-to-end demo loadout (Blue Knight + Bolt Hammer): the swing consumed Act 1; the proc's Lightning Strike emission then hit "No Act budget remaining this turn" in the validator. Conceptually identical to ADR-0064's MP/Silence rationale ("the proc is the weapon's power, not the wielder's"); now codified for Act budget and charge time as well.

**Engine plumbing fix (incidental):**

4. **`system_mp_drain` plumbed through `commit.ts:envelopeFor`.** Session 30 added the action type and the reducer + validator pass-through, but the commit-side envelope construction's switch + actorId-exclusion list were missing the case. Surfaced this session when the Blue Lightning Mage's Flametongue + Rasp Pendant combo emitted `system_mp_drain` during the demo battle and the orchestrator threw on `Cannot read properties of undefined (reading 'type')`. Now `envelopeFor` handles `system_mp_drain` like the other system action types.

**Status type expansion (incidental):**

5. **`regen_auto` sibling status.** Session 29's Tintinibar shipped with `statusGrants: ['regen']`, but `regen` has `durationMode: 'per_unit_ct'` which requires a duration arg, and the equipment-status-grants pipeline doesn't pass one. The Tintinibar definition had a watch-for note flagging this. Session 31 surfaced it the first time Tintinibar was equipped on a v1 demo unit (Blue Knight). Resolved by authoring `regen_auto.ts` (`'permanent_per_unit_ct'`, shares `regenOnTick` with cast Regen), routing Tintinibar's grant to it, leaving cast Regen intact for Earth Mage's Buff ability. Sibling pattern follows Shell / future cast-Shell.

**Content (5 items + 3 abilities):**

6. **Bolt Hammer (new).** WP 10, accuracy 75, `physicalVariance: { min: 0.9, max: 1.3 }`, `tags: ['axe']`, `attackProcs: [{ chance: 0.25, abilityId: 'lightning_strike' }]`. Reuses the existing first-level Lightning Strike directly per Session 31 decision 4 — display name flows automatically; the actionSpeed bypass (ADR-0068) lets the procced charged spell fire instantly. `availability: 'available'`.

7. **Flametongue extension.** Added `attackProcs: [{ chance: 0.25, abilityId: 'apply_burn_proc' }]`. Fire-tag intact (Session 29 carry-forward). New sibling ability `apply_burn_proc` (single-target Burn application, `applyAlways: true`, `availability: 'hidden'`) is distinct from `smolder` (Fire Mage's reaction-compiled passive, fires *attacker*-ward) and `spark` (Fire Mage's first-action 2-stack Burn-bomb with Faith roll). The proc fires *target*-ward off a physical swing.

8. **War Axe retrofit.** Added `physicalVariance: { min: 0.9, max: 1.3 }`. No proc. Lands as the variance fork's regression fixture.

9. **Wand of the Depths extension.** Added `attackProcs: [{ chance: 1.0, abilityId: 'wand_of_depths_apply_shift' }]`. Wielder-side `+1H/+1V on water-tagged spells` passive intact.

10. **Wand of the Deepwood extension.** Added `attackProcs: [{ chance: 1.0, abilityId: 'wand_of_deepwood_apply_shift' }]`. Wielder-side `+5 speed on earth-tagged spells` passive intact.

11. **Rasp Pendant (new).** Accessory, `damageMpDrainPercent: 10`. No damage reduction (per Session 30's mid-session call captured in ADR-0065). Equipment doc updated to match.

12. **Two `apply_shift` abilities (`wand_of_depths_apply_shift`, `wand_of_deepwood_apply_shift`).** Single-target apply-status carriers, `applyAlways: true`. Each authors per-instance `customState: { tagDeltas, displayName }` for the target's instance of `tagged_resistance_shift`. Both `availability: 'hidden'`.

**Demo loadouts (5 of 6 units fully equipped):**

13. **Blue Knight:** Bolt Hammer (R), Managuard (L), Silvered Vest (body), Focus Band (head), Tintinibar (accessory). Exercises Session 31's Bolt Hammer proc + asymmetric variance, Session 29's Managuard +2 MA hybrid shield, Silvered Vest +2 MA +30 MP, Focus Band status defense, plus Tintinibar's Auto-Regen (now routed through `regen_auto`).

14. **Blue Water Mage:** Wand of the Depths (R), Sorcerer's Robe (body), Pointy Hat (head), Lightfoot (accessory). Exercises the wand on-hit shift, Auto-Shell from Sorcerer's Robe, total Move 6 (base 4 + Sorc Robe +1 + Lightfoot +1).

15. **Blue Lightning Mage:** Flametongue (R), Wizard's Robe (body), Pointy Hat (head), Rasp Pendant (accessory). Cross-element pressure via Flametongue's Burn proc; Rasp Pendant exercises Session 30's MP drain through `system_mp_drain`.

16. **Red Earth Mage:** Wand of the Deepwood (R), Wizard's Robe (body), Pointy Hat (head), Capacitor Ring (accessory). Capacitor Ring +100 Lightning resistance stacks on Earth Mage's native +50 → +150 effective → absorption activation (ADR-0057 tag-flip → healing) on any incoming Lightning damage. End-to-end Capacitor + native-resistance + ADR-0057 substrate exercised. Wand of the Deepwood on-hit cancels with Wand of the Depths on a shared target.

17. **Red Fire Mage:** Magus Crown (head), Wizard's Robe (body). Carries a two-secondary-command-set loadout (`white_magic` + `water_spells`) — only valid because Magus Crown's `bucketCapacityMods: [[secondary_command_sets, +1]]` is wired through `equipmentContributionsFor → runModifyBucketCapacity` (Session 29 substrate). Exercises the Magus Crown +1 Action capacity end-to-end. The earlier "Magus Crown ships disabled / no-op" framing was stale; Session 29 already wired it, and Session 31 is the first demo unit to actually use it.

18. **Red Lightning Mage:** unchanged (existing default loadout).

**Documentation:**

19. **`docs/twentyOneDesign/mage-war-equipment.md` — Rasp Pendant spec update.** Replaced "10% of final damage dealt is converted to MP drain" with "Bonus 10% of final damage dealt is converted to MP drain (wielder gains, target loses; no damage reduction)". Notes section expanded with the spillover-lost guardrail and the absorption skip per ADR-0065.

**Mid-session bug fix (Rasp Pendant white-screen crash, post-handoff):**

20. **`system_mp_drain` UI cases added at four sites.** Chris's first-playtest run hit a white-screen crash when Blue Lightning Mage's Rasp Pendant emitted `system_mp_drain` (the new action type from Session 30 substrate, first surfaced in v1 content this session). Root cause: `formatActionLog`'s switch in `src/ui/action-log-format.ts` was non-exhaustive over `Action` types and lacked a `system_mp_drain` case — fell through to implicit `undefined`, caller's `for (const row of rows)` threw `TypeError`, React tree unmounted. Fixed by adding the missing case at four sites:
    - `src/ui/action-log-format.ts` — renders `"X drained N MP from Y"`, skips zero-applied entries, annotates `(N lost to MP cap)` when source headroom is below target loss.
    - `src/renderer/animator.ts` — added to the no-v1-visual list alongside `system_apply_status` / `system_ct_push`.
    - `src/ui/action-log-panel.tsx` — detail expansion row.
    - `src/ui/derived-events.ts` — `deriveActionParticipants` sets `actorId: source, targetIds: [target]` so hover-counterpart highlighting works.

21. **Defensive exhaustiveness checks at two switches.** To make the next missing system-action case fail at compile time instead of silently in production, added `default: { const _exhaustive: never = … }` guards at:
    - `src/engine/actions/commit.ts:envelopeFor` (which Session 30 had ALSO missed `system_mp_drain` in — quietly returning undefined and only surfacing in Session 31 when the orchestrator finally tried to envelope one).
    - `src/ui/action-log-format.ts:formatAction` — runtime fallback returns empty rows so missed cases show nothing instead of crashing, while the compile-time `never` cast forces a TS error.

**Option-A detail-hover tooltip pass (post-handoff polish fold-in):**

22. **`src/ui/detail-text.ts` — pure formatters** for `ItemDefinition` and `AbilityDefinition`. Auto-generates a mechanical summary from existing catalog fields (WP / accuracy / variance / attackProcs / damageMpDrainPercent / statMods / movementMods / resistanceMods / evasionMods / abilityRangeModifiers / actionSpeedModifiers / mpCostMultipliers / outgoingHitChanceMultipliers / incomingStatusModifiers / statusTickAmountMultipliers / bucketCapacityMods / statusGrants / classRestrictions / tags). For active abilities: cost, targeting, damage spec, AoE, status effects, ctEffects, selfDamage, hit-roll presence. For passives: an authored placeholder description per known demo passive (counter, move_plus_1, float, fly, earth_resilience, earth_communion, bedrock_stride, tidal_pull, flow_state, tidewalker, smolder, ignition, aether_bloom, hotfoot, discharge, conductor, quickstep, damage_reduction, static_embrace, magnetic_mark) plus auto-cost / tags / hook-list fallback.

23. **`src/ui/detail-hover.tsx` — generic hover-tooltip wrapper.** `<DetailHover content={…}>{children}</DetailHover>` renders a positioned tooltip near the wrapped element on `onMouseEnter`. Placement: tries left of anchor, then right, then shrink-to-fit on the wider side, with viewport-edge clamping so the tooltip never clips off-screen on narrow viewports. Vertical clamp keeps the top on-screen when anchors sit near the bottom edge.

24. **Three wire-in sites:**
    - **Unit detail panel** (`src/ui/unit-detail-panel.tsx`) — every passive ability in the Loadout section's R/S/M buckets gets its name wrapped in `<DetailHover>`. Same for every equipment row's item name. Hoverable elements show a dotted underline with `cursor: help` so the affordance reads as interactive.
    - **Action menu's `AbilityButton`** (`src/ui/action-menu.tsx`) — the entire button is wrapped in `<DetailHover>` so hovering the cast option reveals the mechanical breakdown before commit.
    - Command-set names (Primary Action / Secondary Action(s) — e.g., "Water Spells", "White Magic") are intentionally NOT wrapped; they're set-of-abilities containers, not individual mechanical units. The set's member abilities are reachable via the cast flow's AbilityButton hover instead.

25. **`src/ui/detail-text.test.ts` — formatter contract tests.** 8 tests covering Bolt Hammer / Rasp Pendant / Wand of Depths / Sorcerer's Robe / Magus Crown formatting (verifies WP, drain, range mods, stat mods, statusGrants, classRestrictions, bucketCapacity all surface correctly) and Lightning Strike / Counter / Move +1 (active and passive ability formatting).

26. **Tooltip background opacity — React portal fix.** First pass landed the tooltip with declared background `rgb(20, 22, 28)` at opacity 1, but the painted color still showed translucency because the wrapper `<span style={statusDurStyle}>` in `unit-detail-panel.tsx` carries `opacity: 0.65` (the dimmed reading style for the right-side cell). CSS `opacity < 1` multiplies *all* descendant alpha — including `position: fixed` children — so the tooltip's solid color got attenuated to ~`(13, 14, 18, 0.65)` and underlying panel rows bled through.
    - Fixed by rendering the tooltip via `createPortal(<Tooltip />, document.body)` so it escapes the wrapper's stacking context entirely. Verified: tooltip's DOM parent is now `<body>` with opacity 1.
    - Lesson worth carrying: any future "popover above a dimmed row" UI should use a portal too. Tracked.
    - Tooltip's own background also tightened from `rgba(20, 22, 28, 0.97)` to fully opaque `#14161c` with a brighter border (`#3a3e48`) and stronger shadow for readability against the panel's similar dark palette.

### Architecture records

- **ADR-0066** — `tagged_resistance_shift` parametric status: single-type-with-customState shape, `STACK_INDEPENDENT`, `'permanent'` duration, additive `modifyResistance` composition for stacking + cross-source cancellation.
- **ADR-0067** — Weapon-sourced asymmetric variance: optional `physicalVariance` on `WeaponEquipment`, pipeline fork via `resolveVarianceBand`, physical-gated, sub-stream 0 unchanged.
- **ADR-0068** — Rider bypass extension to `actionSpeed` charge + Act budget: lets Bolt Hammer reuse the first-level Lightning Strike ability directly with instant resolution; lets procs fire on swings where the wielder has already spent their Act. Five-site rider bypass machinery now reaches the point where a `isRiderCast(payload)` helper could consolidate the literal `!== undefined` checks (small refactor; deferred — see watch-fors).

### Test reconciliation

- 19 new tests in `src/engine/actions/session-31-integration.test.ts`. Sections:
  - `tagged_resistance_shift` composition (5): single application, stacked same-source, cross-wand cancellation, additive over native baseline, battle-long persistence.
  - `physicalVariance` fork (4): weapon-declared band used, ability-band fallback, magical-ignored, deterministic per seed.
  - Bolt Hammer + sibling content sanity (7): Bolt Hammer shape, War Axe retrofit, Flametongue extension, Wand of the Depths extension, Wand of the Deepwood extension, Rasp Pendant shape, proc abilities all `'hidden'`, wand customState authoring.
  - `riderSource` actionSpeed bypass (2): rider cast with `actionSpeed > 0` resolves instantly; non-rider cast still charges as expected (regression).

- Existing tests unchanged in count behavior. `src/content/loader.test.ts` bumped per content additions:
  - statuses 22 → 24 (`tagged_resistance_shift`, `regen_auto`)
  - abilities 46 → 49 (`apply_burn_proc`, `wand_of_depths_apply_shift`, `wand_of_deepwood_apply_shift`)
  - items 33 → 35 (`bolt_hammer`, `rasp_pendant`)

- TypeScript strict-mode error count unchanged from Session 30; zero new strict-mode errors.

### Limitations + watch-fors

- **Rider bypass machinery is now keyed at five sites without a single helper.** `riderSource !== undefined` reads at: `validate.ts` Act + MP, `reducers.ts` MP + Act + actionSpeed, `commit.ts` pre-hook. Sixth bypass site → time to extract `isRiderCast(payload): boolean` and update all sites at once. Quiet refactor; no engine behavior change. Flagged in ADR-0068.

- **`tagged_resistance_shift` polarity defaults to `'debuff'`.** v1 ships with enemy-only wand swings (decision 8 in the brief), so the offensive-setup polarity is correct. When ally-targetability lands (deferred), per-instance polarity may need to read off the *net* delta vs. the recipient's intent (an enemy targeted with +Fire shift could read as net-positive for the enemy if their Fire vulnerability is the issue). Reassess at that point.

- **Magus Crown's `bucketCapacityMods` covers `secondary_command_sets`, not `first_action`.** The equipment-doc comment ("Magus Crown's +1 Action capacity allows equipping two secondary action command sets instead of one") matches what the engine does. The internal field name `bucketCapacityMods: [[secondary_command_sets, 1]]` correctly maps to the secondary slot.

- **Red Fire Mage's loadout array is loaded with 2 secondary command sets.** This is validated at `createInitialState` time via `validateLoadout`, which reads through `runModifyBucketCapacity` — Magus Crown's contribution is consulted. If Magus Crown is unequipped via a future inventory-swap mechanic, the loadout becomes invalid until the second command set is also removed. v1 has no inventory swap; the validation is start-of-battle only. Tracked.

- **Bolt Hammer's procced spell uses the *wielder's* MA.** Per ADR-0064 ("Equipment-procced spell uses the actor's stats for damage formula"). A Knight wearing Bolt Hammer fires a Lightning Strike that scales on the Knight's MA, not the weapon's WP. With Knight MA 4 + Silvered Vest +2 + Managuard +2 = 8, the procced Lightning Strike at MA 8 × power 12 × Faith × Faith (~0.49) lands around ~47 base — modest vs. a stock Lightning Mage's ~82 at MA 14. By design; flagged for playtest read.

- **Procced Lightning Strike now bypasses `actionSpeed`.** Lightning Strike's display name + cast UI still shows it as a 30-CT charged spell when Lightning Mage casts it normally. The rider-fired variant resolves instantly. The action log distinguishes via `riderSource: { kind: 'equipment_proc', itemId: 'bolt_hammer' }` — readable in trace, not yet surfaced as different visual treatment in the action log UI.

- **`apply_burn_proc` and the two `apply_shift` abilities all declare `actionSpeed: 0` explicitly.** They'd resolve instantly via the ADR-0068 rider bypass regardless, but the explicit-0 keeps them self-coherent if they ever surface in a non-rider context. None of them are exposed via command menus (`availability: 'hidden'`).

- **`regen_auto` is a sibling of `regen` sharing the onTick handler.** Heal formula lives in `regenOnTick` (exported from `regen.ts`). Future Regen-formula edits land once and benefit both.

- **`'permanent'` durationMode is now used by `tagged_resistance_shift` (first v1 consumer).** Before Session 31, no v1 status used it. The `applyStatus` / `computeInitialDuration` flow handles it correctly per pre-existing code. Future statuses needing battle-long-no-tick semantics have this precedent.

- **Forecast hit-chance display unchanged.** Session 30 shipped the always-shown hit chance + range strip; Session 31 doesn't touch it. Still shows "hit 100%" on auto-hit magical abilities for reading consistency.

- **Rasp Pendant + Bolt Hammer composes naturally.** A Knight with both equipped: every swing triggers (a) the swing's damage, (b) 25% Lightning Strike proc, (c) 10% MP drain on the swing's final damage, (d) 10% MP drain on the procced Lightning Strike's final damage too — `onFinalDamage` fires for the rider cast as well (rider casts still pump through the damage pipeline). Demonstrated cleanly in the Blue Knight loadout for playtest.

- **System action types not in `commit.ts:envelopeFor` switch will crash silently with `undefined.type`.** Discovered this session via `system_mp_drain`. The contract: any new system action type added to `ActionType` must also be added to the actorId-exclusion list AND the case-switch in `envelopeFor`. Tracked as a quiet defensive add — could swap the implicit switch with an exhaustive switch (TS would catch missing cases) in a future polish session.

### Considered and rejected this session

- **Sibling `lightning_strike_proc` ability with `actionSpeed: 0`.** Rejected per Session 31 decision 4 — would split Lightning Strike into two definitions, requiring sync if power/cost/tags shift. ADR-0068's actionSpeed bypass enables reuse instead.

- **Sibling resistance-shift types per source (Wand of the Depths Shift vs. Wand of the Deepwood Shift as separate types).** Rejected per ADR-0066 — parametric type with customState scales to future wands without catalog inflation.

- **Make `actionSpeed` dynamic / context-aware on Lightning Strike.** Rejected per ADR-0068 — would require widening the ability field shape and adding callback dispatch at every cast site. Engine-side rider bypass is narrower.

- **Per-grant duration field on `statusGrants` (so Tintinibar could pass a max-int duration for cast Regen).** Rejected — sibling status (`regen_auto`) is cleaner and matches the established pattern (Shell vs. future cast-Shell, Haste vs. future Quickening). The shape change would propagate to every grant authoring; sibling-status is a local change to the one consumer.

- **Status tags `['negative', 'dispellable']` vs. `['negative']` only on `tagged_resistance_shift`.** Picked the former — `'dispellable'` is forward-compatible (future Dispel ability can clear it) and matches Shell/Protect's tag set; no v1 consumer reads it, but the tag has zero cost and a documented precedent.

### Empirical-questions checklist for Chris's next playtest (broad playtest now warranted — equipment-complete milestone)

**Blue Knight (Bolt Hammer + Managuard + Silvered Vest + Focus Band + Tintinibar):**
- [ ] Open Status. Knight's MA should read 4 + 2 (Silvered Vest) + 2 (Managuard) = **8** (not the base 4). HP 144 + 50 = **194**; MP 20 + 30 = **50**.
- [ ] Auto-Regen should be active at battle start (Tintinibar grants `regen_auto`). At Knight Faith 70 × maxHp 194: floor(0.70 × 0.10 × 194) = **13 HP / CT-100 trigger**. Verify a CT-100 elapses → Knight HP ticks up.
- [ ] Walk into melee, attack a target with the Bolt Hammer swing. Verify damage band is asymmetric — expected range per swing: `8 (PA from Sil+Man+Knight) × 10 (WP) × 0.7 (Brave) × [0.9, 1.3] (variance)` ≈ 50–73 base. Damage roll should hover in the 50–73 range, not centered on the symmetric mean of 56. Sample multiple swings; mean should sit above 56.
- [ ] Watch for the 25% Lightning Strike proc — over many swings, ~1 in 4 should emit a Lightning bolt at the target. Action log entry should read "Lightning Strike" (NOT "Bolt Hammer procced Lightning Strike" or anything custom) — the display name flows from the ability.
- [ ] On every landed swing (and every procced spell), the target should lose ~10% of the final damage in MP (Rasp Pendant on Lightning Mage — wait, that's on the LIGHTNING Mage, not the Knight; Knight has Tintinibar). So Knight's swings don't trigger Rasp Pendant; only Lightning Mage's swings do.
- [ ] Focus Band reads as: −25 incoming status application chance on `'negative'`-tagged statuses. The Burn proc from a hypothetical enemy Flametongue (not in v1 red loadout) would land at 75%, not 100%; not exercised directly but the wiring should hold.

**Blue Water Mage (Wand of the Depths + Sorcerer's Robe + Pointy Hat + Lightfoot):**
- [ ] HP 102 + 30 + 10 = **142**, MP 60 + 30 + 20 = **110**, Speed 10 + 1 (Lightfoot) = **11**, Move 4 + 1 + 1 = **6**, MA 12 + 1 (Pointy Hat) = **13**.
- [ ] Auto-Shell active at battle start (Sorcerer's Robe). Incoming magical damage → ×0.5 multiplier; verify via a single magical hit.
- [ ] Walk to melee, swing the Wand of the Depths at an enemy. The hit lands tiny physical damage (WP 2 × PA 4 × 0.7 ≈ 5.6 base) but applies `tagged_resistance_shift` with `+25 Fire / -25 Lightning`. Verify the status appears on the target (status badge in detail panel).
- [ ] Cast Water Strike on a target. Range should show as **5H · 3V** (base 4H/2V + Wand of the Depths +1H/+1V on water-tagged).
- [ ] After applying the shift, have Blue Lightning Mage cast Lightning Strike on the same target. The damage should be 25% higher than against an un-shifted target (the −25 Lightning resistance multiplies (100 − (−25)) / 100 = ×1.25).

**Blue Lightning Mage (Flametongue + Wizard's Robe + Pointy Hat + Rasp Pendant):**
- [ ] HP 87 + 40 + 10 = **137**, MP 60 + 40 + 20 = **120**, MA 14 + 3 + 1 = **18**. Wizard's Robe's −25 to all four elemental resistances should reflect in the Status panel's per-tag resistance display (not yet a v1 surface — flagged below).
- [ ] Walk to melee, swing Flametongue at an enemy. 25% per-swing chance to apply Burn. Burn at Lightning Mage MA 18 × 0.6 = **10 dmg per stack** per CT-100. Apply, then watch the target tick at CT-100 for the burn damage.
- [ ] Every swing — both the direct hit and any Burn-proc-driven application — drains 10% of the final damage as MP transfer (Rasp Pendant). Verify via Lightning Mage's MP rising and the target's MP dropping in the action log.

**Red Earth Mage (Wand of the Deepwood + Wizard's Robe + Pointy Hat + Capacitor Ring):**
- [ ] HP 112 + 40 + 10 = **162**, MP 60 + 40 + 20 = **120**, MA 12 + 3 + 1 = **16**. Lightning resistance: Earth Mage native +50 + Capacitor Ring +100 = **+150 effective**. Incoming Lightning damage triggers absorption (ADR-0057 tag-flip): the damage value tag-flips to healing and the unit gains HP. Verify via Blue Lightning Mage casting Lightning Strike on Red Earth Mage — Red Earth Mage's HP should go UP, with the action log showing the tag-flipped resolution.
- [ ] Walk to melee, swing the Wand of the Deepwood. Applies `tagged_resistance_shift` with `+25 Lightning / -25 Fire` on the target.
- [ ] **Cross-wand cancellation test:** Have Blue Water Mage swing Wand of the Depths AND Red Earth Mage swing Wand of the Deepwood on the same target. Resistance shifts should net to zero on both Fire and Lightning. Verify the target has two `tagged_resistance_shift` instances and the runModifyResistance composition produces zero net via the integration tests' authoritative path.

**Red Fire Mage (Magus Crown + Wizard's Robe):**
- [ ] HP 97 + 40 + 10 = **147** (no head HP swap — Magus Crown has no HP mod), MA 13 + 3 − 3 (Magus Crown) = **13** (net zero MA), MP 60 + 40 = **100** (Magus Crown adds no MP).
- [ ] Loadout's second action menu shows BOTH `White Magic (Cure)` and `Water Spells` — two distinct sub-action panels under "Secondary Action(s)". This is the Magus Crown +1 Action capacity wired through.
- [ ] Cast Water Strike from the Fire Mage. The MA is 13 so spell damage matches a base Fire Mage's Water Strike. Verify the action is available (it was previously inaccessible to Fire Mage without Magus Crown).
- [ ] Cure self-heal works (existing Cure on white_magic command set).

**Action log + UI checks (Session 30 carry-forwards):**
- [ ] Bucket / slot labels read "Primary Action", "Secondary Action(s)", "Reaction(s)", "Support(s)", "Movement(s)" / "Left Hand", "Right Hand", "Head", "Body", "Accessory". No raw bucket IDs.
- [ ] Per-facing evasion row visible in unit Status panel (Water Mage: F 10 / S 6 / B 0 baseline; with Steel Helm: side/back goes negative on Knight builds — not in this demo's blue Knight build).
- [ ] Forecast panel shows `Range: 3H · 2V` / `hit XX%` per target row for all attacks, including auto-hit magical (displays `hit 100%`).

**Substrate validation (regression check, no observable surface):**
- [ ] Demo battle launches cleanly with all six unit equipment blocks; no validation errors at startup.
- [ ] Existing battles (greedy vs. basic AI integration tests) terminate without regression — confirmed by the test suite (835/835 passing).

### Longer-term carry-forward

- **Rider bypass consolidation refactor.** Five sites, all gated on `riderSource !== undefined`. Extract `isRiderCast(payload): boolean` helper, sweep all sites. Cosmetic, no behavior change.
- **Exhaustive switch over `ActionType` in `commit.ts:envelopeFor`.** Force TS-side coverage so the next system action addition doesn't silently break commitAction at runtime (as `system_mp_drain` did this session). Defensive add.
- **`computeAbilityRange` extension to ability menu for wand-buffed ranges.** Session 30 brought the forecast panel onto `computeAbilityRange`; the cast menu itself may still display un-buffed range in some flows. Verify in playtest.
- **AI projection forecast extension via `computeOutgoingHitChance`.** Session 30 carry; optional refinement.
- **AI active absorption exploitation** (Session 27 carry) — relevant now that Capacitor + Earth Mage produces absorption in the demo. AI tactics-layer pass.
- **Procced spell uses caster's MA — playtest read.** Bolt Hammer in particular surfaces this (Knight at MA 8 vs. hypothetical Lightning Mage MA 14). Watch for "boring weapon, op caster" feel.
- **Wand swing ally-targetability** (Session 31 deferred). Future content-or-engine session; per-weapon targeting override on the swing ability is the cleanest shape.
- **Magus Crown +5 MA / +25% MP cost tighteners.** Equipment-doc-suggested cost-tighteners if Magus Crown's variety advantage exceeds the -3 MA cost in playtest. Surfaced in the equipment doc; flagged for tuning pass.
- **Burn × Purifier playtest.** No Purifier in the v1 demo loadouts. Could compose a one-off playtest battle with Purifier equipped and a Burn-applying attacker.
- **Tintinibar Regen tuning playtest.** Now that Auto-Regen actually applies (via `regen_auto`), verify the per-CT-100 heal feels right. Knight 13 HP/tick at 70 Faith × 0.10 × maxHp.
- **Sorcerer's Robe Move +1 playtest read.** Verifiable now (Blue Water Mage Move 6 with the equipment stack).
- **Status-badge polarity convention** (Session 22 carry).
- **Forecast accuracy row** (rejected in Session 30) — revisit if playtest finds the absent accuracy multiplier surface confusing.
- **`onTurnStart` symmetric widening** (Session 26 carry; defer until emitter).
- **Multiplicative tick-amount stacking** (Session 28 carry; no v1 stacking case).
- **`onFinalDamage` fires on absorbed hits but handlers gate on `absorbed: true`** — observation, not a problem; future "thanks for the heal" debuff handler can gate inversely.
- **Forecast facing uses actual attacker→target geometry, not hypothetical "if I moved here first".** Carry from Session 30.
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in.** Carry from Session 30.
- **Constant-map labels don't carry icons today.** Migration seam is in place (`bucketLabel(id)` / `slotLabel(id)` helpers). Future polish.
- **Renderer's HP "max" captured at mount** (Session 28 carry; sibling to MP lift).
- **rAF vs setInterval for animation drain** (Session 23 carry).
- **AoE preview correctness across all shapes** (Session 23 carry; confirmed shape-agnostic in Sessions 26–30).
- **MP / status snapshot ahead-of-tween fix** (Session 22 carry).
- **`pa_factor` NotYetImplementedError** (audit E3).
- **TS strict-mode test errors** (audit E8) — pre-existing list; Session 31 added zero.
- **Surrender flow** (Session 34 / ADR-0041).
- **MVP-unit smarter algorithm** (Session 24 Wave 1).
- **Permadeath timer** (Session 24 Wave 1).
- **Settings expansion** (Session 24 Wave 1).
- **Reactions in projection column** (Session 24 Wave 1).
- **Bug 1** (Session 24.5 ADR-0046): no recurrence Sessions 25–31.
- **Vite HMR cache invalidation** occasional issue.
- **Hardcoded team color palette across three sites** (Session 25 carry).
- **Active-ring + counterpart-ring rounded-square fitment** (Session 26.5 carry).
- **Tile-info effect-icon area still empty in v1** (Session 26.5 carry).
- **Item #5 pacing constants** (Session 26.5 carry; tuneable per playtest).
- **Bedrock Stride fall-immunity untested until River Ridge** (Session 33).
- **Brief's path references for status-effects + action-resolution + equipment doc.** Session 31's brief pointed at `docs/twentyOnePlanning/mage-war-equipment.md`, `docs/twentyOneDesign/status-effects.md`, and `docs/twentyOneDesign/action-resolution.md`. Actual locations: equipment doc is in `docs/twentyOneDesign/`, status-effects and action-resolution are in `docs/design/`. Fix in the Session 32 brief.

### Option B carry — authored description pass

The detail-hover MVP (Option A above) auto-generates mechanical summaries from existing fields and ships a small `PASSIVE_DESCRIPTIONS` lookup table in `detail-text.ts` for the demo passives. Option B is the **authored-description pass**: add an optional `description?: string` field to `AbilityCommon` and `EquipmentBase`, and author 1–3 sentences of designer prose per ability/item.

- Scope: ~46 abilities + ~35 items = ~80 authored strings.
- Authoring lives on the content side (each item's `.ts` file), making it diff-reviewable and version-controlled alongside the mechanical authoring.
- The formatter picks up `description` when present and prepends it to the auto-mechanical summary; falls back to the current `PASSIVE_DESCRIPTIONS` lookup or generic placeholder otherwise.
- Best scheduled as a focused content session (likely 2–4 hours of authoring + iteration). A natural pairing with future pre-battle UI text (Phase E — title screen, battle setup), since both involve authorial voice decisions.

This is now a **flagged carry-forward** — surface for Chris when polish / content-pass scheduling comes up.

### Suggested scope for Session 31.5 vs. Session 32

Per the Session 31 brief: equipment-complete milestone triggers Chris's broad playtest. Observations inform whether **Session 31.5 (polish session)** is needed before **Session 32 (Phase D — map mechanics / River Ridge)**.

Polish accumulation queue (potential Session 31.5):
- Hardcoded team color palette across three sites (Session 25)
- Active-ring + counterpart-ring rounded-square fitment (Session 26.5)
- Tile-info effect-icon area (Session 26.5)
- Item #5 pacing constants tuning (Session 26.5)
- Status-badge polarity convention (Session 22)
- Animation drain rAF (Session 23)
- MP/status snapshot tween fix (Session 22)
- Rider bypass refactor (this session — `isRiderCast` helper consolidation)
- `envelopeFor` exhaustive switch (this session — defensive)
- Forecast accuracy row visibility (Session 30 — if playtest reveals confusion)

If post-playtest observations warrant the polish session, items #2 / #3 / #5 (renderer fitment + tile info + pacing) likely lead. The rider refactor and `envelopeFor` defensive are quick wins to bundle with cosmetic polish.

If polish isn't urgent, Session 32 (Phase D — Cluster 6: map mechanics + deployment-phase logged actions) proceeds per `docs/twentyOnePlanning/roadmap-sessions-21-plus.md`.
