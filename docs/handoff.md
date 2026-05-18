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

## From Session 39 close (2026-05-17) — Alchemist class shipped end-to-end

S39 was split into 39a (substrate) and 39b (content + UI). Both shipped in this session. **1183 tests passing across 107 files** (up from 1152 / 105 at session start; +31 net). Two commits: `b249907` (S39a substrate) and S39b (this commit).

### What's playable now

- **Alchemist class** selectable in the team builder. Stats per brief (L25 baseline 126 HP / 36 MP / 8 PA / 5 MA / Move 4 / Jump 3 / Evades 6-4-0).
- **Compound + Throw Item** action economy via the new `alchemy` command set. Player flow: Act → Alchemy → Compound (item picker, MP-gated) OR Throw Item (target picker → item picker, range 3h × 3v).
- **Four items**: Potion (PA × 12 HP), Phoenix Down (revive + PA × 4 HP), Remedy (clear debuffs), Ether (PA × 4 MP).
- **R/S/M passives**:
  - Combat Focus (Reaction) — +1 PA for 3 turns on enemy hit (REFRESH).
  - Field Recovery (Movement) — heal tiles² HP at end of intentional Move.
  - Field Kit (Support) — battle-start stockpile of `{ potion: 1, phoenix_down: 1, remedy: 1 }`. Free on Alchemist primary, cost 1 cross-class.
- **KO recovery** (Phoenix Down): HP=1 + heal layer + reset turnsKOd + reset CT to 0.
- **Permadeath timer**: KO'd unit's virtual CT ticks; at threshold (default 3) the unit is `removed`.
- **Defensive Front team retrofitted** — Halric (Knight) + Beorn (Alchemist) + Ysolde (Water Mage) + Auralia (Fire Mage). Replaces the S38 Earth-Spells stopgap with a real healer.

### Engine substrate additions (S39a + S39b)

| Component | S39a | S39b |
|---|---|---|
| `Unit` state fields | `stockpile`, `turnsKOd`, `removed` | — |
| Catalog kinds | `ConsumableDefinition` | — |
| Action kinds | `use_compound`, `use_throw_item`, `system_mp_restore`, `system_ko_tick`, `system_unit_removed` | — |
| Hooks | — | `onMoveCompleted` |
| Passive fields | — | `stockpileGrants` on `PassiveAbilityDefinition` |
| Ruleset fields | `permadeath: { threshold }` | — |
| System heal source | — | `'movement_passive'` discriminator |
| Scheduler | `ko_unit` entity kind for virtual-CT accumulation | — |

### Engine operational changes the next session should know about

- **Compound and Throw Item bypass the ability/reaction pipeline entirely.** No `onActionAttempted`, no `onActionTargeted`, no Counter / Reflect / Discharge / Combat Focus triggering. The brief flagged this as a watch-for: if a future content item is offensive (acid, debuff bomb), this design needs revisiting. The v1 four items are all helper/healing, so it's correct today.
- **`onMoveCompleted` fires once per committed Move action** against the mover's hooks, with `tilesMoved` count. Forced movement (knockback / pull) bypasses by virtue of not going through `reduceMove` — Field Recovery's "intentional only" gate is structural. First v1 consumer is Field Recovery (Alchemist Movement); future move-trigger content reuses the hook.
- **`stockpileGrants` on `PassiveAbilityDefinition`** populates `unit.stockpile` at `createInitialState` time. Cross-class equippers receive the grant; no class gate. Items referenced must be consumables — non-consumable ids in the field cause silent skip at runtime (caught at runtime via the catalog lookup; no compile-time enforcement).
- **`compound` and `throw_item` are detected by ability id** in the UI router (`src/ui/use-turn-flow.ts → abilityRoute`). Their `ActiveAbilityDefinition` shells exist mostly for Command-Set membership; their targeting / mpCost / actionSpeed fields are placeholders the UI ignores. The actual action emission is `use_compound` / `use_throw_item`, not `use_ability`.
- **The action-menu FSM gained two states**: `compound-item-select` and `throw-item-item-select`. Both reach `animation` directly via `pickItem` (no `await-confirm` — the item picker IS the confirm surface). The `throw-item-item-select` state caches the picked target id; cancel returns to `target-select` for re-pick.
- **Permadeath countdown UI lives on the unit-detail panel** rather than as a battlefield overlay. Players see the counter when they click a KO'd unit. If playtest reads "I need it visible without clicking," a renderer-side badge is a small follow-on.

### ADRs from S39a

- [ADR-0076](docs/decisions/0076-permadeath-timer-and-removed-units.md) — permadeath timer + `removed` state.
- [ADR-0077](docs/decisions/0077-consumable-items-and-mp-restore-primitive.md) — consumable items catalog kind + MP-restore primitive.

(No new ADR for S39b — the brief flagged it as "ADR if Compound submenu lands as new engine surface." It did, but it's UI-layer (FSM state additions), not engine. The compound/throw_item action kinds were ADR-0077 territory.)

### Browser verification (S39b)

- Game loads cleanly with no console errors.
- Alchemist class shows in the team-builder picker.
- Defensive Front template loads with Beorn the Alchemist, stats compute correctly post-equipment (256 HP / 36 MP / 10 PA / 6 MA / 9 SPD with Battle Gear + Lookout's Hood + Diamond Bracelet + War Axe).
- The HMR loop is clean (no module-graph errors after the S39b additions).
- **Manual playtest item — not automated:** canvas-deployment click-through, then in-battle exercise of Compound → Throw Item → KO an ally → Phoenix Down revival → permadeath threshold reached. The flows are exhaustively unit-tested (the substrate covers each step independently); a full click-through is the next playtest's job.

### Things noticed but not acted on (next-session candidates)

- **Throw Item's "is this useful?" gating is in the picker, not in the click handler.** The throw-target click validates range + LoS + removed-target, but doesn't check "does the picked target have a debuff that Remedy could clear?" The item picker disables items that aren't useful (Phoenix Down on a non-KO'd target is gated), but the picker only shows after the target click. If players misclick a target, they pay an extra click to cancel out. Worth observing in playtest — may be fine, may want pre-target gating.
- **Stockpile cap absent (per S39 out-of-scope).** Players can Compound the same item arbitrarily many times. Probably fine for a 4v4 battle that lasts 20-30 actions, but worth flagging if a long-battle scenario emerges.
- **Permadeath badge is panel-only.** Player must click the KO'd unit to see the counter. A renderer-side number overlay is the natural follow-on if playtest shows the panel-only model is too easy to miss.
- **Ether MP cost vs. restore math** (S39 watch-for) — 10 MP to Compound, 32 MP restored at PA 8 = net +22 MP per self-cycle. Not exploitable (action turn cost), but worth observing whether players cycle Alchemist Ether → Alchemist's own MP → Compound Ether repeat. Probably fine; flag if it surfaces in playtest.
- **`UnitPlacement` could carry `initialStockpile`** for hand-authored scenarios that want a unit to enter battle with a non-Field-Kit stockpile (e.g., a hard-mode enemy Alchemist starts with 3 Potions + 1 Phoenix Down). Out of scope for S39; small extension when a consumer ships.
- **Compound's MP gate could compose with a "double-MP cost" debuff** (none in v1). The cost is read directly from `item.compoundMpCost` without the `modifyMpCost` hook chain — that chain is ability-specific. If a future status wants to penalize Compound, the substrate needs to plumb compound MP through the chain.
- **Cross-class Alchemy availability.** Compound and Throw Item are members of the `alchemy` command set, which can be equipped cross-class as a secondary. A Knight equipping Alchemy gets Compound + Throw Item; with Field Kit (cost 1) they also get the starting stockpile. The brief implies this is intended ("Cross-class equippers also receive the grant"); worth confirming the play experience reads OK once it's tested.
- **Movement HP heal × Move-boosting equipment** (S39 watch-for) — square scaling makes Boots of Haste / Sorcerer's Robe Move +1 dramatically more valuable on the Alchemist. Boots of Haste-equipped Alchemist with Move 5 heals 25 HP per move turn (vs. 16 baseline). Flag for `playtest-watch.md` once playtest data accumulates.

### Considered and rejected this session

- **Per-ally-turn-start permadeath cadence.** S39a — Chris picked per-virtual-turn instead. (See ADR-0076.)
- **Items as `'hidden'` abilities.** S39a — would have reused the ability pipeline but conflated semantics. (See ADR-0077.)
- **Dedicated `compound` and `throw_item` `TargetingSpec` kinds.** Considered for engine purity (ability shells would declare their UI behavior). Rejected — UI detection by ability id is leaner and doesn't pollute the engine's targeting types with UI concerns. The ability shells stay as `targeting: 'self'` / `targeting: 'single_unit'` placeholders.
- **`await-confirm` after the item pick.** Rejected — the item picker IS the confirm surface. The player explicitly chose this item with MP cost / stockpile count / target all visible; an additional Confirm row is redundant. Existing target-select abilities still flow through await-confirm per the user's settings preference.
- **Renderer-side permadeath badge on KO'd unit sprites.** Deferred — panel-only badge is a smaller scope and gets the information surfaced. Renderer overlay is a polish session if playtest demands it.

### Longer-term carry-forward (mostly unchanged)

- **TS strict-mode errors (~230) — S34 carry.** `vercel.json` works around. S39's typecheck pass shows ~0 new errors introduced (counts hold steady).
- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session.
- **AI deployment logic / random-fill** — Red still uses authored placements.
- **Full battle → results → continuity-button loop manual playtest** — S34 carry; should be re-run with Alchemist in the mix.
- **Knight-exclusive armor access for Alchemist** (S39 D1 trajectory) — Universal-only for v1.
- **Additional consumables (Hi-Potion, Holy Water, Elixir)** — pure content adds in a future session.
- **Buff/debuff consumables** — deferred; would need an `applyStatus` field on `ConsumableEffects`.
- **Sophisticated Alchemist AI tactics** (banking, prediction, prep timing) — out of scope; v1 reactive heuristics shipped.
- **Calculator class** — future expansion; will reuse Compound submenu UX pattern. The substrate (per-unit stockpile, item-picker FSM states) generalizes if Calculator's spells are modeled similarly.
- **Spiked Mail / Tricorn / Crusader's Helm / Light-Dark Robe playtest reads** (S37 carry) — in `docs/playtest-watch.md`.
- **Bedrock Stride / Tidewalker / Purifier / Magus Crown / Tintinibar / Sorcerer's Robe calibration** (S37 carry) — all in `docs/playtest-watch.md`.
- **Status duration rebalance signals** (S38-fixes carry) — watch how 3/4/6/10 numbers play.
- **Main Menu transition lag root cause** (S38-fixes carry) — masked by `TransitionOverlay`; not diagnosed.
- **Fire Embrace target-rejection mystery** (S38 carry) — dev-mode log will catch next occurrence.
- **Per-target "resolves before / after" forecast for AoE** (S38 carry).
- **Gender / zodiac field implementation** (Decision 13A) — state shape extensible; lands when needed.

---
