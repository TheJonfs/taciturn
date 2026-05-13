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

## From session 2026-05-13 (Session 31.5 — post-playtest bug fixes + accumulated polish)

Session 31.5 ran the post-equipment-complete polish lap: five playtest bug fixes, one helper refactor (the `envelopeFor` exhaustive switch was already done in S31 so only `isRiderCast` remained), one tuning bump, all seven polish queue carry-forwards, and one new ADR for the engine-level changes. Tests: **852 passing across 71 files, 0 failing** (up from 846 across 70 in Session 31). +6 new regression tests in `session-31-5-integration.test.ts`.

### Scope completed

**Bug fixes (5):**

1. **Bug 4 — Bolt Hammer proc fires on missed swings.** Pipeline stage-ordering bug: `fire_on_damage_dealt` ran at the `attacker` stage which executes **before** `evasion_check`. `ctx.hit` was always its initialized `true` when the proc gate evaluated, so every physical swing emitted the proc regardless of accuracy. Fix per ADR-0069: moved `fire_on_damage_dealt` from `attacker` to the `target` stage, positioned between `evasion_check` and `resistance_check`. `attacker` stage now empty in v1 (reserved). Mirror change to `DEFAULT_TEST_DAMAGE_PIPELINE`. Stale comment in `src/content/abilities/ignition.ts` corrected.

2. **Bug 3 — Rasp Pendant drain zeroed on fatal hits.** The contributor (`finalDamageDrainContributor`) correctly emits `system_mp_drain` at pre-damage HP > 0. By the time the reducer runs, the target's HP is ≤ 0 (the same hit's damage already applied). The reducer's `vitals.hp <= 0` short-circuit then zeroed both `targetApplied` and `sourceApplied`, the action-log formatter suppressed the zero-applied entry, and the Lightning Mage saw no drain on a finishing-blow cast. Fix per ADR-0069: dropped the reducer's HP gate. The contributor's pre-fire HP gate (against pre-damage state) still filters "target was already dead before the swing"; the reducer now transfers what each unit holds when the action arrives. Source-side HP gate also dropped for symmetry. Existing session-30 test "KO'd target is a no-op" rewritten to assert the new semantics.

3. **Bug 2+5 — resistance display.** Unit detail panel's Resistances section was reading `unit.resistances.entries()` directly, bypassing `runModifyResistance`. Damage resolution itself works correctly (session-27 / 29 / 31 integration tests prove it); only the panel display was broken. Fix: walk a fixed elemental-tag list (`fire / ice / lightning / earth / holy / dark / poison`), thread each through `runModifyResistance` with `baseValue = native ?? 0`, include the tag iff native exists OR a contributor returned non-zero — matching `composeResistance`'s inclusion rule. One read site rewritten; no substrate change.

4. **Bug 6 — Don't Move / Don't Act soft-lock.** Two-layer fix.
   - **UX layer:** action-menu reads `unit.statuses` for `dont_move` / `dont_act` typeIds; disables the corresponding button so the player can't initiate the blocked action.
   - **Root cause:** `DemoOrchestrator.step()` was throwing on *any* `commitAction` failure — including legitimate runtime refusals like `hook_blocked`. The throw propagated through the Pixi ticker pump and crashed the React tree. Per Chris's question after the menu-gating fix landed, addressed in the same session: `OrchestratorStep` gains an optional `rejection: { action, stage, reason }` field; controller-submitted commit failures populate the field instead of throwing. Scheduler-emitted system commits (`turn_start` after `advanceToNextEvent`) still throw — those are engine-internal and a rejection there indicates a programmer error. The UI flow's `animationEnded` rAF poll handles menu-return automatically (renderer stays idle, `isIdle()` returns true on the next tick). `BattleView`'s pump logs the rejection reason to console for dev visibility; player-facing toast is future polish. Net: future hook-blocking content (Berserk, Silence-on-cast, future Confusion variants) can't re-introduce the same crash through other click sequences.

5. **Bug 1 — Auto-Regen display.** `regen_auto.name` renamed from "Auto-Regen" to "Regen" so the player sees the same display name regardless of whether the Regen status came from a cast (Earth Mage's Buff) or from equipment (Tintinibar's Auto-Regen). The status types are still distinct (`regen` vs `regen_auto`); only the display name is shared.

**Bonus fix:** the unit detail panel now shows `MP / maxMP` (was just `MP`). Lightning Mage now reads "MP 110 / 120" rather than estimating from baseline + equipment.

**Bonus fix — knockback animator wiring (per ADR-0070, bug A).** Maelstrom's knockback rider correctly moved the target's `unit.position` in engine state (clicking the new tile opened the right unit's detail panel — engine-side state was right), but the sprite stayed on the original tile. Root cause: the reducer's knockback path called `applyKnockback` + `withUnit` for the position update but emitted no animator-visible signal; `snap.position` only updates from `move` action tweens. Fix: `AbilityTargetResult` gains an optional `displacedTo: Position` field that the reducer populates from `knockResult.finalPosition`; the renderer's `FlashTargetSpec` gains `positionAfter`; the animator's flash finalize settles `snap.position` in sync with the damage flash (same finalize point that writes HP/MP/KO). Sprite jumps to the new tile when the flash ends. A future multi-step move-style tween over `knockResult.path` remains available (path already logged) for cosmetic polish.

**Bonus fix — absorption tag-flip can't revive a KO'd target (per ADR-0070, bug B).** Per Chris's playtest: Earth Mage had been KO'd earlier (action log showed "KO'd"), then a Lightning Mage hit them with a Lightning attack. The cap stage's absorption tag-flip (ADR-0057) — Earth Mage's +150 Lightning resistance produces healing — ran through `applyDamageToTarget`'s healing branch (`hp + finalDamage`), raising 0 → positive HP. The scheduler then picked the un-KO'd Earth Mage for a normal turn. Root cause: `applyDamageToTarget` had no gate against raising a KO'd target's HP. Fix: a one-line gate `if (isHealing && currentTarget.vitals.hp <= 0) return state;` between the existing `isHealing` check and the `nextHp` computation. Parallel to `system_apply_status`'s existing KO'd-target gate. Covers both the absorption-revives case and the FFT-precedent "ambient Cure doesn't revive — Raise is the explicit reviver." No v1 explicit revive ability exists, so the gate doesn't break anything; it establishes the rule.

**Bonus extension — status-effect hover tooltips.** The existing `DetailHover` tooltip surface (Session 31's Option-A auto-formatter for abilities + items) now covers status effects too:
- `formatStatusDetail(type, instance?)` in [src/ui/detail-text.ts](src/ui/detail-text.ts) — pure formatter; pulls from the status type's catalog fields plus the optional per-instance state (`magnitude`, `stacks`, `remainingDuration`, `customState`). Reads parametric instances' `customState.displayName` as the tooltip title (so "Wand of the Depths Resonance" renders distinctly from "Wand of the Deepwood Resonance" even though both share `tagged_resistance_shift`). Renders authored description (from a new `STATUS_DESCRIPTIONS` lookup covering the v1 demo statuses), duration line (mode-aware), magnitude, stacks, customState tagDeltas (for tagged_resistance_shift), resistance tag, stacking rule, tags. Hooks-list fallback for any future status not in the description map.
- Subtitle reads "Status · Buff" / "Status · Debuff" — undeclared polarity defaults to Debuff per the catalog's documented AI default.
- **Two wire-in sites** wrap the status badge with `DetailHover` and a `cursor: help` affordance:
  - Unit detail panel's Active Statuses section — every status pill is hoverable.
  - Tile-info panel's effect-icon chips — every chip on a hovered unit-occupied tile is hoverable.
- **4 new tests** in `detail-text.test.ts` covering: Burn auto-description + Debuff polarity subtitle; tagged_resistance_shift uses customState.displayName as title and renders tagDeltas; Shell with magnitude + permanent duration mode; fallback hook-list line for an unknown status.
- **Verified** in browser preview: DOM structure confirms DetailHover wrappers in place around status pills; `cursor: help` affordance present; existing surfaces (MP/maxMP, polarity-colored badges, resistance display) render correctly alongside.

**Refactor:** `isRiderCast(payload): boolean` extracted to a new `src/engine/actions/payload-helpers.ts`. Four call sites consolidated: `validate.ts` (Act check + MP check), `reducers.ts:reduceUseAbility` (one `isRider` local covering MP / Act / actionSpeed bypasses), `commit.ts:runPreHook`. The `envelopeFor` exhaustive switch refactor from the brief was already done in Session 31; no further work.

**Tuning:** Wizard's Robe and Staff of Power both bumped from +3 MA → +4 MA. Drawback magnitudes unchanged (Robe: -25 to all four elements; Staff: × 1.20 MP cost). Per Chris's playtest read: +3 felt "useful but unremarkable" against the drawback magnitude; +4 brings the upside closer in line. Mage base MA 12-14 stacked with both items now reaches 20-22 (was 18-20).

**Polish queue (7 / 7, one partial):**

1. **Status-badge polarity convention** — new `src/ui/status-polarity.ts` helper exports `badgeStyleFor(type)` returning subdued positive (green) / negative (red) tints. Unit detail panel's "Active Statuses" section + tile-info-panel's effect-icon area both consume the convention. Polarity reads off `aiHints.polarity` (defaults to debuff per the catalog's AI default).

2. **Tile-info effect-icon area** — populated. When the cursor hovers a tile occupied by a unit, the panel renders that unit's active statuses as polarity-tinted name chips. Empty for tiles without a unit. Threads `catalog` from `BattleHud` into `TileInfoPanel`.

3. **Hardcoded team color palette** — centralized. `src/renderer/constants.ts` now exports `TEAM_PALETTE` (per-team `{ pixi, css }` entries) + `TEAM_PALETTE_FALLBACK_PIXI / _CSS`. Renderer + `queue-tower.tsx` + `forecast-panel.tsx` all import via `@renderer/index.ts`. Inline duplicates removed.

4. **Active-ring + counterpart-ring rounded-square fitment** — both rings now draw as `roundRect` (matching `PORTRAIT_FRAME_CORNER` curvature) instead of `circle`. The portrait body is a rounded-square; the rings now fit cleanly around it.

5. **HP / MP / status snapshot ahead-of-tween fix** — partial. `UnitVisualSnapshot.mp` added; the animator's flash finalize settles MP in sync with the damage tween (use_ability's mpSpent on the actor, system_mp_drain on source + target). HP was already snapshot-tracked. **Statuses still read live** from engine state — fixing that would require the animator to track per-unit status arrays through every action that mutates them (`system_apply_status` / `status_tick` / `status_remove` / `status_decrement_stack`); larger scope, deferred. The visual mismatch for statuses is less pronounced than for resource bars.

6. **Renderer's HP "max" lifted to per-frame read** — was captured at mount as `unit.baseStats.maxHpBase`. Now reads through `runModifyStatQuery` per frame, mirroring the ADR-0058 maxMp pattern. A Mage with Wizard's Robe (+40 maxHp) now reads correctly on the HP-bar denominator.

7. **rAF replaces setInterval for animation drain** — `use-turn-flow.ts`'s animation-drain `setInterval(16ms)` polling replaced with `requestAnimationFrame`. Paint-syncs naturally; pauses with the Pixi ticker when the tab is hidden (the prior tab-suspension concern is no longer relevant because Pixi's ticker is itself rAF-based).

### Architecture records

- **ADR-0069** — `fire_on_damage_dealt` stage re-ordering + reducer-side KO short-circuit dropped on `system_mp_drain` + orchestrator hook-blocked recovery. Documents the shared root cause ("read the wrong invariant at the wrong stage") plus the coupled UI display fixes (resistance read, maxHp lift, MP snapshot tween).
- **ADR-0070** — Knockback animator wiring via `AbilityTargetResult.displacedTo` + absorption tag-flip's healing branch gated on `vitals.hp > 0` (KO'd targets stay inert). Two playtest finds with surgical fixes; preserves ADR-0057's tag-flip semantics, adds the apply-time gate.

### Test reconciliation

- 6 new tests in `src/engine/actions/session-31-5-integration.test.ts`:
  - Bug 4: proc does NOT fire on a missed swing (full production pipeline, accuracy 0).
  - Bug 4: proc DOES fire on a landed swing (accuracy 100).
  - Bug 3: Rasp Pendant emits `system_mp_drain` on a magical cast through the full pipeline; amount = floor(10% × finalDamage).
  - Bug 3: mid-chain fatal-hit drain transfers MP normally (target HP 0 + reducer no longer short-circuits).
  - Bug 1: `regen_auto.name === 'Regen'`.
  - Refactor: `isRiderCast` predicate smoke test.

- 1 new test in `src/app/demo/orchestrator.test.ts`:
  - Bug 6 root: orchestrator returns rejection (no throw) when `commitAction` is `hook_blocked`. Verifies state unchanged + rejection populated.

- One existing test rewritten: `session-30-integration.test.ts > Session 30 reduceSystemMpDrain > KO'd target is a no-op` → `KO'd target still drains MP (mid-chain fatal-hit case per ADR-0069)`. Same fixture; flipped assertions reflect the new semantics.

- One existing assertion updated: `src/content/rulesets/default.test.ts > damage pipeline ships the v1 stage handlers` updated for the new `attacker: []` + reordered `target` stage list.

- 4 new tests in `src/ui/detail-text.test.ts` for `formatStatusDetail` (Burn description + Debuff subtitle; tagged_resistance_shift displayName + tagDeltas; Shell magnitude + duration; unknown-status hook-list fallback).

- 2 new tests in `src/engine/actions/session-31-5-integration.test.ts` for the ADR-0070 fixes:
  - `AbilityTargetResult` carries `displacedTo` after a knockback rider fires through `reduceUseAbility` (engine end-to-end).
  - A Lightning hit on a KO'd high-resistance target does NOT raise HP (absorption-flipped damage gated at apply).

- Final test count: **859 passing across 71 files, 0 failing.**

- Browser preview verified: demo battle launches cleanly with the orchestrator change; pump runs through CT spool-up without throws; no console errors.

### Limitations + watch-fors

- **Polish #5 partial — statuses still read live from engine state.** Adding `statuses` to the animator snapshot requires tracking per-unit status arrays through every status-mutating action type. Manageable but invasive (5 action types). Visual cost of leaving it: statuses appear/disappear slightly ahead of damage flash; not jarring. Carry-forward for a future polish session.

- **Polish #5: animator now infers actor MP delta from `outcome.mpSpent`.** Free abilities and rider casts have `mpSpent: 0` and don't contribute to the flash's mpAfter spec. Working as intended. If a future action type causes a non-`mpSpent` MP change on a wielder (e.g., a passive that consumes MP per swing), the snapshot's MP wouldn't settle correctly and we'd see live engine state again. Watch in playtest.

- **`maxHp` field on `UnitVisualSnapshot` is retained but unread.** The animator's flash finalize still writes to it (legacy), but `applyVisualState` reads through `runModifyStatQuery` instead. Future cleanup: remove the field if no consumer surfaces. Low priority.

- **Renderer's `UnitVisualSnapshot.maxHp` capture-at-mount still uses `unit.baseStats.maxHpBase`.** Same comment as above. Doesn't matter for display (the live read overrides) but the value is technically stale at mount-time.

- **The "attacker" damage pipeline stage is empty in v1.** Reserved for future content that wants to fire pre-evasion. If a content session adds a new attacker-stage handler, it should be aware that hit/miss isn't resolved yet at that stage; gate accordingly.

- **`tile-info-panel.tsx` reads `unitAt` on every render.** The function does a linear scan over `state.units.values()`. With ~6-8 units in v1 this is fine; for larger battles the panel may want a position-indexed cache. Not yet a perf concern.

- **Polarity convention currently only colors name pills.** Could extend to a leading dot/icon for compact rows; deferred until status-list density becomes a problem.

- **Team palette centralization landed but the renderer's `MP_BAR_FG` still uses the team-a blue (`0x4a90e2`) as a coincidence.** Not a bug — MP bars are blue regardless of team — but a future "team-tinted MP bar" feature would want to read from `TEAM_PALETTE` rather than the standalone constant.

- **Status-badge convention overlaps with the existing `aiHints.polarity` field.** No conflict in v1 (every authored polarity is `'buff'` or `'debuff'`; undeclared defaults to debuff in `badgeStyleFor`). If future statuses author a new polarity value, the helper widens.

- **Bug 3 fix changes mid-chain semantics for system_mp_drain.** Future content that wants "drain skips when target was already KO'd before the swing" can rely on the contributor's pre-fire HP gate (still in place); the reducer no longer enforces that. If a future scenario needs a stricter reducer check, it can be added via a payload flag rather than re-introducing the blanket gate.

- **The `staticVariance` substrate on War Axe was kept at session 31's `{ 0.9, 1.3 }` band.** No tuning change in 31.5; just noting that the polish queue's "calibration reads" carry-forward is still active.

### Considered and rejected this session

- **Stop at menu-gating for the Don't Move soft-lock.** Rejected per Chris's question after the menu fix landed. Menu gating prevents the specific Don't Move / Don't Act click path but doesn't address the underlying crash mechanism (orchestrator throwing on `hook_blocked`); future hook-blocking content would re-introduce it via other paths. Replaced with the orchestrator-side rejection fix.

- **Thread rejection through `useTurnFlow` as a new event with player-facing toast/status-line feedback.** Considered — useful for "Can't move while afflicted with Don't Move" messaging. Deferred: the existing `animationEnded` recovery handles menu-return on its own; surfacing the reason is its own future polish.

- **Make `validation` rejections still throw (only catch `hook_blocked` / `battle_decided`).** Considered — validation failures arguably indicate a UI/engine drift bug that should surface loudly. Rejected: race conditions can legitimately produce a validation failure on a player-submitted action mid-animation; better to recover gracefully and log than crash.

- **Patch the proc contributor to consult a "resolved-hit" flag.** Rejected per ADR-0069 — would push the timing concern onto every future `onDamageDealt` handler author. Moving the stage is one edit; the gate semantics stay simple.

- **Add a new pipeline stage between `attacker` and `target` for emission-only attacker handlers.** Rejected — single-handler stages are architectural overkill. The target stage already runs post-evasion.

- **Narrow the reducer's KO gate to source-only (keep `source.hp <= 0` check).** Rejected per ADR-0069 — needless asymmetry. MP transfer doesn't depend on HP > 0; the missing-unit check is the load-bearing safety net.

- **Mark the drain action with a "was-fatal" flag at emission time.** Rejected — emission-time would have to predict whether the attack will be fatal; coupling between contributor and damage application that we don't want.

- **Track statuses on `UnitVisualSnapshot` for fully consistent ahead-of-tween fix.** Deferred (not rejected) — invasive change touching 5 action types. Re-evaluate when status-display timing becomes a visible problem.

- **Move `tagged_resistance_shift` polarity from `'debuff'` to per-instance read.** Deferred — v1 ships enemy-only wand swings, so the offensive-setup polarity is correct. Re-evaluate when ally-targetable wand swings ship.

- **Add `ma: 4` to Magus Crown as a comparable cost tightener.** Out of scope. The brief's tuning section called out Wizard's Robe + Staff of Power specifically.

### Empirical-questions checklist for Chris's next playtest

**Blue Knight (Bolt Hammer + Managuard + Silvered Vest + Focus Band + Tintinibar):**
- [ ] Swing the Bolt Hammer at a target. Confirm that **misses no longer trigger Lightning Strike procs** — over many swings, the proc rate should be ~25% × 75% (Bolt Hammer accuracy) ≈ ~19% per attempted swing. Pre-31.5 the rate was effectively ~25% per attempted swing regardless of miss.
- [ ] Auto-Regen badge displays as "Regen ∞" (not "Auto-Regen ∞"). Tintinibar's grant still applies battle-long.

**Blue Lightning Mage (Flametongue + Wizard's Robe + Pointy Hat + Rasp Pendant):**
- [ ] Cast Lightning Strike or Water Strike at a target with positive MP and watch the Lightning Mage's MP go up by 10% of the dealt damage. **Confirm fatal hits now drain too** — pre-31.5 a KO-ing cast silently zeroed the drain; this session's bug 3 fix should land the drain regardless of survival.
- [ ] Stat panel reads MA 18 (14 base + 4 Wizard's Robe + 0 Pointy Hat = wait, Pointy Hat +1 MA, so 19. Re-checking: Robe is now +4; if Pointy Hat is +1, MA = 14 + 4 + 1 = 19. Verify the new tuning composes correctly through `runModifyStatQuery`.

**Red Earth Mage (Wand of the Deepwood + Wizard's Robe + Pointy Hat + Capacitor Ring):**
- [ ] Open the unit detail panel. **Lightning resistance should display as +150** (50 native + 100 Capacitor Ring). Pre-31.5 it showed the +50 native only. Fire/Water/Earth/Lightning all show -25 from Wizard's Robe; the Lightning row composes additively to +125 (-25 + 50 + 100). Verify the panel reflects this.
- [ ] Cast Lightning damage at the Earth Mage from another unit. **HP should go UP** (absorption per ADR-0057). Confirms the resistance pipeline display matches the resolution behavior.
- [ ] Swing Wand of the Deepwood at a target. The `tagged_resistance_shift` status applies on hit. Open the target's detail panel and watch the resistance row composition (Fire / Lightning shifts).

**Status display + UI checks:**
- [ ] Unit detail panel's Active Statuses now shows colored name pills — positive statuses (Regen, Shell) read green; negative statuses (Burn, Don't Move, tagged_resistance_shift) read red.
- [ ] Tile-info panel's icon area (top-right) shows the same colored chips when the cursor hovers a unit-occupied tile.
- [ ] Active-ring + counterpart-ring around units now render as rounded squares matching the portrait frame.
- [ ] MP and HP changes tween in sync with the damage flash (pre-31.5 MP dropped instantly while HP tweened).

**Bug 6 / status gating:**
- [ ] Apply Don't Move to the active unit (some future test scenario, or a future Stun-class status). The Move button should grey out; clicking it should do nothing.
- [ ] Same for Don't Act.

**Substrate validation:**
- [ ] Demo battle launches cleanly; tests at 852 / 71 files all passing.

### Longer-term carry-forward

- **Polish #5 statuses portion** — extend `UnitVisualSnapshot` with `statuses` array, settle at flash finalize for `system_apply_status`, `status_remove`, `status_decrement_stack`, `status_tick`. Surface as a future polish session.
- **`UnitVisualSnapshot.maxHp` field cleanup** — unused at the read site post-31.5; field stays for the animator's flash-finalize write. Could be removed alongside the snapshot's `hpAfter` / `maxHpAfter` if the animator drops mount-time HP-max capture too.
- **Wand swing ally-targetability** — Session 31 deferral; reassess `tagged_resistance_shift` polarity when ally targeting lands.
- **AI active absorption exploitation** — Session 27 carry; tactics-layer pass.
- **AI projection forecast extension via `computeOutgoingHitChance`** — Session 30 carry.
- **Procced spell uses caster's MA** — Session 30 / 31 carry; ongoing playtest read.
- **Magus Crown +5 MA / +25% MP cost tighteners** — equipment-doc-suggested adjustments if variety advantage exceeds the -3 MA cost. No change in 31.5; the +4 MA tuning on Wizard's Robe + Staff of Power may shift the discrimination.
- **Burn × Purifier playtest** — no Purifier in v1 demo; one-off battle setup needed.
- **Tintinibar Regen tuning playtest** — initial read reasonable, ongoing.
- **Sorcerer's Robe Move +1 playtest read** — initial read reasonable, ongoing.
- **Status-badge polarity convention extension** — chip pre-icons (color dots / glyphs) if status lists grow.
- **Team color palette → engine `Team` shape** — long-term: team definitions could carry a palette ref. Out of scope for v1.
- **Tooltip Option B authored-description pass** — Session 31 deferral; post-current-roadmap.
- **`onTurnStart` symmetric widening** — Session 26 carry; defer until emitter surfaces.
- **Multiplicative tick-amount stacking** — Session 28 carry; no v1 stacking case.
- **`onFinalDamage` fires on absorbed hits but handlers gate on `absorbed: true`** — design pattern, not a problem.
- **Forecast facing uses actual attacker→target geometry** — Session 30 carry.
- **Unit detail panel's per-facing evasion uses `unit` as attacker stand-in** — Session 30 carry.
- **`onFinalDamage` emission-side semantics on absorption** — see ADR-0065 / 0069 absorbed-gate discussion.
- **Item #5 pacing constants** — Session 26.5 carry.
- **Constant-map labels don't carry icons today** — Session 28 polish.
- **`pa_factor` NotYetImplementedError** — audit E3.
- **TS strict-mode test errors** — audit E8; Session 31.5 added zero.
- **Surrender flow** — Session 34 / ADR-0041.
- **MVP-unit smarter algorithm** — Session 24 Wave 1.
- **Permadeath timer** — Session 24 Wave 1.
- **Settings expansion** — Session 24 Wave 1.
- **Reactions in projection column** — Session 24 Wave 1.
- **Bedrock Stride fall-immunity** — untested until River Ridge (S33).
- **Forecast accuracy row visibility** — Session 30 reject; revisit if confusion surfaces.
- **`DEFAULT_TEST_DAMAGE_PIPELINE` should be auto-checked against `DEFAULT_DAMAGE_PIPELINE`.** Pre-31.5 the test fixture and production ruleset diverged silently (test fixture missing `postFinalize`). A test that asserts the two are structurally equivalent (or that the test fixture forwards from the production constant) would catch the next divergence. Defensive add candidate.

### Suggested scope for Session 32

Per the Session 31.5 brief: equipment-complete milestone holds; Phase D kickoff (Cluster 6 / map mechanics / River Ridge) is the natural next session. No regressions surfaced from the polish lap that block progression. Session 32 proceeds per `docs/twentyOnePlanning/roadmap-sessions-21-plus.md`.
