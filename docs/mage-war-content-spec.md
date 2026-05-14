# Mage War Content Spec — Post-Reconciliation

*Synthesis document — captured 2026-05-09.*

This document is the consensus target for the five Mage War classes following the post-Session-20 reconciliation pass. It supersedes the implementation snapshot (`content-snapshot.md`) wherever the two diverge: when source files differ from this document, **this document is the calibration target** and source files should be updated to match.

The document is intended as input to an early reconciliation session in the post-20 roadmap, where the implementer aligns the engine and content layers with the targets here.

## Tuning anchors

- **Battle level:** L25 (calibration anchor; class stat curves yield the targets below at L25)
- **Default Brave / Faith:** 70 / 70 (user-adjustable per team builder, range 40–90)
- **Faith_factor:** 0.49 (= 0.7 × 0.7) for symmetric magical interactions
- **Brave_factor:** 0.70 for physical attacks and Brave-gated reactions
- **Crit baseline:** 5% chance, ×1.5 multiplier; `crit_chance` engine-clamped to [0, 100]
- **Initial CT at battle start:** uniform integer roll in [0, 20] per unit (per deployment-phase architecture)

---

## 1. Class baselines at L25

| Class | HP | MP | PA | MA | Speed | Move/Jump | Evasion (F/S/B) |
|---|---|---|---|---|---|---|---|
| **Knight** | 144 | 20 | 11 | 4 | 9 | 3 / 2 | 0 / 0 / 0 |
| **Earth Mage** | 112 | 60 | 4 | 12 | 8 | 3 / 3 | 8 / 5 / 0 |
| **Water Mage** | 102 | 60 | 4 | 12 | 10 | 4 / 3 | 10 / 6 / 0 |
| **Fire Mage** | 97 | 60 | 4 | 13 | 9 | 3 / 3 | 6 / 4 / 0 |
| **Lightning Mage** | 87 | 60 | 4 | 14 | 9 | 4 / 3 | 7 / 4 / 0 |

Class stat curves should be defined to produce these values at L25 (linear-ish progression from L1; specific coefficient choices left to implementation). Move/Jump and Evasion stay flat across levels per the existing per-class baselines.

All classes equip into all 5 slots (rightHand, leftHand, headgear, armor, accessory). Ground-only `canEnter` for v1.

**Notes on the recalibration:**
- Knight is significantly beefier (144 HP vs current 60). This is the equipment-doc anchor and what makes equipment effects (e.g., +90 HP from Soldier's Leathers) properly proportionate rather than HP-doubling.
- Mages have ~2× the MP of current implementation (60 vs ~42-45). Spells with 8-30 MP cost can now be cast 4-7+ times per battle; equipment like Wizard's Robe (+40 MP) becomes a meaningful budget extension.
- MA bumped substantially for mages (12-14 vs 7-9). Spell power coefficients are recalibrated below to land at correct damage targets given the new MA × Faith_factor 0.49 math.
- Brave 70 means reactions trigger probabilistically (~70% per BMG), not deterministically. This is a meaningful play-feel change from the current Brave 100 testing tuning.

---

## 2. Class-free passives (parity rule)

Every class gets its in-class reaction and support as zero-cost class-inherent passives. They count as equipped abilities for hook purposes but do not consume bucket capacity. Knight additionally retains its `move_plus_1` movement passive as class-free.

| Class | Class-free abilities |
|---|---|
| **Knight** | counter (R), damage_reduction (S), move_plus_1 (M) |
| **Earth Mage** | earth_resilience (R), earth_communion (S) |
| **Water Mage** | tidal_pull (R), flow_state (S) |
| **Fire Mage** | smolder (R), ignition (S), aether_bloom (S) |
| **Lightning Mage** | discharge (R), conductor (S) |

Fire Mage retains two class-free supports (ignition + aether_bloom) intentionally — both are core to Fire's identity surface. All other classes have one R + one S free.

Class-free abilities are still equipped if the unit also wants the same ability — i.e., a Knight in another class who wants Counter must equip it explicitly (and pay the bucket cost).

---

## 3. Active abilities (per class)

Damage formulas:
- **Physical:** `PA × WP × power_coefficient × Brave_factor × variance × hit_landed`
- **Magical:** `MA × power_coefficient × Faith_factor × resistance_modifier`

Spell-tier power coefficients (per the post-reconciliation calibration):

| Tier | Earth | Water | Fire | Lightning |
|---|---|---|---|---|
| Strike | 8 | 8 | 8 | 12 |
| AoE | 7 | 7 | 6 | 9 + 1 / extra target |
| Ultimate | 12 | 12 | 10 | 36 |

### Knight — Battle Skill (`battle_skill`)

All physical, weapon-tagged, hitRoll on, variance ±10%. Damage = PA × WP × power_coefficient × Brave_factor.

Demo expected damage assumes Long Sword (WP 8) and PA 11; Brave_factor 0.70.

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Statuses applied | Expected raw |
|---|---|---|---|---|---|---|---|
| **attack** | single_unit | 1 melee | 0 (instant) | 0 | 1.0 | — | 62 |
| **power_attack** | single_unit | 1 melee | 0 | 4 | 1.5 | — | 92 |
| **stasis_sword** | single_unit | 1 melee | 0 | 6 | 1.0 | Stop @ 50% (12 CT), factors `{brave, ma}` | 62 |
| **taunt** | single_unit | 4 arc | 0 | 4 | — | Taunted @ `applyAlways` (12 CT) | — |

### Knight — White Magic (`white_magic`)

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Tags | Notes |
|---|---|---|---|---|---|---|---|
| **cure** | single_unit | 4 arc | 0 | 4 | 5 | holy, healing, magical | MA × 5 × 0.49; Knight Cure heals ~10 HP — see open items |

### Earth Mage — Earth Spells (`earth_spells`)

All magical, earth-tagged, no hitRoll. Demo expected damage with MA 12 and Faith_factor 0.49.

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Statuses applied | Expected raw |
|---|---|---|---|---|---|---|---|
| **earth_strike** | single_unit | 4 arc | 30 | 4 | 8 | Movement Debuff @ 60% (36 CT) | 47 |
| **earth_blessing** | single_unit | 4 arc | 30 | 6 | — | Regen on ally @ 100% (36 CT) | — |
| **earth_curse** | single_unit | 4 arc | 30 | 8 | — | Blind @ 50% + Silence @ 50% (24 CT each, independent rolls) | — |
| **earth_quake** | tile (cross r1) | 4 arc | 25 | 14 | 7 | Movement Debuff @ 50% per target (24 CT) | 41 / target |
| **earth_cataclysm** | tile (cross r1) | 4 arc | 18 (Ultimate) | 30 | 12 | Poison @ 60% + Don't Act @ 40% + Don't Move @ 40% per target (24 CT each, independent) | 71 / target |

### Water Mage — Water Spells (`water_spells`)

All magical, water-tagged, no hitRoll. Demo expected damage with MA 12 and Faith_factor 0.49.

CT push magnitude scales as `floor(2 × MA)` = 24 CT at MA 12 (vs ~14 at the implementation's MA 7). This is intended; CT manipulation is Water's identity, scaling with caster's MA.

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Riders / statuses | Expected raw |
|---|---|---|---|---|---|---|---|
| **water_strike** | single_unit | 4 arc | 30 | 10 | 8 | ctPush rider: -floor(2 × MA) = -24 CT on hit | 47 |
| **tide_surge** | single_unit | 4 arc | 25 | 10 | — | ctEffect on ally: +floor(2 × MA) = +24 CT @ 80% baseChance | — |
| **tidal_wave** | tile (diamond r1) | 4 arc | 25 | 14 | 7 | knockback distance 1 @ 50%, uniform direction across cluster | 41 / target |
| **brine** | single_unit | 4 arc | 30 | 8 | — | Speed Down @ 50% (permanent, STACK_INDEPENDENT) | — |
| **maelstrom** | tile (cone rows [1,3,3], anchor=caster) | 4 arc | 18 (Ultimate) | 28 | 12 | knockback distance 1 (always) | 71 / target |

### Fire Mage — Fire Spells (`fire_spells`)

All magical, fire-tagged, no hitRoll. Demo expected damage with MA 13 and Faith_factor 0.49.

Burn per-stack damage = `floor(applier.MA × 0.6)` = 7 dmg/stack/tick at MA 13.

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Statuses applied | Expected raw |
|---|---|---|---|---|---|---|---|
| **fire_strike** | single_unit | 4 arc | 30 | 10 | 8 | linked (PA Down + MA Down) @ 60% / 1 magnitude / permanent | 51 |
| **fire_embrace** | single_unit | 3 arc | 25 | 8 | — | linked (PA Up + MA Up) on ally @ 80% / 1 magnitude / permanent | — |
| **fire_storm** | tile (cross r1; cross r2 with Aether Bloom) | 4 arc | 25 | 16 | 6 | — | 38 / target |
| **spark** | single_unit | 4 arc | 28 | 10 | — | Burn ×2 stacks @ 80% (single roll for both) | applies 7 dmg/stack/tick |
| **flame_lance** | tile (line length 4, anchor=caster, vTol 5) | 4 arc | 18 (Ultimate) | 28 | 10 | Burn ×1 stack `applyAlways` per hit | 64 / target + 7 dmg/stack/tick |

### Lightning Mage — Lightning Spells (`lightning_spells`)

All magical, lightning-tagged, no hitRoll. Demo expected damage with MA 14 and Faith_factor 0.49.

| Ability | Targeting | Range | actSpd | mpCost | power_coef | Riders / statuses | Expected raw |
|---|---|---|---|---|---|---|---|
| **lightning_strike** | single_unit | 4 arc | 30 | 10 | 12 | — | 82 |
| **static_embrace** | single_unit | 3 arc | 25 | 10 | — | Crit_modifier on ally @ 80% / +20 magnitude / permanent / STACK_INDEPENDENT | — |
| **chain_lightning** | tile (diamond r1) | 4 arc | 25 | 14 | 9 + 1/extra | uniform across cluster (1→9, 2→10, 3→11) | 62 (1) / 69 each = 138 (2) / 75 each = 226 (3) |
| **magnetic_mark** | single_unit | 4 arc | 35 (faster) | 8 | — | Vulnerable @ 60% (one-shot ×1.5 next-hit) | — |
| **storm_caller** | single_unit | 4 arc | 18 (Ultimate) | 28 | 36 | selfDamage `0.25 × maxHpBase` (= 22 dmg @ HP 87) | 247 |

### Hidden ability (reaction-emitted)

| Ability | Notes |
|---|---|
| **discharge_strike** | Emitted by `discharge` reaction; not in any First Action menu. Power 4, MA-scaled. Hidden from team builder. |

---

## 4. R/S/M ability costs

Cost framework: 1 = simple single-effect; 2 = bundled multi-effect, scaling effect, or status-application. No 3-cost abilities in v1; tier reserved for future content.

Base bucket capacities: R 3 / S 3 / M 3. With Steel Helm (+1 R) or Augmentor (+1 S) caps lift to 4 in those buckets.

### Reactions

| ID | Cost | Effect | Class-free for |
|---|---|---|---|
| **counter** | 1 | On `damage_received` (physical, no healing): use_ability `attack` → attacker | Knight |
| **earth_resilience** | 1 | On `damage_received` (no healing, minDamage 1): apply movement_self_buff (+1 magnitude / 24 CT) → self. STACK_INDEPENDENT. | Earth Mage |
| **tidal_pull** | 1 | On `damage_received`: ct_push +20 CT → self | Water Mage |
| **smolder** | 2 | On `damage_received` (no healing, minDamage 1): apply burn ×1 → attacker | Fire Mage |
| **discharge** | 2 | On `damage_received` (no tag filter — physical AND magical): use_ability `discharge_strike` → attacker | Lightning Mage |

**Change from snapshot:** `earth_resilience` drops from 2 → 1 (self-buff utility, no direct attacker punishment).

### Supports

| ID | Cost | Effect | Class-free for |
|---|---|---|---|
| **earth_communion** | 1 | `modifyStatusApplicationChance` × 1.25 (universal) | Earth Mage |
| **flow_state** | 1 | `onActionResolved`: refunds +10 CT after a `magical`-tagged action | Water Mage |
| **damage_reduction** | 2 | `onDamageReceived` × 0.75 multiplier on physical (post-resistance) | Knight |
| **ignition** | 2 | `onDamageDealt` (magical, no healing): emits apply burn ×1 on target | Fire Mage |
| **aether_bloom** | 2 | `modifyAoeShape`: enlarges `magical`-tagged AoE shapes by one step | Fire Mage |
| **conductor** | 2 | `modifyStatQuery` × 1.25 multiplicative on `ma` | Lightning Mage |

**Change from snapshot:** none. Support costs were well-priced.

### Movement

| ID | Cost | Effect | Class-free for | Availability |
|---|---|---|---|---|
| **move_plus_1** | 1 | `modifyStatQuery` +1 to `moveRange` | Knight | available |
| **tidewalker** *(new)* | 1 | `modifyTerrainCost`: water tile cost -1 (minimum 1) | Water Mage | available |
| **quickstep** *(new)* | 1 | `onTurnEnd` after a Move action: refund `MA` CT (one-time per turn) | Lightning Mage | available |
| **bedrock_stride** *(new)* | 2 | `modifyStatQuery` +1 to `moveRange`; `modifyDamageReceived` immune to fall damage | Earth Mage | available |
| **hotfoot** *(new)* | 2 | `modifyStatQuery` +1 to `moveRange`, +1 to `spd` | Fire Mage | available |
| **bulwark_stance** | 2 | `modifyStatQuery` -1 moveRange, -1 jump, ×1.2 maxHp; `modifyEvasion` +10 front evade | — | available |
| **float** | 1 | `modifyTerrainCosts`: every terrain cost → `min(cost, 1)` | — | available |
| **fly** | 2 | `modifySpecialMovement` `'fly'` (drops jump check) | — | **hidden** |

**Changes from snapshot:**
- `float` drops from 2 → 1
- `fly` drops from 3 → 2, marked hidden
- Four new movement abilities: tidewalker (Water), quickstep (Lightning), bedrock_stride (Earth), hotfoot (Fire)

**Float redesign (Session 33.5):** originally `modifyCanEnter` adds `'water'` terrain. Under Session 33's universal-water-enter convention (ADR-0073) every class can already enter water at a cost penalty, so that role became a no-op against the production catalog. Float is now the universal terrain-cost leveller — `modifyTerrainCosts` flattens *every* registered terrain's move cost to `min(cost, 1)`, tag-agnostic, forward-compatible for future high-cost terrains (swamp, sand, mud). It is now `available`. Differentiates against the future Walk-on-Water passive (water-only) and Fly (Float + elevation-ignoring).

---

## 5. Availability tag

A new `availability` field on ability and item definitions filters what the team builder shows users (and what AI team generation considers). Engine semantics are unchanged; this is purely a content-presentation layer.

```typescript
type Availability = 'available' | 'hidden';
```

- `available` (default): selectable in team builder, considered in AI team generation
- `hidden`: not selectable in team builder, not considered in AI team generation, but fully functional if a unit happens to have it equipped (e.g., from test fixtures or future progression unlocks)

Validation requires `availability` annotation on every ability and item; engine catalog load fails if missing.

### Hidden abilities (v1)

| ID | Reason hidden |
|---|---|
| fly | Reserved for future class tie-in |
| discharge_strike | Internal — emitted by discharge reaction, not directly equippable |

(`float` became `available` in Session 33.5 — see the Movement abilities table above.)

### Hidden equipment (v1)

These are test items that survive in the engine for test suite use but should not appear in team builder or AI generation.

| ID | Reason hidden |
|---|---|
| iron_helm | Test fixture; superseded by equipment-doc head armor (Guard Cap, Steel Helm, etc.) |
| iron_mail | Test fixture; superseded by equipment-doc body armor (Battle Gear, Soldier's Leathers, etc.) |
| strength_ring | Test fixture; closest equivalent in equipment doc is Diamond Bracelet (+1 PA / +1 MA) |

### Visible equipment retained (v1)

| ID | Notes |
|---|---|
| long_sword | Update WP 4 → 8 to match equipment doc spec |
| boots_of_haste | Survives as-is; matches equipment doc's "Auto-Haste Boots" |

### New equipment to author

All other items in `mage-war-equipment.md` (~25-30 items across weapons, shields, body, head, accessories) need to be authored. The equipment doc is the spec.

---

## 6. Permanent vs decaying status durations

A reminder of the call: **stat-modifying buffs/debuffs are permanent for the duration of the battle.** This applies to PA Up/Down, MA Up/Down, Speed Down, and Crit_modifier. Once applied = sticks for the battle. Opportunity cost is the casting turn.

`crit_chance` is engine-clamped to [0, 100] so multi-stack Crit_modifier doesn't roll into undefined territory.

Other status durations remain as currently implemented (per_unit_ct, custom triggers, etc.).

---

## 7. Open items

Items still to settle, either before the early reconciliation session or as part of subsequent roadmap planning:

- **Cure ownership.** Knight's Cure with MA 4 heals ~10 HP at L25 — basically irrelevant for emergency healing. Options: leave as-is (Knight has weak self-heal as utility), remove from Knight (no in-class healing), make Cure scale on caster's max HP rather than MA so output is class-agnostic, or defer healing as a Priest-class ability for post-Mage-War.
- **Brave 70 reaction-trigger feel.** At Brave 70 vs current Brave 100, every reaction has a 30% miss rate. Verify this is the intended play feel during early playtest; if reactions feel too unreliable, consider higher class-baseline Brave for some classes.
- **Ultimate AI scoring.** Storm Caller's `SELF_COST_DAMPING_FACTOR = 0.25` was tuned against the demo's small numbers. With Storm Caller now doing ~247 damage vs ~22 self-damage at L25, the spell is even more efficient, so the dampening should still suppress it appropriately for the AI — but verify in playtest.
- **Long Sword availability across classes.** Equipment doc says Long Sword has no class restriction, so a Mage could equip Long Sword + Wizard's Robe. This is intended per the equipment doc's "incentive-based not restriction-based" philosophy. Confirm the engine doesn't have residual class-locked weapon assumptions.
- **Demo battle config preservation.** Current `demo.ts` is the test fixture and feeds the existing test suite. Decide: update demo.ts in place to use new tuning, or keep demo.ts frozen for test-suite stability and create a separate `mage-war-first-playable.ts` battle config for the rebalanced numbers.
