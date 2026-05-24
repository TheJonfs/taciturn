# Content ID Registry

*Started session 16 (2026-05-06).*

A flat lookup table of every content ID currently in the catalog: `id` (used internally everywhere — command sets, hook lookups, tests, debug fixtures) ↔ `name` (display string, freely renamable).

Use this as a quick reference when:
- Renaming abilities / statuses / classes (touch `name`, leave `id` alone unless you commit to a multi-file rename).
- Adding new content (pick an id that doesn't collide; add a row here).
- Reviewing the current content surface at a glance.

Keep this in sync with the catalog. If you rename a `name`, update the row. If you add a new content item, append a row.

---

## Classes

| ID | Name | File |
|---|---|---|
| `knight` | Knight | `src/content/classes/knight.ts` |
| `earth_mage` | Earth Mage | `src/content/classes/earth-mage.ts` |
| `water_mage` | Water Mage | `src/content/classes/water-mage.ts` |
| `fire_mage` | Fire Mage | `src/content/classes/fire-mage.ts` |
| `lightning_mage` | Lightning Mage | `src/content/classes/lightning-mage.ts` |
| `alchemist` | Alchemist | `src/content/classes/alchemist.ts` |
| `assassin` | Assassin | `src/content/classes/assassin.ts` |
| `hunter` | Hunter | `src/content/classes/hunter.ts` |

## Command sets

| ID | Name | Members | File |
|---|---|---|---|
| `battle_skill` | Battle Skill | `power_attack`, `lightning_stab`, `taunt` (S42: Stasis Sword → Lightning Stab; `attack` surfaced via class freeAbilities) | `src/content/command-sets/battle-skill.ts` |
| `shadow_arts` | Shadow Arts | `shadow_stitch`, `blowdart`, `undermine`, `sow_doubt` | `src/content/command-sets/shadow-arts.ts` |
| `marksmanship` | Marksmanship | `pin_down`, `charged_attack`, `scramble` | `src/content/command-sets/marksmanship.ts` |
| `alchemy` | Alchemy | `compound`, `throw_item` | `src/content/command-sets/alchemy.ts` |
| `white_magic` | White Magic | `cure` | `src/content/command-sets/white-magic.ts` |
| `arcane_skill` | Arcane Skill | `bolt` | `src/content/command-sets/arcane-skill.ts` |
| `earth_spells` | Earth Spells | `earth_strike`, `earth_blessing`, `earth_curse`, `earth_quake`, `earth_cataclysm` | `src/content/command-sets/earth-spells.ts` |
| `water_spells` | Water Spells | `water_strike`, `tide_surge`, `tidal_wave`, `brine`, `maelstrom` | `src/content/command-sets/water-spells.ts` |
| `fire_spells` | Fire Spells | `fire_strike`, `fire_embrace`, `fire_storm`, `spark`, `flame_lance` | `src/content/command-sets/fire-spells.ts` |
| `lightning_spells` | Lightning Spells | `lightning_strike`, `static_embrace`, `chain_lightning`, `magnetic_mark`, `storm_caller` | `src/content/command-sets/lightning-spells.ts` |

## Active abilities

| ID | Name | Bucket | Charged? | File |
|---|---|---|---|---|
| `attack` | Attack | first_action | no | `src/content/abilities/attack.ts` |
| `power_attack` | Power Attack | first_action | no | `src/content/abilities/power-attack.ts` |
| `stasis_sword` | Stasis Sword | first_action | no | `src/content/abilities/stasis-sword.ts` |
| `taunt` | Taunt | first_action | no | `src/content/abilities/taunt.ts` |
| `cure` | Cure | second_action | no | `src/content/abilities/cure.ts` |
| `bolt` | Bolt | first_action | yes (actionSpeed 25) | `src/content/abilities/bolt.ts` |
| `earth_strike` | Earth Strike | first_action | yes (actionSpeed 30) | `src/content/abilities/earth-strike.ts` |
| `earth_blessing` | Earth's Blessing | first_action | yes (actionSpeed 30) | `src/content/abilities/earth-blessing.ts` |
| `earth_curse` | Earth Curse | first_action | yes (actionSpeed 30) | `src/content/abilities/earth-curse.ts` |
| `earth_quake` | Earth Quake | first_action | yes (actionSpeed 25, AoE cross-r1) | `src/content/abilities/earth-quake.ts` |
| `earth_cataclysm` | Earth Cataclysm | first_action | yes (actionSpeed 18, AoE cross-r1) | `src/content/abilities/earth-cataclysm.ts` |
| `water_strike` | Water Strike | first_action | yes (actionSpeed 30, ctPush rider) | `src/content/abilities/water-strike.ts` |
| `tide_surge` | Tide Surge | first_action | yes (actionSpeed 25, ally CT bump) | `src/content/abilities/tide-surge.ts` |
| `tidal_wave` | Tidal Wave | first_action | yes (actionSpeed 25, AoE diamond-r1, knockback rider) | `src/content/abilities/tidal-wave.ts` |
| `brine` | Brine | first_action | yes (actionSpeed 30, Speed Down debuff) | `src/content/abilities/brine.ts` |
| `maelstrom` | Maelstrom | first_action | yes (actionSpeed 18, cone caster-anchored, always-knockback) | `src/content/abilities/maelstrom.ts` |
| `fire_strike` | Fire Strike | first_action | yes (actionSpeed 30, linked PA Down + MA Down rider) | `src/content/abilities/fire-strike.ts` |
| `fire_embrace` | Fire Embrace | first_action | yes (actionSpeed 25, linked PA Up + MA Up on ally) | `src/content/abilities/fire-embrace.ts` |
| `fire_storm` | Fire Storm | first_action | yes (actionSpeed 25, AoE cross-r1 base; cross-r2 with Aether Bloom) | `src/content/abilities/fire-storm.ts` |
| `spark` | Spark | first_action | yes (actionSpeed 28, applies 2 stacks of Burn on a single roll) | `src/content/abilities/spark.ts` |
| `flame_lance` | Flame Lance | first_action | yes (actionSpeed 18, line length 4 caster-anchored, applyAlways Burn) | `src/content/abilities/flame-lance.ts` |
| `lightning_strike` | Lightning Strike | first_action | yes (actionSpeed 30, raw power 12 magical lightning) | `src/content/abilities/lightning-strike.ts` |
| `static_embrace` | Static Embrace | first_action | yes (actionSpeed 25, applies Crit_modifier +20 on ally) | `src/content/abilities/static-embrace.ts` |
| `chain_lightning` | Chain Lightning | first_action | yes (actionSpeed 25, AoE diamond-r1 with chainBonus +1 power per additional target) | `src/content/abilities/chain-lightning.ts` |
| `magnetic_mark` | Magnetic Mark | first_action | yes (actionSpeed 35 — deliberately slow, applies Vulnerable) | `src/content/abilities/magnetic-mark.ts` |
| `storm_caller` | Storm Caller | first_action | yes (actionSpeed 18, power 36 single-target with 25% maxHp self-cost) | `src/content/abilities/storm-caller.ts` |
| `discharge_strike` | Discharge Strike | first_action | no (instant, reaction-only payload — emitted by Discharge passive) | `src/content/abilities/discharge-strike.ts` |
| `pin_down` | Pin Down | first_action | no (instant, Slow applier — Brave-and-Speed formula, baseChance 50, 4 turns) | `src/content/abilities/pin-down.ts` |
| `charged_attack` | Charged Attack | first_action | yes (actionSpeed 25, physical bow, power_coefficient 1.5) | `src/content/abilities/charged-attack.ts` |
| `scramble` | Scramble | first_action | no (instant, `selfMove` reposition — 1 tile, jump delta 5) | `src/content/abilities/scramble.ts` |
| `undertow` | Undertow | first_action | no (hidden; Riptide Bow proc — PA-scaled CT push, factor -3) | `src/content/abilities/undertow.ts` |
| `wand_of_lumen_apply_shift` | Wand of Lumen Resonance | first_action | no (hidden; Lumen proc — applies tagged_resistance_shift +Earth/−Water) | `src/content/abilities/wand-of-lumen-apply-shift.ts` |

## Passive abilities

| ID | Name | Bucket | File |
|---|---|---|---|
| `move_plus_1` | Move +1 | movement | `src/content/abilities/move-plus-1.ts` |
| `float` | Float | movement | `src/content/abilities/float.ts` |
| `fly` | Fly | movement | `src/content/abilities/fly.ts` |
| `counter` | Counter | reaction | `src/content/abilities/counter.ts` |
| `earth_resilience` | Earth Resilience | reaction | `src/content/abilities/earth-resilience.ts` |
| `earth_communion` | Earth Communion | support | `src/content/abilities/earth-communion.ts` |
| `damage_reduction` | Damage Reduction | support | `src/content/abilities/damage-reduction.ts` |
| `tidal_pull` | Tidal Pull | reaction | `src/content/abilities/tidal-pull.ts` |
| `flow_state` | Flow State | support | `src/content/abilities/flow-state.ts` |
| `smolder` | Smolder | reaction | `src/content/abilities/smolder.ts` |
| `ignition` | Ignition | support | `src/content/abilities/ignition.ts` |
| `aether_bloom` | Aether Bloom | support | `src/content/abilities/aether-bloom.ts` |
| `discharge` | Discharge | reaction | `src/content/abilities/discharge.ts` |
| `conductor` | Conductor | support | `src/content/abilities/conductor.ts` |
| `updraft` | Updraft | reaction | `src/content/abilities/updraft.ts` |
| `eagle_eye` | Eagle Eye | support | `src/content/abilities/eagle-eye.ts` |
| `high_jump` | High Jump | movement | `src/content/abilities/high-jump.ts` |

## Status types

| ID | Name | Tag(s) | Stacking | Duration | File |
|---|---|---|---|---|---|
| `haste` | Haste | positive, time | REFRESH | permanent_per_unit_ct | `src/content/statuses/haste.ts` |
| `stop` | Stop | negative, time, mental | REFRESH | per_unit_ct | `src/content/statuses/stop.ts` |
| `charging` | Charging | neutral, time | REJECT | conditional | `src/content/statuses/charging.ts` |
| `regen` | Regen | positive | REFRESH | per_unit_ct | `src/content/statuses/regen.ts` |
| `movement_debuff` | Movement Debuff | negative, earth | REFRESH | per_unit_ct | `src/content/statuses/movement-debuff.ts` |
| `movement_self_buff` | Earthen Resolve | positive, earth | STACK_INDEPENDENT | per_unit_ct | `src/content/statuses/movement-self-buff.ts` |
| `blind` | Blind | negative, mental | REFRESH | per_unit_ct | `src/content/statuses/blind.ts` |
| `silence` | Silence | negative, mental | REFRESH | per_unit_ct | `src/content/statuses/silence.ts` |
| `poison` | Poison | negative, poison | REFRESH | permanent_per_unit_ct | `src/content/statuses/poison.ts` |
| `dont_act` | Don't Act | negative, mental | REFRESH | per_unit_ct | `src/content/statuses/dont-act.ts` |
| `dont_move` | Don't Move | negative, physical | REFRESH | per_unit_ct | `src/content/statuses/dont-move.ts` |
| `taunted` | Taunted | negative, mental, dispellable | REFRESH | per_unit_ct (removeOnSourceKO) | `src/content/statuses/taunted.ts` |
| `speed_down` | Speed Down | negative, water | STACK_INDEPENDENT | permanent | `src/content/statuses/speed-down.ts` |
| `burn` | Burn | negative, fire, dot | STACK_COUNT_ADDITIVE | custom (on_unit_ct_100) | `src/content/statuses/burn.ts` |
| `pa_up` | PA Up | positive | STACK_ADDITIVE | permanent | `src/content/statuses/pa-up.ts` |
| `pa_down` | PA Down | negative, fire | STACK_ADDITIVE | permanent | `src/content/statuses/pa-down.ts` |
| `ma_up` | MA Up | positive | STACK_ADDITIVE | permanent | `src/content/statuses/ma-up.ts` |
| `ma_down` | MA Down | negative, fire | STACK_ADDITIVE | permanent | `src/content/statuses/ma-down.ts` |
| `vulnerable` | Vulnerable | negative, lightning | REFRESH | custom (on_damage_received) | `src/content/statuses/vulnerable.ts` |
| `crit_modifier` | Crit Modifier | positive | STACK_INDEPENDENT | permanent | `src/content/statuses/crit-modifier.ts` |
| `slow` | Slow | negative, time | REFRESH | per_unit_ct | `src/content/statuses/slow.ts` |
| `updraft` | Updraft | positive, time | STACK_ADDITIVE | permanent | `src/content/statuses/updraft.ts` |

## Equipment

| ID | Name | Slot | Effect | File |
|---|---|---|---|---|
| `long_sword` | Long Sword | weapon | WP 4, accuracy 95, tags `['sword']` | `src/content/items/long-sword.ts` |
| `strength_ring` | Strength Ring | accessory | +1 PA | `src/content/items/strength-ring.ts` |
| `boots_of_haste` | Boots of Haste | accessory | grants Haste while equipped | `src/content/items/boots-of-haste.ts` |
| `iron_helm` | Iron Helm | headgear | +20 maxHpBase | `src/content/items/iron-helm.ts` |
| `iron_mail` | Iron Mail | armor | +30 maxHpBase | `src/content/items/iron-mail.ts` |
| `longbow` | Longbow | weapon | WP 7, accuracy 33, two-handed, range 2-5 / vertical-inf, height-delta variance, tags `['bow']` | `src/content/items/longbow.ts` |
| `riptide_bow` | Riptide Bow | weapon | WP 5, accuracy 33, two-handed, range 2-5, height-delta variance, 30% Undertow CT-push proc, tags `['bow','water']` | `src/content/items/riptide-bow.ts` |
| `wand_of_lumen` | Wand of Lumen | weapon | WP 2, accuracy 90, 100% on-hit `+Earth/−Water` shift, +1 Burn stack on fire-tagged ability apply (ADR-0084), tags `['wand']` | `src/content/items/wand-of-lumen.ts` |
| `mantle_of_protection` | Mantle of Protection | accessory | +25 resistance to fire/water/earth/lightning/holy/dark; +25 front/side/back evasion | `src/content/items/mantle-of-protection.ts` |
| `ironfoot` | Ironfoot | accessory | −1 Move, −1 Jump, −1 Speed; +1 PA, +1 MA; +1 Movement-bucket capacity | `src/content/items/ironfoot.ts` |

## Rulesets

| ID | Name | File |
|---|---|---|
| `default` | Default Ruleset | `src/content/rulesets/default.ts` |

## Maps

| ID (key in source) | Name | Dimensions | File |
|---|---|---|---|
| `riverRidge` | River Ridge | 14×14 | `src/content/maps/river-ridge.ts` |
| `stonebridge` | Stonebridge | 16×16 | `src/content/maps/stonebridge.ts` |

Authored battles consume these maps via per-scenario battle configs:

| Battle ID | Map | File |
|---|---|---|
| `river_ridge_v1` | River Ridge | `src/content/battles/river-ridge-battle.ts` |
| `stonebridge_v1` | Stonebridge | `src/content/battles/stonebridge-battle.ts` |
| `demo_battle` (smoke-test fixture) | (inline 6×6) | `src/content/battles/demo.ts` |
| `training_field` (engine smoke-test) | Training Field | `src/content/battles/training-field-battle.ts` |

## Terrain types

Registered in `default.ts`'s `terrain.tags` map; see ADR-0073 (tag abstraction) and ADR-0085 (S47 Stonebridge addition).

| Terrain ID | Tags | Notes |
|---|---|---|
| `ground` | `land` | Default land. Default step cost 1. |
| `water_shallow` | `water`, `shallow` | Elev 1 in River Ridge / Stonebridge. Default cost 2 (Tidewalker reduces to 1). |
| `water_deep` | `water`, `deep` | Elev 0. Default cost 3 (Tidewalker reduces to 2). |
| `rampart` | `land` | S47. Keep walls on Stonebridge. Walkable by every class at elev 8; default step cost 1. Distinct id for renderer art identity. |

---

## Conventions

- **IDs are snake_case strings.** Branded types in code (`AbilityId`, `StatusTypeId`, etc.) wrap them.
- **Display names are freely flexible.** Rename in the `name` field of the definition; no other file changes needed.
- **Renaming an ID is a multi-file rename.** Touches the definition file, command set member arrays, tests, fixtures, and any debug references. Avoid unless the rename is high-value.
- **Earth Mage's "Earthen Resolve"** is the display name of the `movement_self_buff` status; the ID stays generic so future classes (Wind Mage, etc.) could use a similarly-shaped buff under a different display name without changing the engine wiring.
