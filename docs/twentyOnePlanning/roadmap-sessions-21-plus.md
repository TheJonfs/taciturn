# Roadmap: Sessions 21+ (Mage War MVP and Full Demo)

*Drafted 2026-05-10. Captures the post-reconciliation, post-engine-audit sequencing for sessions following the Session 20b handoff. Anchored on the post-reconciliation content spec (`mage-war-content-spec.md`) and the engine audit (`docs/audits/post-20-engine-audit.md`).*

## Reading guide

The roadmap is organized in six phases. Each phase has a clear milestone; each session has Goal / Engine / Content / UI / Out-of-Scope / Dependencies / Size / Notes.

Sizes follow the engine arc convention: small (~½ session), medium (~full session), large (multi-session).

**Milestones:**

- **End of Phase A (Session 24):** Battle-loop MVP. Playable battle from hand-authored teams. No team builder, no deployment phase, no River Ridge — but the core combat loop is live and supports playtest.
- **End of Phase C (Session 31):** Equipment-complete. Most of the equipment doc shipped; deployment phase substrate ready.
- **End of Phase E (Session 38):** Full demo. Team builder + deployment phase + River Ridge + three sample teams, end-to-end play loop from title screen through results.

**Deferred-wiring reminders.** Phase A builds the battle loop assuming a `BattleConfig` produced by a static loader (hand-authored in `demo.ts`). Phases D-E replace the static loader with team builder + deployment phase output, but the `BattleConfig` contract stays stable. Each Phase A session's Notes calls out the wire-in points that get retrofitted later.

---

## Phase A — Battle-loop MVP

Goal: get a playable battle loop in Chris's hands as fast as possible, using hand-authored teams, on a flat map, with no pre-battle UI surfaces.

### Session 21 — Cluster 1: Stabilization

- **Goal:** Green test suite and a calibrated AI that pre-filters blocked actions. Closes out the post-reconciliation tuning shift.
- **Engine work:**
  - **E1 crit_chance clamp.** Land `Math.max(0, Math.min(100, runModifyStatQuery(...)))` inside `critRoll`. ~2 lines + a stacking-Crit_modifier test asserting that 6× Static Embrace stacks (5 base + 120 magnitude = 125) clamp to 100% crit, not undefined behavior.
  - **E9 AI pre-filter.** Extend the basic AI's candidate-filter pass to call `runOnActionAttempted` in dry-run mode (with `isReaction: false`) before proposing an action; filter blocked actions out of the candidate list. Same pattern the AI already uses for `validateAction`. Fixes the two failing integration tests in `ai-controller.integration.test.ts`.
- **Content:** none.
- **UI:** none.
- **Out of scope:** All other items in the audit. No new abilities, items, or maps.
- **Depends on:** Test reconciliation work landed in the audit session.
- **Size:** small.
- **Notes:** This session unblocks Phase A's UI work. Test count target: 559+ passing, 0 failing.

### Session 22 — Battle UI: visualization layer

- **Goal:** Render the map and units on a PixiJS canvas wrapped in React. Camera controls (pan, zoom). Static visualization — no interaction yet.
- **Engine work:** none (the audit confirmed no engine gaps for visualization).
- **Content:**
  - **Training Field map.** 14×14 grid, uniform terrain at elevation 2 (land everywhere; respects the implicit water table rule). No deployment zones encoded yet (Cluster 2's deploymentZone field hasn't shipped). Hard-coded starting positions in `demo.ts` reference this map.
- **UI:**
  - React + PixiJS scaffolding under `src/ui/`. App-level layout (canvas + side panels).
  - Map renderer: tile sprites by terrain type, elevation visualization, grid lines.
  - Unit renderer: sprite-by-class, facing indicator, HP/MP bars, status badges.
  - Camera: pan (drag or arrow keys), zoom (wheel or pinch), recentre on active unit.
  - Settings panel scaffold (empty for now; populated in Session 24).
- **Out of scope:** All interaction. No action menu, no targeting, no action commits. Battle plays itself via the existing `DemoOrchestrator` in headless mode while the UI renders state changes; user can watch but not intervene.
- **Depends on:** Session 21.
- **Size:** medium-to-large.
- **Notes:** **Deferred wiring** — `BattleConfig` is loaded statically by a `loadDemoBattle()` function. When team builder + deployment phase ship (Sessions 36-37), this loader is replaced by team-builder output. Keep the loader interface stable.

### Session 23 — Battle UI: interaction layer

- **Goal:** Player can drive a unit's turn end-to-end: select an action, choose a target, commit. Battle responds, log updates, next turn fires.
- **Engine work:** none (forecast/projection contract is sufficient per Item 19).
- **Content:** none.
- **UI:**
  - Turn-flow state machine per `battle-ui-architecture.md`: idle → action menu → target selection → forecast → commit → animation → idle.
  - Action menu: list of available abilities for the active unit, organized by command set. MP cost / charge time visible. Disabled abilities greyed with tooltip reason.
  - Target selection: tile / unit picker constrained by ability targeting (range, shape, line-of-sight where applicable). Highlights legal targets.
  - Commit handler: builds a `proposed_action`, runs through `validateAction`, calls `commitAction` if valid, displays the result.
  - Action log panel: streaming list of action-log entries, formatted for readability.
- **Out of scope:** Forecast/projection column (Session 24). Status detail popovers. Replay controls.
- **Depends on:** Session 22.
- **Size:** large.
- **Notes:** **Deferred wiring** — interaction layer assumes both teams are player-controlled OR one team is AI-driven via `DemoOrchestrator`. When pre-battle UI ships, the team-builder output supplies the player/AI assignment per team. Keep the team-control mode as a `BattleConfig` field consumed by the controller.

### Session 24 — Battle UI: forecast, projection column, settings, results

- **Goal:** MVP polish — players see what an action will do before committing; battle outcomes display cleanly; settings let users adjust UX preferences.
- **Engine work:** Light extension of the projection module per Item 19 (`projectDamageRange`, `computeStatusChance`, AoE per-target preview entry point). All composes existing pure functions; no new substrate.
- **Content:** none.
- **UI:**
  - **Forecast hover:** when a target is selected (or hovered) in the targeting state, a forecast tooltip displays expected damage range (min/expected/max), hit chance, status application probabilities per applicable status, and AoE per-target preview.
  - **Projection column:** rightside panel showing in-flight charged actions, queued reactions, and CT-ordered turn forecast for the next several turns. Reads the engine's projection surface; updates per action commit.
  - **Settings panel:** animation speed, log verbosity, camera follow toggle, accessibility options. Persisted to localStorage. (One known limitation in the artifacts environment per the system constraints; the production app is fine with localStorage.)
  - **Results screen:** post-battle summary — winner, MVP unit, KO timeline, log replay button (defers to Session 39+ for full replay; v1 just opens the log panel).
- **Out of scope:** Replay-from-log scrubbing. Full settings persistence with cloud sync.
- **Depends on:** Sessions 22, 23.
- **Size:** medium-to-large.
- **Notes:** **MVP milestone reached.** At end of this session, hand-authored battles in `demo.ts` are fully playable end-to-end with rich UI. **Deferred wiring** — results screen "next battle" / "back to title" buttons stub to a placeholder until Phase E lands the title and battle-setup screens.

---

## Phase B — Substrate prep & content cleanup

Goal: lay the engine substrate that subsequent equipment content needs, plus author the move abilities the spec calls for.

### Session 25 — Cluster 2: Substrate prep

- **Goal:** Add the engine substrate that unblocks team builder, deployment phase, and bulk equipment tagging.
- **Engine work:**
  - **Item 18: availability field.** Required `availability: 'available' | 'hidden'` on `AbilityCommon` and `EquipmentBase`. Catalog-load validator fails loud if missing on any registered ability or item.
  - **Item 14: deploymentZone tile field.** Optional structured `deploymentZone?: TeamId | null` on the Tile interface. Map authors set explicitly.
  - **Item 13: initial CT randomization.** New `{ kind: 'uniform_int', min: number, max: number }` variant on `RulesetInitialCT`. Resolver hashes `(masterSeed, unitId)` into the integer range. Default ruleset switches `initialCT` to `{ kind: 'uniform_int', min: 0, max: 20 }`.
- **Content:**
  - **Bulk availability tagging.** Every existing ability and item declares `availability`. Per spec:
    - Hidden abilities: `float`, `fly`, `discharge_strike`, `cure`, plus the `white_magic` command set's containment of cure (set-level hide if the catalog supports that, else just hide the cure ability).
    - Hidden items: `iron_helm`, `iron_mail`, `strength_ring`.
    - Everything else: `'available'`.
  - **Knight class file:** remove `white_magic` from secondary command sets. Knight ships with `battle_skill` only for v1.
- **UI:** none.
- **Out of scope:** Authoring the four new movement abilities (Session 26). Authoring new equipment (Phase C). Pre-battle UI surfaces.
- **Depends on:** Session 21 (or any Phase A session — strictly only blocked by Cluster 1).
- **Size:** medium (the substrate is small per item; the bulk tagging touches ~36 ability files + ~5 item files + the test fixtures).
- **Notes:** Test-fixture defaults need updating: any inline ability declarations in `abilities/test-fixtures.ts` need `availability: 'available'` (or `'hidden'` for fixture-only abilities). Catalog-load validation enforces this so missing fields fail loud.

### Session 26 — Movement abilities authoring

- **Goal:** Author the four new movement abilities per the post-reconciliation spec.
- **Engine work:** none.
- **Content:**
  - **`bedrock_stride` (Earth Mage).** Cost 2, `available`. Effects: `modifyStatQuery` +1 to `moveRange`; `modifyDamageReceived` immune to fall damage (via existing fall-damage system_damage source).
  - **`hotfoot` (Fire Mage).** Cost 2, `available`. Effects: `modifyStatQuery` +1 to `moveRange`, +1 to `spd`.
  - **`tidewalker` (Water Mage).** Cost 1, `available`. Effects: `modifyTerrainCost` water tile cost -1 (minimum 1 per the spec).
  - **`quickstep` (Lightning Mage).** Cost 1, `available`. Effects: `onTurnEnd` after a Move action, refund `MA` CT (one-time per turn). Mirrors `flow_state`'s structure but on Move axis.
- **UI:** none.
- **Out of scope:** New equipment.
- **Depends on:** Session 25 (availability tag).
- **Size:** small-to-medium.
- **Notes:** All four go into the class-free passive list per the spec's parity rule (Earth/Water/Fire/Lightning each get their movement ability free). Verify each compiles cleanly into the unit's modify-chain registration at battle setup.

---

## Phase C — Equipment expansion

Goal: ship the bulk of the equipment doc, layered against the engine extensions that support its effect types.

### Session 27 — Cluster 3: Hook surfaces (+ contributor refactor)

- **Goal:** Add four new hook surfaces and refactor the equipment contributor to extension-pattern shape so future hook-driven equipment is mechanical.
- **Engine work:**
  - **Item 5: `modifyMpCost` hook.** Args `{ unit, ability, baseCost }`, multiplicative chain. New helper `computeMpCost(state, catalog, unit, ability)` centralizes the read; reducer + validator route through it.
  - **Item 7: `modifyActionSpeed` hook.** Args `{ unit, ability, baseActionSpeed }`, additive chain. Charged-action commit + `computeActionSpeed` route through it.
  - **Item 10: `modifyResistance` hook.** Args `{ unit, tag, baseValue }`, additive chain. `composeResistance` and `lookupStatusResistance` route through it.
  - **Item 11: `modifyIncomingStatusApplicationChance` hook.** Target-side variant of `modifyStatusApplicationChance`. Apply chance composes `formula × ∏casterHooks × ∏targetHooks`.
  - **E4: contributor refactor.** Replace the linear branch chain in `equipmentContributionsFor` with a registration pattern (per-hook contributors registered at module load). Each new hook adds a contributor module rather than a branch in the dispatch.
- **Content:** none.
- **UI:** none.
- **Out of scope:** Authoring items that consume these hooks (Session 29). Cluster 4 work.
- **Depends on:** Session 25 (availability field is on the contributor's input shape).
- **Size:** medium-to-large (four hooks plus refactor; each hook independently small but they all touch overlapping files).
- **Notes:** Item 5 doesn't strictly need maxMp; Items 7, 10, 11 are also independent of maxMp. Cluster 3 ships before Cluster 4 in this roadmap because the hooks are independently useful and the refactor is best done while the contributor surface is small. **Watch for E2 (resistance cap at 100):** Item 10 lights up the resistance modification path; verify the cap-at-100 behavior in `composeResistance` is still correct, or schedule lifting it (with absorption per ADR-0020) if equipment can push past 100.

### Session 28 — Cluster 4: Structural

- **Goal:** Introduce maxMp as a stat, add bucket capacity hook, add status tickdown rate modifier. Time-dominator is the maxMp introduction.
- **Engine work:**
  - **Item 6: maxMp introduction.** New `maxMpBase` stat on `BaseStats`; derived `maxMp` for query. Per-placement vitals.mp continues to override; `fillVitalsFromComputedMaxes` handles the absent case. `STAT_MOD_KEYS` extends to `mp → maxMp`. New `statModsMultiplicative?: Partial<Record<StatName, number>>` field on `ItemDefinition` for Staff of Abundance-style multiplicative shifts. Per-class `BaseStats` get `maxMpBase` populated (matching the spec's L25 targets: 60 for mages, 20 for Knight). Verify AI's projection still reads correctly with MP added to the queried surface.
  - **Item 1: bucket capacity hook.** Dedicated `modifyBucketCapacity` hook (recommended over polluting StatName with bucket entries). Equipment contributor extends to support per-bucket-cap deltas.
  - **Item 8: status tickdown rate modifier.** `modifyStatusTickAmount` hook with args `{ unit, statusTypeId, statusTags, baseAmount }`, additive chain. `reduceStatusTick` reads chain product. **Design call needed at session start:** confirm Burn (custom-trigger, ticks by stack) participates in tickdown rate modification — if so, Purifier doubles per-stack drain effective damage.
- **Content:**
  - Update class baselines in `demo.ts` so each class's `maxMpBase` matches spec. Vitals.mp follows from it. (Currently spec values are encoded in `vitals.mp`; this session moves them to the stat layer.)
  - **E5 fold-in:** since maxMp now exists, Rasp Pendant's MP-cap clamp logic is ready when Cluster 5 lands.
- **UI:** none.
- **Out of scope:** Authoring new equipment (Session 29). Cluster 5 work.
- **Depends on:** Session 27.
- **Size:** medium-to-large.
- **Notes:** This is the highest-risk session for surfacing engine surprises. The maxMp introduction touches placement, fill, and the AI's stat projection. Plan for ~30 minutes of buffer for retrofit work.

### Session 29 — Equipment authoring batch A

- **Goal:** Author every item from the equipment doc that's unlocked by Clusters 3 and 4 (i.e., everything except Cluster 5's procs/drains items).
- **Engine work:**
  - **E7 fold-in:** add `classRestriction?: ReadonlyArray<ClassId>` to `EquipmentBase` and a check in `validateEquipmentPlacement`. Required because this session ships Knight-only items (Battle Gear, Soldier's Leathers, Steel Helm, Tower Shield, etc.).
  - Status authoring: any Auto-statuses referenced by equipment that don't already exist (Shell, Protect — verify against the existing status catalog; Regen and Haste already ship).
- **Content:** Equipment items per `mage-war-equipment.md`:
  - **Weapons:** non-procced wand, sword, axe, staff variants. (Procced weapons — Bolt Hammer, Flametongue with Burn proc — wait for Cluster 5.)
  - **Shields:** all Knight-only shields.
  - **Body armor:** Battle Gear, Soldier's Leathers, Sorcerer's Robe (with Auto-Shell), Silvered Vest, Wizard's Robe.
  - **Head armor:** Steel Helm, Magus Crown, Pointy Hat, Guard Cap.
  - **Accessories:** Diamond Bracelet, Augmentor, Capacitor Ring, Focus Band, Purifier, Tintinibar (Auto-Regen).
  - All items declared with `availability: 'available'`.
- **UI:** none.
- **Out of scope:** Bolt Hammer, Flametongue Burn proc, Rasp Pendant.
- **Depends on:** Session 28.
- **Size:** large (substantial content authoring; possibly splits into 29a/29b if it overflows one session).
- **Notes:** This is a content session, not an engine session. The pattern should be mechanical: each item maps to a known engine capability shipped in earlier clusters. Where an item needs a status that doesn't exist (Shell), author the status alongside the first item that uses it.

### Session 30 — Cluster 5: Procs / drains

- **Goal:** Land the proc and drain mechanisms so weapon-driven secondary effects can ship.
- **Engine work:**
  - **Item 4: spell-cast riders on weapons.** Generalize the reaction-compiler to fire `use_ability` from `onDamageDealt` against the attacker's hooks. New effect shape `{ kind: 'attack_proc', chance: number, abilityId: AbilityId }` on equipment items. Per-action seed sub-stream for the proc roll. Existing chain-depth + reaction caps cover safety.
  - **Item 9: damage-to-MP-drain conversion.** New `onFinalDamage` hook (post-finalize, emission-only). New `system_mp_drain` action type with payload `{ source, target, amount }` and a reducer branch (floor at 0, cap at attacker's max MP using Cluster 4's maxMp).
- **Content:** none.
- **UI:** none.
- **Out of scope:** Authoring proc/drain items (Session 31).
- **Depends on:** Session 28 (Item 9 needs maxMp).
- **Size:** medium.
- **Notes:** none.

### Session 31 — Equipment authoring batch B (procs/drains)

- **Goal:** Author the items that depend on Cluster 5.
- **Engine work:** none.
- **Content:**
  - **Bolt Hammer.** Lightning-tagged sword swing + spell-cast rider firing a Lightning ability on hit at configured chance.
  - **Flametongue Burn proc.** Fire-tagged sword swing + Burn application via attack_proc rider (alternative shape from Smolder, since this fires on attacker rather than target).
  - **Rasp Pendant.** Damage-to-MP-drain accessory using Item 9's hook.
  - All declared with `availability: 'available'`.
- **UI:** none.
- **Out of scope:** Map mechanics (Session 32). Pre-battle UI (Phase E).
- **Depends on:** Session 30.
- **Size:** small-to-medium.
- **Notes:** **Equipment-complete milestone.** End of this session, the equipment doc is shipped end-to-end barring any items that emerge from playtest as needing rework.

---

## Phase D — Map mechanics & River Ridge

Goal: ship the map-side engine substrate and author River Ridge as the first real combat map.

### Session 32 — Cluster 6: Map mechanics + deployment-phase logged actions

- **Goal:** Add jump-over-water, verify knockback-into-water, reroute pre-battle equipment auto-status through the reducer, and add a pre-battle setup pass to the orchestrator.
- **Engine work:**
  - **Item 15: jump-over-water pathfinding.** During Dijkstra expansion, generate four cardinal two-step leaps where the intermediate tile is water and the destination is land. Each leap costs 2 move points. Cost-structure soft cap (no path-state tracking required) per the design call.
  - **Item 16: knockback-into-water verification.** Add an integration test asserting the ridge-elev-7-into-shallow-water case lands the unit on water at elev 1 with `dropDistance = 6` and the correct system_damage entry.
  - **Item 17: pre-battle equipment auto-status as logged actions.** Reroute `applyEquipmentStatusGrants` to enqueue `system_apply_status` actions through `commitAction` rather than direct state mutation. New payload field `source: 'pre_battle_equipment'` extension. Action log captures the initial state from sequence 0 forward.
  - **Orchestrator pre-battle setup pass.** New phase between `createInitialState` and the first turn: orchestrator runs the pre-battle action sequence (auto-statuses, initial CT rolls if those also move to the reducer) before turn 0 fires. CLAUDE ground rule 3 alignment.
- **Content:** none.
- **UI:** none.
- **Out of scope:** Authoring River Ridge (Session 33).
- **Depends on:** Session 31 (or any Phase C session — strictly only blocked by Cluster 1).
- **Size:** medium-to-large (Item 17's snowball and the orchestrator change are the unknowns).
- **Notes:** Per the design call, initial CT randomization (Cluster 2's Item 13) may want to also run through the reducer here as a `system_set_ct` action. If so, fold that in; if not, document why it stays as direct state mutation.

### Session 33 — River Ridge map authoring

- **Goal:** Author River Ridge per `river-ridge.md` and validate via integration test.
- **Engine work:** none.
- **Content:**
  - **River Ridge map.** 14×14 grid per the spec. Western lane: river (deep + shallow water). Central ridge: elevation 2-9 with the elev-9 perch on the east. Northern and southern deployment zones (using the deploymentZone tile field). All tile properties set explicitly.
- **UI:** none.
- **Out of scope:** Pre-battle UI surfaces.
- **Depends on:** Session 32.
- **Size:** small-to-medium.
- **Notes:** Until pre-battle UI ships (Sessions 35-37), River Ridge is reachable via hand-authored `BattleConfig` in `demo.ts` (alongside or replacing the Training Field config). Battle UI loads it the same way.

---

## Phase E — Pre-battle UI & full demo

Goal: complete the pre-battle UI surface — title screen, battle setup, team builder, deployment phase — and ship sample team templates.

### Session 34 — Title screen + battle setup screen

- **Goal:** First half of the pre-battle UI flow. Player sees a title screen and can select a battle / opponent / map.
- **Engine work:** none.
- **Content:** none.
- **UI:**
  - **Title screen.** Game title, "New Battle" / "Continue" / "Settings" / "Quit" actions. Wired to the React app router.
  - **Battle setup screen.** Map picker (Training Field / River Ridge), opponent picker (AI / hot-seat for v1), team-build toggle (sample team / build my own — the latter routes to team builder once Session 36 ships).
  - Wires the Phase A "next battle / back to title" results-screen stubs to real navigation.
- **Out of scope:** Team builder UI. Deployment phase UI.
- **Depends on:** Phase A complete.
- **Size:** medium.
- **Notes:** Once this session ships, the loading-from-`demo.ts` workflow becomes optional; players load battles from the menu instead.

### Session 35 — Deployment phase UI

- **Goal:** Player places units on the map's deployment zones, sets facing, sees pre-battle equipment auto-status preview.
- **Engine work:** none (Cluster 6 covered the substrate).
- **Content:** none.
- **UI:**
  - Deployment-zone rendering (tile highlights based on `deploymentZone` field).
  - Drag/drop unit placement with validation (one per tile, within own zone).
  - Per-unit facing selector.
  - Pre-battle status preview panel showing each unit's auto-statuses (from equipment) before battle commits.
  - "Commit deployment" button that runs validation and transitions to battle.
- **Out of scope:** Team builder. AI deployment for AI-controlled teams (defer to a small post-Phase-E session if needed; AI default behavior is "place all units in the most aggressive forward row" or similar simple heuristic).
- **Depends on:** Sessions 32, 34.
- **Size:** medium-to-large.
- **Notes:** **Deferred wiring** — when Session 36 ships team builder, the deployment phase consumes team builder's output (the assembled team) as its input.

### Session 36 — Team builder UI

- **Goal:** Player composes a 4-class team with equipment, R/S/M loadout, Brave/Faith adjustments. Validation enforces uniqueness and capacity rules.
- **Engine work:** none.
- **Content:** none.
- **UI:**
  - **Team list panel.** Four slots; each shows the unit being built.
  - **Class picker.** Available classes (no duplicates per team rule).
  - **Equipment picker per slot.** Filtered by `availability: 'available'` and the class's allowed equipment slots and any `classRestriction` on items.
  - **R/S/M loadout panel.** Bucket capacity display (with capacity modifications from equipped Steel Helm / Augmentor / Magus Crown shown). Drag/drop or click-to-equip. Validation prevents over-cap.
  - **Brave/Faith sliders.** Per-unit, range 40-90.
  - **Validate-and-commit button.** Runs full team validation; transitions to deployment phase.
  - **AI random fill** (for player-vs-AI): generates a valid AI team using availability-filtered content.
- **Out of scope:** Sample team templates as inputs (Session 38).
- **Depends on:** Session 25 (availability field consumed here), Session 35 (deployment phase consumes team-builder output).
- **Size:** large.
- **Notes:** The team builder is the most complex single UI surface. Splitting into 36a/36b may make sense if it overflows.

### Session 37 — Pre-battle UI integration polish

- **Goal:** Smooth out the title → battle setup → team builder → deployment → battle → results flow. Address any rough edges discovered during integration.
- **Engine work:** likely none (would surface issues in earlier sessions otherwise).
- **Content:** none.
- **UI:** Polish and bugfix pass on the full pre-battle flow. Animation transitions between screens. State preservation when navigating back. Save/restore of in-progress team builds.
- **Out of scope:** Sample team templates (Session 38).
- **Depends on:** Sessions 34, 35, 36.
- **Size:** medium.
- **Notes:** This session is a "pull it together" pass; estimated size assumes the prior sessions land cleanly. If they don't, this absorbs the slop.

### Session 38 — Sample team templates

- **Goal:** Three pre-built team templates available in the team builder, each exercising distinct equipment + ability combinations as worked examples.
- **Engine work:** none.
- **Content:**
  - **"Aggro Knight Squad."** Knight + Earth + Fire + Lightning, offensive equipment loadouts. Showcases Knight's Battle Skill + Mage burst.
  - **"Mage Variety Pack."** Earth + Water + Fire + Lightning, status-spread builds. Showcases the elemental matrix without a Knight anchor.
  - **"Defensive Front."** Knight + Earth + Water + Fire (or similar), control / sustain equipment loadouts. Showcases bulwark + regen + status-application play.
- **UI:** Template picker integrated into team builder's "build my own" entry point ("Start from template" / "Start blank").
- **Out of scope:** Additional templates beyond the three. Balance tuning.
- **Depends on:** Session 36 (team builder consumes templates), Session 31 (equipment-complete so templates can reference final items).
- **Size:** small-to-medium.
- **Notes:** **Full demo milestone.** End of this session, the demo is end-to-end shippable: title → setup → team build (template or scratch) → deployment → battle → results.

---

## Phase F — Polish, balance, post-MVP work

Goal: empirical tuning and feature additions based on playtest of the full demo.

### Session 39+ — Open

- **Open items from the spec:**
  - **Brave 70 reaction trigger feel.** Empirical tuning question. May want to revisit per-class Brave defaults if reactions feel too unreliable.
  - **Storm Caller AI scoring.** Verify the SELF_COST_DAMPING_FACTOR still suppresses Storm Caller appropriately given the new HP / damage scale; may need adjusting.
  - **E2 absorption path.** Once equipment can push resistance > 100 in practice, decide whether to lift the `composeResistance` cap and light up ADR-0020 absorption.
  - **E3 pa_factor unused.** Implement on first content demand; not currently blocking.
  - **E8 TS strict-mode test errors.** Cleanup pass when convenient.
- **Future content:**
  - Additional maps beyond Training Field and River Ridge.
  - Additional classes (Priest as the future Cure owner; possibly Monk or Archer).
  - Two-handed weapons (deferred from equipment doc).
  - Dual-wield (gated behind unlock ability per equipment doc).
  - Replay-from-log scrubbing (referenced but deferred from Battle UI).
  - Save/load battle states.

### Open design questions for after the full demo ships

- **Class progression / unlock system.** The team builder ships in v1 with all classes available immediately. Does v2 introduce class unlocks?
- **Permadeath vs. revive systems.** Currently no revive; a downed unit stays out for the battle. Deliberate or to revisit?
- **Multi-battle session structure.** A series of battles with persistent unit progression is hinted at by the architecture but not implemented.

---

## Summary

| Phase | Sessions | Endpoint |
|---|---|---|
| A — Battle-loop MVP | 21-24 | Playable battle from hand-authored teams |
| B — Substrate & content cleanup | 25-26 | Availability tag, four new movement abilities |
| C — Equipment expansion | 27-31 | Equipment doc shipped (less procs/drains, then with) |
| D — Maps & River Ridge | 32-33 | River Ridge playable |
| E — Pre-battle UI | 34-38 | Full demo: title → setup → team build → deployment → battle → results, with sample teams |
| F — Polish | 39+ | Empirical tuning, post-MVP work |

**~18 sessions to full demo, with playable MVP at Session 24.**

Sequential ordering throughout; no parallelization assumed. Each session's Notes call out deferred-wiring points so the Phase A battle UI doesn't need refactoring when Phase E surfaces ship — the `BattleConfig` contract stays stable, the loader changes.
