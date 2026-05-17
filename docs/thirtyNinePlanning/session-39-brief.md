# Session 39 Brief: Alchemist Class + KO Recovery / Permadeath Timer

## Context

Phase E closed at S38 with the demo in playtest. S39 opens Phase F's first content expansion: introduce the **Alchemist**, a second physical class that doubles as the game's healing solution via a prepare-then-throw item economy. The class fantasy is a battlefield logistician / field medic; the tactical identity is a resource manager that banks consumables on lower-pressure turns (often opening turns spent on positioning anyway) and releases them on demand. The Alchemist's action economy is fundamentally different from the existing classes — Compound builds the stockpile, Throw Item draws from it, and the value proposition is in deciding *when* to spend the action turn to prep vs. to deliver.

Two engine prerequisites ride along because Alchemist mechanics force them onto the agenda:

1. **KO recovery flow.** Phoenix Down revives a KO'd unit. The engine currently doesn't exercise KO recovery; whatever's in place needs auditing and likely extension.
2. **Permadeath timer.** Per-unit "turns KO'd" accumulator that permanently removes a unit after N turns of being KO'd. Previously deferred (in Session 24 Wave 1 carry per the S30 watch-list); the Phoenix Down revival path makes it concrete, so it lands here.

Scope is **Large**. Possible 39a/39b split if architectural audits surface surprises; natural seams identified below.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — S38 handoff. Most relevant items: TS strict-mode pile workaround in `vercel.json`, three sample templates exercising Knight + Mage roster, "real healer high-priority" note from S38 plan-review.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Phase F framing.
4. **`core-types.md`**, **`action-resolution.md`**, **`ct-system.md`** — engine model the new actions plug into.
5. **`ability-slots.md`**, **`ability-format-spec.md`** — class skill structure (Command Set, Reaction, Support, Movement).
6. **`status-effects.md`** — status taxonomy + KO modeling + status tags (Remedy needs the "negatively-tagged" predicate).
7. **`four-mages-design.md`** — reference for how an existing class is structured.
8. **`mage-war-equipment.md`** — Universal-set inventory for armor + weapons (Alchemist's v1 equipment compatibility).
9. **`glossary.md`** — terminology.

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/content/classes/` — existing class definitions (Knight, four Mages) as templates.
- `src/content/abilities/` — Command Set / Reaction / Support / Movement definition shapes.
- `src/engine/state/` (or wherever per-unit state lives) — the natural extension point for stockpile state.
- `src/engine/actions/` — action type registry + reducers (where Compound + Throw Item slot in).
- `src/engine/lifecycle/` (or equivalent) — KO state, turn queue, end-of-battle conditions; the path that needs extension for KO recovery and permadeath timer.
- `src/engine/items/` (or equivalent) — existing item / consumable substrate, if any.
- `src/ai/` — heuristics shape for adding Alchemist behaviors.
- `src/ui/` — action menu, target selection, unit detail panel, action-log — for Compound submenu, stockpile display, permadeath countdown badge.
- `src/content/teams/` — for adding an Alchemist-anchored sample template.

## Goal

End state:

**Class:**
- **Alchemist** selectable in team builder. Stats per design notes (Level 25: 126 HP / 36 MP / 8 PA / 5 MA / Move 4 / Jump 3 / Evades 6-4-0). Universal armor / helm / accessory / weapons (D1, D2 below). Native Command Set with Compound + Throw Item. Native Reaction (PA Up on enemy hit). Native Movement (HP heal = move²). Native Support (Field Kit; starting stockpile).

**Action economy:**
- **Compound** — adds 1 of a selected item to the unit's stockpile, costs MP per item type, 100% accuracy, self-targeted (stockpile is per-unit).
- **Throw Item** — consumes 1 from stockpile, applies effect to target, 3 horizontal × 3 vertical range with LoS, 100% accuracy.

**Items (4):**

| Item | Effect | Compound MP |
|---|---|---|
| Potion | Restore PA × 12 HP | 8 |
| Phoenix Down | Remove KO; restore PA × 4 HP | 12 |
| Remedy | Remove all negatively-tagged statuses | 6 |
| Ether | Restore PA × 4 MP | 10 |

**Engine prerequisites:**
- KO recovery — a KO'd unit can be revived via Phoenix Down, re-entering the turn queue per existing CT rules.
- Permadeath timer — per-unit turns-KO'd counter; reaches threshold → permanent removal; reset on revival.

**Quality:**
- Tests at 1180+ (rough estimate; +40-60 new tests across new mechanics).
- ADRs written for: permadeath timer (substantive); KO recovery semantics (if audit reveals non-trivial extension); Compound action pattern (only if the submenu architecture lands as new engine surface).
- `docs/handoff.md` updated.
- Playtest observations captured in `docs/playtest-watch.md` (a real healer in the mix will shift balance reads).

## Pre-implementation plan (required)

Same audit-first discipline as previous sessions.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it. Particularly important for:

- The action-type registry + reducer path (Compound + Throw Item slot in)
- Per-unit state shape (where stockpile lives, how it serializes, how it survives turn transitions)
- The KO lifecycle (current behavior of KO'd units in the turn queue, current end-of-battle conditions — does KO'd ever convert to "removed," is there a recovery code path at all?)
- Ability-slot conventions (Reaction trigger conditions, Movement ability hooks, Support equip mechanics + cross-class cost)
- Action-menu UI pattern (does any existing ability use a submenu / second-step selection? if not, the Compound submenu is new UI surface)

### Architectural decisions

After the audit:

1. **Single Compound action with item submenu vs. four distinct Compound actions.** Chris's preference is the cleaner single-action-with-submenu pattern (relevant to a future rebalanced Calculator class which will likely require linked-menu structures). State:
   - Whether the existing ability/action system supports a submenu / sub-selection pattern, or whether single-Compound-with-submenu requires new engine surface (action definition that branches on a sub-selection at runtime).
   - If new surface is needed, scope the implementation. Recommended path: land it in S39 since Calculator and other planned classes will reuse it.
   - **Fallback if scope is too large:** four distinct Compound actions (Compound: Potion, Compound: Phoenix Down, Compound: Remedy, Compound: Ether). Works without new engine surface; generates ability-bloat and a wider Command Set; ugly but functional.

2. **Per-unit stockpile state shape.** State:
   - Where in the per-unit state structure stockpile lives (alongside `statuses`, `chargedActions`, or wherever ephemeral battle state is held).
   - Shape: `Record<ItemId, number>` or equivalent multiset. Items not in the map are 0.
   - Serialization for snapshot / save state (per existing per-unit state conventions).
   - Mutation paths: Compound increments by 1; Throw Item decrements by 1.
   - Initialization: empty by default; populated by Field Kit support at battle start (`{ potion: 1, phoenix_down: 1, remedy: 1 }`).
   - Reset on new battle (do not persist across battles in campaign mode — though campaign mode isn't here yet, design accordingly).

3. **KO recovery flow.** State:
   - Current behavior: when a unit is KO'd, what state are they in? Do they remain on the map at their KO location? Do they still appear in the turn queue (presumably no, since they have 0 HP and 0 CT progression)? Does the engine currently have any code path that transitions KO'd → active?
   - Required behavior: a KO'd unit targeted by Phoenix Down returns to active state. HP is restored to PA × 4 (capped at max). KO status removed. Unit re-enters the turn queue at appropriate CT (audit: does CT reset, resume, or initialize at 0 on revival? Recommend: resume from 0 — feels right narratively and limits revival from being a near-instant-action).
   - Edge case: can a KO'd unit be targeted by Throw Item with other items (Potion, Remedy, Ether)? Recommend: yes, but the items fizzle or have no effect (KO'd unit's HP/MP/status state is gated). Phoenix Down is the only revival path. Simpler than gating selection.

4. **Permadeath timer.** State:
   - Per-unit `turnsKOd: number` counter (or equivalent name) in per-unit state.
   - Tick behavior: incremented at the start of each owning-team turn while the unit is KO'd. (Alternative: incremented per full round. The owning-team-turn cadence matches FFT's typical permadeath flow and is easier to reason about.)
   - Threshold: **3** recommended (per D5 below). Tunable per-battle / per-unit if needed.
   - Reset behavior: revival sets the counter back to 0.
   - End condition: counter reaches threshold → unit permanently removed for rest of battle. Removed unit cannot be revived (Phoenix Down on a permadead unit fizzles).
   - **ADR-worthy**: this is a real design decision with downstream UI + end-condition implications. Recommend a new ADR.

5. **"Negatively-tagged statuses" predicate for Remedy.** State:
   - Audit the existing status-effect tag system. Does each status carry a polarity tag, or is polarity inferred from name/effect?
   - Confirm which statuses are "negatively-tagged": Poison, Sleep, Silence, Slow, Stop, Confusion, etc. — the canonical FFT-like debuffs.
   - Confirm which are *not* negatively-tagged: Regen, Protect, Shell, Haste, etc.
   - Edge case: KO status. Recommend: not removable by Remedy (Phoenix Down is the only KO-removal). The "negatively-tagged" predicate should exclude KO explicitly or by virtue of KO being a structural rather than tagged status.

### Decision points

(Settled in plan-review before code lands.)

**D1. Armor compatibility for v1.** Design notes have a mild tension: item 1 references letting the Alchemist wear "some of the Knight-exclusive armor" as the rationale for shorter throw range; item 12 limits v1 to Universal sets only. Reading: Universal armor is the v1 constraint with Knight-armor access on the trajectory but not yet. **Recommend: Universal armor / helm / accessory for v1.** Knight-exclusive access can land in a future content expansion alongside other balance reads.

**D2. Weapon compatibility for v1.** Not specified in design notes. **Recommend: Universal weapons for v1**, with the weapon audit confirming which weapons are tagged Universal. If the Universal weapon set is sparse, consider expanding to include Knight-shared weapons (short swords, etc.) as a small content add this session.

**D3. Reaction proc gating.** Chris flagged with "?". **Recommend: enemy-hit only.** Otherwise ally-cast effects (heals, buffs that count as "hits") could proc the reaction, which feels off both mechanically and narratively. Tag the trigger as "hit by an enemy action" — definition of "hit" matches existing Reaction conventions.

**D4. Reaction duration and stacking.** Not specified. **Recommend: +1 PA for 3 turns, refreshes on re-trigger (does not stack).** Calibrate the +1 magnitude / 3-turn duration against existing PA buff conventions in the audit; adjust if existing PA buffs (if any) use different magnitudes.

**D5. Movement heal trigger.** **Recommend: intentional movement only** (movement initiated by the unit's own action turn). Forced movement (knockback, pull) does not count. Heal applies once per turn at end-of-movement, formula = (tiles moved)², capped at max HP.

**D6. Permadeath threshold.** **Recommend: 3 turns KO'd → permadeath.** Tunable. Three turns gives enough window for the team to mount a revival without being so long it removes meaningful threat.

**D7. Throw Item action classification — instant vs. standard.** Chris's framing in design discussion: "instant action." **Recommend: Throw Item is the unit's action that turn, resolves without charge delay** (instant in the "no CT delay between selection and effect" sense, not in the "free additional action that doesn't consume the turn" sense). Per Chris's own framing: "the price is paid in time and proximity, not in chance" — implying time *is* paid, i.e., the action turn is consumed. Audit existing instant-action conventions to confirm the right classification.

**D8. Field Kit cross-class cost.** Design notes specify cost 1 to equip cross-class. **Confirm:** cost 1 is consistent with existing Support cost conventions (audit the Support cost ladder; there are multiple cost tiers).

**D9. Class name.** Working name "Alchemist." Other candidates: Chemist (FFT-canon), Field Medic (military), Apothecary (mystical-practical). **Recommend: settle in plan-review** based on which lands best for Mage War's Gariland Academy framing. Final name affects file names, class IDs, and Ivalician-flavored class display. (Chris noted "TBD" in the design conversation.)

## Implementation work

### Class definition

- Add `alchemist` class (or final name per D9) to the class registry. File path: `src/content/classes/alchemist.ts` (audit current convention).
- Stats per design notes.
- Equipment compatibility per D1, D2.
- Native Command Set: contains Compound + Throw Item.
- Native Reaction, Movement, Support per below.

### New action types

**Compound:**
- CT cost: standard action turn.
- Range: self.
- Accuracy: 100%.
- MP cost: per item (8 / 12 / 6 / 10 for Potion / Phoenix Down / Remedy / Ether).
- Effect: select item type (via submenu per audit outcome); pay MP cost; increment stockpile by 1 for that item.
- Gated by sufficient MP for the selected item.

**Throw Item (instant resolution, normal action turn):**
- CT cost: standard action turn (per D7).
- Range: 3 horizontal × 3 vertical with LoS.
- Accuracy: 100%.
- Effect: select target (any unit in range, including self and allies; KO'd units selectable for Phoenix Down per audit on whether other items can target KO'd); select item from stockpile (submenu pattern per audit, or distinct actions per fallback); consume 1 of selected item; apply effect.
- Gated by ≥1 of the relevant item in stockpile.

### Item definitions

Per the table in Goal. Notes:
- HP / MP restores cap at max (per existing heal conventions, ADR-0074: engine-reported absolutes, no UI arithmetic on magnitudes).
- Phoenix Down: removes KO status, then heals PA × 4 HP. Revived unit re-enters turn queue per audit outcome on CT.
- Remedy: removes all "negatively-tagged" statuses per the predicate in architectural decision 5.
- Ether: MP restore caps at max MP.

### Engine prerequisites

**KO recovery flow** (per architectural decision 3):
- Phoenix Down on a KO'd unit triggers revival path.
- Revived unit's HP, KO status, turn queue position handled per audit.
- Permadeath counter reset on revival.

**Permadeath timer** (per architectural decision 4):
- Per-unit `turnsKOd` counter.
- Increment at start of owning-team turn while KO'd.
- Threshold (3 per D6) → permanent removal.
- Reset on revival.
- UI: countdown badge on KO'd unit (number remaining + visual differentiation from "KO'd, recoverable" baseline).

### Reaction: PA Up on enemy hit

- Trigger: unit hit by an enemy action (definition of "hit" per audit on existing Reaction conventions).
- Effect: self +1 PA for 3 turns (per D4); refreshes duration on re-trigger; does not stack.
- Equippable on Alchemist natively + cross-class per existing Reaction conventions (cost TBD if not already standard).

### Movement: HP heal = move²

- Trigger: end of intentional movement on unit's own turn (per D5).
- Effect: restore HP = (tiles moved this turn)², capped at max HP.
- Equippable on Alchemist natively + cross-class.
- Name TBD (suggestions: "Battlefield Vigor," "Field Recovery," "Wanderer's Mend" — settle in plan-review or pass to implementer for class-flavor matching).

### Support: Field Kit

- Effect: unit begins battle with stockpile of `{ potion: 1, phoenix_down: 1, remedy: 1 }`.
- Native to Alchemist (free on primary class).
- Cost 1 for cross-class equip (per D8 confirmation).

### AI handling

Minimal v1:
- When stockpile is empty or all items at 0 count: use Compound to produce the most-needed item (priority order: Phoenix Down if any ally KO'd, Potion if any ally below 50% HP, otherwise Remedy or Potion for stockpiling).
- When stockpile has items: use Throw Item to (a) revive KO'd ally if Phoenix Down available, (b) heal ally below 50% HP if Potion available, (c) cleanse negatively-statused ally if Remedy available.
- Defer sophisticated tactical use (banking items for high-value moments, predicting damage spikes, etc.) to a future tactics-layer pass.

### UI surfaces

- **Compound submenu** (or distinct action buttons per audit outcome). Submenu UX: action button → second-step item selector listing each item with current stockpile count + MP cost; gated by sufficient MP.
- **Throw Item target + item selector.** Target picker showing in-range tiles (3 horizontal × 3 vertical with LoS); item picker (submenu or per-action variants) listing each item with current stockpile count.
- **Stockpile display in unit detail panel.** Show `{item: count}` for the selected unit; visible to both players.
- **Permadeath countdown badge** on KO'd unit's roster card / battlefield marker. Numeric badge (e.g., "2" with two turns to permadeath); visual differentiation (color shift?) from baseline KO'd state.
- **Action log** entries for Compound (e.g., "Beowulf prepared a Potion") and Throw Item (e.g., "Beowulf threw a Potion at Marach for 96 HP").

### Sample team template

Add a new template featuring the Alchemist — natural fit for the existing roster:
- "Field Hospital" or similar — Alchemist + Knight + 2 Mages, balanced toward survival.
- Or update one of the existing three templates (Defensive Front's healing-via-Earth-Spells-on-Knight stopgap is the obvious candidate for retrofit — replace the Knight's Earth Spells secondary with an Alchemist).
- Decide in plan-review. Naming follows the Ivalician pool established in S38.

### Tests

Estimated +40-60 tests across:
- Class registry: Alchemist selectable; stats / equipment correct.
- Compound: each item type adds to stockpile; MP costs deducted; gated by MP.
- Throw Item: each item applies correct effect; range / LoS enforced; stockpile decremented; gated by stockpile.
- Phoenix Down: revives KO'd; heals non-KO'd; HP capped; permadeath counter reset.
- Remedy: clears negatively-tagged statuses; positive/neutral statuses unaffected; KO unaffected.
- Ether: MP restored; cap respected.
- Stockpile state: serialization; cross-turn persistence; battle-start reset; Field Kit initialization.
- KO recovery: revived unit re-enters turn queue with correct CT.
- Permadeath timer: increments per owning-team turn; threshold removes unit; resets on revival.
- Reaction: triggers on enemy hit; doesn't trigger on ally action; PA Up applied with correct duration; refreshes vs. stacks.
- Movement heal: formula correct across move distances; intentional-only gating; HP cap.
- Support: starting stockpile applied for Alchemist primary and cross-class equippers; not applied without Field Kit.

## Acceptance criteria

**Class:**
- Alchemist selectable in team builder with correct stats and equipment compatibility.
- Compound submenu (or fallback actions) functional; produces items at correct MP costs.
- Throw Item delivers correct effects at correct range/LoS, 100% accuracy.

**Items:**
- Potion / Phoenix Down / Remedy / Ether all functional per spec.
- Phoenix Down revives KO'd units; revived units re-enter turn queue.

**Engine prerequisites:**
- KO recovery path exercised end-to-end.
- Permadeath timer ticks correctly; KO'd unit permanently removed at threshold; revival resets counter.

**Abilities:**
- Reaction triggers on enemy hit only; correct duration / refresh.
- Movement heal applies (tiles moved)² HP at end of intentional movement.
- Field Kit gives starting stockpile to Alchemist primary and cross-class equippers.

**Quality:**
- Tests at 1180+, 0 failing.
- ADR(s) written for permadeath timer (substantive); KO recovery if audit reveals non-trivial extension; Compound submenu pattern if it lands as new engine surface.
- `docs/handoff.md` updated.
- Browser verification: drive an Alchemist through a battle, exercise Compound + Throw + Phoenix-Down revival + permadeath threshold reached.

## Out of scope

- **Knight-exclusive armor access for Alchemist** (D1 trajectory; not v1).
- **Additional items** (Hi-Potion, Holy Water, Elixir, etc.) — v1 ships with four.
- **Buff/debuff items** — deferred per design notes; future content expansion.
- **Sophisticated Alchemist AI tactics** (banking, prediction, prep timing).
- **Calculator class submenu pattern groundwork** — Compound submenu lands the surface; Calculator's own implementation is a future session.
- **Stockpile cap** — Chris confirmed not needed for v1.
- **Alchemist sprite / animations** — existing universal-class sprite or placeholder per current convention.
- **TS strict-mode pile cleanup** (S34 carry) — separate future session.
- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — deferred per S39 direction discussion.
- **River Ridge balance tuning from S38 templates** — separate playtest-driven session; informed by playtest signal as it accumulates.
- **All other long-running carries** not explicitly named above.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Content:**
- `src/content/classes/alchemist.ts` (new) — class definition.
- `src/content/abilities/` (additions) — Command Set, Reaction, Movement, Support definitions for Alchemist.
- `src/content/items/` (new or extended) — Potion / Phoenix Down / Remedy / Ether definitions.
- `src/content/teams/` — new or updated sample template featuring Alchemist.

**Engine:**
- `src/engine/state/` — per-unit stockpile state field.
- `src/engine/actions/` — Compound + Throw Item action types and reducers.
- `src/engine/lifecycle/` (or equivalent) — KO recovery path; permadeath timer tick.
- `src/engine/abilities/` — Reaction trigger conditions, Movement hook integration.

**UI:**
- `src/ui/action-menu.tsx` (or equivalent) — Compound submenu UX.
- `src/ui/target-selector.tsx` (or equivalent) — range/LoS overlay for Throw Item; item picker.
- `src/ui/unit-detail-panel.tsx` — stockpile display.
- `src/ui/roster.tsx` (or battlefield rendering) — permadeath countdown badge.
- `src/ui/action-log.tsx` (or equivalent) — Compound + Throw Item log entries.

**AI:**
- `src/ai/` — Alchemist heuristics.

**Tests:**
- Test files mirroring each above.

**Docs:**
- `docs/decisions/` — new ADR for permadeath timer (substantive); possibly KO recovery; possibly Compound submenu pattern.
- `docs/handoff.md` — updated at session close.
- `docs/playtest-watch.md` — append Alchemist-related observations to watch.
- `docs/playtest-scenarios.md` — append Alchemist-specific scenarios if any natural test cases surface during implementation.

## Workflow notes

- **Plaintext-first review required.** Same discipline as previous sessions.
- **Audit-first within the plan.** Particularly important for KO recovery (engine path may or may not exist), per-unit state extension (stockpile shape), and the Compound submenu pattern (new UI surface or extension of existing).
- **ADR path is `docs/decisions/`**. New ADR(s) per acceptance criteria.
- **Substrate before content where order matters.** The engine prerequisites (KO recovery, permadeath timer, stockpile state) should be in place before the Alchemist content uses them; tests can be authored in either order, but content-driven testing of revival requires the recovery path live.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: submenu pattern vs. distinct actions if audit reveals submenu requires significant new engine surface; final name for the class (D9); permadeath counter tick cadence if owning-team-turn doesn't read clean against current turn structure.
- **Phase F session** — capture playtest observations in `docs/playtest-watch.md`. A real healer in the mix will shift balance reads from S38 templates; expect new entries.

## Watch-fors

**Addressed this session:**
- Real healer class (S38 plan-review carry; high priority).
- Permadeath timer (S24 Wave 1 carry; tracked in long-term watch list across many sessions).
- KO recovery flow (implicit prerequisite; not previously a named carry).

**Not addressed this session, longer-term carry-forward (selected; see prior handoffs for full list):**
- TS strict-mode error pile (S34 carry; `vercel.json` works around).
- Pass-and-play toggle + dual deployment + battle-loop AI gating (dedicated future session).
- Cross-class command set picker UX (S38 watch).
- Lightning Mage default loadout's hidden `[white_magic]` secondary (S38 watch).
- Gender / zodiac field implementation (S38 decision 13A; deferred).
- Knight-exclusive armor access for Alchemist (S39 D1 trajectory).
- Additional items (Hi-Potion, etc.); buff/debuff items (S39 out-of-scope).
- Sophisticated Alchemist AI tactics (S39 out-of-scope).
- Calculator class (future content expansion; will reuse Compound submenu pattern).
- All prior long-running carries documented in S38 handoff.

**Watch-fors specific to this session:**
- **Stockpile reset on new battle.** Confirm stockpile reinitializes correctly on battle start; doesn't retain across battles.
- **Phoenix Down on full-HP target.** Confirm targets KO'd or non-KO'd, applies revival + heal or just heal as appropriate; HP cap respected.
- **Permadeath visibility.** UI must clearly distinguish "KO'd, recoverable" from "KO'd, permadeath imminent." Color shift + numeric badge.
- **Reaction stacking semantics.** If Alchemist is hit multiple times in one enemy action sequence (chain reactions, multi-hit abilities), confirm refresh-vs-stack matches D4.
- **AI sequencing.** Alchemist AI on turn 1 with full starting stockpile shouldn't waste the turn on Compound; should engage tactically.
- **Movement heal × movement-modifier statuses.** If Slow or another modifier reduces tiles moved, the heal scales with actual movement, not intended movement.
- **Movement heal × Boots of Haste / Sorcerer's Robe Move +1.** Square scaling makes Move-boosting equipment dramatically more valuable on the Alchemist than on other classes. Watch for emergent imbalance; flag for `playtest-watch.md`.
- **Ether MP cost vs. restore.** 10 MP cost, 32 MP restored (at 8 PA) = net +22 MP per cycle. Self-cycle is non-exploit (action turn cost) but worth confirming the loop reads correctly.

## Estimated size

**Large.** Class + four abilities + four items + new state shape + two engine prerequisites + UI surfaces + tests is heavy for a single session. Possible 39a/39b split candidate; flag in plan-review if architectural audits surface surprises (especially around submenu pattern, KO recovery path, or per-unit state extension).

Natural seams if split is needed:

**Option A — substrate / content split:**
- **39a:** Engine prerequisites (KO recovery, permadeath timer) + stockpile state shape + Compound + Throw Item action types + item definitions. No Alchemist class yet; items exercisable via test fixtures.
- **39b:** Alchemist class definition + Reaction / Movement / Support abilities + AI + UI surfaces + sample template.

**Option B — class-without-revival / revival split:**
- **39a:** Alchemist class + Compound + Throw Item + Potion/Remedy/Ether + stockpile state + Reaction/Movement/Support. Phoenix Down deferred; class is playable for non-revival use.
- **39b:** KO recovery + permadeath timer + Phoenix Down activation.

**Recommendation:** prefer Option A if audits reveal the engine prereqs are substantial; prefer Option B if the Alchemist content is well-bounded but KO recovery turns out to be a deep extension. Plan-review settles based on audit findings.
