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

## From session 2026-05-12 (Session 30 — Cluster 5 substrate + Session 29 polish fold-ins)

Session 30 landed the Cluster 5 engine substrate (procs + drains) plus three Session-29-carry UI fold-ins. Tests: **816 passing across 68 files, 0 failing** (up from 796 in Session 29). +20 new tests (17 substrate integration in `session-30-integration.test.ts`, 3 label-helper tests in `ui/labels.test.ts`).

### Scope completed

**Engine substrate (Cluster 5):**

1. **`attack_proc` effect shape (ADR-0064).** New optional field `attackProcs?: ReadonlyArray<AttackProcDef>` on `EquipmentBase` where `AttackProcDef = { chance: number; abilityId: AbilityId }`. Equipment contributor `attackProcContributor` registers against `onDamageDealt`; each (item × procs entry) yields a synthetic handler. The handler gates on `ctx.hit === true` + `ctx.damageTags.has('physical')` + `ctx.actionSeed !== undefined`, rolls `unitFloatFromSeed(ctx.actionSeed ^ (PROC_ROLL_SUB_STREAM + procIndex))` against `chance`, and on success emits a `use_ability` against `ctx.target.id` with `riderSource: { kind: 'equipment_proc', itemId }`.

2. **`onDamageDealt` return widening (ADR-0064).** Mirrors the existing `onDamageReceived` pattern. New `OnDamageDealtResult = { ctx; emittedActions? }`. `runOnDamageDealt` normalizes wrapped-or-bare returns; `fireOnDamageDealt` forwards `ctx.emittedActions`. No new hook surface — just a return-type widening on an existing hook.

3. **`riderSource` on `UseAbilityPayload` (ADR-0064).** Discriminated union; sole v1 variant is `{ kind: 'equipment_proc'; itemId }`. When present: `validateAction` skips MP affordability; `reduceUseAbility` skips MP deduction and records `mpSpent: 0`; `runPreHook` (in `commitAction`) skips `onActionAttempted`, bypassing Silence / Stop / Don't Act on the wielder. The proc is the weapon's power, not the wielder's.

4. **`onFinalDamage` hook + new `postFinalize` pipeline stage (ADR-0065).** Post-finalize, emission-only. Args: `{ unit (attacker), target, damageDealt, damageTags, absorbed }`. Return: `OnFinalDamageResult | void`. New stage `'postFinalize'` added to `DamageStage`; `STAGE_ORDER` extends to eight stages; default ruleset registers `fire_on_final_damage`. The pipeline's `runStage` now reads `ruleset.damagePipeline.stages[stage] ?? []` to tolerate custom rulesets that pre-date the stage (test fixtures don't need a churn pass).

5. **`damageMpDrainPercent` field + contributor (ADR-0065).** New optional `number` field on `EquipmentBase`. `finalDamageDrainContributor` registers against `onFinalDamage`; emits `system_mp_drain { source, target, amount }` where `amount = floor(damageDealt × percent / 100)`. Gates on `!absorbed`, `damageDealt > 0`, `target.vitals.hp > 0`, and non-zero rounded amount.

6. **`system_mp_drain` action (ADR-0065).** New action type. Payload `{ source, target, amount }`; outcome `{ kind, source, target, requested, targetApplied, sourceApplied }`. Reducer applies transfer-bounded math: `targetApplied = min(target.mp, requested)`; `sourceApplied = min(maxMp − source.mp, targetApplied)`. KO'd / missing source or target short-circuits to all-zero applied fields; entry still logged.

7. **`DamageContext.actionSeed` and exported `unitFloatFromSeed`.** Optional `actionSeed?: number` on the context; pipeline orchestrator (`runDamagePipeline`) initializes it from `args.seed`. Hook contributors (which see only `args`, not `env.seed`) read it to roll deterministically. `PROC_ROLL_SUB_STREAM = 8` — well past variance (0), evasion (1), brave (2), status_chance (3..), crit (4), and ability_chance (16..).

**UI fold-ins (Session 29 carry):**

8. **Bucket / slot label helpers (`src/ui/labels.ts`).** Constant maps + `bucketLabel(id)` / `slotLabel(id)` helper functions. Labels per Chris's preference: `Primary Action`, `Secondary Action(s)`, `Reaction(s)`, `Support(s)`, `Movement(s)` for buckets; `Left Hand`, `Right Hand`, `Head`, `Body`, `Accessory` for slots. Helpers wrap the maps so a future text → text+icon migration is a one-helper change, not a sweep across every call site.

9. **Per-facing evasion in unit detail panel.** New row below the Stats grid: `Evade F: 10  S: 6  B: 0` (Water Mage example). Reads through `runModifyEvasion` for each facing, so Steel Helm's `-20 side/back` shows in the display.

10. **`computeOutgoingHitChance` helper.** Pure function in `engine/damage/hit-chance.ts` that mirrors `evasionCheck`'s composition (accuracy × evasion × elevation × ∏targetHooks × ∏casterHooks, clamped to [0.05, 1.0]) but returns the value instead of rolling. Helper internals `computeAttackerFacing` / `pickEvasion` / `computeElevationModifier` extracted to `hit-chance-internals.ts` and shared between the pipeline handler and the forecast helper (single-source-of-truth for the math).

11. **Forecast hit-chance + range projection.** New `effectiveRange: { horizontal, vertical }` on `Forecast`; new `hitChance?: number` per `ForecastTargetRow`. The panel renders a `Range: 3H · 2V` strip below the sub-header (effective values after `computeAbilityRange`, no base+bonus annotation per Chris's call) and a `hit XX%` row inside each target card. The row always shows when `hitChance` is defined, including at 100% — consistent reading across attacks per Chris's playtest preference (auto-hit / non-physical land at 1.0 and just display "hit 100%").

### Architecture records

- **ADR-0064** — `attack_proc` substrate: `onDamageDealt` emission widening, `attackProcContributor` shape, `riderSource` bypass machinery (MP + Silence), seed sub-stream architecture, chain-depth sharing with reactions. Documents the rationale for mirroring `onDamageReceived`'s wrapped return rather than introducing a parallel emitter hook.

- **ADR-0065** — `onFinalDamage` substrate: new `postFinalize` pipeline stage, emission-only hook semantics, `system_mp_drain` action shape and transfer-bounded reducer math. Documents the rationale for tolerating missing stages in the orchestrator (avoiding a churn pass through test fixtures).

### Test reconciliation

- 17 new tests in `src/engine/actions/session-30-integration.test.ts` cover: proc-firing chain (5 cases — hit, miss, non-physical, deterministic, multi-proc independent sub-streams), `onFinalDamage` emission semantics (4 cases — damage, absorbed, zero damage, KO'd target), `reduceSystemMpDrain` (5 cases — transfer math, target floor, source cap, KO'd target, missing units), `riderSource` bypass (3 cases — validator accepts, validator regression, reducer records mpSpent: 0).
- 3 new tests in `src/ui/labels.test.ts` cover the bucket / slot label lookups and the raw-id fallback.
- TypeScript strict-mode error count unchanged from baseline; zero new strict-mode errors.
- The validator's switch was missing a `system_mp_drain` case in the pass-through list — caught by test #2 returning `undefined` for `result.kind` (which exposed the missing branch). Added.

### Limitations + watch-fors

- **`damageMpDrainPercent` is integer percent (0–100), not a [0, 1] fraction.** Author-friendly (`damageMpDrainPercent: 10` reads "10%"); floor-math keeps drain integer-valued. If a fractional-percent need surfaces (a debug equipment item with 0.5%), the field reshapes.

- **Multi-proc independence depends on lane spacing.** Two `attackProcs` entries roll on lanes 8 and 9. If a future weapon ships with N>8 procs (probably never), the lanes 8..15 fill up and N=9 collides with ability_chance lane 16. Reserve `PROC_ROLL_SUB_STREAM = 8` plus 7 entries; revisit if equipment ever wants more.

- **Procs don't count against any per-attacker-per-turn cap.** Reactions cap at 1 per reactor per turn (`perUnitPerTurnReactions`); procs have no symmetric cap. In v1 (single-act units) this is moot. If multi-act content surfaces and procs feel spammy, add `perUnitPerTurnProcs` to `chainTermination` and gate in `commitAction`.

- **`onFinalDamage` fires on absorbed hits but handlers gate on `absorbed: true`.** The hook always fires post-finalize; the contributor pattern is responsible for the gate. A future handler that wants to react to absorption (a "thanks for the heal" debuff trigger?) can gate on `absorbed === true` rather than skipping.

- **Forecast facing uses the actual attacker→target geometry.** No "what if I moved here first" projection. For a Move + Attack flow, the displayed hit chance reflects the current attacker position, not the move destination. If a future Move + Attack confirmation flow surfaces, the forecast may need a hypothetical-position arg.

- **Unit detail panel's per-facing evasion uses `unit` as the attacker stand-in.** No v1 evasion handler reads `attacker`, so the displayed value matches reality for every v1 case. If a future handler gates on attacker identity (a Frost reaction that ignores cold-resistant attackers, for example), the panel's display diverges from per-attacker reality. Flagged for playtest watch.

- **Constant-map labels don't carry icons today.** Per Chris's question about future icons: the helper-function wrapper (`bucketLabel(id)` / `slotLabel(id)`) is the migration seam. Extending the helpers to return `{ text, icon }` is a one-helper change; every consumer already reads through it.

- **`riderSource` is consumed at three sites today** (validator MP gate, reducer MP deduction, commit pre-hook). A future site that adds a *new* gate against player-action affordability (cooldowns, resource budgets) needs to remember to thread the rider check. The pattern is "if `riderSource !== undefined`, skip the gate." Tests should cover the bypass for any new gate.

- **Equipment-procced spell uses the actor's stats for damage formula.** A Knight wearing Bolt Hammer fires a Lightning spell that scales on the *Knight's* MA, not the weapon's. (FFT-accurate: the weapon's power funnels through the user's stats.) If Mage War design ever wants weapon-flat-power on procs (no MA scaling), the contributor would author a `system_damage` directly rather than emitting `use_ability`.

- **`finalize` and `postFinalize` share the same `ctx.finalDamage` value.** Future `postFinalize` handlers must not mutate `ctx.finalDamage` (the contract); they emit `system_*` actions instead. The runner's `OnFinalDamageResult` shape carries `emittedActions?` only — no `ctx` field — which enforces this at the type level.

### Considered and rejected this session

- **Parallel `onAttackHit` hook for proc firing.** Rejected — `onDamageDealt` already carries the attacker/target/tag information at the right fire site. Extending its return shape is cheaper than adding a hook surface.

- **Strict equipment-doc reading of Rasp Pendant (10% damage reduction + 10% MP drain).** Reconsidered per Chris's call this session: simpler "no damage reduction, bonus MP drain" reading was chosen. Pendant becomes slightly more powerful in exchange for not needing a `modifyOutgoingDamage`-style transform. Equipment doc to update in Session 31's authoring pass.

- **Procs share the per-unit-per-turn reactor cap.** Rejected — reactor cap is target-side (the reactor's per-turn budget); procs are attacker-side. Different conceptual axis.

- **`mpFree: boolean` flag instead of `riderSource: { kind; itemId }`.** Rejected — the wrapper carries action-log readability ("Bolt Hammer procced") and extends to future rider variants without parallel flags.

- **Per-stage handler list churn vs. tolerating missing `postFinalize` stage in the orchestrator.** Rejected the churn; the orchestrator's `?? []` fallback is the smaller-blast-radius change.

- **`computeAbilityRange` chokepoint also in the forecast.** Already routed (ADR-0063); the forecast was the last consumer that read bare fields, and is now wired this session.

- **Forecast accuracy row separate from hit row.** Rejected — accuracy folds into the hit chance via the composition; surfacing both would invite a "why are these different?" question. Hit chance is the single number that matters.

### Empirical-questions checklist for Chris's next playtest

Most Cluster 5 effects don't surface until Session 31 authors Bolt Hammer / Flametongue / Rasp Pendant. The fold-ins ARE observable now:

**Unit detail panel:**
- [ ] Open Status for any demo unit. Should show the new `Evade F X  S Y  B Z` row below the Stats grid. Default classes (Knight, Mages) all have zero front evade and zero side/back evade in v1 baselines; the row shows `F 0  S 0  B 0`. The Water Mage in my smoke test showed `F 10  S 6  B 0` — confirm those are the intended Water Mage class baselines.
- [ ] Loadout section should use the new labels: "Primary Action", "Secondary Action(s)", "Reaction(s)", "Support(s)", "Movement(s)". No raw bucket ids visible.
- [ ] Equipment section should use the new labels: "Left Hand", "Right Hand", "Head", "Body", "Accessory". No `leftHand` / `headgear` / `armor` raw strings visible.

**Forecast panel:**
- [ ] Engage Act → Water Spells → Water Strike → hover any valid target. The forecast should show "Range: 3H · 2V" (the effective horizontal/vertical range strip) above the per-target damage row.
- [ ] Hit-chance row always shows. For a physical attack against a same-elevation target with default front facing: row displays "hit 100%". Magical auto-hit spells also show "hit 100%" (per Chris's preference for consistent reading across all attacks).
- [ ] (Synthetic test) — if you author a demo battle with a Knight wearing Steel Helm and a target with the Knight on the Mage's side, hit chance should still display as 100% (the equipment's `-20` side evade plays through, but the final clamp at 1.0 hides the overflow).

**Substrate (no observable v1 surface):**
- [ ] Demo battle launches normally — no Session 30 item is equipped on any demo unit; no `attack_proc` or `damageMpDrainPercent` field is set on any v1 item. Regression check only.

### Longer-term carry-forward

- **Session 31 content authoring** — Bolt Hammer (`attackProcs: [{ chance: 0.25, abilityId: 'bolt_basic' }]`), Flametongue Burn proc (`attackProcs: [{ chance: 0.25, abilityId: 'apply_burn_proc' }]`), Rasp Pendant (`damageMpDrainPercent: 10`), Wand of Depths / Wand of Deepwood on-hit resistance shifts.
- **Wand on-hit resistance shifts** — engine substrate for "+25/-25 elemental resistance on target, persistent for battle" is NOT in Cluster 5; it's a separate need (status-tier per-tag resistance shift?). Surface during Session 31 authoring; may require additional engine work (new status type carrying tag-keyed resistance delta).
- **Procced spell uses caster's MA for damage** — flagged above. Watch playtest; if Mage War design wants weapon-flat-power on procs (no MA scaling), the contributor can author `system_damage` directly. Today's `use_ability` emission goes through the full damage pipeline including MA scaling.
- **Equipment doc update** — Rasp Pendant spec needs to update from "10% damage reduction + 10% MP drain" to "bonus 10% MP drain" per Chris's design call. Schedule for Session 31 when the item is authored.
- **Tintinibar Regen duration verification** (Session 29 carry; first playtest reveals if needed).
- **Weapon-sourced variance engine seam** (Session 29 carry; future).
- **Cast Shell / Cast Protect substrate** (Session 29 carry; future spells).
- **Sorcerer's Robe "Move +1" playtest read** (Session 29 carry).
- **AI active absorption exploitation** (Session 27 carry; tactics-layer pass).
- **`onTurnStart` symmetric widening** (Session 26 carry; defer until emitter).
- **Multiplicative tick-amount stacking** (Session 28 carry; design noted, no v1 stacking case).
- **AI projection forecast extension** — `computeOutgoingHitChance` is now available; the AI's tier-2 projection can route through it for a sharper expected-damage estimate (today the AI's projection threads hit-chance separately). Optional refinement.
- **`onActionAttempted` bypass for procs is currently double-gated** (source === 'system' AND riderSource !== undefined). Either is sufficient. If a future content path wants `source: 'player'` rider casts, only the riderSource gate matters; the system-source gate is incidental.
- **Forecast layout — accuracy row** considered and rejected; revisit if playtest finds the missing accuracy multiplier surface confusing.
- **Per-attacker proc cap** — none today; revisit if multi-act content makes procs feel spammy.
- **Renderer's HP "max" captured at mount** (Session 28 carry; sibling to MP lift).
- **Status-badge polarity convention** (Session 22 carry).
- **rAF vs setInterval for animation drain** (Session 23 carry).
- **AoE preview correctness across all shapes** (Session 23 carry; Sessions 26-30 confirmed shape-agnostic).
- **MP / status snapshot ahead-of-tween fix** (Session 22 carry).
- **`pa_factor` NotYetImplementedError** (audit E3).
- **TS strict-mode test errors** (audit E8) — pre-existing list carries forward; Session 30 added zero.
- **Surrender flow** (Session 34 / ADR-0041).
- **MVP-unit smarter algorithm** (Session 24 Wave 1).
- **Permadeath timer** (Session 24 Wave 1).
- **Settings expansion** (Session 24 Wave 1).
- **Reactions in projection column** (Session 24 Wave 1).
- **Bug 1** (Session 24.5 ADR-0046): mid-battle targeting failure; instrumentation in place, no recurrence in Sessions 25-30.
- **Vite HMR cache invalidation** occasional issue.
- **Hardcoded team color palette across three sites** (Session 25 carry).
- **Active-ring + counterpart-ring still circles after portrait restructure** (Session 26.5 carry).
- **Tile-info effect-icon area still empty in v1** (Session 26.5 carry).
- **Item #5 pacing constants** — tuneable per playtest feedback (Session 26.5 carry).
- **Burn × Purifier action-log readability** — first Purifier playtest possible now (Purifier shipped in Session 29 batch A).
- **Bedrock Stride fall-immunity untested until River Ridge ships** (Session 33).

### Suggested scope for Session 31

Per `docs/twentyOnePlanning/roadmap-sessions-21-plus.md`, Session 31 is **Cluster 5 content authoring** — the items that consume the substrate landing this session:

- **Bolt Hammer** (`kind: 'weapon'`, WP 10, accuracy 75, variance [0.9, 1.3], `tags: ['axe']`, `attackProcs: [{ chance: 0.25, abilityId: '<lightning_basic_proc>' }]`). The procced Lightning ability needs authoring too — likely a simple SP-12 magical Lightning hit, no AoE.
- **Flametongue Burn proc** — extend Session 29's Flametongue (`{ tags: ['sword', 'fire'] }`) with `attackProcs: [{ chance: 0.25, abilityId: '<apply_burn_proc>' }]`. The procced ability is a single-target Burn application — `system_apply_status` carrier or a stripped-down `use_ability`.
- **Rasp Pendant** (`kind: 'accessory'`, `damageMpDrainPercent: 10`). Update equipment doc spec to "bonus 10% MP drain" (no damage reduction).
- **Wand of Depths / Wand of Deepwood on-hit resistance shifts** — Session 31 also picks up this carry from Session 29. Needs a status-tier resistance-shift substrate that's NOT in Cluster 5; likely a new status type carrying tag-keyed resistance deltas. Surface design call early in the session.

Authoring-only for the proc items (engine work is complete). The wand on-hit shifts may need a small engine seam — assess during the audit phase of Session 31.
