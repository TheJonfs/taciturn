# Content ID Registry

*Started session 16 (2026-05-06). Refreshed session 48 (2026-05-24) — full reconciliation against `loadDefaultCatalog`. Session 50 (2026-05-25) — equipment expansion + Knight Sword class. Session 51 (2026-05-25) — universal off-hand expansion (6 new off-hand pieces) + Calculator MA 8 → 9 + Wand of the Depths refit (deltaVertical moved off range onto new `aoeVerticalToleranceModifiers` surface) + Escutcheon resistance per-element 10 → 20. Session 54 (2026-05-30) — Terraformer class + Worldcraft command set (5 abilities) + Ignore Height / Expert Former R/S/M + Damage Split wired onto Terraformer + Terraformer added to mage-gear classRestrictions.*

A flat lookup table of every content ID currently in the catalog: `id` (used internally everywhere — command sets, hook lookups, tests, debug fixtures) ↔ `name` (display string, freely renamable).

Use this as a quick reference when:
- Renaming abilities / statuses / classes (touch `name`, leave `id` alone unless you commit to a multi-file rename).
- Adding new content (pick an id that doesn't collide; add a row here).
- Reviewing the current content surface at a glance.

Keep this in sync with the catalog. If you rename a `name`, update the row. If you add a new content item, append a row.

---

## Classes

The four-school mage display names are flavored (Geosage / Hydrologist / Pyromancer / Aethurge); the ids stay generic (`*_mage`) per the convention "rename names, leave ids alone."

| ID | Display Name | File |
|---|---|---|
| `knight` | Knight | `src/content/classes/knight.ts` |
| `earth_mage` | Geosage | `src/content/classes/earth-mage.ts` |
| `water_mage` | Hydrologist | `src/content/classes/water-mage.ts` |
| `fire_mage` | Pyromancer | `src/content/classes/fire-mage.ts` |
| `lightning_mage` | Aethurge | `src/content/classes/lightning-mage.ts` |
| `alchemist` | Alchemist | `src/content/classes/alchemist.ts` |
| `assassin` | Assassin | `src/content/classes/assassin.ts` |
| `hunter` | Hunter | `src/content/classes/hunter.ts` |
| `calculator` | Calculator | `src/content/classes/calculator.ts` |
| `terraformer` | Terraformer | `src/content/classes/terraformer.ts` |

## Command sets

| ID | Display Name | Members | File |
|---|---|---|---|
| `battle_skill` | Battle Skill | `power_attack`, `lightning_stab`, `bull_rush` | `src/content/command-sets/battle-skill.ts` |
| `shadow_arts` | Shadow Arts | `shadow_stitch`, `blowdart`, `undermine`, `sow_doubt` | `src/content/command-sets/shadow-arts.ts` |
| `marksmanship` | Marksmanship | `pin_down`, `charged_attack`, `scramble` | `src/content/command-sets/marksmanship.ts` |
| `alchemy` | Alchemy | `compound`, `throw_item` | `src/content/command-sets/alchemy.ts` |
| `white_magic` | White Magic | `cure` | `src/content/command-sets/white-magic.ts` |
| `arcane_skill` | Arcane Skill | `bolt` | `src/content/command-sets/arcane-skill.ts` |
| `earth_spells` | Geosagacity | `earth_strike`, `earth_blessing`, `earth_curse`, `earth_quake`, `earth_cataclysm` | `src/content/command-sets/earth-spells.ts` |
| `water_spells` | Hydrology | `water_strike`, `tide_surge`, `tidal_wave`, `brine`, `maelstrom` | `src/content/command-sets/water-spells.ts` |
| `fire_spells` | Pyromancy | `fire_strike`, `fire_embrace`, `fire_storm`, `spark`, `flame_lance` | `src/content/command-sets/fire-spells.ts` |
| `lightning_spells` | Aethurgy | `lightning_strike`, `static_embrace`, `chain_lightning`, `magnetic_mark`, `storm_caller` | `src/content/command-sets/lightning-spells.ts` |
| `math_skill` | Math Skill | `precision_fire`, `targeted_treatment`, `exact_rhythm`, `sculpted_enhancement`, `engineered_defenses` | `src/content/command-sets/math-skill.ts` |
| `worldcraft` | Worldcraft | `pillar`, `pit`, `hill`, `valley`, `barrier` | `src/content/command-sets/worldcraft.ts` |

The `attack` ability is universal — surfaced through every class's `freeAbilities` rather than as a command-set member, so the action menu shows it alongside the player's First Action set.

## Active abilities

The display names of the elemental-spell suite were re-flavored (S40 name pass and follow-ups); ids stayed stable per the convention.

| ID | Display Name | Bucket | Charged? | Availability | File |
|---|---|---|---|---|---|
| `attack` | Attack | first_action | no | available | `src/content/abilities/attack.ts` |
| `power_attack` | Power Attack | first_action | no | available | `src/content/abilities/power-attack.ts` |
| `lightning_stab` | Lightning Stab | first_action | no (Battle Skill member; Silence rider — Brave×PA gated since S65) | available | `src/content/abilities/lightning-stab.ts` |
| `bull_rush` | Bull Rush | first_action | no (S65 Battle Skill member; weapon attack + Brave×PA knockback) | available | `src/content/abilities/bull-rush.ts` |
| `stasis_sword` | Stasis Sword | first_action | no (cross-class option; Stop rider — moved off Knight set in S42) | available | `src/content/abilities/stasis-sword.ts` |
| `taunt` | Taunt | first_action | no (cross-class option; suppressed off the Knight Battle Skill set in S65) | available | `src/content/abilities/taunt.ts` |
| `cure` | Cure | secondary_command_sets | no | hidden (engine-side only; UI surfaces through White Magic set when equipped) | `src/content/abilities/cure.ts` |
| `bolt` | Bolt | first_action | yes (actionSpeed 25) | available | `src/content/abilities/bolt.ts` |
| `earth_strike` | Rock Toss | first_action | yes (actionSpeed 30) | available | `src/content/abilities/earth-strike.ts` |
| `earth_blessing` | Life from the Loam | first_action | yes (actionSpeed 30) | available | `src/content/abilities/earth-blessing.ts` |
| `earth_curse` | Gaian Hex | first_action | yes (actionSpeed 30) | available | `src/content/abilities/earth-curse.ts` |
| `earth_quake` | Earthquake | first_action | yes (actionSpeed 25, AoE cross-r1) | available | `src/content/abilities/earth-quake.ts` |
| `earth_cataclysm` | Cataclysm | first_action | yes (actionSpeed 18, AoE cross-r1) | available | `src/content/abilities/earth-cataclysm.ts` |
| `water_strike` | Water Lash | first_action | yes (actionSpeed 30, ctPush rider) | available | `src/content/abilities/water-strike.ts` |
| `tide_surge` | Rapids Rush | first_action | yes (actionSpeed 35, ally CT bump) | available | `src/content/abilities/tide-surge.ts` |
| `tidal_wave` | Tidal Wave | first_action | yes (actionSpeed 25, AoE diamond-r1, knockback rider) | available | `src/content/abilities/tidal-wave.ts` |
| `brine` | Brine | first_action | yes (actionSpeed 30, Speed Down debuff) | available | `src/content/abilities/brine.ts` |
| `maelstrom` | Maelstrom | first_action | yes (actionSpeed 18, cone caster-anchored, always-knockback) | available | `src/content/abilities/maelstrom.ts` |
| `fire_strike` | Scorch | first_action | yes (actionSpeed 30, linked PA Down + MA Down rider) | available | `src/content/abilities/fire-strike.ts` |
| `fire_embrace` | Inner Warmth | first_action | yes (actionSpeed 25, linked PA Up + MA Up on ally) | available | `src/content/abilities/fire-embrace.ts` |
| `fire_storm` | Fireball | first_action | yes (actionSpeed 25, AoE cross-r1 base; cross-r2 with Aether Bloom) | available | `src/content/abilities/fire-storm.ts` |
| `spark` | Slow Burn | first_action | yes (actionSpeed 28, applies 2 stacks of Burn on a single roll) | available | `src/content/abilities/spark.ts` |
| `flame_lance` | Flame Lance | first_action | yes (actionSpeed 18, line length 4 caster-anchored, applyAlways Burn) | available | `src/content/abilities/flame-lance.ts` |
| `lightning_strike` | Lightning Bolt | first_action | yes (actionSpeed 30, raw power magical lightning) | available | `src/content/abilities/lightning-strike.ts` |
| `static_embrace` | Static Embrace | first_action | yes (actionSpeed 25, applies Crit Modifier +20 on ally) | available | `src/content/abilities/static-embrace.ts` |
| `chain_lightning` | Chain Lightning | first_action | yes (actionSpeed 25, AoE diamond-r1 with chainBonus +1 power per additional target) | available | `src/content/abilities/chain-lightning.ts` |
| `magnetic_mark` | Magnetic Mark | first_action | yes (actionSpeed 35 — deliberately slow, applies Vulnerable) | available | `src/content/abilities/magnetic-mark.ts` |
| `storm_caller` | Megavolt | first_action | yes (actionSpeed 18, premium-power single-target with 25% maxHp self-cost) | available | `src/content/abilities/storm-caller.ts` |
| `discharge_strike` | Discharge Strike | first_action | no (instant; emitted by the Discharge reaction — never a player-picker entry) | hidden | `src/content/abilities/discharge-strike.ts` |
| `shadow_stitch` | Shadow Stitch | first_action | no (Stop rider; S42 Assassin) | available | `src/content/abilities/shadow-stitch.ts` |
| `blowdart` | Blowdart | first_action | no (single-target physical with poison rider; S42 Assassin) | available | `src/content/abilities/blowdart.ts` |
| `undermine` | Undermine | first_action | no (PA / MA debuff applier; S42 Assassin) | available | `src/content/abilities/undermine.ts` |
| `sow_doubt` | Sow Doubt | first_action | no (Brave Down / Faith Down applier; S42 Assassin) | available | `src/content/abilities/sow-doubt.ts` |
| `pin_down` | Pin Down | first_action | no (Slow applier — Brave-and-Speed formula; S45 Hunter) | available | `src/content/abilities/pin-down.ts` |
| `charged_attack` | Charged Attack | first_action | yes (actionSpeed 25, physical bow shot at higher power_coefficient; S45 Hunter) | available | `src/content/abilities/charged-attack.ts` |
| `scramble` | Scramble | first_action | no (instant `selfMove` reposition — 1 tile, jump delta 5; S45 Hunter) | available | `src/content/abilities/scramble.ts` |
| `compound` | Compound | first_action | no (S39 Alchemist — turns an item into a higher-rank effect on a target) | available | `src/content/abilities/compound.ts` |
| `throw_item` | Throw Item | first_action | no (S39 Alchemist — ranged consumable delivery; ranged variant of compound) | available | `src/content/abilities/throw-item.ts` |
| `undertow` | Undertow | first_action | no (hidden Riptide Bow proc — PA-scaled CT push, factor -3) | hidden | `src/content/abilities/undertow.ts` |
| `wand_of_deepwood_apply_shift` | Wand of the Deepwood Resonance | first_action | no (hidden wand on-hit proc — applies tagged_resistance_shift) | hidden | `src/content/abilities/wand-of-deepwood-apply-shift.ts` |
| `wand_of_depths_apply_shift` | Wand of the Depths Resonance | first_action | no (hidden wand on-hit proc) | hidden | `src/content/abilities/wand-of-depths-apply-shift.ts` |
| `wand_of_lumen_apply_shift` | Wand of Lumen Resonance | first_action | no (hidden Lumen proc — applies +Earth/−Water shift; S45 follow-up + ADR-0084 Burn-stack rider) | hidden | `src/content/abilities/wand-of-lumen-apply-shift.ts` |
| `apply_burn_proc` | Burn | first_action | no (hidden helper — emitted by Flametongue / Wand of Lumen Burn-rider) | hidden | `src/content/abilities/apply-burn-proc.ts` |
| `apply_silence_proc` | Silence | first_action | no (hidden helper — emitted by Silence-applying weapons / casts) | hidden | `src/content/abilities/apply-silence-proc.ts` |
| `precision_fire` | Precision Fire | first_action | no (S49 Math Skill — fire damage + 50% Burn proc per matching target) | available | `src/content/abilities/precision-fire.ts` |
| `targeted_treatment` | Targeted Treatment | first_action | no (S49 Math Skill — multi-target heal; friendly fire on enemies) | available | `src/content/abilities/targeted-treatment.ts` |
| `exact_rhythm` | Exact Rhythm | first_action | no (S49 Math Skill — CT push, magnitude = SP × MA × Faith; clamps at 0) | available | `src/content/abilities/exact-rhythm.ts` |
| `sculpted_enhancement` | Sculpted Enhancement | first_action | no (S49 Math Skill — 50% Faith-gated PA Up + MA Up apply, linked roll) | available | `src/content/abilities/sculpted-enhancement.ts` |
| `engineered_defenses` | Engineered Defenses | first_action | no (S49 Math Skill — 80% Faith-gated apply of `engineered_defenses` status) | available | `src/content/abilities/engineered-defenses.ts` |
| `pillar` | Pillar | first_action | no (S54 Worldcraft — single-tile +4 elevation [S55 tune 3→4]; instant; 8 MP) | available | `src/content/abilities/worldcraft/pillar.ts` |
| `pit` | Pit | first_action | no (S54 Worldcraft — single-tile -4 elevation [S55 tune 3→4] + fall damage; instant; 8 MP) | available | `src/content/abilities/worldcraft/pit.ts` |
| `hill` | Hill | first_action | no (S54 Worldcraft — 3×3 [1,2,1;2,3,2;1,2,1] kernel raise; instant; 16 MP) | available | `src/content/abilities/worldcraft/hill.ts` |
| `valley` | Valley | first_action | no (S54 Worldcraft — 3×3 negated kernel lower + fall damage; instant; 16 MP) | available | `src/content/abilities/worldcraft/valley.ts` |
| `barrier` | Barrier | first_action | no (S54 Worldcraft — 3-5 tile wall line, HP = PA×MA, TTL 50 turn-starts ≈ 5 rounds in a 5v5; tile_set target; instant; 12 MP) | available | `src/content/abilities/worldcraft/barrier.ts` |

## Passive abilities

Reaction / Support / Movement passives are equipped through their respective R/S/M buckets in the team builder. Each entry's `baseCost` is consumed against the bucket's capacity (default 3); class freeAbilities set the cost to 0 for their native picks.

| ID | Display Name | Bucket | Cost | File |
|---|---|---|---|---|
| `move_plus_1` | Move +1 | movement | 1 | `src/content/abilities/move-plus-1.ts` |
| `float` | Float | movement | 1 | `src/content/abilities/float.ts` |
| `fly` | Fly | movement | 2 (hidden — not surfaced in the picker as of S48) | `src/content/abilities/fly.ts` |
| `bedrock_stride` | Bedrock Stride | movement | 2 (Geosage themed Movement) | `src/content/abilities/bedrock-stride.ts` |
| `hotfoot` | Hotfoot | movement | 2 (Pyromancer themed Movement) | `src/content/abilities/hotfoot.ts` |
| `quickstep` | Quickstep | movement | 1 (Aethurge themed Movement — CT refund on move-only turn) | `src/content/abilities/quickstep.ts` |
| `tidewalker` | Tidewalker | movement | 1 (Hydrologist themed Movement — water-tile cost reduction) | `src/content/abilities/tidewalker.ts` |
| `bravestrider` | Bravestrider | movement | 2 (S41 Knight Movement — +1 Move + 10 Brave) | `src/content/abilities/bravestrider.ts` |
| `fleet_of_foot` | Fleet of Foot | movement | 1 (S42 Assassin Movement — +1 Move + 1 Jump) | `src/content/abilities/fleet-of-foot.ts` |
| `high_jump` | High Jump | movement | 1 (S45 Hunter Movement — +2 Jump) | `src/content/abilities/high-jump.ts` |
| `field_recovery` | Healthy Stride | movement | 1 (S39 Alchemist — HP restore on movement) | `src/content/abilities/field-recovery.ts` |
| `counter` | Counter | reaction | 1 (Knight native) | `src/content/abilities/counter.ts` |
| `earth_resilience` | Landwalker | reaction | 1 (Geosage native) | `src/content/abilities/earth-resilience.ts` |
| `tidal_pull` | Tidal Pull | reaction | 1 (Hydrologist native — CT push reaction) | `src/content/abilities/tidal-pull.ts` |
| `smolder` | Smolder | reaction | 2 (Pyromancer reaction — apply Burn to attacker) | `src/content/abilities/smolder.ts` |
| `discharge` | Discharge | reaction | 2 (Aethurge native — magical retaliation) | `src/content/abilities/discharge.ts` |
| `updraft` | Updraft | reaction | 1 (S45 Hunter — +1 Jump permanently on hit, stacks) | `src/content/abilities/updraft.ts` |
| `combat_focus` | Combat Focus | reaction | 1 (S39 Alchemist — Brave-gated PA buff on hit) | `src/content/abilities/combat-focus.ts` |
| `speed_save` | Speed Save | reaction | 1 (S42 Assassin — +1 Speed permanently on hit, stacks) | `src/content/abilities/speed-save.ts` |
| `damage_reduction` | Damage Reduction | support | 2 (Knight-flavored; S50 suppressed — `availability: 'hidden'` — no class home) | `src/content/abilities/damage-reduction.ts` |
| `earth_communion` | Biomastery | support | 1 (Geosage native — × 1.25 status application chance) | `src/content/abilities/earth-communion.ts` |
| `flow_state` | Flow State | support | 1 (Hydrologist native — CT refund on magical cast) | `src/content/abilities/flow-state.ts` |
| `ignition` | Ignition | support | 2 (Pyromancer native — Burn on fire-tagged damage) | `src/content/abilities/ignition.ts` |
| `aether_bloom` | Aether Bloom | support | 2 (Pyromancer native — AoE shape +1 step on magical casts) | `src/content/abilities/aether-bloom.ts` |
| `conductor` | Conductor | support | 2 (Aethurge native — × 1.25 MA multiplier) | `src/content/abilities/conductor.ts` |
| `eagle_eye` | Eagle Eye | support | 2 (S45 Hunter — × 2 physical hit chance) | `src/content/abilities/eagle-eye.ts` |
| `martial_expertise` | Martial Expertise | support | 2 (S41 Knight — × 1.25 PA multiplier; Conductor parity) | `src/content/abilities/martial-expertise.ts` |
| `two_weapons` | Two Weapons | support | 3 (S42 Assassin — dual-wield + per-swing PA × 0.75) | `src/content/abilities/two-weapons.ts` |
| `field_kit` | Travel Preparations | support | 1 (S39 Alchemist — start battle with Potion / Phoenix Down / Remedy stocked) | `src/content/abilities/field-kit.ts` |
| `mathematician` | Mathematician | support | 2 (S49 Calculator native — +1 SP on Math + per-target MP cost 3 → 1) | `src/content/abilities/mathematician.ts` |
| `cornered_focus` | Cornered Focus | reaction | 1 (S49 Calculator native — +1 MA permanently on hit, stacks; Speed Save / Updraft parity) | `src/content/abilities/cornered-focus.ts` |
| `thoughtful_pacing` | Thoughtful Pacing | movement | 1 (S49 Calculator native — restore 2 × tiles MP on Move) | `src/content/abilities/thoughtful-pacing.ts` |
| `ignore_height` | Ignore Height | movement | 3 (S54 Terraformer native — Jump → 99, ignores elevation deltas) | `src/content/abilities/ignore-height.ts` |
| `expert_former` | Expert Former | support | 1 (S54 Terraformer native — Worldcraft effect cap +2, base 2 → 4) | `src/content/abilities/expert-former.ts` |
| `damage_split` | Damage Split | reaction | 2 (Terraformer native — reflect damage taken to attacker + heal half; built S53, wired onto Terraformer freeAbilities S54) | `src/content/abilities/damage-split.ts` |

S48 suppressed Bulwark Stance (was a floating Knight-flavored Movement passive without a class home; the `modifyEvasion` hook it introduced stays for equipment-side consumers). **S50 suppressed Damage Reduction** under the same "support without a class home" pattern — `damage_reduction` is now `'hidden'` (the catalog still resolves the id for historical action-log replays; the picker just doesn't surface it).

## Status types

| ID | Display Name | Tag(s) | Stacking | Duration | File |
|---|---|---|---|---|---|
| `haste` | Haste | positive, time, dispellable | REFRESH | permanent_per_unit_ct | `src/content/statuses/haste.ts` |
| `stop` | Stop | negative, time, mental | REFRESH | per_unit_ct | `src/content/statuses/stop.ts` |
| `charging` | Charging | neutral, time | REJECT | conditional | `src/content/statuses/charging.ts` |
| `regen` | Regen | positive | REFRESH | per_unit_ct | `src/content/statuses/regen.ts` |
| `regen_auto` | Regen | positive | REFRESH | permanent_per_unit_ct | `src/content/statuses/regen-auto.ts` |
| `mana_font` | Mana Font | positive | REFRESH | permanent_per_unit_ct | `src/content/statuses/mana-font.ts` |
| `shell` | Shell | positive, dispellable | REFRESH | permanent_per_unit_ct | `src/content/statuses/shell.ts` |
| `protect` | Protect | positive, dispellable | REFRESH | permanent_per_unit_ct | `src/content/statuses/protect.ts` |
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
| `brave_down` | Brave Down | negative | STACK_ADDITIVE | permanent | `src/content/statuses/brave-down.ts` |
| `faith_down` | Faith Down | negative | STACK_ADDITIVE | permanent | `src/content/statuses/faith-down.ts` |
| `vulnerable` | Vulnerable | negative, lightning | REFRESH | custom (on_damage_received) | `src/content/statuses/vulnerable.ts` |
| `crit_modifier` | Crit Modifier | positive | STACK_INDEPENDENT | permanent | `src/content/statuses/crit-modifier.ts` |
| `slow` | Slow | negative, time | REFRESH | per_unit_ct | `src/content/statuses/slow.ts` |
| `updraft` | Updraft | positive, time | STACK_ADDITIVE | permanent | `src/content/statuses/updraft.ts` |
| `speed_save` | Speed Save | positive, time | STACK_ADDITIVE | permanent | `src/content/statuses/speed-save.ts` |
| `combat_focus` | Combat Focus | positive, time | STACK_ADDITIVE | permanent (S50 migrated from turn_based/3 + REFRESH; joins Speed Save / Updraft / Cornered Focus family) | `src/content/statuses/combat-focus.ts` |
| `tagged_resistance_shift` | Resonance | negative, dispellable | STACK_INDEPENDENT | permanent | `src/content/statuses/tagged-resistance-shift.ts` |
| `cornered_focus` | Cornered Focus | positive, mental | STACK_ADDITIVE | permanent | `src/content/statuses/cornered-focus.ts` |
| `engineered_defenses` | Engineered Defenses | positive, dispellable | STACK_INDEPENDENT | permanent | `src/content/statuses/engineered-defenses.ts` |

A status's `aiHints.polarity` (`'buff' | 'debuff'`) drives AI scoring; the polarity is independent of the `negative`/`positive` *tag* (which steers resistance application). Buff statuses include haste, regen, movement_self_buff, pa_up, ma_up, crit_modifier, and the S42 `speed_save` / Hunter `updraft` self-stacking buffs.

## Equipment

Equipment slots: weapon (one- or two-handed), shield, armor, headgear, accessory.

### Weapons

| ID | Display Name | Slot | Notes | File |
|---|---|---|---|---|
| `long_sword` | Long Sword | weapon | WP 4, accuracy 95, sword tag | `src/content/items/long-sword.ts` |
| `war_axe` | War Axe | weapon | physical sword-tagged primary | `src/content/items/war-axe.ts` |
| `bolt_hammer` | Bolt Hammer | weapon | WP 10, lightning attackProc | `src/content/items/bolt-hammer.ts` |
| `flametongue` | Flametongue | weapon | 25% on-hit Burn proc | `src/content/items/flametongue.ts` |
| `chefs_knife` | Chef's Knife | weapon | S40 knife class — Speed-based dynamic variance | `src/content/items/chefs-knife.ts` |
| `magebane` | Magebane | weapon | S40 knife class — anti-magic flavor | `src/content/items/magebane.ts` |
| `sai` | Sai | weapon | S40 knife class — Assassin-favored | `src/content/items/sai.ts` |
| `wand_of_depths` | Wand of the Depths | weapon | 100% on-hit `+Water/−Fire` resonance + ability range +1H on water spells + S51 refit: +1 AoE vertical tolerance on water spells (pre-S51 `deltaVertical: 1` was dead since spells target at vertical 99) | `src/content/items/wand-of-depths.ts` |
| `wand_of_deepwood` | Wand of the Deepwood | weapon | actionSpeed mod on earth casts; tagged_resistance_shift apply-proc | `src/content/items/wand-of-deepwood.ts` |
| `wand_of_lumen` | Wand of Lumen | weapon | S45 follow-up — `+Earth/−Water` shift on hit + ADR-0084 Burn-stack rider on fire ability apply | `src/content/items/wand-of-lumen.ts` |
| `staff_of_power` | Staff of Power | weapon | × 1.50 MP cost [S55 tune 1.2→1.5] · +4 MA | `src/content/items/staff-of-power.ts` |
| `staff_of_abundance` | Staff of Abundance | weapon | MP-economy magic staff | `src/content/items/staff-of-abundance.ts` |
| `longbow` | Longbow | weapon | S45 bow — WP 7, accuracy 33, two-handed, range 2-5/vertical-inf, height-delta variance | `src/content/items/longbow.ts` |
| `riptide_bow` | Riptide Bow | weapon | S45 bow + 30% Undertow CT-push proc | `src/content/items/riptide-bow.ts` |
| `parrying_sword` | Parrying Sword | weapon | S50 — sword tag, WP 6, accuracy 95, +10 Front / +5 Side evade (defensive sword variant) | `src/content/items/parrying-sword.ts` |
| `absolom` | Absolom | weapon | S50 Knight Sword class — WP 13, accuracy 95, two-handed, `attacker_brave` variance ([Brave/100 ± 0.05]), +1 Reaction-bucket capacity. First consumer of the new `attacker_brave` `WeaponPhysicalVariance` kind. | `src/content/items/absolom.ts` |

### Shields / Off-hand pieces

The `kind: 'shield'` discriminant covers every non-weapon off-hand piece —
shields proper, talismans, and books all share the off-hand-slot affordance
via this kind. Per-item `classRestrictions` enforces who can equip what
(S51 broke the off-hand open by adding pieces without class restrictions).

| ID | Display Name | Notes | File |
|---|---|---|---|
| `escutcheon` | Escutcheon | Knight-flavored shield. S51 resistance bump 10 → 20 per element. | `src/content/items/escutcheon.ts` |
| `warriors_aegis` | Warrior's Aegis | shield + evasion mods (Knight-only) | `src/content/items/warriors-aegis.ts` |
| `managuard` | Managuard | hybrid shield — +2 MA among its mods (Knight-only) | `src/content/items/managuard.ts` |
| `buckler` | Buckler | S51 universal off-hand baseline — +10F/+5S evade, +15 all elemental resistance. No class restriction. | `src/content/items/buckler.ts` |
| `talisman_of_warding` | Talisman of Warding | S51 universal off-hand — +20 all elemental resistance. Mantle of Protection (+25 across 6 tags incl. Holy/Dark) remains top-tier. | `src/content/items/talisman-of-warding.ts` |
| `talisman_of_conviction` | Talisman of Conviction | S51 universal off-hand — +5 Brave, +5 Faith via statMods. Dual-edged Faith is intentional. | `src/content/items/talisman-of-conviction.ts` |
| `tome_of_power` | Tome of Power | S51 Book (mage off-hand) — +1 MA, +10 MP. Class-restricted to the mage-gear tier (geosage / hydrologist / pyromancer / aethurge / calculator / terraformer — S54 added Terraformer). | `src/content/items/tome-of-power.ts` |
| `livre_of_urgency` | Livre of Urgency | S51 Book (mage off-hand) — +1 Speed plus +5 charged action speed on magical-tagged casts (generalized Wand-of-Deepwood pattern). | `src/content/items/livre-of-urgency.ts` |
| `battle_dictionary` | Battle Dictionary | S51 Book (mage off-hand) — +1 PA plus +1 horizontal range AND +1 AoE vertical tolerance on magical casts. +1 PA finally pays off on S54's Terraformer (Barrier HP = PA × MA). First non-Wand consumer of the new `aoeVerticalToleranceModifiers` field. | `src/content/items/battle-dictionary.ts` |

### Armor

| ID | Display Name | Notes | File |
|---|---|---|---|
| `battle_gear` | Battle Gear | mid-tier mixed-stat armor | `src/content/items/battle-gear.ts` |
| `silvered_vest` | Silvered Vest | +30 MP +2 MA — mage-hybrid armor | `src/content/items/silvered-vest.ts` |
| `soldiers_leathers` | Soldier's Leathers | physical-focused light armor | `src/content/items/soldiers-leathers.ts` |
| `war_plate` | War Plate | Knight-restricted heavy armor | `src/content/items/war-plate.ts` |
| `wizards_robe` | Wizard's Robe | mage-restricted robe | `src/content/items/wizards-robe.ts` |
| `sorcerers_robe` | Sorcerer's Robe | mage-restricted robe with Auto-Shell grant + Move +1 | `src/content/items/sorcerers-robe.ts` |
| `travel_garb` | Travel Garb | low-cost utility armor | `src/content/items/travel-garb.ts` |
| `light_robe` | Light Robe | mage-restricted lightweight robe; specialist resist | `src/content/items/light-robe.ts` |
| `dark_robe` | Dark Robe | mage-restricted robe with dark-flavored mods | `src/content/items/dark-robe.ts` |
| `spiked_mail` | Spiked Mail | S37 — revenge-tax armor (reflects on hit) | `src/content/items/spiked-mail.ts` |
| `iron_mail` | Iron Mail | +30 maxHpBase | `src/content/items/iron-mail.ts` |
| `shimmer_cloak` | Shimmer Cloak | S50 universal armor — +75 HP, +10 F/S/B evade. First evasion-bias body slot. | `src/content/items/shimmer-cloak.ts` |
| `soul_vest` | Soul Vest | S50 universal armor — +50 HP, +10 Brave, +10 Faith. First universal Brave/Faith piece (Tricorn = Mage-only; Crusader's Helm = Knight-only). | `src/content/items/soul-vest.ts` |
| `battlemages_chain` | Battlemage's Chain | S65 universal hybrid body — +80 HP, +10 MP, +1 MA | `src/content/items/battlemages-chain.ts` |

### Headgear

| ID | Display Name | Notes | File |
|---|---|---|---|
| `iron_helm` | Iron Helm | +20 maxHpBase | `src/content/items/iron-helm.ts` |
| `guard_cap` | Guard Cap | basic balanced headgear | `src/content/items/guard-cap.ts` |
| `focus_band` | Focus Band | × 0.75 incoming negative-status apply chance | `src/content/items/focus-band.ts` |
| `steel_helm` | Steel Helm | Knight-only. +40 maxHpBase, +1 Reaction-bucket capacity, −20 side/back evasion (positive-feedback "Knight wants to get hit" identity) | `src/content/items/steel-helm.ts` |
| `tactical_mask` | Tactical Mask | utility-focused headgear | `src/content/items/tactical-mask.ts` |
| `pointy_hat` | Pointy Hat | mage-favored headgear | `src/content/items/pointy-hat.ts` |
| `magus_crown` | Magus Crown | +1 secondary-command-set capacity | `src/content/items/magus-crown.ts` |
| `lookouts_hood` | Lookout's Hood | mid-tier utility | `src/content/items/lookouts-hood.ts` |
| `crusaders_helm` | Crusader's Helm | Knight-flavored heavy headgear | `src/content/items/crusaders-helm.ts` |
| `tricorn` | Tricorn | +Brave headgear | `src/content/items/tricorn.ts` |
| `golden_hairpin` | Golden Hairpin | S50 universal head — +10 HP, `mpCostMultipliers: [0.5]` (50% MP cost on every cast). Inverse shape of Staff of Power's × 1.50. | `src/content/items/golden-hairpin.ts` |
| `skullclamp` | Skullclamp | S50 universal head — −20 HP, −10 MP, +1 PA, +1 MA. **First equipment to ship a negative HP/MP `statMods`** (additive composition through `modifyStatQuery`; vitals fill to post-equipment max at battle start). | `src/content/items/skullclamp.ts` |
| `barbut` | Barbut | S65 heavy head (Knight/Templar) — +30 HP, × 0.5 incoming Stop / Don't Move / Don't Act (three `by_type` `incomingStatusModifiers`). | `src/content/items/barbut.ts` |
| `circlet` | Circlet | S65 mage head — +10 HP, +10 MP, grants `mana_font` (per-turn MA/2 MP regen). | `src/content/items/circlet.ts` |

### Accessories

| ID | Display Name | Notes | File |
|---|---|---|---|
| `strength_ring` | Strength Ring | +1 PA | `src/content/items/strength-ring.ts` |
| `boots_of_haste` | Boots of Haste | grants Haste at battle start | `src/content/items/boots-of-haste.ts` |
| `capacitor_ring` | Capacitor Ring | per-tag resistance shifts | `src/content/items/capacitor-ring.ts` |
| `tintinibar` | Tintinibar | grants Auto-Regen at battle start | `src/content/items/tintinibar.ts` |
| `lightfoot` | Lightfoot | +1 Move via movementMods | `src/content/items/lightfoot.ts` |
| `augmentor` | Augmentor | +1 Support-bucket capacity (sister to Steel Helm's +1 Reaction) | `src/content/items/augmentor.ts` |
| `diamond_bracelet` | Diamond Bracelet | status-defense accessory | `src/content/items/diamond-bracelet.ts` |
| `purifier` | Purifier | × 2 status-tick amount on negative-tagged statuses (S30 / S33.5 interaction piece) | `src/content/items/purifier.ts` |
| `arcane_lens` | Arcane Lens | × 1.10 outgoing hit chance | `src/content/items/arcane-lens.ts` |
| `rasp_pendant` | Rasp Pendant | 10% damage-to-MP-drain on hit | `src/content/items/rasp-pendant.ts` |
| `the_offering` | The Offering | S42 — attack-swing multiplier (each weapon swings 2× on basic Attack) | `src/content/items/the-offering.ts` |
| `mantle_of_protection` | Mantle of Protection | S45 follow-up — +25 resistance across elemental tags + +25 evasion on every facing | `src/content/items/mantle-of-protection.ts` |
| `ironfoot` | Ironfoot | S45 follow-up — −Move/−Jump/−Speed in exchange for +PA/+MA + Movement-bucket capacity | `src/content/items/ironfoot.ts` |

### Consumables

S39 Alchemist substrate. Not "equipment" in the slot sense — consumed via `compound` (raise stat / clear status / etc. on target) or `throw_item` (ranged).

| ID | Display Name | Effect | File |
|---|---|---|---|
| `potion` | Potion | HP restore | `src/content/items/potion.ts` |
| `phoenix_down` | Phoenix Down | revives KO | `src/content/items/phoenix-down.ts` |
| `remedy` | Remedy | clears negative statuses | `src/content/items/remedy.ts` |
| `ether` | Ether | MP restore | `src/content/items/ether.ts` |

## Rulesets

| ID | Name | File |
|---|---|---|
| `default` | Default Ruleset | `src/content/rulesets/default.ts` |

## Maps

| ID (key in source) | Name | Dimensions | File |
|---|---|---|---|
| `riverRidge` | River Ridge | 14×14 | `src/content/maps/river-ridge.ts` |
| `stonebridge` | Stonebridge | 16×16 | `src/content/maps/stonebridge.ts` |
| `marshmoor` | Marshmoor | 16×16 | `src/content/maps/marshmoor.ts` |

Authored battles consume these maps via per-scenario battle configs:

| Battle ID | Map | File |
|---|---|---|
| `river_ridge_v1` | River Ridge | `src/content/battles/river-ridge-battle.ts` |
| `stonebridge_v1` | Stonebridge | `src/content/battles/stonebridge-battle.ts` |
| `marshmoor_v1` | Marshmoor | `src/content/battles/marshmoor-battle.ts` |
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

## Catalog counts (as of S54 — 2026-05-30)

| Kind | Count | Δ since S51 |
|---|---|---|
| Classes | 10 | +1 (S54: `terraformer`) |
| Command sets | 12 | +1 (S54: `worldcraft`) |
| Abilities (active + passive + hidden) | 88 | +8 (S53: `damage_split`; S54: `pillar`, `pit`, `hill`, `valley`, `barrier`, `ignore_height`, `expert_former`) |
| Status types | 32 | — |
| Equipment + consumables | 67 | — |
| Rulesets | 1 | — |
| Maps | 3 | — |
| Terrain types | 4 | — |

Pinned in `src/content/loader.test.ts`; that test fails loud if the counts drift without a corresponding registry update.

---

## Conventions

- **IDs are snake_case strings.** Branded types in code (`AbilityId`, `StatusTypeId`, etc.) wrap them.
- **Display names are freely flexible.** Rename in the `name` field of the definition; no other file changes needed. The four-school mage classes (`earth_mage` / `water_mage` / `fire_mage` / `lightning_mage`) ship under flavored display names (Geosage / Hydrologist / Pyromancer / Aethurge); the ids stay generic.
- **Renaming an ID is a multi-file rename.** Touches the definition file, command set member arrays, tests, fixtures, and any debug references. Avoid unless the rename is high-value.
- **Earthen Resolve** is the display name of the `movement_self_buff` status — the id stays generic so future classes can grant a similarly-shaped buff under a different display name without touching the engine wiring. Same pattern at `regen_auto` (display "Regen" — the same heal math as cast Regen, but battle-long).
