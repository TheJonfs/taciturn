# Content Snapshot — Phase B Open

*Frozen as of 2026-05-11, end of session 26.*

This is a **balancing-pass reference**: every class's stats, every ability's numbers, every equipment item's effects, every status's mechanics, in one scannable document. Used to support a design / planning conversation about the next set of sessions (calibration, content expansion, UI work).

For id ↔ name lookups and file paths, see `docs/content-id-registry.md`. This document is the *numerical* counterpart — what each thing actually does, not where it lives.

When numbers in this doc diverge from the source files, the source files are authoritative. This is a snapshot, not a contract; expect drift after a calibration pass and refresh accordingly.

## Changelog since session 20b

The previous freeze (2026-05-09, end of session 20b) preceded the L25-target stat reconciliation and the Cluster 2 substrate work. Material deltas in sessions 21–26:

- **Stat baselines reconciled (session 21).** maxHpBase climbed from ~50 to ~100-145; PA/MA bumped for L25 targets. Brave/Faith dropped from 100/80 to 70/70 uniformly. Faith_factor is now ~0.49 (0.7² ≈ 0.49) instead of 0.64. Damage tables below carry the new numbers; "Expected raw" columns no longer hold their session-20b values.
- **Availability tags (session 25, ADR-0049).** Every ability / item / command-set carries `availability: 'available' | 'hidden'`. Hidden today: `float`, `fly`, `discharge_strike`, `cure`, items `iron_helm`, `iron_mail`, `strength_ring`, command sets `white_magic` and `arcane_skill`. The team-builder UI (forthcoming) hides these; engine semantics are unaffected.
- **uniform_int initial CT (session 25, ADR-0050).** Default ruleset starts units at CT in [0, 20] rather than 0; pre-battle CT seeds visible jitter in the queue. Calibration-sensitive tests preserved via inline ruleset overlays.
- **`deploymentZone` field on Tile (session 25).** Substrate for team-builder deployment phase; no current consumer.
- **AoE base-shape consistency (session 26).** `earth_quake`, `earth_cataclysm`, and `fire_storm` migrated from `cross r1` to `diamond r1`. At r1 the footprint is identical (5 tiles in a plus); the meaningful change is Aether-Bloom-enlarged Fire Storm: now diamond r2 (13 tiles) instead of the pre-26 cross r2 (9).
- **Four new Movement-bucket passives (session 26).** Bedrock Stride (Earth), Hotfoot (Fire), Tidewalker (Water), Quickstep (Lightning). All available, all in their class's `freeAbilities`. See "Passive abilities" below. Drives two new hook surfaces: `modifySystemDamage` (ADR-0052) for Bedrock Stride's fall-immunity, and the widened `onTurnEnd` (ADR-0053) for Quickstep's Move-axis CT refund.
- **Terrain texture infrastructure (session 26, ADR-0054).** Renderer-side. Doesn't affect game balance; flagged here because content snapshots historically include renderer-touching changes too.
- **Demo loadout note.** Knight's Second Action slot is empty (session 25 — White Magic command set hidden). Mages still carry `white_magic` in Second Action (engine-side they can cast Cure mid-battle; presentation only). The four new Movement passives are NOT yet wired into demo loadouts — every demo unit still equips `move_plus_1` in the Movement bucket. The new passives sit in `freeAbilities` for team-builder consumption.

---

## 1. Class baselines

Class definitions ship `movement` (moveRange / jump / canEnter / terrainCosts), `evasion` baselines (front / side / back), `firstActionCommandSet`, and `freeAbilities`. Per-unit `baseStats` are set at battle config time (`UnitPlacement.baseStats`) — the values below come from `src/content/battles/demo.ts` and represent the v1 demo's tuning.

Demo stats below are sampled from `src/content/battles/demo.ts` post-session-26. Free-passive lists reflect each class's `freeAbilities` set (no equipment-modifier interactions; pure class baseline).

| Class | spd | pa | ma | maxHpBase | mp | brave | faith | crit_chance / mult | Move/Jump | Evasion (F/S/B) | Free passives |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Knight** | 9 | 11 | 4 | 144 | 12 | 70 | 70 | 5% / ×1.5 | 3 / 2 | 0 / 0 / 0 | attack |
| **Earth Mage** | 8 | 4 | 12 | 112 | 60 | 70 | 70 | 5% / ×1.5 | 3 / 3 | 8 / 5 / 0 | attack, earth_resilience, earth_communion, **bedrock_stride** |
| **Water Mage** | 10 | 4 | 12 | 102 | 60 | 70 | 70 | 5% / ×1.5 | 4 / 3 | 10 / 6 / 0 | attack, tidal_pull, flow_state, **tidewalker** |
| **Fire Mage** | 9 | 4 | 13 | 96 | 60 | 70 | 70 | 5% / ×1.5 | 3 / 3 | 6 / 4 / 0 | attack, ignition, aether_bloom, smolder, **hotfoot** |
| **Lightning Mage** | 11 | 4 | 12 | 100 | 60 | 70 | 70 | 5% / ×1.5 | 4 / 3 | 7 / 4 / 0 | attack, discharge, conductor, **quickstep** |

(Bold marks the four Movement-bucket passives added in session 26.)

All five classes equip into all 5 slots (leftHand, rightHand, headgear, armor, accessory). Ground-only `canEnter` for everyone in v1.

**Patterns to notice:**

- **Faith uniformly 70 (session 21)** — produces Faith_factor ≈ 0.49 (0.7²) for every magical cast in the demo. Down from session-20b's 0.64. Tuning lever for varying class magic effectiveness when calibration revisits per-class Faith.
- **Brave uniformly 70 (session 21)** — was 100. Reactions now trigger probabilistically (70% per attempt). The AI projection still treats reaction-triggering as deterministic at the planning stage; trigger-roll outcome is per-attempt RNG.
- **Crit baseline 5% / ×1.5** — Lightning Mage's Static Embrace pushes crit_chance higher (+20 → 25%).
- **HP scaled for L25 (session 21)** — Knight 144, mages 96–112. The previous 50–60 HP range was a low-tier baseline; current values target the post-MVP L25 design.
- **MP uniform 60 on mages (session 21)** — was 40-45 with class variation. Standardized so Cluster 4's `maxMpBase` introduction has a clean migration point.
- **PA / MA polarity widened** — Knight pa 11 / ma 4; mages pa 4 / ma 12-13. Reconciliation tightened the archetype distinction. Knight is now a sharp physical bruiser; mages are pure casters.
- **Class-free passive count rebalanced (session 26).** Each Mage now has 4 class-free passives (3 prior + the new Movement passive) covering one slot in each of reaction / support / movement. Knight has only `attack` free (the universal grant); their identity comes purely from equipped Battle Skill members and equipment.

---

## 2. Active abilities

Damage = base value × variance midpoint × resistance × evasion (physical) × Vulnerable (when applied) × crit expectation. v1 default Faith_factor = 0.64 for symmetric Faith-80 casts. The "Expected raw damage" column below is `baseStat × WP_or_1 × power_coefficient × Faith_factor` (or just `pa × wp × power_coefficient` for physical) at the demo's standard caster stats — quick scanning value, not a precise projection.

### Knight — Battle Skill (`battle_skill`)

All physical, weapon-tagged, hitRoll on, variance ±10%. Damage = PA × WP × power_coefficient. With Long Sword (WP 4) and PA 6:

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Statuses applied | Expected raw |
|---|---|---|---|---|---|---|---|
| **attack** | single_unit | 1 melee | 0 (instant) | 0 | 1.0 | — | 24 |
| **power_attack** | single_unit | 1 melee | 0 | 4 | 1.5 | — | 36 |
| **stasis_sword** | single_unit | 1 melee | 0 | 6 | 1.0 | Stop @ 50% (12 CT) — factors `{ brave, ma }` | 24 |
| **taunt** | single_unit | 4 arc | 0 | 4 | — | Taunted @ `applyAlways` (12 CT) | — |

### Knight — White Magic (`white_magic`)

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Tags | Expected raw |
|---|---|---|---|---|---|---|---|
| **cure** | single_unit | 4 arc | 0 | 4 | 5 | holy, healing, magical | MA × 5 × 0.64 = 12 (Faith-modulated heal) |

### Earth Mage — Earth Spells (`earth_spells`)

All magical, earth-tagged, no hitRoll. Expected raw damage = `MA × power_coefficient × Faith_factor`. With MA 8 and Faith 80 (factor 0.64):

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Statuses applied | Expected raw |
|---|---|---|---|---|---|---|---|
| **earth_strike** | single_unit | 4 arc | 30 | 4 | 6 | Movement Debuff @ 60% (36 CT) | 30.7 |
| **earth_blessing** | single_unit | 4 arc | 30 | 6 | — | Regen on ally @ 100% (36 CT) | — |
| **earth_curse** | single_unit | 4 arc | 30 | 8 | — | Blind @ 50% + Silence @ 50% (24 CT each, independent rolls) | — |
| **earth_quake** | tile (diamond r1) | 4 arc | 25 | 14 | 6 | Movement Debuff @ 50% per target (24 CT) | 30.7 / target |
| **earth_cataclysm** | tile (diamond r1) | 4 arc | 18 (Ultimate) | 30 | 10 | Poison @ 60% + Don't Act @ 40% + Don't Move @ 40% per target (24 CT each, independent) | 51.2 / target |

### Water Mage — Water Spells (`water_spells`)

All magical, water-tagged, no hitRoll. Expected raw with MA 7 (Faith_factor 0.64):

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Riders / statuses | Expected raw |
|---|---|---|---|---|---|---|---|
| **water_strike** | single_unit | 4 arc | 30 | 10 | 5 | ctPush rider: -floor(2 × MA) = -14 CT on hit | 22.4 |
| **tide_surge** | single_unit | 4 arc | 25 | 10 | — | ctEffect on ally: +floor(2 × MA) = +14 CT @ 80% baseChance | — |
| **tidal_wave** | tile (diamond r1) | 4 arc | 25 | 14 | 5 | knockback distance 1 @ 50%, uniform direction across cluster | 22.4 / target |
| **brine** | single_unit | 4 arc | 30 | 8 | — | Speed Down @ 50% (permanent, STACK_INDEPENDENT) | — |
| **maelstrom** | tile (cone rows [1,3,3], anchor=caster) | 4 arc | 18 (Ultimate) | 28 | 7 | knockback distance 1 (always) | 31.4 / target |

### Fire Mage — Fire Spells (`fire_spells`)

All magical, fire-tagged, no hitRoll. Expected raw with MA 9 (Faith_factor 0.64):

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Statuses applied | Expected raw |
|---|---|---|---|---|---|---|---|
| **fire_strike** | single_unit | 4 arc | 30 | 10 | 5 | linked (PA Down + MA Down) @ 60% / 1 magnitude / permanent | 28.8 |
| **fire_embrace** | single_unit | 3 arc | 25 | 8 | — | linked (PA Up + MA Up) on ally @ 80% / 1 magnitude / permanent | — |
| **fire_storm** | tile (diamond r1, 5 tiles; diamond r2, 13 tiles with Aether Bloom) | 4 arc | 25 | 16 | 4 | — | 23.0 / target |
| **spark** | single_unit | 4 arc | 28 | 10 | — | Burn ×2 stacks @ 80% (single roll for both) | applies BURN_COEFFICIENT 0.6 × MA = 5 dmg/stack/tick |
| **flame_lance** | tile (line length 4, anchor=caster, vTol 5) | 4 arc | 18 (Ultimate) | 28 | 6 | Burn ×1 stack `applyAlways` per hit | 34.6 / target + 5 dmg/stack/tick |

### Lightning Mage — Lightning Spells (`lightning_spells`)

All magical, lightning-tagged, no hitRoll. Expected raw with MA 8 (Faith_factor 0.64):

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Riders / statuses | Expected raw |
|---|---|---|---|---|---|---|---|
| **lightning_strike** | single_unit | 4 arc | 30 | 10 | 12 | — | 61.4 |
| **static_embrace** | single_unit | 3 arc | 25 | 10 | — | Crit_modifier on ally @ 80% / +20 magnitude / permanent / STACK_INDEPENDENT | — |
| **chain_lightning** | tile (diamond r1) | 4 arc | 25 | 14 | 8 + 1/extra | uniform across cluster (1→8, 2→9, 3→10) | 41.0 (1) / 46.1 (2) / 51.2 (3) |
| **magnetic_mark** | single_unit | 4 arc | 35 (faster) | 8 | — | Vulnerable @ 60% (one-shot ×1.5 next-hit) | — |
| **storm_caller** | single_unit | 4 arc | 18 (Ultimate) | 28 | 36 | selfDamage `0.25 × maxHpBase` (= 11 dmg @ HP 44) | 184.3 (huge — but watch self-cost) |

### Hidden ability (reaction-emitted)

| Ability | Notes | actSpd | mpCost | power_coef | Expected raw |
|---|---|---|---|---|---|
| **discharge_strike** | Emitted by `discharge` reaction; not in any First Action menu | 0 (instant) | 0 | 4 | MA 8 × 4 × 0.64 = 20.5 |

**Patterns to notice:**

- **Strike-tier baseline:** earth/water/fire all use `power_coefficient: 5-6` for their main strike. Lightning_strike at 12 is a clear outlier — premium scalar to compensate for "no rider, just damage." Worth verifying against other class identity intents.
- **AoE Ultimate cost:** earth_cataclysm 30 MP / fire's flame_lance 28 / water's maelstrom 28 / lightning's storm_caller 28. Earth's is +2 dearer; consider whether that matches the ultimate's relative impact.
- **Charge tier matches actionSpeed:** Strike tier uniformly 30 (slowest of the in-tier abilities resolves first), AoE tier 25, Ultimate tier 18. Lightning's `magnetic_mark` at 35 is the deliberate exception (faster — resolves before Strike in setup→exploit pattern).
- **Cure cost / power:** mp 4 for power 5 healing. With Knight's MA 4 and Faith 0.64, that's a 12-HP heal — restores ~20% of a Knight's max HP. Worth deciding if Cure should scale with caster MA more aggressively (currently anyone can cast Cure but Knights heal poorly).
- **Storm Caller's outlier scaling.** Coefficient 36 produces ~184 expected raw damage, easily one-shotting any v1 unit. Self-cost 11 (25% of 44 maxHp) is significant but survivable. Worth deciding whether the AI's `SELF_COST_DAMPING_FACTOR = 0.25` should scale with content density (currently rarely fires).

---

## 3. Passive abilities

| ID | Bucket | baseCost | Tags | Mechanism | Notes |
|---|---|---|---|---|---|
| **counter** | reaction | 1 | — | On `damage_received` (physical, no healing, minDamage 0): `use_ability` `attack` → attacker | BMG-faithful: triggers on attempt regardless of landed damage |
| **earth_resilience** | reaction | 2 | magical, earth | On `damage_received` (no healing, minDamage 1): `apply_status` movement_self_buff (+1 magnitude / 24 CT) → self | STACK_INDEPENDENT — repeated triggers stack additively |
| **tidal_pull** | reaction | 1 | magical, water | On `damage_received` (no healing, minDamage 1): `ct_push` +20 CT → self | Pulls Water Mage's next turn forward |
| **smolder** | reaction | 2 | magical, fire | On `damage_received` (no healing, minDamage 1): `apply_status` burn ×1 → attacker | Burn snapshots reactor's MA |
| **discharge** | reaction | 2 | magical, lightning | On `damage_received` (no healing, minDamage 1; **no tag filter — fires on physical AND magical**): `use_ability` discharge_strike → attacker | Magical retaliation |
| **earth_communion** | support | 1 | magical, earth | `modifyStatusApplicationChance` × 1.25 (universal — applies to all status applications) | Free for Earth Mage? **No** — costs 1 |
| **damage_reduction** | support | 2 | — | `onDamageReceived` × 0.75 multiplier on physical (post-resistance) | Composes multiplicatively with resistance |
| **flow_state** | support | 1 | magical, water | `onActionResolved`: refunds +10 CT after a `magical`-tagged action | Cure now has `magical` tag too (so refund triggers on Water Mage Cures) |
| **ignition** | support | 2 | fire | `onDamageDealt` (magical, no healing): emits `apply_status` burn ×1 on the target | Free for Fire Mage |
| **aether_bloom** | support | 2 | fire | `modifyAoeShape`: enlarges `magical`-tagged AoE shapes by one step | Free for Fire Mage. Fire Storm: cross r1 → cross r2; future magical AoEs scale similarly |
| **conductor** | support | 2 | lightning | `modifyStatQuery` × 1.25 multiplicative on `ma` | Free for Lightning Mage |
| **move_plus_1** | movement | 1 | — | `modifyStatQuery` +1 to `moveRange` | Universally available; currently equipped on every demo unit |
| **float** | movement | 2 | — | `modifyCanEnter` adds `'water'` terrain | `availability: 'hidden'` — no water tiles in v1 maps |
| **fly** | movement | 3 | — | `modifySpecialMovement` `'fly'` | `availability: 'hidden'` — drops jump check; only proven user |
| **bulwark_stance** | movement | 2 | — | `modifyStatQuery`: -1 moveRange / -1 jump / × 1.2 maxHp; `modifyEvasion` +10 front evade | Knight tank stance |
| **bedrock_stride** | movement | 2 | earth | `modifyStatQuery` +1 to `moveRange`; `modifySystemDamage` returns 0 when `source.kind === 'falling'` | Session 26. Free for Earth Mage. First v1 consumer of the `modifySystemDamage` hook (ADR-0052) |
| **hotfoot** | movement | 2 | fire | `modifyStatQuery` +1 to `moveRange`, +1 to `spd` | Session 26. Free for Fire Mage |
| **tidewalker** | movement | 1 | water | `modifyTerrainCosts` clones the input map and clamps water-tile cost to `max(1, current - 1)` | Session 26. Free for Water Mage. v1-marginal: no class has elevated water cost, so the floor pins at 1 (no behavioral change today). Forward-compatible with future high-cost water terrain types |
| **quickstep** | movement | 1 | lightning | `onTurnEnd`: if `state.turnState.consumed.movesConsumed > 0`, emits `system_ct_push` of `+ma` (queried via `runModifyStatQuery`) targeting self | Session 26. Free for Lightning Mage. First v1 consumer of the widened `onTurnEnd` hook (ADR-0053). At Lightning's L25 MA 12, a Move-committed turn refunds 12 CT |

**Patterns to notice:**

- **Reaction baseCost spread:** Counter 1, Tidal Pull 1, others 2. Worth checking whether Tidal Pull's CT manipulation is genuinely cheap (no damage, no debuff — just self-CT bump) or under-priced.
- **Free-passive grants (post-session-26).** The asymmetry called out in the prior snapshot is resolved — every Mage class now has parity in class-free count (1 reaction, 1 support, 1 movement). Knight is the outlier with only the universal `attack` free; their identity sits on the equipped Battle Skill command set. Earth/Water gained their reaction + support (`earth_resilience`/`earth_communion` for Earth; `tidal_pull`/`flow_state` for Water) as class-free between sessions 21–24; session 26 added the Movement-bucket parity passive for each Mage.
- **Damage Reduction × Bulwark Stance** stack multiplicatively: a Bulwark-stanced Knight with Damage Reduction takes physical hits at × 0.75 × (1 + maxHp 1.2 effective HP) — significant survivability budget. Watch when both ship on demo Knight.
- **Movement-bucket diversity (session 26).** Five viable Movement passives at L25: `move_plus_1` (cheap baseline), `bedrock_stride` (Earth — same +1 plus fall-immunity), `hotfoot` (Fire — +1 move + +1 spd), `tidewalker` (Water — water-cost reduction), `quickstep` (Lightning — CT refund on move-turn). With Movement bucket capacity 3, a build can stack two depending on capacity headroom; the demo loadout's universal `move_plus_1` choice is calibration-conservative.

---

## 4. Equipment

| ID | Slot | Effect | Notes |
|---|---|---|---|
| **long_sword** | rightHand (weapon) | WP 4, accuracy 95, tags `['sword']` | The only weapon equipped on demo Knights |
| **strength_ring** | accessory | `modifyStatQuery` +1 PA | In catalog, not equipped on demo |
| **boots_of_haste** | accessory | `statusGrants`: applies Haste (`permanent_per_unit_ct`) on equip | In catalog, not equipped on demo |
| **iron_helm** | headgear | `modifyStatQuery` +20 maxHpBase | In catalog, not equipped on demo |
| **iron_mail** | armor | `modifyStatQuery` +30 maxHpBase | In catalog, not equipped on demo |

**Patterns to notice:**

- **Catalog vs equipped surface:** 4 of 5 items aren't equipped on the demo because v1 tuning kept the demo damage numbers stable. Equipping Iron Helm (+20) and Iron Mail (+30) on Knight would push them from 60 HP to 110 HP — a major durability shift. Deliberate choice; revisit during calibration.
- **No mage-specific weapons / armor** yet. Mages fight unarmed (WP 1 default) and unarmored. The framework supports it (the equipmentSlots field is uniformly open across classes); content just hasn't shipped staves, robes, etc.
- **Boots of Haste** as a standing-Haste source. With the `permanent_per_unit_ct` durationMode it lasts as long as worn — effectively a +50% Speed boost. Not on demo because it'd massively reshuffle turn order.

---

## 5. Statuses

| ID | Polarity (aiHints) | Tags | Stacking | Duration | Magnitude / Effect |
|---|---|---|---|---|---|
| **haste** | buff | positive, time, dispellable | REFRESH | permanent_per_unit_ct | × magnitude on `spd` (default 1.5) |
| **stop** | (none — neither) | negative, time, mental | REFRESH | per_unit_ct | `queryTurnSkipped` returns "stopped"; suppresses status ticks |
| **charging** | (none — engine) | neutral, time | REJECT | conditional | `queryTurnSkipped` while caster's ChargedAction sits |
| **regen** | buff | positive | REFRESH | per_unit_ct | per CT-100 trigger emits `system_heal` for `Faith × maxHp × 0.10` |
| **movement_debuff** | (none) | negative, earth | REFRESH | per_unit_ct | -magnitude (default 1) on moveRange and jump (capped at 0) |
| **movement_self_buff** ("Earthen Resolve") | buff | positive, earth | STACK_INDEPENDENT | per_unit_ct | +magnitude (default 1) on moveRange and jump |
| **blind** | (none) | negative, mental | REFRESH | per_unit_ct | `modifyHitChance` × 0.5 |
| **silence** | (none) | negative, mental | REFRESH | per_unit_ct | Blocks `magical`/`voice`-tagged actions via onActionAttempted |
| **poison** | (none) | negative, poison | REFRESH | permanent_per_unit_ct | per CT-100 trigger emits `system_damage` for `0.10 × maxHpBase` |
| **dont_act** | (none) | negative, mental | REFRESH | per_unit_ct | Blocks volitional UseAbility (allows reactions) |
| **dont_move** | (none) | negative, physical | REFRESH | per_unit_ct | Blocks Move actions |
| **taunted** | (none) | negative, mental, dispellable | REFRESH | per_unit_ct (`removeOnSourceKO`) | Blocks 40% of attacks against non-source targets via stable hash |
| **speed_down** | (none) | negative, water | STACK_INDEPENDENT | permanent | -magnitude (default 1) on `spd`, no expiry |
| **burn** | (none) | negative, fire, dot | STACK_COUNT_ADDITIVE | custom (on_unit_ct_100) | Per-stack damage = `floor(applier.MA × 0.6)`, FIFO drop on decrement |
| **pa_up** | buff | positive | STACK_ADDITIVE | permanent | +magnitude (default 1) on `pa` |
| **pa_down** | (none) | negative, fire | STACK_ADDITIVE | permanent | -magnitude (default 1) on `pa` |
| **ma_up** | buff | positive | STACK_ADDITIVE | permanent | +magnitude (default 1) on `ma` |
| **ma_down** | (none) | negative, fire | STACK_ADDITIVE | permanent | -magnitude (default 1) on `ma` |
| **vulnerable** | (none) | negative, lightning | REFRESH | custom (on_damage_received) | × 1.5 multiplier on next non-healing hit, one-shot |
| **crit_modifier** | buff | positive | STACK_INDEPENDENT | permanent | +magnitude (default 20) on `crit_chance` |

**Patterns to notice:**

- **Buff-polarity declarations:** 6 statuses declare `aiHints: { polarity: 'buff' }`. Debuffs left undeclared (the AI treats undeclared as not-a-buff). Adding a new buff requires the declaration; debuffs are auto-handled.
- **Resistance tags:** earth-tagged debuffs (movement_debuff), water (speed_down), fire (burn, pa_down, ma_down), lightning (vulnerable). The status application formula reads `target.resistances[tag]` and multiplies `(1 - resistance/100)` into the chance. Demo units have no resistance entries — every magical-applied status lands at the unmodified `baseChance × Faith × MA` rate.
- **Permanent-for-the-battle vs CT-decaying:** PA/MA Up/Down + Crit_modifier + Speed Down are all `permanent` (no expiry). Burn, Vulnerable use `custom` triggers. Movement debuff/buff, blind, silence, poison, taunted, regen all use CT-based modes. Worth deciding whether the `permanent` shapes are gameplay-correct or whether some should decay (e.g., should Static Embrace's Crit_modifier last forever, or should it tie to the next attack like Vulnerable does?).
- **No "neither" polarity declared.** A few statuses (charging, stop) are clearly neither buff nor debuff but functional engine bookkeeping. Currently absent from the declaration; not a problem because the AI's only consumer is `isBuffStatus` (which returns false for undeclared). If a future feature needs explicit "neither," extend the union.

---

## 6. Ruleset constants (default ruleset)

| Field | Value | Notes |
|---|---|---|
| **CT costs** | moveOnly 50, actOnly 70, moveAndAct 100, wait 20, defend 20 | "Defend" not yet a content consumer |
| **Speed bounds** | floor 0, ceiling null | Stop pushes speed to 0 |
| **Default turn budget** | 1 Move, 1 Act | FFT default |
| **Range defaults** | melee horizontal 1 / vertical 3, minHorizontal 0, aoeVerticalTolerance 1 | |
| **Bucket capacities** | first 1, second 1, reaction 3, support 3, movement 3 | |
| **Friendly fire** | true | AoE damages allies caught in cluster |
| **Friendly pass-through** | true | Can route through allies, can't settle |
| **Units block LoS** | false | Straight-line LoS unblocked by units |
| **Reactions per unit per turn** | 1 | Dampens reaction chains |
| **Chain depth cap** | 8 | Hard cap on action-chain depth |
| **Damage pipeline stages** | base, attacker, target, environment, variance, cap, finalize | Per ADR-0010 |
| **Initial CT formula** | fixed value 0 | `speed_with_variance` variant available but not used |

---

## 7. Content holes and calibration questions

### Content holes (sized as roadmap candidates)

- **Class roster** — 5 classes. Floor candidates: Priest (healer), Time Mage (CT manipulation at scale), Thief (steal), Monk (unarmed + Chakra), Wizard (elemental damage tags at scale).
- **Status catalog** — ~20 ship. Conspicuous absences: Reflect, Protect, Shell, Float (status form, distinct from the movement passive), Berserk, Sleep, Confuse, Charm, Disable, Innocent, Slow, Quick, Reraise, Float-as-status. Many are tied to specific class kits (Priest will want Protect/Shell; Time Mage will want Slow/Quick/Demi).
- **Equipment** — 5 items, only Long Sword equipped. No mage weapons (staves), no armor variety, no consumable accessories.
- **Maps** — only the 6×6 flat-ground demo. Real maps with elevation, terrain variety, multi-layer.
- **Damage tags** — physical, magical, healing, holy, fire, water, earth, lightning, poison, weapon, sword. Conspicuous absences: ice, wind, dark, ranged, slash/pierce/blunt sub-physical.
- **Reactions ecosystem** — 5 reactions ship (counter, discharge, smolder, tidal_pull, earth_resilience). Coverage is class-bound; cross-classed builds have limited pool.

### Calibration questions surfaced

- **Cure scales with caster's MA, not the healer's archetype.** A Knight's Cure (MA 4) heals 12 HP; a Mage's Cure (MA 7-9) heals ~22-29. Intentional? Worth deciding.
- **Storm Caller never fires from the AI (per session 20a handoff).** With `SELF_COST_DAMPING_FACTOR = 0.25`, the projection-based scoring pushes Storm Caller below Lightning Strike + Mark in nearly every scenario. Either tier 2's projection makes it correctly rare (design intent), or the dampening is too aggressive. Look at the action log to confirm.
- **Magnetic Mark setup→exploit window is narrow.** With Lightning Strike one-shotting a 60 HP Knight, Mark only adds value against tougher targets (Iron Mail Knight at 90 HP). If we want Mark to fire more often, target HP needs to climb (equipment) or Strike's coefficient needs to come down.
- **Free-passive asymmetry.** Earth and Water Mages get 0 class-free passives; Fire and Lightning Mages get 2 each. Earth's Resilience and Water's Tidal Pull would be parallel candidates for class-free.
- **Brave 100 across the board** means every reaction is deterministic. Lower Brave (or per-class Brave variation) would create probabilistic-trigger gameplay distinct from tier-2's "if it would trigger, it triggers" model.
- **Faith uniformly 80** means all magical damage / healing / status chance scales identically across classes. Per-class Faith would let Earth Mage be the "reliable status applier" while Lightning Mage is the "burst caster" with lower Faith.
- **All resistance maps empty.** No demo unit has resistances. The signed-max composition machinery is built but unexercised. Adding even one elemental-resistant unit would surface several scoring questions.
- **Crit baseline 5%.** Combined with × 1.5 multiplier and Vulnerable × 1.5 (one-shot), worst-case burst is ~108 damage from a Lightning Mage on a marked, crit-rolled, Vulnerable target. Flagged in ADR-0032's calibration notes; might need a multiplicative cap or a Vulnerable adjustment if playtest confirms it's too swingy.
- **Movement / jump / equipment slots are uniformly open across classes.** No archetype-specific restrictions (Knight can wear cloth; Mage can wield Long Sword). Intended for v1 simplicity but worth deciding whether an equipment-restriction system is wave-3 territory.

---

## 8. AI-side notes (for design awareness)

The tier-2 AI's scoring formula is roughly:

```
score = projectedDamage × killValue(target) × (1 − reactionPenalty(target, ability))
```

Where:
- `projectedDamage` is the live damage pipeline run with deterministic substitutes for the random handlers.
- `killValue(target) = 1 / max(0.05, target.hp / target.maxHp)` — a low-HP target is more valuable.
- `reactionPenalty` consumes `reactionFields.triggerCondition` to filter reactions whose tag-gates wouldn't fire against the proposed ability.
- Self-cost dampening multiplies by 0.25 for selfDamage abilities (Storm Caller).
- Magnetic Mark scores by marginal damage gain from Vulnerable on the strongest follow-up.
- Static Embrace and other ally buffs score by `target.MA × #offensives × 0.3`.

Calibration knobs the AI is sensitive to:
- `power_coefficient`s — directly drive projectedDamage.
- Faith — both sides, multiplicative on magical/healing.
- crit_chance / crit_multiplier — folded as expected value.
- maxHpBase — denominator of killValue; low maxHp targets get higher kill weight.
- resistance — folded into projectedDamage at the resistance_check stage.
- mpCost — gates ability availability via the MP affordability filter.
- selfDamage fraction — refusal threshold for self-KO; otherwise dampens.

Calibration knobs the AI is NOT sensitive to (won't show in playtest until UI/log surfaces them):
- Brave — only affects reaction *trigger probability*, not whether the AI considers the reaction (deterministic at Brave 100).
- actionSpeed — the AI doesn't model "I'll be skipped while this charges."
- Stacking rules other than visible damage / multiplier — Burn's per-stack damage is folded into projection only when the projection includes a stack-effective MA (it doesn't; tier 2 projects the immediate hit, not future ticks).

---

## 9. References

- `docs/content-id-registry.md` — id ↔ name lookup, file paths.
- `docs/progress.md` — project-wide status and what's resolved.
- `docs/roadmap.md` — sequenced session plan, including completed sessions 14-20b.
- `docs/handoff.md` — note from the most-recent session to the next.
- `docs/decisions/0028-equipment-integration.md` — equipment system shape.
- `docs/decisions/0030-custom-trigger-status-pattern.md` — Burn / Vulnerable substrate.
- `docs/decisions/0032-lightning-mage-substrate.md` — crit, chain, self-damage, Vulnerable.
- `docs/decisions/0033-ai-tier-2-projection-and-joint-planner.md` — current AI shape, projection contract.
- `docs/decisions/0049-availability-tag-and-catalog-validator.md` — session 25; presentation-only hide bit on abilities / items / command sets.
- `docs/decisions/0050-uniform-int-initial-ct.md` — session 25; pre-battle CT jitter.
- `docs/decisions/0052-modify-system-damage-hook.md` — session 26; single modification seam for system-emitted damage (Bedrock Stride's fall-immunity).
- `docs/decisions/0053-on-turn-end-emission-widening.md` — session 26; widened `onTurnEnd` signature (state + catalog in args, OnTurnEndResult in return) so passives can emit follow-on actions at turn end. Quickstep is the first consumer.
- `docs/decisions/0054-terrain-texture-infrastructure.md` — session 26; renderer-side texture-overlay pattern + deterministic per-tile variant pick.
