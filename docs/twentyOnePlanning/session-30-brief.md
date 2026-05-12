# Session 30 Brief: Cluster 5 — Procs / Drains + Session-29 Polish Fold-ins

## Context

Phase C engine substrate continues. Sessions 27-29 collectively delivered the four Cluster 3 hooks, absorption activation, contributor refactor, `maxMp` + bucket capacity + status tickdown (Cluster 4), and 28 equipment items with audit-time substrate extensions (Cluster 4 + the Session 29 surprises: `modifyAbilityRange`, `modifyOutgoingHitChance`, `movementMods`, `evasionMods`, `ShieldEquipment`). The remaining engine substrate before equipment-complete is **Cluster 5**: spell-cast riders on weapons and damage-to-MP-drain conversion.

This session lands Cluster 5 as pure engine substrate (no content authoring; that's Session 31). Plus three polish fold-ins surfaced during Session 29 that benefit from landing while their equipment context is fresh:

1. **Unit detail panel evasion display** — surfaces per-facing evasion so Steel Helm's `-20 side/back` is visible
2. **Forecast hit chance / accuracy / range projection** — surfaces what Wand of Depths' range bonus, Arcane Lens' accuracy, and Steel Helm's negative evasion actually do
3. **Bucket / passive / equipment-slot label polish** — human-readable labels in the unit detail panel for what's currently raw bucket IDs

Cluster 5's substrate is moderate (two well-bounded items per the audit). The fold-ins are individually small UI work but touch the existing forecast and detail-panel architecture. Combined scope is medium total.

## Inputs (read first)

In recommended order:

1. **`CLAUDE.md`** — project conventions.
2. **`docs/handoff.md`** — Session 29 handoff. Note especially: the three polish items being folded in here are explicitly in the "limitations + watch-fors" section; the equipment items they make visible are now live.
3. **`docs/twentyOnePlanning/roadmap-sessions-21-plus.md`** — Session 30 entry; Session 31 entry for context on what consumes the substrate landing here.
4. **`docs/audits/post-20-engine-audit.md`** — Items 4 (spell-cast riders) and 9 (damage-to-MP-drain). Both have implementation sketches.
5. **`docs/twentyOnePlanning/mage-war-equipment.md`** — items that will consume the new hooks in Session 31 (Bolt Hammer, Flametongue Burn proc, Rasp Pendant, Wand on-hit resistance shifts).
6. **`docs/decisions/0056-...`** and **`0061-...`** through **`0063-...`** — recent ADRs covering the contributor pattern, loadout shape, and the Session 29 hook additions.
7. **`docs/twentyOneDesign/battle-ui-architecture.md`** — sections relevant to the polish fold-ins: forecast panel, unit detail panel.

### Paths to survey before planning

Current-tree audit required. At minimum survey:

- `src/engine/hooks/types.ts`, `src/engine/hooks/runners.ts` — for the new `onFinalDamage` hook and the proc-firing extension to reaction-compile path
- `src/engine/actions/reducers.ts` — for `system_mp_drain` integration (reducer branch alongside system_damage / system_heal)
- `src/engine/damage/handlers.ts` — for the post-finalize hook fire site
- `src/engine/items/contributions.ts` — for new contributor entries (`attack_proc` shape on equipment)
- `src/engine/seeded/` (or wherever seed-stream management lives) — for the per-action proc-roll sub-stream
- `src/engine/actions/types.ts` — for `attack_proc` effect shape and `system_mp_drain` action type
- `src/ui/unit-detail-panel.tsx` — for the per-facing evasion display fold-in
- `src/ui/forecast-panel.tsx`, `src/ui/forecast-compose.ts` — for the hit-chance / accuracy / range projection fold-in
- `src/ui/queue-tower.tsx` and other consumers of bucket labels — for the label polish fold-in
- `src/engine/catalog/definitions/` — for bucket label conventions if a registry of human-readable names is the cleanest path

The plan articulates what exists, what's being refit, what's being added.

## Goal

End state:

**Cluster 5 substrate:**
- **`attack_proc` effect shape** on equipment. Generalized reaction-compiler fires `use_ability` from `onDamageDealt` against the attacker's hooks (not target's, which is the existing pattern). Per-action seed sub-stream isolates proc rolls from damage variance. Chain-depth + reaction caps cover safety.
- **`onFinalDamage` hook**. Post-finalize, emission-only. Fires after damage is fully resolved (post-resistance, post-absorption); handlers can emit follow-on actions but cannot mutate damage already applied. First consumer (Session 31): Rasp Pendant's MP-drain conversion.
- **`system_mp_drain` action type**. Reducer branch alongside `system_damage` / `system_heal`. Floors at 0; caps at attacker's `maxMp` per Session 28's substrate.

**Polish fold-ins:**
- **Unit detail panel evasion display**. Per-facing evasion (front / side / back) visible in the Stats / Resistances section. Steel Helm's `-20 side/back` reads correctly.
- **Forecast hit chance / accuracy / range projection**. Forecast panel surfaces effective hit chance per facing (where applicable), accuracy multiplier from caster, and effective range (with axis breakdown when the modifier is asymmetric like Wand of Depths' +1/+1 on water spells).
- **Bucket / passive / equipment-slot label polish**. Human-readable labels in the unit detail panel: "First Action", "Secondary Command Sets", "Reaction", "Support", "Movement" for buckets; equipment-slot labels for hand / body / head / accessory. Sources to be settled in the plan (constant map, manifest in a registry, or per-bucket definition).

Tests at 796+, 0 failing. New tests cover: proc-firing chain, `onFinalDamage` emission semantics, `system_mp_drain` reducer behavior, per-facing evasion read, forecast projection accuracy, bucket-label lookups.

## Pre-implementation plan (required)

Same discipline as previous sessions. Current-tree audit first; architectural decisions surfaced before code.

### Required first step: current-tree audit

For each surface this session touches: what exists, what state it's in, what this session does to it. Particularly important for:

- The reaction-compile path (where `onDamageDealt` reactions fire today; generalizing to also fire `attack_proc` against attacker's hooks may share or diverge from this path)
- The seed-stream architecture (does it already support sub-streams cleanly? if not, adding the proc-roll lane is its own design call)
- The forecast pipeline (Session 29 didn't extend it for hit-chance / range projection; this session does)

### Architectural decisions

After the audit:

1. **`attack_proc` effect shape on `EquipmentBase`.** Audit's sketch: `{ kind: 'attack_proc', chance: number, abilityId: AbilityId }`. State:
   - Whether it's a top-level field on `EquipmentBase` (`attackProcs?: ReadonlyArray<AttackProcDef>`) or composes through the existing contributor pattern (a contributor that emits `onDamageDealt` handlers)
   - Whether procs fire on physical attacks only or also on ability hits — audit suggests "from `onDamageDealt`," which fires on any damage source from the attacker; clarify for v1 content (Bolt Hammer says "spell-cast on physical hit"; Flametongue's Burn proc same; both physical-attack-only)
   - Whether the proc's ability is fired against the original target (audit's sketch) or against a re-selected target (less likely for v1)

2. **Reaction-compiler generalization.** The current reaction-compile path likely fires reactions on the **target's** hooks (target reacts to incoming damage). Procs fire on the **attacker's** hooks (attacker's weapon fires an extra ability after dealing damage). State:
   - Whether the proc-fire is a separate emission path inside the same compile function, or a parallel compile-and-fire pass
   - Chain-depth interaction with reactions: if a procced ability deals damage, does that damage trigger reactions on its new target? Most likely yes — audit's "Existing chain-depth + reaction caps cover safety" implies the existing caps apply
   - Whether procs and reactions share a chain-depth budget or have separate budgets

3. **Per-action seed sub-stream for proc rolls.** Audit notes "Per-action seed sub-stream for the proc roll." State:
   - Whether the existing seed architecture already supports sub-streams (most likely yes given the deterministic-replay discipline)
   - The sub-stream naming convention (per-action procs vs damage variance vs status apply)
   - Where the proc-roll consumes the sub-stream

4. **`onFinalDamage` hook signature and fire site.** Post-finalize, emission-only. State:
   - Args shape: `{ unit, attacker, damageDealt, damageTags, ... }` — match what Rasp Pendant needs to read for MP-drain
   - Return type: emission-only matches the `OnTurnEndResult` pattern from Session 26's ADR-0053 (return emissions, don't mutate state)
   - Fire site: post-finalize means after `clampMinMax`, after HP delta is recorded in perTargetResults, after `system_damage` (or `system_heal` for absorption) action would be emitted
   - Whether the hook fires on absorbed damage (resistance > 100): the damage *applied* is 0 (heal), but the *base damage* was meaningful — Rasp Pendant probably wants to read damageDealt = 0 for absorbed cases (no MP drain when no damage taken). State the semantic.

5. **`system_mp_drain` reducer behavior.** State:
   - Action payload shape: `{ source: UnitId, target: UnitId, amount: number }`
   - Floor at 0 (can't drain a unit below 0 MP)
   - Cap at attacker's maxMp (can't push attacker above their max via drain transfer)
   - Whether drain is a transfer (target loses N MP, attacker gains N MP) or one-way (target loses N MP, attacker unchanged). Rasp Pendant's behavior per the equipment doc dictates. Audit's "damage-to-MP-drain conversion" phrasing suggests transfer.
   - Edge case: target has 0 MP. No-op? Emit anyway with amount=0? Action log readability matters here.

6. **Polish fold-in 1: unit detail panel evasion display.** Audit reveals the panel's current structure. Per-facing evasion data source: read from unit's runtime evasion stats (`runModifyStatQuery` on whichever stat names exist). State:
   - Display position (alongside HP/MP/SPD/CT, or in Resistances section)
   - Visual idiom (three numbers labeled F/S/B, or compact "20/0/-20" or similar)
   - Whether it reads through computed (with equipment) or base values — should be computed for the player's actual effective evasion

7. **Polish fold-in 2: forecast hit chance / accuracy / range projection.** State:
   - Whether hit chance is shown as a single percentage (most likely facing) or per-facing breakdown (front / side / back)
   - Whether range is shown as the effective number (post-`modifyAbilityRange`) or as base + bonus annotation
   - Where in the forecast panel the new rows sit (after damage range, alongside the Timing subsection, or in a dedicated Accuracy subsection)
   - For ability-with-modifier scenarios (Wand of Depths' +1 range on water spells): does the forecast show the unmodified range when the player is casting a non-water spell, and the modified range when casting a water spell? Yes per the per-ability computation, but state explicitly.

8. **Polish fold-in 3: bucket / slot label polish.** State the source-of-truth for human-readable labels. Three reasonable shapes:
   - **Constant map** in a UI module: `BUCKET_LABELS: Record<BucketId, string>`. Simple; UI-side ownership.
   - **Field on bucket definition** (if buckets have authoring records): `displayName: 'First Action'`. Cleanest for future i18n.
   - **Manifest in `src/content/`**: separate `labels.ts` that the UI imports. Decouples from engine.
   
   Constant map is probably right for v1. State the call. Same shape applies to passive bucket names (R/S/M → "Reaction" / "Support" / "Movement") and equipment-slot names (hand / body / head / accessory).

9. **Test strategy.** Per-substrate item: unit tests for proc-firing chain, `onFinalDamage` emission, `system_mp_drain` reducer. Per-polish-item: snapshot tests where appropriate (panel rendering), small unit tests for label lookup. State coverage plan.

10. **Order of work.** Substrate first (Cluster 5 items), then fold-ins. The fold-ins don't depend on the substrate; either order works for them. Substrate-first lets the fold-ins land against a stable engine state.

11. **30a/30b split allowance.** Surface area is moderate. If the reaction-compiler generalization or the seed-stream work balloons during audit, propose a split with substrate as 30a and polish as 30b. Most likely no split needed; the audit's findings drive.

The plaintext plan is reviewed before code lands.

## Implementation work

Following plan approval, items land roughly in this order: substrate first, then polish in any order.

### Item 1: `attack_proc` effect shape + reaction-compiler generalization

- New effect shape on equipment (field name and structure per plan)
- Reaction-compiler extended to fire `attack_proc` against attacker's hooks from `onDamageDealt`
- Per-action seed sub-stream for proc rolls
- Chain-depth + reaction caps apply

### Item 2: `onFinalDamage` hook

- New hook type, runner, contributor map entry
- Post-finalize, emission-only
- Args include `damageDealt`, `damageTags`, attacker, target
- Returns emissions (matches `OnTurnEndResult` pattern)
- Verified to fire on regular damage; verified to fire (or not) on absorbed damage per plan decision

### Item 3: `system_mp_drain` action type

- New action type with payload `{ source, target, amount }`
- Reducer branch handling MP transfer or one-way drain per plan
- Floor / cap behavior per plan
- Action log entry for drain events

### Item 4: Unit detail panel evasion display

- Per-facing evasion (F/S/B) visible
- Reads through `runModifyStatQuery` for effective values
- Display location per plan

### Item 5: Forecast hit chance / accuracy / range projection

- Hit chance per facing (or summary)
- Accuracy multiplier surfaced
- Effective range with axis breakdown for asymmetric modifiers
- Tooltips clarify what's base vs modified

### Item 6: Bucket / slot label polish

- `BUCKET_LABELS` (or equivalent) constant map
- Unit detail panel reads human-readable labels
- Same for passive bucket names and equipment-slot names

## Acceptance criteria

**Cluster 5 substrate:**
- `attack_proc` effects compile and fire correctly; per-action seed sub-stream isolates rolls from damage variance.
- `onFinalDamage` fires post-finalize with correct args; emissions queue correctly.
- `system_mp_drain` reducer handles floor / cap / transfer semantics correctly.
- Chain-depth + reaction caps prevent runaway proc chains.

**Polish fold-ins:**
- Steel Helm wearer's per-facing evasion visible in unit detail panel.
- Wand of Depths wielder's effective range for water spells visible in forecast.
- Arcane Lens wielder's effective accuracy visible in forecast.
- Unit detail panel shows human-readable bucket / slot labels.

**Quality:**
- Tests at 796+, 0 failing. New tests proportional to the six items.
- ADRs written for: `attack_proc` effect + reaction-compiler generalization (substantive); `onFinalDamage` hook (new emission-only hook surface). Polish items don't need ADRs unless something non-obvious emerges.
- `docs/handoff.md` updated.

## Out of scope

- **Content authoring of procced items** (Bolt Hammer, Flametongue Burn proc, Rasp Pendant). Session 31.
- **Wand on-hit resistance shifts** (Wand of Depths, Wand of Deepwood). Session 31 alongside procced items.
- **Tintinibar Regen duration verification** (Session 29 carry-forward; first playtest reveals if needed).
- **Weapon-sourced variance engine seam** (Session 29 carry; not blocking).
- **Other accumulated polish items** that didn't make this fold-in batch — pacing constants, ring/portrait fitment, etc. Future polish session.
- **All Phase D work** (Cluster 6, River Ridge). Sessions 32-33.
- **`onTurnStart` symmetric widening** (Session 26 carry; defer until emitter).
- **AI active absorption exploitation** (Session 27 carry; tactics-layer pass).

## Files likely touched

A non-exhaustive list. Audit confirms / corrects.

**Engine:**
- `src/engine/hooks/types.ts`, `src/engine/hooks/runners.ts` — `onFinalDamage` hook definition + runner
- `src/engine/actions/types.ts` — `system_mp_drain` action type, possibly `attack_proc` effect shape
- `src/engine/actions/reducers.ts` — `system_mp_drain` branch
- `src/engine/damage/handlers.ts` — `onFinalDamage` fire site
- `src/engine/items/contributions.ts` — `attack_proc` contributor wiring (if contributor pattern)
- `src/engine/seeded/` or equivalent — per-action proc-roll sub-stream
- `src/engine/catalog/definitions/equipment-base.ts` — `attackProcs` field shape (if top-level field)

**UI:**
- `src/ui/unit-detail-panel.tsx` — per-facing evasion rendering, human-readable labels
- `src/ui/forecast-panel.tsx`, `src/ui/forecast-compose.ts` — hit chance / accuracy / range projection
- `src/ui/constants.ts` (or new module) — `BUCKET_LABELS`, `SLOT_LABELS` constant maps
- `src/ui/queue-tower.tsx` — possibly updated if it also displays bucket-relevant labels

**Tests:**
- New tests for proc-firing chain
- New tests for `onFinalDamage` emission semantics
- New tests for `system_mp_drain` reducer
- New tests for evasion / forecast / label rendering

**ADRs:**
- New ADRs in `docs/decisions/` for substrate items
- `docs/handoff.md` updated

## Workflow notes

- **Plaintext-first review required.** Same discipline as previous sessions.
- **Audit-first within the plan.** Particularly important for the reaction-compiler generalization — the existing reaction-fire path's shape determines whether proc-fire is a clean extension or requires structural change.
- **ADR path is `docs/decisions/`**.
- **Substrate before polish.** Substrate-first keeps polish work landing against stable engine state.
- **Mid-session design questions** route through Chris to the planner. Most likely surfaces: proc transfer-vs-one-way for MP-drain semantics; whether `onFinalDamage` fires on absorbed damage; forecast layout for new accuracy/range rows.
- **The integration test calibrated to `demoBattle`'s 6×6 board** stays calibrated. Procs don't fire in demo content (no demo unit equips a procced weapon); the substrate landing here shouldn't perturb existing test outcomes.

## Watch-fors

**Addressed this session:**
- `attack_proc` effect shape + spell-cast riders (audit Item 4)
- `onFinalDamage` hook + `system_mp_drain` (audit Item 9)
- Per-facing evasion in unit detail panel (Session 29 carry)
- Forecast hit chance / accuracy / range projection (Session 29 carry)
- Bucket / passive / equipment-slot label polish (Session 29 carry)

**Not addressed this session, longer-term carry-forward:**
- Bolt Hammer, Flametongue Burn proc, Rasp Pendant, Wand on-hit shifts (Session 31)
- Tintinibar Regen duration verification (Session 29 carry; first playtest)
- Weapon-sourced variance engine seam (Session 29 carry; future)
- Cast Shell / Cast Protect substrate (Session 29 carry; future spells)
- Sorcerer's Robe "Move +1" playtest read (Session 29 carry)
- Item #5 pacing constants (Session 26.5 carry)
- Active-ring / counterpart-ring rounded-square fitment (Session 26.5 carry)
- Tile-info effect-icon area still empty in v1 (Session 26.5 carry)
- Burn × Purifier action-log readability — first Purifier playtest possible now
- AI active absorption exploitation (Session 27 carry)
- `onTurnStart` symmetric widening (Session 26 carry)
- Renderer's HP "max" captured at mount (Session 28 carry; sibling to MP lift)
- Status-badge polarity convention (Session 22 carry)
- rAF vs setInterval for animation drain (Session 23 carry)
- AoE preview correctness across all shapes (Session 23 carry; confirmed shape-agnostic)
- MP / status snapshot ahead-of-tween fix (Session 22 carry)
- `pa_factor` NotYetImplementedError (audit E3)
- TS strict-mode test errors (audit E8)
- Surrender flow (Session 34)
- MVP-unit smarter algorithm (Session 24 Wave 1)
- Permadeath timer (Session 24 Wave 1)
- Settings expansion (Session 24 Wave 1)
- Reactions in projection column (Session 24 Wave 1)
- Bug 1 (Session 24.5 ADR-0046): mid-battle targeting failure; instrumentation in place
- Vite HMR cache invalidation occasional issue
- Hardcoded team color palette across three sites (Session 25 carry)
- Bedrock Stride fall-immunity untested until River Ridge (Session 33)
- Multiplicative tick-amount stacking (Session 28 carry; design noted)

## Estimated size

Medium. Cluster 5 substrate is two items per the audit, each well-bounded. The polish fold-ins are individually small UI work; combined they touch unit detail panel + forecast + label conventions. No split anticipated; if the reaction-compiler generalization balloons during audit, the natural seam is substrate (30a) vs polish (30b).
