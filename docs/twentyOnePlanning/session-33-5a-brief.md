# Session 33.5A Brief: Post-State Absolutes — Generalize ADR-0074 to MP + System Damage/Heal + Snapshot Cleanup

## Context

Session 33.5 closed the post-playtest bug cluster (#2-#5) via ADR-0074: `hpAfter` (engine-reported absolute post-state) on `AbilityTargetResult`, animator settles from it instead of doing `snap.hp - damage + healing` delta arithmetic. One fix, three bugs (#2 Cure on KO'd target, #3 ghost-at-1-HP, #4 visual-snapshot didn't reflect KO). A mid-session phantom `[ko]` catch in `deriveKoEvents` was the same pattern at a different site (KO walker delta-arithmetic from a wrongly-initialized running HP).

Post-session architectural review surfaced the meta-pattern: **UI consumers reconstruct absolute post-state values by arithmetic on prior values + magnitude deltas; the drift compounds.** `hpAfter` closed this for HP on ability per-target results. The same gap remains in three places — animator MP settling (latent bug), KO walker for `system_damage`/`system_heal` (partway done), and `UnitVisualSnapshot.maxHp` dead-field cleanup.

Session 33.5A is the focused generalization pass. ADR-0074 extended (as an amendment) to cover the broader principle: **UI/renderer derives from engine-reported absolutes, never UI arithmetic on magnitudes.** Tests proportional. Out: Phase E content, deeper HMR/Pixi-init crash investigation, calibration tuning.

End of session: post-state absolute discipline uniform across HP/MP/KO settling and KO-event derivation. Phase E (Session 34) opens with no carried renderer-arithmetic latent bugs.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 33.5 handoff. The "Suggested follow-up — engine post-state absolutes" section *is* this brief's scope; read for the dividing-line analysis (what UI arithmetic stays correct vs. what becomes post-state absolutes).
3. **`docs/decisions/0074-...`** — `hpAfter` + centralized victory check + KO-state invariants. This session amends ADR-0074 rather than introducing a new ADR.
4. **`docs/decisions/0058-...`** — maxMp / maxHp lift to live `runModifyStatQuery` reads (S28 / S31.5). Sibling pattern to the snapshot-maxHp cleanup.
5. **`src/renderer/animator.ts`** — `buildFlashFromTargets` (HP path already fixed; MP path still delta-arithmetic at the actor MP and `system_mp_drain` finalize sites).
6. **`src/ui/derived-events.ts`** — `deriveKoEvents` partly anchored to `hpAfter`; residual delta-reconstruction for `system_damage`/`system_heal` outcomes.
7. **`src/engine/types/action.ts`** — outcome shapes that need the new `mpAfter` / `hpAfter` fields.
8. **`src/engine/actions/reducers.ts`** — `reduceUseAbility` / `resolveAbilityEffect` (caster MP), `reduceSystemMpDrain`, `reduceSystemDamage`, `reduceSystemHeal` — the population sites for the new fields.

### Paths to survey before planning

Current-tree audit. Particularly:

- **MP settling paths.** Confirm the two MP-arithmetic sites the handoff names: `Animator.buildFlashFromTargets`' actor-MP path (uses `mpDelta = -(outcome.mpSpent ?? 0)`) and `animator.ts` ~line 346 `system_mp_drain` finalize (settles both source and target MP via delta). Confirm no third MP-arithmetic site lurks.
- **KO walker reconstruction sites.** `derived-events.ts`'s `damageDealtByAction` — currently anchors to `hpAfter` when present (ability per-target results), still delta-reconstructs for `system_damage`/`system_heal` per-target rows. Confirm shape; identify the surfacing site for the new outcome field.
- **`derivePerUnitStats` damageTaken tally.** Sums computed `r.damage`, overstates on overkill (133-damage hit on 4-HP unit tallies 133). This is a definitional call (dealt-at vs. absorbed-by) more than a bug; audit confirms current behavior and Chris's intent (see decision 3 below).
- **Snapshot maxHp/maxMp consumers.** Confirm `UnitVisualSnapshot.maxHp` is genuinely unread (per S31.5 polish #6's live-read path). Confirm `unit-layer.ts` mount-time `setVisualState`'s `maxMp: unit.vitals.mp` placeholder is similarly unread post-frame-1.
- **Error-boundary opportunity.** `BattleViewInner` doesn't have one today; the HMR crash from S33.5 (carry-forward) would benefit, and the boundary is small and orthogonal to root-cause investigation. See decision 4 below.

### Architectural decisions

After the audit:

1. **ADR placement — amendment vs new ADR.** Per the handoff's recommendation: amend ADR-0074 to generalize the principle ("UI/renderer derives from engine-reported absolutes"). The three items in this session are concrete extensions of the same decision; a new ADR is only warranted if the engine-outcome-shape change needs its own rationale. **Recommendation: amend ADR-0074.** A new ADR adds carrying cost without new design content.

2. **New outcome field naming.** Match `hpAfter`'s precedent. New fields:
   - `UseAbilityOutcome.mpAfter` (caster MP after the cast)
   - `ChargedActionResolveOutcome.mpAfter` (caster MP after the charged resolve)
   - `SystemMpDrainOutcome.sourceMpAfter` / `targetMpAfter` (both ends; drain transfers both)
   - `SystemDamageOutcome.hpAfter` (target HP after the damage applies)
   - `SystemHealOutcome.hpAfter` (target HP after the heal applies — gated outcomes still populate the unchanged value, like `hpAfter` does today for blocked heal on KO'd target)
   
   **Recommendation: as listed.** Direct parallels; no novel naming decisions.

3. **`damageTaken` tally on overkill — design call.** Two reasonable shapes:
   - **A — Sum computed magnitudes (current).** "Damage taken" reports what was thrown at the unit. A 133-damage hit on a 4-HP unit tallies 133.
   - **B — Sum actual HP loss.** "Damage taken" reports what the unit absorbed. The same hit tallies 4.
   
   The metric is a stat-report consumer (likely "battle summary" surface; not load-bearing on game state). FFT/genre-precedent split: most TRPGs report dealt-at (matches "this attack hit for 133"); some report absorbed-by (matches "the unit lost 4 HP"). **Recommendation: B (absorbed-by).** Aligns with the post-state-absolutes principle — the stat should reflect engine truth, not pre-application magnitude. But this is a design call; if Chris reads dealt-at as the natural interpretation, A is defensible. **Settle at plan-review.**

4. **Error boundary around `BattleViewInner` (optional fold-in).** Per S33.5 handoff: the content-HMR black-screen crash is a real dev-loop bug; root-cause fix is non-trivial; an error boundary is cheap and orthogonal. Two paths:
   - **A — Fold in this session.** Defensive UI add. ~30 lines. Reduces dev-loop friction for any future render-throw class.
   - **B — Defer to Session 34.** Pair with the app-shell/router work that Session 34 begins.
   
   **Recommendation: A.** The fold-in is small, the benefit is immediate, and Session 34 will already be UI-busy. **Settle at plan-review.**

5. **Test strategy.**
   - **B1 (MP settling):** unit tests that `Animator.buildFlashFromTargets` reads `mpAfter` for caster (use-ability + charged-resolve paths); unit tests for `system_mp_drain` finalize reading `sourceMpAfter` / `targetMpAfter`. Reducer-level tests that the new outcome fields are populated from committed `workingState`.
   - **B2 (KO walker):** test that a Burn-tick KO (`system_damage` outcome path) emits a `[ko]` event anchored to `hpAfter`; test that overkill `system_damage` reports `hpAfter: 0` (engine-clamped); update `deriveKoEvents` test to assert no reconstruction-only branch remains.
   - **B3 (snapshot cleanup):** no behavior tests — type-check passes, dead-field removal compiles, no consumer breakage. Existing snapshot test suite covers the live-read paths.
   - **Error boundary (if folded in):** integration test that a synthetic throw in `BattleViewInner` is caught and rendered as a fallback rather than black-screening.

6. **Order of work.** B1 → B2 → B3, per the handoff's sequencing. B1 first because it's a live latent bug; B2 second because it shares the outcome-shape change pattern with B1 (engine-side changes batch); B3 last as pure cleanup. Optional error boundary anywhere (orthogonal).

7. **33.5A/33.5B split allowance.** Surface area is small; split very unlikely. If audit reveals additional delta-arithmetic sites beyond the three named (e.g., a third snapshot consumer doing arithmetic against magnitudes), the session may grow modestly but stays one session.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land in B1 → B2 → B3 order. Error boundary (if folded) lands at any point; it's orthogonal.

### Item B1: Animator MP settling — engine-reported absolutes

- Add `mpAfter` to `UseAbilityOutcome` and `ChargedActionResolveOutcome` (caster MP after the cast)
- Add `sourceMpAfter` and `targetMpAfter` to `SystemMpDrainOutcome` (drain transfers; both ends report absolutes)
- Populate from committed `workingState` in `reduceUseAbility` / `resolveAbilityEffect` (or wherever the outcome construction lives) and `reduceSystemMpDrain`
- `Animator.buildFlashFromTargets` reads `mpAfter` for the actor's MP settle; remove the `mpDelta = -(outcome.mpSpent ?? 0)` arithmetic
- `animator.ts` ~line 346 `system_mp_drain` finalize reads `sourceMpAfter` / `targetMpAfter`; remove the delta arithmetic
- Tests: per decision 5 B1

### Item B2: KO walker completion — `system_damage` / `system_heal` outcomes

- Add `hpAfter` to `SystemDamageOutcome` and `SystemHealOutcome` (target HP after application)
- Populate from committed `workingState` in `reduceSystemDamage` / `reduceSystemHeal`
- `derived-events.ts`'s `damageDealtByAction` surfaces `hpAfter` for these outcome types
- KO walker anchors to `hpAfter` for *every* HP-changing action; the running-HP map becomes a pure "last reported HP" cache; KO detection is the positive-to-≤0 crossing on reported values; no reconstruction branches remain
- If decision 3 lands on B (recommended): `derivePerUnitStats`' `damageTaken` tally uses `hpAfter` to compute absorbed-by (`prior - hpAfter`) rather than summing magnitudes
- Tests: per decision 5 B2

### Item B3: `UnitVisualSnapshot.maxHp` field cleanup

- Remove `maxHp` from `UnitVisualSnapshot` interface
- Remove the field from every snapshot constructor (`animator.ts`)
- Fix or drop `unit-layer.ts`'s mount-time `setVisualState`'s `maxMp: unit.vitals.mp` placeholder per audit (it's overwritten frame 1; safe to drop or set to a sentinel)
- `battle-renderer.ts`'s live-read path (S31.5 polish #6) remains the source of truth for max HP/MP
- Tests: existing suite covers; no new tests needed

### Item B4 (optional): Error boundary around `BattleViewInner`

- React error boundary component wrapping `BattleViewInner` in `BattleView.tsx`
- Fallback UI: minimal "Something went wrong" panel + a hard-refresh affordance
- Console log the error for dev visibility
- Tests: integration test that a synthetic throw is caught (per decision 5)

## Acceptance criteria

**Engine outcome shapes:**

- `UseAbilityOutcome` and `ChargedActionResolveOutcome` carry `mpAfter` (caster MP after cast).
- `SystemMpDrainOutcome` carries `sourceMpAfter` and `targetMpAfter`.
- `SystemDamageOutcome` and `SystemHealOutcome` carry `hpAfter` (target HP after application).
- All four are populated from committed `workingState`; gated outcomes (e.g., heal blocked on KO'd target) populate the unchanged value.

**Animator:**

- `buildFlashFromTargets` reads `mpAfter` for caster MP; no delta arithmetic on MP at this site.
- `system_mp_drain` finalize reads `sourceMpAfter` / `targetMpAfter`; no delta arithmetic on MP at this site.

**KO walker:**

- `deriveKoEvents` anchors to `hpAfter` for every HP-changing action type (ability per-target results — already done; `system_damage` / `system_heal` — new).
- No HP-reconstruction branches remain in `damageDealtByAction`.
- (Per decision 3) `derivePerUnitStats.damageTaken` reports absorbed-by (HP delta) rather than dealt-at magnitude, OR retains dealt-at if decision 3 lands on A.

**Snapshot cleanup:**

- `UnitVisualSnapshot.maxHp` removed; no consumer surfaces broken.
- `unit-layer.ts` mount-time placeholder resolved per audit.

**Error boundary (if folded):**

- `BattleViewInner` wrapped; synthetic throw produces fallback panel rather than blank screen.

**Quality:**

- Tests at 975+, 0 failing. New tests proportional to outcome-shape changes and KO walker anchoring.
- ADR-0074 amended with the post-state-absolutes generalization (MP, system damage/heal, snapshot cleanup).
- `docs/handoff.md` updated.

## Out of scope

- **HMR/Pixi-init crash root-cause fix** — needs focused investigation per S33.5 handoff; not a one-liner. Error boundary (B4, if folded) is the defensive add; root-cause stays carry-forward for Session 34 or a focused dev-loop session.
- **Phase E surfaces** — title screen, battle setup, team builder, deployment phase. Sessions 34-37.
- **Pacing constants iteration** — values landed in S33.5; need Chris's playtest read before further tuning.
- **Cliff-edge thickness iteration** — same disposition.
- **River Ridge balance tuning** — needs more playtest data.
- **Burn × Purifier playtest observation** — setup landed in S33.5; needs playtest to observe.
- **AI active absorption exploitation** — S27 carry; tactics-layer pass.
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry.
- **Procced Lightning Strike / Rasp Pendant action-log attribution** — S30 carries.
- **Tooltip Option B authored-description pass** — post-current-roadmap.
- **`map-and-battlefield.md` open questions** — elevation hit-chance/cover, AoE multi-layer, etc.
- **Centralized `canApplyHeal` helper** — explicitly rejected in S33.5; revisit at a third heal-application site (none planned).
- **Suppress pre-battle init entries in release builds** — S33.5 carry.
- **`buildBattle` test-fixture extraction** — triggers at fourth duplication.
- **`mapAllTerrainCosts` vs. `defaultStepCost`** — S33.5 carry; no v1 case (no ruleset sets `defaultStepCost > 1`).
- **Surrender flow / MVP-unit algorithm / permadeath timer / settings expansion / reactions in projection column** — Phase E/F.

## Files likely touched

Non-exhaustive. Audit confirms / corrects.

**Engine outcome shapes:**

- `src/engine/types/action.ts` — `UseAbilityOutcome`, `ChargedActionResolveOutcome`, `SystemMpDrainOutcome`, `SystemDamageOutcome`, `SystemHealOutcome`

**Reducers:**

- `src/engine/actions/reducers.ts` — `reduceUseAbility` / `resolveAbilityEffect` (caster `mpAfter`), `reduceSystemMpDrain` (both `mpAfter` fields), `reduceSystemDamage` / `reduceSystemHeal` (target `hpAfter`)

**Renderer / Animator:**

- `src/renderer/animator.ts` — `buildFlashFromTargets` actor MP settle; `system_mp_drain` finalize; `UnitVisualSnapshot` interface (B3); snapshot constructors

**UI:**

- `src/ui/derived-events.ts` — `damageDealtByAction` / `deriveKoEvents` / `derivePerUnitStats`

**Renderer cleanup (B3):**

- `src/renderer/unit-layer.ts` — mount-time placeholder resolution
- `src/renderer/battle-renderer.ts` — live-read path stays; no change expected

**Error boundary (B4, if folded):**

- `src/app/BattleView.tsx` — error boundary wrapper around `BattleViewInner`

**Tests:**

- `src/engine/actions/session-33-5a-integration.test.ts` (new) — outcome-shape coverage
- `src/renderer/animator.test.ts` — MP settle from `mpAfter`
- `src/ui/derived-events.test.ts` — KO walker anchoring to `hpAfter` for system damage/heal

**ADRs:**

- `docs/decisions/0074-...` — amended with post-state-absolutes generalization

**Documentation:**

- `docs/handoff.md` — session handoff

## Workflow notes

- **Plaintext-first review required.**
- **Pattern parallel.** B1 and B2 are direct parallels to the `hpAfter` change just landed in S33.5; the implementation pattern is established. B3 is pure cleanup. The session is mechanically straightforward; most of the design work happened during the S33.5 post-session review.
- **ADR path is `docs/decisions/`.** This session amends ADR-0074; doesn't add a new one (per decision 1).
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: `damageTaken` dealt-at vs absorbed-by (decision 3); error boundary fold-in vs defer (decision 4); any audit-revealed delta-arithmetic site beyond the three named.
- **Engine-clean session.** No new engine substrate; no new ADRs (amendment only). Outcome-shape changes are additive.
- **Phase D content and equipment-complete milestones hold.**

## Watch-fors

**Addressed this session:**

- Animator MP settling (S33.5 carry — latent bug confirmed)
- KO walker `system_damage`/`system_heal` reconstruction (S33.5 carry — partway completion)
- `UnitVisualSnapshot.maxHp` field cleanup (S31.5 carry — finally tractable post-S31.5 live-read confirmation)
- `damageTaken` overkill behavior (new this session — design call at plan-review)
- (If B4 folded) Error boundary around `BattleViewInner` — defensive UI add

**Not addressed this session, longer-term carry-forward:**

- **HMR/Pixi-init crash root cause** — S33.5 carry; non-trivial; consider Session 34 pairing or focused dev-loop session
- **Phase E surfaces** — Sessions 34-37
- **Pacing constants playtest read** — S33.5 carry; needs Chris's playtest before further iteration
- **Cliff-edge thickness playtest read** — same disposition
- **River Ridge balance tuning** — needs playtest data
- **Burn × Purifier playtest observation** — S33.5 setup ready; needs playtest
- **Walk-on-Water passive** — future content; Float's universal-leveller redesign leaves the niche open
- **Procced Lightning Strike action-log attribution** — S30 carry
- **Rasp Pendant drain attribution** — S30 carry
- **Procced spell uses caster's MA** — S30/S31 carry; ongoing playtest read
- **Magus Crown +5 MA / +25% MP cost tighteners** — calibration carry
- **Tintinibar Regen tuning** — initial read reasonable; ongoing
- **Sorcerer's Robe Move +1** — initial read reasonable; ongoing
- **AI active absorption exploitation** — S27 carry
- **AI projection forecast extension via `computeOutgoingHitChance`** — S30 carry
- **Wand swing ally-targetability** — S31 carry
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
- **`mapAllTerrainCosts` vs `defaultStepCost`** — S33.5 carry; no v1 case
- **Centralized `canApplyHeal` helper** — explicitly rejected; revisit at third heal-site
- **Bedrock Stride ongoing playtest read** — integration-tested S33; real playtest still pending

## Estimated size

**Small.** Three discrete items, each a direct parallel to the `hpAfter` change just landed. B1 and B2 share the engine-side change shape (additive outcome fields, populated from `workingState`); B3 is pure deletion. The optional error boundary (B4) is small if folded.

No split allowance needed. If audit reveals a fourth delta-arithmetic site, the session may grow modestly but stays one session.

**End of session: post-state absolutes uniform across the renderer/UI surface. Phase E (Session 34 = title screen + battle setup) opens with no carried renderer-arithmetic latent bugs.**
