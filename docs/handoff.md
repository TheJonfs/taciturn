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

## From Session 39a (2026-05-17) — Alchemist substrate

**1176 tests passing across 106 files** (up from 1152 / 105 at session start; +24 in the new `session-39a-integration.test.ts`). S39a is engine-only — no UI surfaces touch revival / permadeath / stockpiles yet; **S39b lands the Alchemist class, R/S/M abilities, AI heuristics, action-menu submenu, target-selector UI, stockpile display, permadeath badge, and the sample team template**.

### What S39a shipped

**Engine surface (substrate):**
- **`Unit` state extensions:** `stockpile: ReadonlyMap<ItemId, number>`, `turnsKOd: number`, `removed: boolean`. All required; `makeUnit` factory + `createInitialState` default them.
- **`ConsumableDefinition`** as a `kind: 'consumable'` variant of `ItemDefinition`. Discrete effect spec (`hpRestore` / `mpRestore` / `removeKO` / `clearStatuses`). Four v1 items registered: Potion / Phoenix Down / Remedy / Ether. ADR-0077.
- **Two new player action kinds:** `use_compound` (self-targeted, MP-gated, +1 stockpile) and `use_throw_item` (range 3h × 3v with LoS, target-anchored, applies item effects).
- **KO recovery:** Phoenix Down revives a KO'd target (HP=1 baseline + PA × 4 heal, `turnsKOd` reset, CT reset to 0). Cannot revive a `removed` unit.
- **Permadeath timer:** scheduler ticks KO'd units' virtual CT alongside everyone else; at trigger threshold, emits `system_ko_tick` → reducer increments `turnsKOd` and resets CT → at ruleset threshold (default 3), queues `system_unit_removed`. Per Chris's S39 D6 call: per-virtual-would-have-been-turn cadence, scaled to the KO'd unit's Speed. ADR-0076.
- **`system_mp_restore` primitive** parallel to `system_heal`. ADR-0074 absolutes preserved (`mpAfter` on outcome). First v1 consumer is Ether.
- **`removed` flag propagation:** `unitAt` skips removed units (pathfinding + AoE + tile inspection automatically treat their tile as empty), `validateUseThrowItem` rejects removed targets, `projectUpcoming` skips them from the queue tower.
- **Ruleset extension:** `permadeath: { threshold: number }`. Default 3; test fixture accepts override.

**ADRs written:**
- [ADR-0076](docs/decisions/0076-permadeath-timer-and-removed-units.md) — permadeath timer + `removed` unit state.
- [ADR-0077](docs/decisions/0077-consumable-items-and-mp-restore-primitive.md) — consumable items catalog kind + MP-restore primitive.

### Engine operational changes the next session should know about

- **`reduceUseCompound` / `reduceUseThrowItem` consume the actor's Act** via the shared `decrementActBudget` helper (same as `reduceUseAbility`). No reactions trigger from either action — items aren't damage-tagged and don't enter the `onActionTargeted` chain.
- **`isEquipment(item: ItemDefinition): item is EquipmentDefinition`** and **`isConsumable`** predicates exported from `src/engine/items/`. Use these to narrow the widened `ItemDefinition` union before reading equipment-only fields (`bucketCapacityMods`, `classRestrictions`, etc.). Equipment paths inside the engine (`iterateEquippedItems`, `readSlotAsWeapon`) filter consumables defensively and narrow their yield type back to `EquipmentDefinition`.
- **`THROW_ITEM_RANGE`** constant in `src/engine/actions/validate.ts` — hardcoded 3h × 3v for all v1 consumables. A future item with longer/shorter reach would need a per-item field on `ConsumableDefinition`; the constant is the seam.
- **Scheduler third entity kind: `'ko_unit'`.** KO'd-but-not-removed units accumulate virtual CT via the same `computeSpeed` path as living units; their winner fires `system_ko_tick` instead of `turn_start`. Removed units are filtered out entirely. At exactly-equal CT, the comparator prefers `'unit'` over `'ko_unit'` so a real turn beats a bookkeeping tick.

### Suggested scope for S39b

The substrate is testable and tests pass. S39b is the content + UI layer:

**Class:**
- Alchemist class in `src/content/classes/alchemist.ts`. Stats per brief: Level 25 → 126 HP / 36 MP / 8 PA / 5 MA / Move 4 / Jump 3 / Evades 6-4-0. Universal armor/helm/accessory/weapons (D1, D2 per brief).
- Reaction passive: PA Up on enemy hit (+1 PA, 3 turns, refresh-on-trigger per D4).
- Movement passive: HP heal = (tiles moved)² at end of intentional movement (per D5).
- Support passive: Field Kit — battle-start stockpile of `{ potion: 1, phoenix_down: 1, remedy: 1 }`. Cross-class cost 1 (D8).

**UI:**
- **Action-menu submenu** — new FSM state for Compound's item-pick step (action button → item selector listing each item with current stockpile count + MP cost). Throw Item also needs a new step (target first, then item picker per planner's recommendation). Genuinely new surface; pattern Calculator will reuse later.
- **Stockpile display in unit detail panel** — show `{item: count}` for the selected unit.
- **Permadeath countdown badge** on KO'd unit's roster card / battlefield marker — read `unit.turnsKOd` vs. `ruleset.permadeath.threshold`. Color-shift the badge when imminent (e.g., turnsKOd === threshold - 1).
- **Action log entries** for `use_compound`, `use_throw_item`, `system_ko_tick`, `system_unit_removed`. The action-log format files in `src/ui/action-log-format.ts` need new branches.

**AI:**
- Minimal v1 per brief: stockpile-aware compound choice (Phoenix Down if any ally KO'd, Potion at <50% HP ally, otherwise stockpile-build). Throw-Item priority: revive KO'd > heal <50% HP ally > cleanse > stockpile.
- Use the existing `targetsUnit` helper pattern from `src/ai/basic.ts` for the new action kinds.

**Sample team:**
- Retrofit Defensive Front (replace the Knight's Earth-Spells secondary stopgap with the Alchemist's Field Kit) OR add a new "Field Hospital" template. Planner recommended the retrofit — it cleanly demonstrates the real healer solving the stopgap.

### Things noticed but not acted on (low-priority watchpoints)

- **Speed-scaled permadeath cadence game-feel.** Threshold 3 + per-virtual-turn means a Speed-12 unit (no v1 class hits this, but Boots of Haste on a Speed-10 caster does) effectively dies 1.5× faster than a Speed-8 one. Playtest read: does this feel right for fast classes, or punish them disproportionately? Knob to tune first is the ruleset threshold, not the cadence model. Capture in `docs/playtest-watch.md` once the Alchemist is in play.
- **Removed unit's position.** A removed unit's `position` field is preserved (action-log historical references), but `unitAt` skips them so their tile is empty. No FFT-style crystal/treasure leftover for v1. Out of scope this session; possible future content add.
- **No reactions fire on Throw Item.** Items aren't damage-tagged so `onActionTargeted` doesn't engage. If a future item is offensive (acid, debuff bomb), this design needs revisiting — but the v1 four items are all helper/healing so it's correct today.
- **Consumable detail rendering** (`formatConsumableDetail` in `src/ui/detail-text.ts`) is a minimal stub. When S39b adds the action-menu submenu, the tooltip / detail panel will surface consumable info — the stub is enough for now but should be reviewed alongside the submenu UI.
- **Compound submenu architectural seam.** Chris's preference was the single-action-with-submenu pattern (S39 plan-review, decision 1). The substrate doesn't lock this in — `use_compound` is one action with an `itemId` payload, so the UI surface can be either "one button + sub-step" or "four buttons each pre-binding itemId" without engine changes. Submenu is the right call (per the brief and the Calculator argument), but the engine isn't in the way of the fallback either.

### Considered and rejected this session

- **Per-ally-turn-start permadeath cadence.** Planner's initial recommendation: uniform 3-ally-turns revival window regardless of who KO'd. Chris picked per-virtual-would-have-been-turn instead. Rationale: closer FFT-canonical feel, "your fast units die faster" reads right tactically.
- **Items as `availability: 'hidden'` abilities.** Would have reused the ability pipeline. Rejected — conflates "thing thrown" with "thing castable" and forces every item to carry irrelevant ability fields. ADR-0077.
- **Damage-pipeline `'mp_restore'` tag** parallel to `'healing'`. Reuses variance/resistance/cap stages. Rejected — items deliberately bypass the pipeline; flat-coefficient is the design. ADR-0077.
- **Per-item throw range on `ConsumableDefinition`.** All four v1 items share 3h × 3v range. Hardcoded as `THROW_ITEM_RANGE` constant; per-item field can land when a consumer ships.
- **`system_ko_tick` + `system_unit_removed` as a single combined action.** Splitting them makes the action-log lines clear (tick-counter advancing vs. terminal removal) and matches the action-log readability discipline.

### Longer-term carry-forward (mostly unchanged from prior handoff)

- **TS strict-mode errors (~200) — S34 carry.** `vercel.json` works around with `vite build` instead of `npm run build`. S39a's typecheck pass shows 0 new errors introduced (230 total, same as session start).
- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session.
- **AI deployment logic / random-fill** — Red still uses authored placements.
- **Full battle → results → continuity-button loop manual playtest** — S34 carry; bears another pass once Alchemist is in.
- **Spiked Mail / Tricorn / Crusader's Helm / Light-Dark Robe playtest reads** — S37 items; in `docs/playtest-watch.md`.
- **Bedrock Stride real-knockback playtest, Tidewalker tempo, Purifier × Burn readability, Magus Crown calibration, Tintinibar Regen calibration, Sorcerer's Robe Move +1** — all still in `docs/playtest-watch.md`.
- **Status duration rebalance signals** (S38-fixes carry) — watch how 3/4/6/10 numbers play.
- **Main Menu transition lag root cause** (S38-fixes carry) — masked by `TransitionOverlay`; not diagnosed. Profile when convenient.
- **Fire Embrace target-rejection mystery** (S38 playtest) — dev-mode `[targeting] reject` console.debug will log next occurrence.
- **Per-target "resolves before / after" forecast for AoE** (S38-fixes carry) — picker fix landed; only one per-cast line shows. Worth considering if AoE timing strategy becomes important.
- **Gender / zodiac field implementation** (Decision 13A) — state shape extensible; lands when needed.
- **Knight-exclusive armor access for Alchemist** (S39 D1 trajectory) — Universal-only for v1.
- **Additional consumables (Hi-Potion, Holy Water, Elixir)** — out of scope per S39 brief; pure content adds in a future session.
- **Buff/debuff consumables** — deferred per S39 design notes; would need an `applyStatus` field on `ConsumableEffects`.
- **Sophisticated Alchemist AI tactics** (banking, prediction, prep timing) — out of scope; v1 reactive heuristics in S39b.
- **Calculator class** — future expansion; will reuse Compound submenu UX pattern, may reuse stockpile-as-engine-state.

---
