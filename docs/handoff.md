# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When starting a session, read this file and process every item — act on it, promote it elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a reason. Items do not accumulate. If there are no notes to leave, replace the contents with `_No handoff this session._` so the next session knows the file has been processed.

---

## From Session 49 close (2026-05-24) — Calculator class + Math Skill substrate + Level system substrate

S49 introduces the **9th class — Calculator** — together with two new substrates: **Math Skill** (parameter-predicate targeting across the battlefield) and **Level system** (slot-based level assignment with HP/MP and dominant-stat modulation). Large session, comparable to S45 (Hunter + bows). **1440 tests pass** (1399 → 1440, +41), `tsc -b` clean against a fresh build (Vercel pre-flight ran), `npm run build` produces a clean production bundle.

### What shipped — primary work

- **Level substrate (Commit 1 candidate).** `Unit.level: number` field; `ClassDefinition.dominantStat: 'pa' | 'ma' | 'spd'` (every class declares — 9 sites); `classDominantStats` parallel map in `baseline-stats.ts` (cross-validated against ClassDefinition at test time); `buildBaseStats(classId, brave, faith, level=25)` applies HP/MP ±10% per ±1 and dominant ±1 at ±2; `slotLevelFor(slotIndex)` maps the alternating-outward pattern; `BuiltUnit.level` (required); `buildTeamBattleConfig` forwards level into placements; `createInitialState` threads `placement.level` to `Unit.level` (default 25). All 8 pre-S49 templates retro-apply slot-based levels — small tuning shifts (Mage War's L24 Geosage / L26 Pyromancer / L23 Aethurge / L27 Hydrologist; documented in `playtest-watch.md`). UI: level pill on each filled `RosterCard`; `computeDraftUnitStats` accepts a `level` arg and threads slot-derived levels into the stat panel so HP/MP/dominant shifts surface immediately on slot reorder. Team-export JSON gains `level` field. **+11 substrate tests** (`level-substrate.test.ts`).

- **Math Skill targeting substrate (Commit 2 candidate).** New `TargetingSpec` kind `'math_skill'` (5th in the union); new `AbilityTarget` payload variant `{ kind: 'math_skill', parameter, value }`; new `MathSkillParameter = 'ct' | 'height' | 'level' | 'current_hp'` and `MathSkillValue = 'prime' | 3 | 4 | 5`. New module `engine/targeting/math-skill.ts` with `enumerateMathSkillTargets` (predicate-based set enumeration, sorted by id, KO'd / removed excluded) and `isPrime` helper. New dispatcher `resolveMathSkillDispatch` parallel to `resolveAoeDispatch`. New optional `faithScalesMagnitude?: boolean` on `CtEffectSpec` for Faith × magnitude (Exact Rhythm consumer). New `mathSkillMpCost?: { perTarget }` on ActiveAbilityDefinition for per-target MP cost. Two new closed-surface hooks (`modifyMathSkillPerTargetMpCost`, `modifyMathSkillSpBonus`); hook surface 13 → 15. New `DamageContext.additionalPowerCoefficient` shim for the SP bonus on damage / heal (the damage pipeline re-looks up the ability by id, so synthesizing an ability's damage spec doesn't take effect — additional power flows via the context field). `validateAction` gets the math_skill kind branch. **+13 substrate tests** (`math-skill.test.ts`).

- **Calculator class (Commit 3 candidate).** Stats per blueprint (HP 101 / MP 47 / PA 5 / MA 8 / Speed 7 / Move 2 / Jump 2 / 7-3-0 evades); Mage + Universal armor (all-slot baseline; class-side gating wave-2); `dominantStat: 'ma'`; freeAbilities = attack + cornered_focus + mathematician + thoughtful_pacing. New `math_skill` command set wired into the Calculator's First Action.

- **Calculator R/S/M passives (Commit 3 ride-along).** Cornered Focus (Reaction, +1 MA permanent on damage taken, STACK_ADDITIVE via `cornered_focus` status — Speed Save / Updraft pattern). Mathematician (Support, registers `modifyMathSkillSpBonus` → +1 and `modifyMathSkillPerTargetMpCost` → 1 — the anti-parasitism lever). Thoughtful Pacing (Movement, restores `2 × tilesMoved` MP on each Move via `onMoveCompleted` hook).

- **5 Math Skill abilities + Engineered Defenses status (Commit 4 candidate).** Precision Fire (SP 3 magical+fire, 50% Burn proc per target). Targeted Treatment (SP 4 magical+healing, multi-target heal). Exact Rhythm (SP 2 ctEffect, Faith × MA magnitude, clamped at 0). Sculpted Enhancement (50% Faith-gated PA Up + MA Up, linked roll). Engineered Defenses (80% Faith-gated apply of the new `engineered_defenses` status — +10 per elemental resistance + 5% per facing, STACK_INDEPENDENT, permanent). All five share `mathSkillMpCost: { perTarget: 3 }` (default; Mathematician returns 1).

- **AI Math Skill scoring (Commit 5 candidate).** New `src/ai/math-skill-scoring.ts`; `pickBestMathSkill` enumerates the 80 (ability × parameter × value) options, scores each by net team value (damage-to-enemies − damage-to-allies; heal-to-allies − heal-to-enemies; buff-to-allies − buff-to-enemies; CT-to-enemies − CT-to-allies), filters by MP affordability, and returns the highest-scoring above `MATH_SCORE_THRESHOLD = 8`. New phase 0b in `decideBasicAi` — runs before standard offensive enumeration; falls through for non-Math-equipped actors. **+4 AI tests** (`math-skill-scoring.test.ts`).

- **Math Skill UI (Commit 6 candidate).** New `math-skill-target-select` state in `turn-flow.ts` parallel to `target-select` but for parameter-predicate targeting; `pickMathSkillParameter` / `pickMathSkillValue` events + helpers on the TurnFlow interface; `abilityRoute` extended to detect `targeting.kind === 'math_skill'` and route `pickAbility` / `pickFreeAbility` to the new state; new `MathSkillPicker` component in `action-menu.tsx` renders parameter row (CT / Height / Level / HP) + value row (Prime / ×3 / ×4 / ×5) + live "Hits: N (X allies, Y enemies)" counter + Cast / Cancel; `use-turn-flow.ts` highlights effect paints the matched-unit positions on the renderer when both picks are non-null (heal-tinted for Targeted Treatment, attack-tinted otherwise); cancel back-stack matches existing target-select routing. Calculator's class tagline added in `team-builder-class-picker.tsx` ('Battlefield-wide parameter mage') so it surfaces correctly in the picker. **+6 turn-flow tests** (`turn-flow.test.ts`).

- **Portrait.** Calculator portrait (1043×1536 full-body → cropped top-square → downscaled to 512×512 RGBA PNG); registered in `assets/portraits/index.ts`.

- **Calculator kit integration tests.** End-to-end coverage of Precision Fire / Targeted Treatment / Exact Rhythm / Engineered Defenses, Mathematician's MP cost discount + SP bonus on damage, and Thoughtful Pacing's MP restore on Move. **+7 kit tests** (`calculator-kit.test.ts`).

- **ADR-0086** (Math Skill substrate) + **ADR-0087** (Level system) committed.

### What's NOT yet shipped (carry into next session)

**1. Calculator team template (paused waiting for Chris).** Per the brief's iterative-template pattern: Chris authors the team mid-session via the S48 exporter; implementer integrates as a late commit. The substrate + integration path is ready; Chris just needs to drive a build through the team-builder (loading default → swapping in Calculator + 4 other classes → exporting JSON). Recommend Calculator at slot 3 (L26) per the brief — unrestricted Level math, no self-hit on Level parameter.

**2. End-to-end browser exercise of the Math Skill picker in a real battle.** Browser verification at session close confirmed: app loads, no console errors, Calculator visible in class picker (with new "Battlefield-wide parameter mage" tagline), stats render correctly (HP 101 / MP 47 / PA 5 / MA 8 / SPD 7), Level badge displays L25, deployment phase loads. The Math Skill picker UI itself surfaces only on Calculator's first turn in battle; driving the PixiJS deployment phase via synthetic DOM events isn't reliable (Pixi's pointer pipeline doesn't intercept synthetic browser events the same way real input does), so a hand-driven battle is the natural next-session check. The picker FSM is unit-tested (6 new turn-flow tests) and the engine end-to-end paths are integration-tested (7 kit tests + 13 substrate tests + 4 AI tests), so the surface is well-covered structurally.

### Test coverage delta

`1399 → 1440` net (+41):
- Level substrate: +11 (`level-substrate.test.ts`)
- Math Skill targeting substrate: +13 (`math-skill.test.ts`)
- Calculator kit: +7 (`calculator-kit.test.ts`)
- AI Math scoring: +4 (`math-skill-scoring.test.ts`)
- Math Skill picker FSM: +6 (`turn-flow.test.ts`)
- Loader expectations: net 0 (counts bumped for added content)
- Test-fixture updates: ~25 inline ClassDefinition fixtures updated to declare `dominantStat: 'pa'` (no count change; type-required field).

### Engine-side notes worth carrying forward

- **MA factor on Math status abilities is already correct.** The brief / blueprint flagged "missing MA factor in status formula" as audit work — the audit found `engine/status/chance.ts`'s `DEFAULT_FACTORS = { faith: true, ma: true }` (per ADR-0028) already runs Faith × MA on every status application that doesn't explicitly opt out. Sculpted Enhancement / Engineered Defenses inherit the canonical formula by leaving `factors` undefined. No engine work was needed; brief stands corrected.

- **Damage-pipeline id re-lookup wart.** The damage handlers (`magical_ma_power`, `physical_pa_wp`, `healing_base`) re-look up the source ability by id from the catalog before reading `power_coefficient`. That meant my first attempt at the SP bonus (synthesize a per-cast ability with bumped power_coefficient) didn't take effect — the catalog re-lookup returned the canonical ability. Worked around with `DamageContext.additionalPowerCoefficient` shim. A future cleanup could make the damage handlers trust `ctx.ability` (or take it via env), eliminating the catalog re-lookup. Not session-49 scope.

- **Empty Math Skill cast is valid.** When no units match the predicate (e.g., no units have a prime current_hp), the cast still commits — base MP cost is paid but no per-target term applies. AI scorer returns 0 score, so no Math option is picked. Human player would see "empty preview" and could cancel.

- **Knight-fixture dominantStat is 'pa' across the 25+ inline test fixtures.** Test fixtures all use Knight-like classes for setup; programmatic insert of `dominantStat: 'pa'` via the Python helper script in this session. Cleanest from a maintenance perspective is "test fixtures don't exercise dominantStat-specific behavior; the `'pa'` value is a placeholder." If a future test needs a different dominantStat for behavioral coverage, override per-test.

### Vercel pre-flight discipline

Ran `rm node_modules/.tmp/tsconfig.app.tsbuildinfo && rm node_modules/.tmp/tsconfig.node.tsbuildinfo` followed by a fresh `tsc -b` at session close — clean. `npm run build` produced a clean production bundle; the only warnings are the pre-existing `>500KB chunk` notices unchanged from S48. Calculator portrait packed at 276KB.

### Carry-forward (longer-term)

- **All standing carries from S48** (AI deployment role-aware sorting, Bulwark Stance redesign, equipment expansion, Charm/Seduction substrate, Pyromancer R/S/M consolidation, Speed Save / Updraft per-swing cap codification, renderer-side multi-swing polish, ActionType-wiring smoke test, hill-height adjustment on Stonebridge, asymmetric siege scenario for Stonebridge, terrain bar mid-battle vanishing repro, larger teams beyond 5v5, team import). None addressed this session.
- **AI Math Skill personality variants** (Aggressive / Conservative per brief D8 — deferred to playtest-driven tuning).
- **Calculator stretch abilities** (Status-debuff Math, Drain Math, Banish Math per blueprint open questions — possible v2 additions; not v1).
- **Damage-pipeline catalog re-lookup cleanup** (see "Engine-side notes" above).
