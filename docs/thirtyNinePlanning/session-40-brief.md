# Session 40 Brief: Knife Weapon Class + Dynamic Variance + Name-Update Pass

## Context

S39 closed with Alchemist shipped end-to-end (1183 tests / 107 files). S40 opens with the first weapon-class expansion since equipment substrate landed: **knives**, with three v1 entries that serve current classes (Knight + Alchemist) while seeding the future speedy / dual-wield class space.

Knives introduce a new design dimension: **class-tagged weapon power.** Existing weapons gate by *access* (Mages can't equip swords) but perform uniformly within their access class. Knives instead vary in effectiveness *by attacker Speed* — a slow class wielding a knife produces lower damage; a fast class produces higher. The slot-cost remains the same; the value extracted differs by user. This sets up the future Ninja/Assassin class without committing to it now.

The three v1 knives form a tight set with distinct purposes:

- **Chef's Knife** — +1 PA, healing-flavored, perfect for Alchemist (Potion PA × 12 scales; Phoenix Down PA × 4 scales).
- **Magebane** — 50% on-hit Silence proc, serious anti-mage tool. Mages still make up 4/5 classes; Silence becomes a real angle of attack now that Remedy exists as the counter-tool. Status-effect warfare opens as a viable strategy axis.
- **Sai** — +1 Speed, self-compensates the variance penalty when a slow class wields it. Knight Speed 9 + Sai = Speed 10 → variance 1.0 (neutral) instead of 0.9. Brings its own scaling rather than requiring external Speed.

Plus a **name-update pass** on existing classes / command sets / abilities, conducted as an implementer-Chris discussion. Specific renames not pre-specified in the brief — settled in-session.

Scope: **medium.** Engine work centers on dynamic variance substrate; content is three knives plus a knife weapon class definition. The Magebane proc may or may not need substrate extension depending on what `attack_proc` currently supports.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions, including the ActionType-wiring discipline from S39 (lift to a durable doc if not done yet — flagged in S39 handoff).
2. **`docs/handoff.md`** — S39 handoff. Notable: `attack_proc` substrate exists from S30 Cluster-5 work (Bolt Hammer spell-cast, Flametongue Burn proc); compound/throw_item bypass reaction pipeline (unrelated to S40 but worth knowing).
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Phase F continued.
4. **`action-resolution.md`** — damage pipeline stages. Variance stage (stage 5) and its hook-contribution model are core to the dynamic-variance work.
5. **`docs/decisions/`** — particularly the Cluster-5-era ADRs covering `attack_proc` effect shape and reaction-compiler generalization (ADR-0056 and adjacent per S30 brief reference; implementer audits the actual numbers).
6. **`core-types.md`**, **`battle-mechanics-guide.md`** — weapon definition shape, equipment slots, attack resolution.
7. **`mage-war-equipment.md`** — existing weapon roster and stat-modifier precedents (Staff of Power +MA confirmed; Chef's Knife +PA from S39's Alchemist work — or did it land? confirm).
8. **`status-effects.md`** — Silence definition, status-tag system, duration conventions.
9. **`four-mages-design.md`**, **`glossary.md`** — class structure and terminology baselines for the name-update pass.

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/engine/damage/` (or wherever the damage pipeline lives) — variance stage implementation, hook-contribution shape at that stage.
- `src/engine/items/contributions.ts` (per S30 brief reference; confirm current path) — `attack_proc` contributor wiring; verify whether it supports `apply_status` effect or only `use_ability`-style spell-cast.
- `src/engine/actions/reducers.ts` — status-application path for Magebane's Silence. The Brave-based formula gate should be visible here or in a status-apply helper.
- `src/engine/status/` (or equivalent) — status-application math; specifically the Brave vs. Faith formula split.
- `src/content/items/` — existing weapon definitions for shape reference (Sword, Axe, Hammer, Staff entries).
- `src/content/items/weapon-classes/` or equivalent — how weapon classes are taxonomized (if at all currently).
- `src/ui/equipment-picker.tsx` and adjacent — equipment-picker UI for new weapon-class display.
- `src/content/classes/` — Knight + Alchemist equipment compatibility lists.

## Goal

End state:

**Content:**
- **Knife weapon class** defined as a weapon taxonomy entry, with variance computed dynamically from attacker Speed at action resolution time.
- **Three knives** equippable: Chef's Knife (WP 4, Acc 95, +1 PA), Magebane (WP 5, Acc 95, 50% Silence proc on hit), Sai (WP 4, Acc 95, +1 Speed).
- **Equipment compatibility** — Knight + Alchemist can equip knives. Mages may or may not depending on the existing Universal/class-restricted convention (audit).

**Engine substrate:**
- **Dynamic variance pipeline** — variance band can be computed from attacker context (Speed) rather than only from static weapon-definition values. Path: a hook at the variance stage (or contribution at the base stage that sets the variance context) that reads attacker Speed for knife-class weapons.
- **Status-application via attack_proc** (if not already supported) — Magebane's Silence proc fires through the same proc substrate as Flametongue's Burn (status-application), or adds a new proc-effect variant if Burn uses a different path.
- **Brave-based formula** confirmed in use for physical-trigger status application; gap closed if currently absent.

**Name-update pass:**
- Implementer-Chris discussion settles renames for existing classes, command sets, and abilities. Specific targets identified in-session, applied via display-name updates (ability ids and class ids preserved for save-state compatibility, per the S39 Combat Focus / Healthy Stride / Travel Preparations precedent).

**Quality:**
- Tests at 1210+ (rough estimate; +25-35 new tests across variance computation, proc behavior, three knife definitions, equipment compatibility).
- ADRs written for: dynamic variance substrate (if it's substantively new pipeline behavior); status-via-proc if substrate extension is needed. Knife class taxonomy probably doesn't need an ADR unless the audit reveals significant data-model implications.
- `docs/handoff.md` updated.
- Playtest observations folded into `docs/playtest-watch.md` as they accumulate.

## Pre-implementation plan (required)

Audit-first per project conventions.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it. Particularly important for:

- The variance stage of the damage pipeline (hook-contribution model, whether dynamic context is already a supported pattern, what shape a Speed-based variance contribution would take).
- `attack_proc` substrate — does it support a status-application effect, or only `use_ability` spell-cast? Flametongue's Burn proc is the closest existing analog. Burn is itself a status — confirm whether Flametongue applies Burn via direct status-apply through the proc, or via a spell-cast that itself applies Burn.
- The status-application math — Brave-based formula for physical-trigger statuses (e.g., Magebane's Silence proc) vs. Faith-based for spell-cast statuses. Confirm which paths exist; close the gap if Brave-based doesn't.
- Weapon-class taxonomy — does the equipment system currently model "weapon classes" (Sword, Axe, Hammer, Staff, Knife) as first-class entities, or are weapons untaxonomized with class-restriction handled per-weapon?

### Architectural decisions

After the audit:

1. **Dynamic variance substrate integration.** Two plausible paths:
   - **Hook at variance stage**: a hook handler reads attacker Speed when the variance stage fires and contributes a band override. Cleanest if the variance stage already supports band-replacement contributions; new contribution semantics needed if it only supports multiplicative/additive modifications.
   - **Schema-level variance source**: the weapon's variance field becomes a union `{min, max} | { source: 'attacker_speed', divisor: number }`. The damage pipeline resolves the source at action time before the roll.
   
   **Recommend hook-at-variance-stage** as the cleaner integration with existing patterns (the variance stage already supports hooks per `action-resolution.md` stage 5). Fallback is schema-source if the hook path requires more invasive plumbing.

2. **Status-application via `attack_proc`.** Audit's first job: does Flametongue's Burn proc fire through a path that supports status-application directly, or does Burn arrive via a spell-cast intermediate? Likely outcomes:
   - **Status-application already supported**: Magebane slots in cleanly; no new proc-effect variant.
   - **Only spell-cast supported**: add an `apply_status` proc-effect variant (parallel to the existing spell-cast variant). Magebane's Silence becomes the first consumer.
   - **Status-application currently arrives via a synthetic ability**: Flametongue procs `cast_burn` which is a 0-CT, 0-MP ability that applies Burn. Workable for Magebane (proc `cast_silence`) but the cleaner long-term path is direct status-apply. Note for design but don't force the refactor here unless trivial.

3. **Brave-based vs. Faith-based status formula confirmation.** State which formula(s) currently exist; if only Faith-based exists, the Brave-based path lands here (Magebane is the forcing function). Audit should also confirm whether the formula split is data-driven (status definition declares which gate to use) or code-driven (specific status types hardcoded to Brave/Faith).

4. **Knife weapon class taxonomy.** State whether the existing equipment system has a "weapon class" first-class concept or whether weapons are tagged ad-hoc. If first-class, add `'knife'` as a new entry alongside existing classes. If ad-hoc, propose how knife's Speed-based variance gates to knife-tagged weapons specifically (likely a `weaponClass` field on weapon definitions, or a tag-array approach).

### Decision points

(Settled in plan-review before code lands.)

**D1. Variance band shape for knives.** Two micro-options:
- **Fully fixed**: `{ min: Speed / 10, max: Speed / 10 }`. Damage is perfectly predictable for a given Speed. Variance roll is essentially a no-op.
- **Small shift**: `{ min: (Speed / 10) - 0.05, max: (Speed / 10) + 0.05 }`. Tiny variance band preserves the "every weapon has *some* roll" feel that the rest of the system has.

**Recommend small shift (±0.05).** Preserves system-wide consistency without changing the headline character of Speed-determined damage. Fully fixed is defensible if Chris prefers the cleaner mental model.

**D2. Magebane Silence proc trigger semantics.** Recommend:
- Fires on physical attack that **connects** (hits the target), not on miss.
- Fires **before damage finalize**, so the Silence application happens regardless of whether damage was reduced to 0 by defenses.
- Fires once per attack; not multi-procced by multi-hit abilities (if any apply here).
- Proc roll: 50% base × Brave gate × accuracy. Final chance lands in 25-40% range in practice.

**D3. Magebane Silence duration.** Not specified in design notes. Recommend: **4 turns**, matching the existing status-duration palette (3/4/6/10 per S38-fixes work). Silence is a high-impact debuff; 4 turns is enough to feel threatening without being decisive on a single proc.

**D4. Sai's +1 Speed application path.** Recommend: standard stat-modifier contribution at equip time (precedent: Staff of Power +MA, Chef's Knife +PA). Audit confirms whether stat modifiers on weapons compose correctly into the variance computation downstream — Sai's +1 Speed needs to flow through to the *knife's own variance* calculation, which means the Speed value used in variance must read post-equipment-modifier, not base.

**D5. Knife class equipability.** Recommend: Knight + Alchemist equippable in v1; Mages not (consistent with their current weapon-class restrictions to staves and similar). Audit which existing weapon classes Mages access; if Mages already access broader weapon types than expected, revisit.

**D6. Variance band for non-knife weapons.** For sanity: confirm existing weapons (Sword, Axe, Hammer, Staff) continue using their current static variance bands. Knives are the only class introducing dynamic variance in S40. Other weapon classes adopting dynamic variance is a future design choice, not S40 scope.

**D7. Magebane proc + AI behavior.** Recommend: AI heuristics consider Magebane's Silence proc when scoring targets — prioritize mage targets when an enemy unit equips Magebane. Minimal v1: add a "weapon-proc-vs-target" consideration if existing AI heuristics support it; defer sophisticated proc-aware tactics to future. If existing AI doesn't model weapon-procs-vs-targets, this is the first content forcing the question; flag as an audit item and decide in-session whether to land minimal AI awareness or defer to a tactics pass.

**D8. Name-update pass scope.** Implementer-Chris discussion settles specifics. Recommend the brief reserves time for the conversation but doesn't pre-specify targets. Display names update via the same pattern as S39's R/S/M renames (preserve ids for save-state compatibility).

## Implementation work

### Knife weapon class

- Add `knife` weapon class to the taxonomy (path per audit).
- Variance source: dynamic from attacker Speed (per architectural decision 1).
- Equipability: Knight, Alchemist (per D5).

### Three knives

| Weapon | WP | Acc | Modifiers / Effects |
|---|---|---|---|
| Chef's Knife | 4 | 95 | +1 PA |
| Magebane | 5 | 95 | 50% on-hit Silence proc, Brave-based formula |
| Sai | 4 | 95 | +1 Speed |

All three: weapon class `knife`; variance = Speed/10 ± 0.05 per D1.

### Engine substrate

**Dynamic variance** (per architectural decision 1):
- Variance contribution at action resolution time reads attacker Speed.
- Gated to knife-class weapons (other weapons retain their static bands per D6).
- Composes with stat-modifier equipment (Sai's +1 Speed must flow into the variance computation per D4).

**Status-application via attack_proc** (per architectural decision 2):
- Path varies by audit outcome. If new proc-effect variant needed, add `apply_status` alongside existing spell-cast variant.
- Magebane's Silence is the first consumer.

**Brave-based formula** (per architectural decision 3):
- Confirm presence; close gap if needed.
- Magebane's Silence application routes through Brave-based path.

**Knife weapon class taxonomy** (per architectural decision 4):
- Either first-class taxonomy entry or tag-based per audit.
- Equipment compatibility lists on Knight + Alchemist updated.

### Name-update pass

- Implementer-Chris in-session discussion identifies specific renames.
- Apply via display-name updates only; preserve underlying ids for save-state continuity (per S39 precedent).
- Touch: class display names, command-set display names, ability display names. Likely files: `src/content/classes/`, `src/content/abilities/`, possibly i18n / localization map if such a layer exists.
- Tests for renames are minimal (existing tests reference ids, not display names) but verify nothing's hardcoded against the old display strings.

### AI handling

Per D7. Minimal v1: weapon-proc-vs-target consideration in target-scoring heuristics if substrate supports; defer if not.

### Tests

Estimated +25-35 tests across:
- Knife variance computation at various attacker Speed values (Speed 5 → 0.5 variance, Speed 10 → 1.0, Speed 15 → 1.5).
- Sai's +1 Speed flowing into the wielder's variance computation (Knight Speed 9 + Sai = Speed 10 → variance 1.0).
- Magebane Silence proc:
  - Triggers on hit only (not on miss).
  - 50% base rate; Brave gate applied; final chance reads as expected at various Brave values.
  - Silence applied with correct duration per D3.
  - Doesn't trigger on non-physical-attack actions.
- Each knife: equipability on Knight + Alchemist; non-equipability on Mages (per D5); stat modifiers correctly applied.
- Brave-based formula path: status application through this path has correct math.
- Existing weapons unchanged: Sword/Axe/Hammer/Staff continue with their static variance bands (D6 sanity).

### UI surfaces

- Equipment picker: knives appear in the weapon picker for Knight + Alchemist; not for Mages.
- Unit detail panel: stat modifiers from Sai (+1 Speed) and Chef's Knife (+1 PA) render correctly.
- Variance display (if forecast panel shows variance ranges): updated to reflect dynamic variance for knives.
- Magebane proc indication: either in action log (post-fact) or in forecast panel (pre-fact). Recommend action log post-fact for v1; forecast pre-fact is a separate UX call.

## Acceptance criteria

**Content:**
- Three knives equippable by Knight + Alchemist with correct stats, accuracy, modifiers, and effects.
- Magebane Silence procs at expected rate; applies Silence for D3-specified duration.

**Substrate:**
- Knife-class weapons compute variance from attacker Speed at action resolution.
- Sai's +1 Speed correctly compounds into the wielder's variance (post-equipment Speed used).
- Status-application via attack_proc functional (whether pre-existing or newly added).
- Brave-based formula confirmed in use for physical-trigger status.

**Name updates:**
- Renames applied per the in-session discussion.
- Save-state compatibility preserved (no id changes).
- Tests reflect new display names where appropriate.

**Quality:**
- Tests at 1210+, 0 failing.
- ADRs written for substrate items that warrant them (dynamic variance pipeline if substantive; status-via-proc if new variant added).
- `docs/handoff.md` updated.
- Browser verification: Knight equipping each knife exercises stats/procs correctly; Alchemist + Chef's Knife synergy visible in healing math.

## Out of scope

- **Hi-Potion / Holy Water / Elixir** — additional consumables deferred to a future session.
- **Buff/debuff consumables** — need `applyStatus` field on `ConsumableEffects` per S39 handoff; deferred.
- **Dual-wield substrate** — future Ninja/Assassin class will force this; not S40.
- **Additional knives beyond the three** — Ninja class introduction is the natural moment to expand the roster.
- **Other weapon-class adoption of dynamic variance** — knives are the only class with Speed-based variance in v1; other weapons keep static bands.
- **Renderer-side permadeath badge** — S39 watch; UI polish for a future session.
- **Manual full deployment-to-permadeath playtest loop** — separate playtest action, not session-budgeted work.
- **Sophisticated weapon-proc-aware AI tactics** — minimal awareness per D7 if substrate supports; full pass is a future tactics session.
- **TS strict-mode error pile** (S34 carry) — separate future session.
- **Pass-and-play toggle + dual deployment + battle-loop AI gating** — dedicated future session.
- **Promoting the ActionType-wiring checklist to a durable doc** (S39 handoff watch) — separate small docs session, or fold into a future polish session.

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Content:**
- `src/content/items/weapons/` (or equivalent) — three new knife definitions.
- `src/content/items/weapon-classes/` (or equivalent, if first-class taxonomy) — knife class entry.
- `src/content/classes/knight.ts`, `src/content/classes/alchemist.ts` — equipment compatibility updates.
- Display-name updates per the name-update pass — files vary by what's being renamed.

**Engine:**
- `src/engine/damage/` — variance stage; dynamic variance integration.
- `src/engine/items/contributions.ts` — stat-modifier contributions (Chef's Knife +PA, Sai +Speed); proc-effect contribution for Magebane.
- `src/engine/actions/` — possibly proc-firing path if status-application variant is new.
- `src/engine/status/` — Brave-based formula path if it's being added/extended.

**UI:**
- `src/ui/equipment-picker.tsx` — knife-class display.
- `src/ui/unit-detail-panel.tsx` — stat modifier display from knives.
- `src/ui/forecast-panel.tsx` — variance range display for knife-wielders (if forecast surfaces variance).
- `src/ui/action-log-format.ts` — Silence proc log entry.

**AI:**
- `src/ai/` — minimal proc-aware target scoring per D7.

**Tests:**
- Test files mirroring each above.

**Docs:**
- `docs/decisions/` — new ADR for dynamic variance if substantive; possibly status-via-proc if new variant added.
- `docs/handoff.md` — updated at session close.
- `docs/playtest-watch.md` — Magebane Silence rate observation; Sai + variance interaction; Chef's Knife + Alchemist healing scaling.

## Workflow notes

- **Plaintext-first review required.** Same discipline as previous sessions.
- **Audit-first within the plan.** Particularly important for variance pipeline integration, attack_proc status-application support, and Brave-based formula presence — these three audits collectively determine whether S40 is a clean substrate slide-in or grows a substrate extension.
- **ADR path is `docs/decisions/`**. New ADR(s) per acceptance criteria.
- **Name-update pass is in-session.** Reserve time for the implementer-Chris discussion; specific renames not pre-specified. Apply renames via display-name updates with id preservation per S39 precedent.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: variance-pipeline integration if audit reveals more invasive plumbing than the hook path; proc-effect variant shape if status-application is new substrate; AI heuristic shape for weapon-proc-vs-target if existing AI doesn't model it.
- **Phase F session** — capture playtest observations in `docs/playtest-watch.md`. Magebane's Silence rate at various Brave values, Sai's +1 Speed feeding variance, Chef's Knife + Alchemist healing scaling all generate signal.
- **ActionType-wiring discipline note**: this session does **not** add new ActionTypes (knife attacks fire through existing physical-attack action paths; status-application via proc routes through existing or extended substrate, not new ActionType). The five-sites checklist from S39 doesn't apply here, but the discipline is worth remembering for future sessions that do add ActionTypes.

## Watch-fors

**Addressed this session:**
- Knife weapon class (new content area; substrate enables knife-flavored future classes).
- Dynamic variance substrate (engine extension enabling Speed-tied weapon scaling).
- Status-application via attack_proc — substrate confirmed or extended.
- Brave-based status formula — presence confirmed or added.
- Name-update pass on existing classes / command sets / abilities.

**Not addressed this session, longer-term carry-forward:**
- Hi-Potion / Holy Water / Elixir consumables (deferred from S40 candidate pool).
- Buff/debuff consumables — need `applyStatus` on `ConsumableEffects` (S39 carry).
- Dual-wield substrate (future Ninja class).
- Additional knives beyond v1 three (with Ninja).
- Renderer-side permadeath badge (S39 watch).
- Full deployment-to-permadeath playtest loop (S39 carry; separate playtest action).
- Sophisticated weapon-proc-aware AI tactics (future tactics pass).
- Promoting ActionType-wiring checklist to durable doc (S39 carry).
- TS strict-mode error pile (S34 carry).
- Pass-and-play toggle + dual deployment + battle-loop AI gating (dedicated future).
- All prior long-running carries documented in S38/S39 handoffs.

**Watch-fors specific to this session:**
- **Sai + Healthy Stride interaction.** Sai grants +1 Speed, not +1 Move. Healthy Stride scales with tiles moved (Move stat), so Sai *doesn't* directly amplify it. But: if Speed somehow affects available Move actions per turn (it doesn't currently, but worth confirming), the interaction needs revisit.
- **Knight + Magebane vs. Mage matchups.** The class designed to counter mages becomes substantially stronger with Magebane; expect Mage-heavy team compositions to need Remedy investment to remain viable. Note play-test signal.
- **Chef's Knife + Alchemist healing math.** +1 PA = +12 HP on Potion (PA × 12), +4 HP on Phoenix Down (PA × 4), +4 MP on Ether (PA × 4). Meaningful but not transformative. Confirm the healing math reads cleanly post-equipment.
- **Magebane Silence base rate calibration.** 50% base is higher than FFT-canon procs (typically 19-25%); after Brave gate (~50% at Brave 50) lands at ~25%. If post-gate rate plays as too low, can raise base; if too high, can lower. Tunable.
- **Variance display in forecast panel.** Players reading the forecast for a knife attack should see the variance band that reflects the wielder's Speed, not a default static range. Confirm rendering.
- **Speed stat displays in unit detail.** Sai's +1 Speed should render alongside existing equipment Speed bonuses (Boots of Haste, etc.) with consistent UI patterns.
- **Stat-modifier composition on knife equip.** Sai's +1 Speed feeds the knife's own variance (Speed value read post-equip). Audit ensures the variance computation reads the modified Speed, not base.

## Estimated size

**Medium.** Three pieces of work: (a) dynamic variance substrate, (b) three knife items with their effects, (c) name-update pass. Plus the audit-driven substrate extensions if needed (status-via-proc, Brave-based formula).

The substrate work is the wildcard:
- If variance integration is a clean hook at the variance stage, status-via-proc is already supported, and Brave-based formula is already in use: this is a small content-add session with three knives + name renames.
- If all three substrate items require extension: medium-to-large, possibly worth a 40a (substrate) / 40b (content + names) split.

**Split contingency:** if audit surfaces substantive substrate work, natural seam is:
- **40a:** Dynamic variance pipeline + status-via-proc extension + Brave-based formula path. No content yet; substrate exercised through test fixtures.
- **40b:** Three knife items + equipment compatibility updates + AI heuristic update + name-update pass.

Plan-review settles based on audit findings.
