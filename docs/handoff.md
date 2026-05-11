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

## From session 2026-05-10 / 2026-05-11 (Session 24 — Battle UI MVP + first wave of playtest fixes)

Session ran in two waves on the same calendar block: the original Session 24 plate (forecast / projection column / results / MVP polish) shipped first, then Chris playtested it and a same-session fix wave addressed twelve specific observations. The roadmap's MVP empirical-check point is now post-this-session.

### MVP-readiness summary

End-to-end playable on Training Field with full MVP polish + post-playtest refinements:

- Player drives `team_a` through the turn-flow state machine; `team_b` runs on basic AI.
- Bottom-region action menu shows Move / Attack (universal) / Act / End turn / Status. Per-option CT annotations: Move and Attack show their CT cost; Act shows the appropriate command-set's bucket cost; End turn shows the dynamically-projected leftover CT given current consumption. Status opens the unit detail panel for the active unit.
- Target-select hovers populate (a) a compact cursor-following tooltip with per-tile damage + status preview and (b) a fixed-slot forecast panel with damage range (min/expected/max), per-status chance, MP delta, end-of-turn CT, and — for charged abilities — a Timing subsection (ticksToResolve + ✓/✗ pass-fail vs. target's next turn).
- QueueTower shows the full 20-event horizon with mouse-wheel scroll, ordered with the nearest event directly above the active anchor and further events extending upward. Charged-action mini-cards show "{caster} → {target}." Hover mini-card pulses the unit on canvas; click opens detail panel.
- Action log streams entries; click any row to expand for outcome detail; hover any row to pulse actor + targets on canvas. `[ko]` rows interleave at lethal-damage sequence points and attribute the killer. Charged-action resolve rows now name the spell + caster ("Brunhilde's Earth Quake resolves on Sparky → 47 dmg") instead of the raw chargedActionId.
- Canvas unit click in IDLE / action-menu opens the unit detail panel (third entry point per design doc; was deferred in initial Session 24).
- Universal Attack — added to every class's `freeAbilities`; surfaces as a top-level action menu button when the active unit has it. Direct target-select; cancel returns to action-menu.
- WAIT-CONFIRM facing-pick — End turn opens a cardinal-direction picker; choosing a direction commits `set_facing` + endTurn. Defaults highlight the unit's current facing.
- Wait-cost semantics — engine and UI agree that end-of-turn cost = consumed-bucket cost. The waited flag no longer overrides; Wait is the universal "end turn" trigger with bucket-based cost. The standalone `ctCosts.wait` (20 default) applies only when literally nothing was consumed.
- Elemental wheel content shipped — each Mage class carries baseline resistances (Water +50 Fire / -50 Lightning; Lightning +50 Water / -50 Earth; Earth +50 Lightning / -50 Fire; Fire +50 Earth / -50 Water) via the new `ClassDefinition.baselineResistances` field merged into unit.resistances at createInitialState. `composeResistance` updated to skip missing tags rather than default them to 0, so weakness values aren't masked by the implicit 0 of dispatch-only tags (`magical` etc.).
- HP bars now update visibly — animator generalized to handle charged-action resolves, AoE multi-target damage, and system_damage / system_heal (all of which previously left snapshots stale).
- KO visual — KO'd units render at alpha 0.4 with a bright red ✕ overlay across the unit body so the "this unit is down" signal reads at a glance.
- Battle end transitions to results screen: winner, MVP unit (highest damage dealt, lexically tie-broken), per-unit stats table (KO markers for KO'd units), KO timeline with killer attribution. Rematch/New Battle/Main Menu buttons disabled-with-tooltip per ADR-0044; Close dismisses the modal.

### Wave 1 (Session 24 core) — landed first

**Engine:**

1. `src/engine/damage/handlers.ts` — extracted `readCritChance(env, attacker)` helper performing the ADR-0034 clamp once for both live `critRoll` and the projection's `projectionCritRoll`. ADR-0042.

2. `src/engine/status/chance.ts` — extracted pure `computeStatusChance(args)` from `rollStatusChance`. Re-exported via `src/engine/status/index.ts`.

3. `src/engine/forecast/` — new module. `damage-range.ts`, `status-chance.ts`, `ct-preview.ts`, `aoe-preview.ts` + barrel. 15 unit tests. ADR-0042.

4. `src/ai/projection.ts` — line-142 duplicate clamp removed; `readCritChance` consumed via `@engine/damage/index.ts`. Imports routed through engine sub-barrels to break a module cycle once `engine/index.ts` re-exports `forecast/`.

**UI:**

5. `src/ui/derived-events.ts` — `deriveKoEvents`, `derivePerUnitStats`, `deriveActionParticipants`. 9 unit tests. Charged-action attribution via chargedActionId backref. ADR-0043.

6. `src/ui/forecast-compose.ts` + `forecast-panel.tsx` + `forecast-tooltip.tsx` — fixed bottom-right panel + cursor-following tooltip.

7. `src/ui/unit-detail-panel.tsx` — Tier 3 modal-ish side panel with Stats / Active Statuses / Resistances / Loadout / Equipment sections.

8. `src/ui/results-screen.tsx` — modal overlay with winner, MVP, per-unit stats, KO timeline. ADR-0044.

9. `src/ui/action-log-format.ts` + panel — `[ko]` interleaving, participants per row, click-to-expand, hover-counterpart hooks.

10. `src/ui/queue-tower.tsx` — 20-event horizon with scroll, hover-on-mini-card → canvas pulse, click → unit detail.

11. `src/ui/action-menu.tsx` — end-CT annotations on Move/Act/Wait, Status button activated.

12. `src/ui/battle-hud.tsx` — bottom region split into action menu + forecast panel slots.

13. `src/ui/use-turn-flow.ts` — forecast + cursorScreen exposed; mouse-move listener during target-select.

14. `src/ui/index.ts` — exports added.

**Renderer:**

15. `src/renderer/unit-layer.ts` — `counterpart` channel for hover-counterpart pulse.

16. `src/renderer/battle-renderer.ts` — `setCounterpartUnits` API.

**App / wiring:**

17. `src/app/BattleView.tsx` — refit. `ResultsScreen` replaces the prior `WinOverlay`; `ForecastTooltip` mounts during target-select; `UnitDetailPanel` mounts on detail click.

**Architecture records (wave 1):** ADR-0042 (forecast pipeline), ADR-0043 (derived events), ADR-0044 (results screen), ADR-0045 (projection column + hover-counterpart).

### Wave 2 (post-playtest fixes) — Chris played the wave-1 build, gave 12 observations; this batch addresses them

**Engine:**

1. `src/engine/damage/handlers.ts:composeResistance` — now skips tags missing from the target's resistance map. Pre-fix behavior: `target.resistances.get(tag) ?? 0` pushed an implicit 0 for dispatch tags like `magical`, and `signedMax([0, -50])` returned 0, masking the weakness. ADR-0015's intent ("designers store the resistances that apply to a unit") is preserved; only the implicit-zero behavior was wrong.

2. `src/engine/catalog/definitions/class-definition.ts` — new optional `baselineResistances` field on ClassDefinition. Merged into `unit.resistances` at `createInitialState` time before per-placement overrides. Pattern is open for future class-trait content.

3. `src/engine/actions/reducers.ts` — `reduceTurnEnd` no longer special-cases `consumed.waited` in the cost evaluation. Cost is now consumed-bucket-based universally; the standalone wait cost only fires when literally nothing was consumed. Wait becomes the user-facing "end turn" action with bucket-based cost.

4. `src/engine/forecast/ct-preview.ts:projectTurnEndCt` — mirrors the engine change. `plannedNext: 'wait'` no longer adds a waited flag; it just doesn't add to the consumed buckets.

5. `src/content/classes/*` — Water/Lightning/Earth/Fire Mage class files each gain `baselineResistances` per the elemental wheel call. Knight gains `attack` to its existing freeAbilities list.

6. `src/content/classes/water-mage.ts`, `lightning-mage.ts`, `earth-mage.ts`, `fire-mage.ts`, `knight.ts` — all 5 classes add `attack` to `freeAbilities` so the universal Attack button is class-uniform.

**UI:**

7. `src/ui/queue-tower.tsx` — removed `[...events].reverse()`; column-reverse alone now correctly stacks nearest at the bottom (just above the anchor) with further events extending upward. Charged-action mini-cards now show `{caster} → {target}` in the sublabel.

8. `src/ui/action-log-format.ts` — `charged_action_resolve` rows render with the spell name + caster ("Brunhilde's Earth Quake resolves on Sparky → 47 dmg") via a chargedContext lookup map (same backref pattern as derived-events).

9. `src/ui/unit-detail-panel.tsx` — Move/Jump rows now read through `runModifyStatQuery` so passives like `move_plus_1` are reflected in the displayed value. Earth Mage now shows Move: 4 (3 base + 1 from `move_plus_1`) matching the actual reachable-tile count.

10. `src/ui/action-menu.tsx` — top-level rewrite. Move/Attack/Act show absolute CT cost (`Move · 50 CT`). End turn (renamed from Wait) shows dynamic leftover CT (`End turn · CT after: 80`); decrements as actions are committed. Status button activates the unit detail panel. New top-level Attack button when active unit has `attack` in free abilities (all 5 classes in v1).

11. `src/ui/action-menu.tsx:WaitConfirm` — new cardinal-direction facing picker per design doc WAIT-CONFIRM. Default highlight on the unit's current facing. Commit fires `set_facing` (if changed) + `endTurn`.

12. `src/ui/turn-flow.ts` — state machine gains `wait-confirm` state and `pickFreeAbility` event. `target-select.commandSetId` and `await-confirm.commandSetId` are now `CommandSetId | null` so free abilities can flow through without a synthetic command set. Cancel from target-select with `commandSetId === null` returns to action-menu directly.

13. `src/ui/use-turn-flow.ts` — new `onInspectUnit` callback prop. Tile-click handler routes occupant clicks to the detail panel when in `idle` / `action-menu`. `submitWait(facing: Direction)` takes a facing arg, emits a `set_facing` action when the chosen facing differs, then `endTurn`.

14. `src/ui/forecast-compose.ts` — `ChargedTiming` field added to `Forecast`. Populated when ability.actionSpeed > 0. Estimates ticksToResolve from caster speed, counts events that fire first, and identifies the target's next turn in the projection.

15. `src/ui/forecast-panel.tsx` — Timing subsection renders when `chargedTiming !== null`. Includes the ✓/✗ pass-fail line vs. the target's next turn.

16. `src/app/BattleView.tsx` + `src/ui/turn-flow.test.ts` — wired the `onInspectUnit` route and added three new tests for the wait-confirm transitions.

**Renderer:**

17. `src/renderer/animator.ts` — generalized FlashAnim from single-target to multi-target. `use_ability` now applies HP changes for every per-target result (not just the first); added animation builders for `charged_action_resolve` (mirrors use_ability path), `system_damage`, and `system_heal`. HP bars now update visibly across all damage paths.

18. `src/renderer/unit-layer.ts` — added a `koMarker` Graphics layer that draws a red ✕ across the unit body when ko is true. Sits between body and HP bar. The alpha fade (KO_ALPHA = 0.4) remains.

19. `src/renderer/constants.ts` — `KO_X_COLOR`, `KO_X_WIDTH`, `KO_X_ALPHA` constants added.

**Tests:**

`npm test` final state: **651 passing across 57 files, 0 failing.** Up from 622/52 at session start. +29 from new forecast / derived-events / action-log-format tests + 3 new turn-flow tests for wait-confirm + 1 projection clamp test, minus -1 (rewritten commit.test.ts wait-cost expectation to match the new bucket logic).

### Limitations + watch-fors after wave 2

- **Forecast Timing approximation.** `estimateChargedTiming` computes ticksToResolve as `ceil(actionSpeed / casterSpeed)` — a reasonable estimate but not engine-exact (the engine uses `computeActionSpeed` at commit time which factors caster MA). For v1 this is close enough; deeper accuracy can land when the user reports the estimates as misleading. The "+ N events fire first" comparison against `projectUpcoming` is exact.

- **Forecast hover not visually exercised live by Chris this wave.** The wave-1 limitation (Water Mage starting out of range) carries forward. Wave-2's universal Attack changes that — the player can now Attack from melee range without needing a long-range spell. Chris's next playtest should exercise the forecast hover naturally.

- **Vite HMR cache invalidation under cross-file changes** — recurred during wave 2. PowerShell touch is the workaround. No fix needed; flag for the next session if it keeps biting.

- **MVP-unit metric is still strict highest-damage-dealt.** Designer call from wave 1: future task to add nuance. Carry-forward.

- **Permadeath timer not implemented.** Results screen still labels the section "KO Timeline." Carry-forward.

- **Settings expansion (animation speed default, log verbosity, camera follow, localStorage persistence) deferred.** Carry-forward from wave 1.

- **Reactions in QueueTower / projection column.** v1 has no scheduled-reaction queue. Watch for empirical impact.

- **The `consumed.waited` flag is now non-cost-determining but still recorded.** Action log can use it to distinguish "user explicitly ended turn" from "engine auto-ended." Worth a quick note in the action log formatter if a future content surface wants that distinction.

- **Lightning Mage's `quickstep` CT refund isn't visible yet.** The wave-1 design doc has it (`onTurnEnd` refund after Move); when Phase B's movement-ability authoring (Session 26) ships it, the action menu's End-turn projection will start showing the Lightning Mage's higher leftover CT vs. baseline. Currently the implementation isn't there; `bedrock_stride`, `hotfoot`, `tidewalker`, `quickstep` are all Phase B Session 26.

- **Top bar `Turn T####` is O(actionLog.length)** (Session 22 carry-forward).

- **Renderer's MP "max" captured at mount** (Session 22 carry-forward). Replaces with `maxMp` lookup once Session 28 (Cluster 4) ships.

- **Status-badge polarity convention** (`tags`-based vs `polarity?` field) (Session 22). No urgency.

- **rAF vs setInterval for animation-drain detection** (Session 23). Future-when-vsync-smoothness-matters.

- **AoE preview correctness across all shapes** (Session 23) — will be exercised under Chris's next playtest.

- **MP / status snapshot ahead-of-tween fix** (Session 22). Known limitation.

- **`docs/content-snapshot.md` drift** (Session 21 carry-forward). Refresh scheduled with Session 26 (movement abilities authoring).

- **Resistance composition cap at 100** (audit E2). Now that resistances actually bite, the cap is closer to being exercised. The Mage wheel tops out at ±50 individually, but stacked content (Wand of Depths + class baseline) could push past 100 in Phase C. Session 27 still the natural moment.

- **`pa_factor` `NotYetImplementedError`** (audit E3). No content asks.

- **`equipmentContributionsFor` "branch per hook"** (audit E4). Session 27.

- **TS strict-mode test errors** (audit E8). Not blocking.

- **Surrender flow deferred to Session 34** (ADR-0041).

- **Canvas-unit-click → unit detail panel** — landed this wave; only fires in `action-menu`/`idle` states. During target-select / move-select, canvas clicks remain action-bound. If a player wants to inspect a unit while picking a target, the QueueTower mini-card and the Status button still work. Watch for whether this gating feels right.

- **WAIT-CONFIRM facing picker shows 4 buttons.** Keyboard support (arrow keys → facing) would be a nice polish but isn't wired. Flag for next polish pass.

- **Engine's `consumed.waited` flag is now decorative.** It's still set when Wait commits, but the cost evaluation no longer reads it. Could be removed entirely from `TurnConsumption` in a cleanup pass; not load-bearing on anything that still reads it (I scanned the codebase, no other consumers). Flag for cleanup-style touch.

### Considered and rejected this session

**Wave 1 (recap):** ADR-0042/0043/0044/0045 alternatives. See those docs.

**Wave 2:**

- **Adding the universal Attack as a member of every class's primary command set** rather than as a free ability. Rejected — clutters the command-set ability list with an attack that mages won't typically use; the top-level button matches FFT convention better.

- **Synthesizing a "basic" command set auto-equipped on every class** for Attack. Rejected for the same reason — extra command-set tabs cluttering the menu.

- **Stamping `actorId` on `charged_action_resolve` engine-side** vs. the chargedContext-map backref in the formatter / derived-events. Same trade-off as wave 1: engine change has wider blast radius (replay tooling, AI projection); UI-side backref is contained. Wave 2 reuses the wave-1 pattern.

- **Changing the engine's `consumed.waited` flag to drive cost** (instead of removing it from the cost decision). The designer call was explicit that Wait should follow the consumed-bucket cost; the waited flag becomes informational.

- **Keeping `Wait` as the button label** vs. renaming to `End turn`. Renamed per the design call's framing ("Wait is the end-turn button").

- **Re-deriving moveRange display from `cls.movement.moveRange`** when passives modify it. Rejected — keeping the display in sync with the engine's actual reachable-tile count is load-bearing. The detail panel now calls `runModifyStatQuery` for both Move and Jump.

- **Showing absolute bucket cost for Move/Act** vs. incremental-over-baseline-wait. First wave 2 attempt was incremental ("Move CT cost 30" when actual moveOnly is 50); revised to absolute after recognizing the misleading framing. Move now reads "Move · 50 CT" — the resulting bucket cost if Move is the only action this turn.

- **Hiding the KO visual ✕ overlay** and relying on alpha alone. Per Chris's feedback ("nothing on the map indicating KO'd"), the ✕ cross-out lands.

### Items dropped from prior handoff

All wave-1 carry-forward items either landed in wave 2 or remain in the watch-fors above with current status.

---

### Empirical-questions checklist for Chris's next playtest

Wave 2 is more playable than wave 1. The next playtest should specifically attend to:

**Combat feel**
- [ ] Universal Attack readability — does the top-level button feel natural? Does its `· 50 CT` annotation read right alongside Move/Act?
- [ ] WAIT-CONFIRM facing pick — adds a click vs. instant End-turn. Worth the cost or annoying?
- [ ] Elemental wheel — Water Strike on Fire Mage now bites (×1.5 damage from -50 water resistance). Does that feel right at v1 baseline tuning?
- [ ] Reaction triggers — Brave 70 still in effect. Reactions firing ~70%.
- [ ] Storm Caller AI behavior — still on hold from wave 1.
- [ ] Fixed CT-0 starting tempo — still in effect.

**UI ergonomics**
- [ ] End turn CT annotation — "CT after: N" — load-bearing or noise?
- [ ] CT cost annotations on Move/Attack/Act — are the absolute numbers what the player needs, or would incremental costs be clearer?
- [ ] Forecast Timing subsection — the ✓/✗ pass-fail vs. target's next turn — does it answer "will my spell land before they move?"
- [ ] QueueTower mini-card target labels — `{caster} → {target}` — is this enough, or does the tooltip need to expand on it?
- [ ] Charged-resolve log entries — "Brunhilde's Earth Quake resolves on Sparky → 47 dmg" — readable?
- [ ] HP bar tween — visible damage now reads on the canvas.
- [ ] KO ✕ overlay — clear enough? Too loud?
- [ ] Canvas unit click → detail panel — three entry points (canvas / queue tower / status button) all converge as designed.

**Reflection / results**
- [ ] Results screen completeness — same as wave 1 question.
- [ ] MVP unit metric — same.
- [ ] KO timeline — same.

**Visual / pacing**
- [ ] AoE preview correctness across all shapes — exercise universally now that Attack lets you melee.
- [ ] Animation pacing — same as wave 1.

**Items still deferred to designer or future session**
- [ ] Reactions in projection column (wave 1 carry-forward)
- [ ] Permadeath timer + visual treatment (wave 1 carry-forward)
- [ ] Settings expansion (wave 1 carry-forward)
- [ ] Lightning Mage's quickstep refund — visible only after Phase B Session 26
- [ ] MVP-unit smarter algorithm (wave 1 carry-forward)
- [ ] Mini-timeline for charged-action Timing subsection — current is `ticksToResolve + events-before-resolve` count; the design doc's full mini-timeline view with surrounding events isn't rendered (the data is computed). Add if Chris reports the current annotation isn't enough.
