# Session Brief: Engine Audit + Test Reconciliation

*Pre-roadmap session. Primary deliverable is an audit report; secondary deliverable is an updated test suite.*

## Purpose

We've completed a design reconciliation pass following Session 20b that produces new targets for class stats, spell power coefficients, R/S/M ability costs, four new movement abilities, and an availability tag system. Before sequencing the implementation roadmap, we need:

1. An inventory of which engine capabilities required by the post-reconciliation spec already exist, are partially implemented, or are net-new work — with rough size estimates for the gaps.
2. The test suite refreshed to use the new baseline numbers, so subsequent content/engine sessions land against a stable test fixture.

This is **not** an implementation session for the spec changes themselves. Engine extensions and content updates are sequenced as separate sessions after the audit results land.

## Inputs

Read these before starting:

- **`mage-war-content-spec.md`** — the post-reconciliation spec. The audit is conducted against this document's targets.
- **`mage-war-equipment.md`** — equipment doc. The audit list is largely derived from the engine capabilities required by the equipment doc's effect types.
- **`deployment-phase-architecture.md`** — deployment phase requirements (initial CT randomization, deployment zones, pre-battle equipment auto-status, etc.).
- **`river-ridge.md`** — first map's terrain mechanics (jump-over-water, water terrain costs).
- **`team-builder-architecture.md`** — context on the availability filter and team-build validation.
- **`battle-ui-architecture.md`** — context on forecast/projection contract requirements (relevant for one audit item).
- **`content-snapshot.md`** — current implementation state. The audit compares this baseline against the spec.

## Primary task: engine capability audit

For each capability below, produce a structured entry covering:

- **Status**: `implemented` / `partial` / `not implemented`
- **Gap (if partial or absent)**: what specifically is missing
- **Implementation sketch (if not implemented)**: rough approach, including which engine modules are likely involved
- **Size estimate**: `trivial` (< half session) / `small` (~half session) / `medium` (~full session) / `large` (multi-session)
- **Related ADRs / files**: anything relevant the next session-planner should know about

### Equipment effect plumbing

1. **Bucket capacity modifiers from equipment.** Items like Steel Helm (+1 R-capacity), Augmentor (+1 S-capacity), and Magus Crown (+1 Action-capacity) need to modify the relevant bucket cap. Question: does `modifyStatQuery` extend to bucket capacities, or is a new hook required?

2. **Negative evasion handling.** Steel Helm grants -20 Side/Back evasion (the "wants to get hit" mechanic). Does the hit-chance computation handle evasion < 0 cleanly (allowing > 100% effective hit chance), or does it clamp evasion at 0?

3. **Element-tagged physical damage on weapons.** Flametongue (sword) deals Fire-tagged physical damage; Bolt Hammer deals Lightning-tagged physical. Does the damage pipeline flow weapon element tags into the elemental wheel for physical hits?

4. **Spell-cast riders on weapons.** Bolt Hammer fires a Lightning spell on swing alongside the physical hit. Is there an effect type for "weapon procs an ability on hit," or does this require new hook plumbing?

5. **MP cost modifiers.** Staff of Power adds +20% MP cost to spells. Is there a hook in spell MP-cost computation that equipment can hook into?

6. **MaxMP modifier scaling.** Staff of Abundance grants +50% MaxMP. Verify that `modifyStatQuery` on `mp` cleanly handles multiplicative modifiers (vs additive only).

7. **Spell speed modifiers.** Wand of Deepwood grants +5 actionSpeed for Earth-tagged spells; Staff of Abundance grants -5 actionSpeed for all spells. Is there an ability-actionSpeed-by-tag modification hook?

8. **Status tickdown rate modifiers.** Purifier doubles tickdown rate of negative-tagged statuses on the wearer. Does the engine support per-status-class duration scaling, or is duration always literal?

9. **Damage-to-MP-drain conversion.** Rasp Pendant converts a portion of damage dealt into MP drain on the target. Is there an end-of-damage-pipeline transform hook?

10. **Resistance shifts on equip.** Wand of Depths grants +50 Lightning resist and -50 Fire resist (sign-mixed shift). Does `modifyStatQuery` extend to resistance values, and does the existing signed-max composition machinery handle equipment-sourced shifts cleanly?

11. **Per-tag status resistance modifiers.** Pointy Hat grants +50 Silence resist; Focus Band grants +25 to all negative-tag status resistance. Does the status application formula read per-tag (or per-status) resistance modifiers from a hook?

12. **Auto-statuses on equip.** Boots of Haste already implements Auto-Haste via `statusGrants`. Verify the same mechanism cleanly supports Auto-Shell, Auto-Regen, and other auto-statuses referenced in the equipment doc — particularly that the auto-status applies cleanly at battle start (logged as an `apply_status` action with `source: 'pre_battle_equipment'`) per the deployment-phase architecture.

### Battle flow / engine state

13. **Initial CT randomization.** Currently set to fixed value 0 with `speed_with_variance` variant available but unused. Required: uniform integer [0, 20] per unit at battle start. Verify the variant exists and confirm the change is just a config flip, or identify what additional work is needed.

14. **Tile property: deploymentZone.** Per the deployment-phase architecture, map tiles need a `deploymentZone` property indicating which side (north/south or A/B) can place units there. Does the tile schema support arbitrary properties, and is `deploymentZone` already a known property?

15. **Jump-over-water movement.** Per River Ridge: a unit may make a single cardinal leap over 1 water tile (deep or shallow) in a turn, costing 2 move points, gated by jump rating relative to the destination tile. Does the pathfinding support this primitive, or is it net-new movement logic?

16. **Fall damage on knockback into water.** Fall damage from elevation drops is implemented. Verify the interaction with knockback-into-water specifically (the knockback resolves first, then fall damage applies as the unit lands one elevation level lower than its origin — and water tiles have lower elevation by design).

17. **Pre-battle equipment auto-status as action-log entries.** Per the deployment-phase architecture, equipment auto-statuses should apply at battle start as normal `apply_status` actions tagged `source: 'pre_battle_equipment'` so the action log captures the initial state. Verify this is how Boots of Haste currently behaves (vs. e.g. statuses being applied implicitly without log entries).

### Catalog / content infrastructure

18. **Availability filter on abilities and items.** Net-new field on ability and item definitions: `availability: 'available' | 'hidden'`. Engine ignores; team builder filters; AI team generation respects. Required: schema field, validation that it's set on every entry, team builder consumption hook.

### Battle UI prerequisites (lighter-touch audit)

19. **Forecast/projection contract.** The battle UI architecture specifies a forecast pipeline that previews damage, hit chance, status application chance, etc. before the player commits an action. Verify the engine emits forecast data in a shape the UI can consume — specifically: (a) damage range with min/expected/max; (b) status application probabilities including per-target resistances; (c) AoE per-target preview; (d) reaction-trigger preview where determinable. If any of these don't exist, flag them but don't size — UI work is downstream.

20. **Action log persistence and shape.** The battle UI references the action log as canonical state for the log panel and (eventually) replay. Verify the log captures enough metadata to reconstruct any given moment of the battle, and identify any gaps. Don't size; flagging only.

### Items intentionally excluded from audit

These are noted as deferred or out-of-scope for the post-Session-20 work:

- **Teleport movement primitive** (deferred Item 2). Quickstep doesn't need it; future use TBD.
- **Custom-trigger reaction-fizzled action types** (deferred Item 6). Not blocking first playable.

## Secondary task: test suite reconciliation

Update the test suite to use the post-reconciliation baselines so that subsequent sessions land against stable fixtures.

### Updates to apply

1. **Stat baselines.** Update `demo.ts` (and any fixture files derived from it) to use the new L25 stat values from the spec:

   | Class | HP | MP | PA | MA | Speed |
   |---|---|---|---|---|---|
   | Knight | 144 | 20 | 11 | 4 | 9 |
   | Earth Mage | 112 | 60 | 4 | 12 | 8 |
   | Water Mage | 102 | 60 | 4 | 12 | 10 |
   | Fire Mage | 97 | 60 | 4 | 13 | 9 |
   | Lightning Mage | 87 | 60 | 4 | 14 | 9 |

2. **Brave / Faith.** Update default Brave/Faith from 100/80 to 70/70.

3. **Long Sword.** Update WP from 4 to 8 to match the equipment doc's target value.

4. **Spell power coefficients.** Update content/abilities entries:
   - earth_strike 6 → 8; earth_quake 6 → 7; earth_cataclysm 10 → 12
   - water_strike 5 → 8; tidal_wave 5 → 7; maelstrom 7 → 12
   - fire_strike 5 → 8; fire_storm 4 → 6; flame_lance 6 → 10
   - chain_lightning 8+1/extra → 9+1/extra
   - lightning_strike, storm_caller, spark, magnetic_mark unchanged

5. **R/S/M ability costs.** Update content/abilities cost fields:
   - earth_resilience 2 → 1
   - float 2 → 1
   - fly 3 → 2

6. **Class-free passives.** Extend `freeAbilities` per the spec's parity rule:
   - Knight: `move_plus_1` → `move_plus_1`, `counter`, `damage_reduction`
   - Earth Mage: `[]` → `earth_resilience`, `earth_communion`
   - Water Mage: `[]` → `tidal_pull`, `flow_state`
   - Fire Mage: `ignition`, `aether_bloom` (unchanged) → `ignition`, `aether_bloom`, `smolder`
   - Lightning Mage: `discharge`, `conductor` (unchanged)

7. **Test assertions.** Update damage / heal / status-chance / HP-after-hit assertions throughout the test suite to match the new tuning. Where assertions check exact numbers, recompute with the new baselines. Where assertions check ranges or relative ordering, verify they still hold.

8. **Brave-100 → Brave-70 reaction-trigger tests.** Tests currently relying on Brave 100 for deterministic reaction triggers will start firing probabilistically. For each affected test, choose one of:
   - Use a seeded RNG to lock the trigger outcome and assert against the seeded result
   - Override Brave to 100 explicitly in the test setup (preserve the deterministic-trigger test path)
   - Relax the assertion to check that the reaction *can* trigger across N seeded runs
   
   Document the choice per test.

9. **Crit_chance clamp.** Add or update tests verifying that stacking Crit_modifier eventually clamps at crit_chance = 100 (not higher). Currently snapshot says no clamp is mentioned; this audit should also confirm whether the clamp exists in the engine, and if not, flag it as engine work alongside the audit results (not as part of this session's implementation).

### Out of scope for the test reconciliation

- Don't update content files (class definitions, ability definitions in `src/content/abilities/`) for the engine-audit-flagged items — those wait for the dedicated content-update session.
- Don't add new tests for capabilities flagged as missing in the audit.
- Don't refactor unrelated test code; minimal-touch updates only.
- Don't change AI scoring or AI test fixtures unless the AI tests directly read damage values from demo.ts.

If a test breaks after baseline updates and the breakage reveals a real engine issue (rather than just a stale assertion), flag it in the audit report instead of fixing it as part of this session.

## Deliverable

A single markdown document at `docs/audits/post-20-engine-audit.md` (or your preferred path under `docs/`) containing:

- **Engine capability audit**: structured entries for items 1-18, lighter notes for 19-20
- **Test suite update summary**: list of fixture/test files modified, count of assertions updated, count of tests that needed Brave-100 handling, any tests that were skipped/quarantined
- **Surprises and flags**: anything unexpected encountered (missing engine pieces beyond the audit list, content inconsistencies, etc.)
- **Recommended session sequencing**: suggested ordering for the engine extension sessions based on size estimates and dependencies (e.g., "items 14, 17, 18 cluster together as a deployment-prep session")

## Out of scope

- No engine extensions implemented this session
- No new content authored
- No UI work
- No design changes to the spec — if the audit surfaces something that *requires* a design call, flag it in the report rather than deciding unilaterally

## Verification

The session is complete when:

1. The audit report exists, covers all 20 items, and is at a level of detail where the next session-planner can size implementation work from it
2. The test suite passes after the baseline updates
3. Any tests that needed special handling (Brave-100 path preservation, seeded RNG, etc.) are documented in the audit report

## Estimated session size

Medium. The audit is information-gathering and should be quick once the relevant code is read; the test reconciliation has a known scope (specific number swaps, specific assertion updates) but touches many files. Expected: full session with the test reconciliation as the time-dominating work.
