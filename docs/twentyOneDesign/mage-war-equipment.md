# Mage War Equipment — Working Reference

*Living reference document for equipment design in Mage War. Updated incrementally as items are designed.*

## Purpose and Scope

Mage War is the playable demo phase post-Session 20: Knight + 4 Mages, level-configurable battles (anchored at L25 for tuning), 4v4 team format with each side drawing from 4 of the 5 available classes. Equipment is part of the pre-battle customization layer. This document tracks the equipment items as they're designed, plus the philosophical and mechanical decisions that anchor the tuning.

## Design Philosophy

Five framing principles guide equipment design:

1. **Each family has a distinct character.** Choosing one over another should be a real decision rooted in playstyle, not a numerical comparison. Sword vs. axe is "predictability vs. variance," not "lower numbers vs. higher numbers."
2. **Combat surface differentiation.** Each piece operates on one combat surface (raw damage, accuracy, status, tempo, defense, capacity, etc.) rather than spreading across all of them. Mirrors the four mages' design.
3. **Element-specific gear creates the strongest synergy vector.** Items that bind to an element (Flametongue, Wand of Depths) compound with class identity to make personal builds emerge.
4. **Cost of choice is the design.** Equipping the Fire wand means not equipping the +MA staff. The interest lives in the foregone alternatives.
5. **Variety, not exhaustiveness.** Enough variety that team-builder choices feel meaningful at the Mage War scale, not a complete FFT-equivalent inventory.

## Cross-Cutting Design Decisions

**Class restrictions.** All equipment carries a class-restriction field. For weapons and accessories, this is set to null — any class can equip; choice is incentive-based via stat scaling. For armor (head, body), restrictions are used to shape build identity (mages can't wear heavy armor, etc.).

**Hand slots.** Right hand and left hand. Default rule: one weapon between the two hands. Two-handed weapons (deferred to post-Mage War) and dual-wield (gated behind an unlock ability) are future expansions.

**Weapon-applied status procs use flat percentages, not Faith-gated rolls.** Decouples weapon riders from the wielder's casting prowess; consistent with FFT weapon-effect mechanics. A Knight with a Flametongue procs Burn at the same rate as a Fire Mage with one.

**Weapon-tagged physical damage interacts with the elemental wheel.** A weapon that tags its physical hit with an element (Flametongue → Fire) causes that hit to interact with the target's elemental resistance. So a Flametongue swing on an Earth Mage benefits from Earth's Fire vulnerability. Intentional driver of meta-game team comp choices.

**Spell-cast riders on weapons follow normal spell mechanics.** When Bolt Hammer procs and fires a Lightning spell, the spell goes through Faith multipliers and target resistance just like a cast spell would. The proc fires a real spell from the weapon — not just a tagged hit.

**Tuning anchor: L25 with default 70 Brave / 70 Faith.** Equipment effects deliberately mix flat and scaling magnitudes — some items matter more at low levels, some at high levels.

## Reference: L25 Stats and Spell Tuning

**Class stats at L25 (no equipment, default brave/faith):**

| Class | HP | MP | PA | MA | Speed |
|---|---|---|---|---|---|
| Earth | 112 | 60 | 4 | 12 | 8 |
| Water | 102 | 60 | 4 | 12 | 10 |
| Fire | 97 | 60 | 4 | 13 | 9 |
| Lightning | 87 | 60 | 4 | 14 | 9 |
| Knight | 144 | 20 | 11 | 4 | 9 |

**Spell SPs:**
- Earth/Water/Fire basic spells: SP 8
- Lightning basic spell: SP 12 (the burst rider baked in)
- Spells: 100% accuracy when fired (no miss modulo target evasion, which doesn't apply to spell casts)

**Damage formulas (assumed):**
- Physical: `PA × WP × (Brave/100) × variance × hit_landed`
- Spell: `MA × SP × (Faith_caster/100) × (Faith_target/100) × hit_landed`
- Default 70 Brave/Faith → multipliers 0.70 and 0.49

## Weapons

### Sword Family

*Character: high accuracy, medium damage, no variance, reliable. The default physical option.*

**Long Sword**
- WP: 8 | Accuracy: 95 | Variance: none
- Class restriction: none
- Riders: none
- Notes: The vanilla reference. The answer to "I don't want to think about my weapon, just give me damage."

**Flametongue**
- WP: 6 | Accuracy: 90 | Variance: none
- Class restriction: none
- Tag: Fire (physical damage tagged Fire; subject to elemental wheel)
- Rider: 25% flat chance per hit to apply 1 stack of Burn
- Notes: Counter-pick weapon. Substantial damage drop vs. Long Sword (effective WP 5.4 vs. 7.6) is the cost; the Fire tag amplifies vs. Earth-vulnerable targets and gets cut in half vs. Fire-resistant ones. Burn DoT compounds with team strategies that stack burn. The intended build path is a Flametongue Knight paired with one or more Fire Mages.

### Axe Family

*Character: low accuracy (75), high asymmetric variance [0.9, 1.3] for high-roll upside, swingy. Crit-eligible (axes can crit). The gambler's choice physical.*

**War Axe**
- WP: 12 | Accuracy: 75 | Variance: [0.9, 1.3] (asymmetric, mean 1.1)
- Class restriction: none
- Riders: none
- Notes: The vanilla axe reference. Expected effective WP ~9.9 vs. Long Sword's 7.6 — ~30% damage upgrade in exchange for 25% miss rate plus variance noise.

**Bolt Hammer**
- WP: 10 | Accuracy: 75 | Variance: [0.9, 1.3]
- Class restriction: none
- Rider: 25% flat chance per hit to fire a basic Lightning spell at the target (SP 12; follows normal spell mechanics including Faith multipliers and target Lightning resistance)
- Notes: Designed as a hybrid PA/MA weapon. Pure physical builds (Knight at PA 11 / MA 4) lose ~11% expected damage vs. War Axe. Balanced PA/MA builds (hypothetical 8/8 hybrid class) are essentially indistinguishable in mean damage from War Axe; Bolt Hammer wins via Lightning synergy and elemental wheel matchups. A planted weapon for future hybrid classes; for current Mage War, it's the right choice for Knights who invest other slots in MA boosts or pair with Lightning-element secondary actions.

### Wand Family

*Character: light melee (WP 2), high accuracy (90), with two layers of value — an on-hit resistance shift on the target (tactical) and an element-specific spell bonus while equipped (passive). The element-flavored tactical magical weapon.*

**Wand of the Depths** (Water-themed)
- WP: 2 | Accuracy: 90
- Class restriction: none
- On-hit effect: applies +25 Fire Resistance and -25 Lightning Resistance to the target. Persists for the duration of the battle. Stackable across multiple wand applications. Targetable on either allies or enemies.
- Passive: +1 horizontal and +1 vertical range on Water-tagged spells.
- Notes: The on-hit swing is a tactical opener — close range with an early swing on an ally to shore up Fire defense (at the cost of Lightning vulnerability), or on an enemy to set up Lightning teammate strikes. Direct casting is more damage-efficient per single turn, so the swing's value compounds when seeding multiple follow-up casts.

**Wand of the Deepwood** (Earth-themed)
- WP: 2 | Accuracy: 90
- Class restriction: none
- On-hit effect: applies +25 Lightning Resistance and -25 Fire Resistance to the target. Persists for the duration of the battle. Stackable. Either allies or enemies.
- Passive: +5 Spell Speed (faster charge) on Earth-tagged spells.
- Notes: Earth-projection wand. Same swing dynamics as Wand of Depths. The Spell Speed boost shortens cast turnaround for Earth's status-application spells, which matters more when CT manipulation and timing-pressure are at play.

### Staff Family

*Character: medium melee (WP 4), moderate accuracy (80), generalist stat-focused. Each staff is a stat-bucket boost (MA or MP) with a balancing drawback. The generalist magical weapon — equip when you don't want to commit to a single element.*

**Staff of Power**
- WP: 4 | Accuracy: 80
- Class restriction: none
- Effects: MA +4; all spells cost 20% more MP
- Notes: Quality-over-quantity. ~33% damage boost on basic spells (12 → 16 effective MA), but ~17% fewer total casts per battle. Best when you expect a short, high-impact engagement. (Session 31.5: +MA bumped 3 → 4 — the +3 read as unremarkable against the +20% MP-cost drawback.)

**Staff of Abundance**
- WP: 4 | Accuracy: 80
- Class restriction: none
- Effects: MaxMP +50%; all spells -5 Spell Speed (slower charge)
- Notes: Quantity-over-quality. ~50% more total casts per battle, but each spell takes longer to come out. Best when you expect a long battle of attrition. Could also enable physical-with-MP-hungry-hybrid builds (e.g., a Knight with a magical secondary action who needs MP for utility casts) where the slower spell speed matters less.

## Armor — Body

The body slot's primary axis is bulk and defense — HP scaling, physical/magical defense, and elemental resistance. Three tiers per slot: universal, fighter (Knight-only), and mage (Mage-only). The class-restricted tiers offer more focused identity; universal options are the path for hybrid builds and current-class-flexibility.

### Universal Body

**Battle Gear**
- +110 HP, +1 PA
- Class restriction: none
- Notes: The "plain durability" option. Higher HP than Soldier's Leathers without the Speed/Knight-only constraint. Mage equipping this trades all magical riders for raw bulk — the right pick when expecting heavy physical pressure. Future hybrid classes' default tank option.

**Silvered Vest**
- +50 HP, +30 MP, +2 MA
- Class restriction: none
- Notes: The "non-mage wanting magic" option. For a Knight running Bolt Hammer or Lightning Magic as secondary, the +2 MA and +30 MP unlock a real magical contribution (~50% spell damage boost on Knight's Lightning sub-magic; +2.2 expected damage on Bolt Hammer's proc). Modest impact on physical-only Knight builds.

### Fighter Body (Knight-only)

**Soldier's Leathers**
- +90 HP, +1 Sp, +1 PA
- Class restriction: Knight
- Notes: The default offensive Knight gear. ~12.5% more turns over the battle arc plus +PA scaling on every swing. The right pick for aggressive Knight builds.

**War Plate**
- +150 HP, -1 Sp, +25 to all four elemental resistances
- Class restriction: Knight
- Notes: The slow magic-tank. Knight in War Plate has better all-element defense than any Mage has against non-self elements — reinforces "Knight is the elemental neutral pick." Speed cost of -1 means fewer turns over time, but the target is much harder to bring down. Counter-pick against magic-heavy team comps.

### Mage Body (Mage-only)

**Wizard's Robe**
- +40 HP, +40 MP, +4 MA, -25 to all four elemental resistances
- Class restriction: Mage
- Notes: All-offense robe. ~33% basic spell damage boost (MA 12 → 16) plus the MP for more casts, but the wearer becomes broadly elementally vulnerable. A Wizard's Robe Earth Mage takes 1.75× damage from Fire (-50 + -25 net), 1.25× from Water/Lightning, and only weakly resists Earth (+25 net). The cost matters most in mirror matchups and against teams that can pressure on multiple elements. Stacks aggressively with Staff of Power for full burst-spec builds. (Session 31.5: +MA bumped 3 → 4, matching Staff of Power's recalibration.)

**Sorcerer's Robe**
- +30 HP, +30 MP, Auto-Shell, Move +1
- Class restriction: Mage
- Notes: Defensive mage option. Auto-Shell (50% reduction on incoming magic damage) effectively converts the Mage's natural -50 elemental vulnerability into a slight resistance against magic. Move +1 makes them harder to pin down for physical attackers. Trades raw spell output for survivability and mobility. Strong against magic-heavy meta or as a counter to high-burst opponents like Wizard's Robe Lightning Mages.

## Armor — Head

The head slot's primary axis is status defense — the third major defensive surface alongside body's bulk/elemental defense and shields' evasion. Universal heads carry the broad cross-class coverage work; class-restricted tiers branch into role-specific identity dimensions (fighter heads emphasize tank-vs-aggro; mage heads emphasize spell-coverage-vs-build-shaping).

### Universal Head

**Guard Cap**
- +20 HP, +25 to all four elemental resistances
- Class restriction: none
- Notes: Broad elemental defense without class commitment. Stacks additively with War Plate (Knight + War Plate + Guard Cap = +50 all elements) or with a Mage's natural elemental resistance map. Default pick when expecting magic-heavy opposition and you don't want to commit to Sorcerer's Robe in the body slot.

**Focus Band**
- +10 HP, +10 MP, +25 resistance to negative-tag statuses
- Class restriction: none
- Notes: Status defense yardstick. Reduces incoming application chances on all negative statuses by 25% (multiplicative on the application formula per Battle Mechanics Guide). Covers weapon-applied procs (Flametongue's Burn, future weapon-applied debuffs) as well as spell-applied debuffs — anything carrying the "negative" status tag. Modest stat boost; the appeal is the resistance.

### Fighter Head (Knight-only)

**Steel Helm**
- +40 HP, +1 Reaction-slot capacity, -20 Side and Back Evade
- Class restriction: Knight
- Notes: The reaction-tank build piece. The +1 R-capacity opens up reaction abilities that wouldn't fit a base 3-capacity budget. The -20 Side/Back Evade is a *positive-feedback* cost rather than a flat penalty: lower evasion → more hits land → more Reaction triggers fire → more counter-damage. The Knight wants to get hit. Negative evasion in those facings is intentional — the formula `(1 - evasion/100)` allows hit rates above weapon accuracy from those angles, doubling down on the "invite attacks" identity. (See Engine Requirements.)

**Tactical Mask**
- +20 HP, +1 PA, +1 Sp
- Class restriction: Knight
- Notes: Aggressive Knight head. Stacks with Soldier's Leathers for a fast-bruiser package: PA 13, Sp 11, +110 HP combined; Long Sword damage at 69 expected, ~22% more turns over battle arc than baseline.

### Mage Head (Mage-only)

**Pointy Hat**
- +10 HP, +20 MP, +1 MA, +50 Silence resistance
- Class restriction: Mage
- Notes: Default mage hat. Modest offensive boost (~8% spell damage), small MP buffer, plus targeted defense against Silence — the status that hardest-counters a Mage's identity. Reliable pick when nothing more specialized fits.

**Magus Crown**
- -3 MA, +1 Action-slot capacity
- Class restriction: Mage
- Notes: Build-shaping piece. The +1 Action capacity allows equipping two secondary action command sets instead of one, opening up massive ability variety (e.g., Earth Mage primary + Lightning Magic + Fire Magic as secondaries gives effective coverage of three of four elements through one Mage). Cost is -3 MA (~25% basic spell damage reduction at L25). The trade is power vs. flexibility. Calibration may need adjustment in playtest if the variety advantage exceeds the damage cost; potential cost-tighteners include -5 MA (instead of -3) or +25% MP cost on all spells. (See Engine Requirements.)

## Shields

Shields occupy the left-hand slot. Default rule: shields are Knight-only (Mages currently have no left-hand option; their wand or staff goes in the right hand and the left stays empty). The shield slot is where the Knight's identity gets sharpest — three options correspond to three distinct Knight build archetypes (tank, aggro, hybrid).

**Escutcheon**
- +20 Front Evade, +10 Side Evade, +10 to all four elemental resistances
- Class restriction: Knight
- Notes: The pure-tank shield. Stacks with War Plate and Guard Cap to reach +60 elemental resistance across all four elements (60% magic damage reduction). Vs sellout Lightning Mage: a Knight in this stack takes ~62 damage from a 155-damage spell. Five Lightning hits to drop a 314-HP tank Knight. The price is no offensive boost and the body/head slot lock-in.

**Warrior's Aegis**
- +5 Front Evade, +5 Side Evade, +2 PA
- Class restriction: Knight
- Notes: The aggressive shield. The +2 PA is the main draw — ~18% damage boost per swing. Stacks with Tactical Mask and Soldier's Leathers for a Knight at PA 14, Sp 11, +110 HP, doing 97 expected per War Axe swing with ~22% more turns over time.

**Managuard**
- +10 Front Evade, +5 Side Evade, +2 MA
- Class restriction: Knight
- Notes: The hybrid shield. The +2 MA stacks with Silvered Vest (+2 MA) for a Knight at MA 8 — doubling Bolt Hammer's proc damage and bringing Knight's Lightning sub-magic from useless (~24/cast) to legitimate (~47/cast, ~71/cast vs Lightning-vulnerable). Magic-Knight becomes a real two-threat build distinct from pure mage (~60% of stock Lightning Mage's damage with full Knight HP). Slightly more evasion than Warrior's Aegis as compensation for the more niche role.

## Accessories

The accessory slot has no class restrictions and the most diverse design surface — mobility, sustain, element counter, status defense, capacity expansion, stat boost, precision, and resource attrition all live here. The slot is also load-bearing for Mages specifically: shields are Knight-only, so the accessory carries disproportionate weight in expressing a Mage's identity beyond their weapon-and-robe combo.

A note on the R/S/M capacity mechanic: the Mage War ability system allows equipping multiple R/S/M abilities as long as their total cost is less than or equal to the relevant bucket capacity. So +1 capacity from an accessory or headpiece doesn't necessarily upgrade a single ability — it may instead let the wielder add another low-cost ability to the same bucket. Steel Helm's +1 R-capacity, Augmentor's +1 S-capacity, and Magus Crown's +1 Action-capacity all interact with this system (Action capacity differing slightly: it counts whole command sets, not pooled-cost abilities).

**Auto-Haste Boots**
- Effect: Auto-Haste (Haste status applied at battle start, persistent for the battle)
- Class restriction: none
- Notes: Tempo accessory. The wearer starts the battle Hasted, multiplying their effective Speed for the duration. Foundational mobility piece.

**Capacitor Ring**
- Effect: +100 Lightning Resistance
- Class restriction: none
- Notes: Hard counter to Lightning-element strategies. +100 resistance produces full Lightning immunity (`resistance_modifier = 0`). On a Lightning Mage (natural +50 Lightning), stacks to +150 — half-healing on incoming Lightning damage, making Lightning mirror matchups recover-on-hit. Counter-pick to single-Lightning-stack opponents.

**Tintinibar**
- Effect: Auto-Regen
- Class restriction: none
- Notes: Self-sustain accessory. Wearer enters battle with Regen status active, healing 5% MaxHP per turn (per the updated Regen magnitude — see Engine Requirements). For tank Knight builds, that's ~15 HP/turn; for stock Mages, ~5-7 HP/turn. Meaningful sustain over a long battle without trivializing incoming damage. Most impactful on high-HP builds where percentage scaling produces more absolute healing.

**Lightfoot**
- Effect: +1 Move, +1 Jump, +1 Speed
- Class restriction: none
- Notes: Mobility specialist accessory. Enables the "skirmisher" archetype that doesn't otherwise exist. For a Knight with Tactical Mask + Soldier's Leathers + Lightfoot: Move 5, Jump 4, Speed 12 — significantly faster than any Mage. Combined with Auto-Haste boots on another unit (or future +Move passives), produces builds that are very hard to pin down.

**Augmentor**
- Effect: +1 Support-bucket capacity
- Class restriction: none
- Notes: Capacity expansion accessory. Lets the wearer add another cost-1 Support ability to their pool, or upgrade to a higher-cost Support ability than would otherwise fit. Effectively trades the accessory slot for a small extra ability — also useful as a calibration vector for future Support-ability cost tuning. (Sister mechanic to Steel Helm's +1 R-capacity.)

**Diamond Bracelet**
- Effect: +1 PA, +1 MA
- Class restriction: none
- Notes: Universal stat boost. Modest improvement on any class (~+5 dmg/swing for Knight Long Sword, ~+8% basic spell damage for Mage). Most useful for hybrid PA/MA builds where both stats matter; for pure builds it's the "I don't have a sharper opinion" filler accessory.

**Purifier**
- Effect: Doubles tick-down rate on incoming negative-tag statuses
- Class restriction: none
- Notes: Graceful counter to status pressure. Negative debuffs (Burn, Stop, Sleep, Move/Jump debuff, etc.) tick down at 2× normal rate, halving their effective duration. Status applications still land at full chance — they just don't stick. Doesn't affect positive-tag statuses (the wearer's own Auto-Haste from Boots, Regen from Tintinibar, etc. are unaffected). Counter-pick to Earth-mage status-spread strategies.

**Arcane Lens**
- Effect: weapon accuracy × 1.10 (multiplier); crit rate +10pp (flat addition on top of base 5%)
- Class restriction: none
- Notes: Precision accessory. The accuracy multiplier scales naturally and clamps at 100% — no effect on already-accurate weapons (95+%), meaningful on War Axe at 75% → 82.5%, larger on lower-accuracy weapons. The crit boost is flat: base 5% becomes 15%, tripling crit frequency. Enables the "speedy War Axe wielder" archetype as a high-variance physical DPS pole opposite the sellout Lightning Mage.

**Rasp Pendant**
- Effect: Bonus 10% of final damage dealt is converted to MP drain (wielder gains, target loses; no damage reduction on attacker's swing)
- Class restriction: none
- Notes: Resource attrition accessory. Damage output is unchanged; on top of the swing's normal damage, the target loses MP equal to 10% of the final damage dealt, and the wielder gains the same. Most effective on high-damage builds — Knight War Axe (~76 expected dmg) drains ~7-8 MP per hit, depleting a Mage's spell budget in 4-5 hits. Standard guardrails: drain caps at target's current MP (no negative MP), source's gain caps at the wielder's MP headroom (spillover is lost), doesn't apply to KO'd targets, skipped when the hit is absorbed (resistance > 100 per the absorption substrate). Damage conversion reads *final damage dealt* (after resistance modifiers apply). Implemented via the `damageMpDrainPercent` field on equipment + the post-finalize `onFinalDamage` hook + `system_mp_drain` action (per ADR-0065). (Session 30 substrate; Session 31 first consumer. The earlier reading — "10% damage reduction + 10% MP drain" — was simplified to "bonus 10% drain, no damage reduction" per Chris's design call mid-Session-30; ADR-0065 records the call.)

## Engine Requirements

Items requiring engine work to fully support equipment effects in this document. Pass these back to Claude Code alongside the spell-power tuning when the next implementation pass picks up:

- **Spell power tuning.** Basic spell SP values: Earth = 8, Fire = 8, Water = 8, Lightning = 12. Higher-tier spells scale up from these baselines per ability spec. (Pre-existing item from earlier conversation; included here for completeness.)
- **Action-slot capacity > 1.** Magus Crown's +1 Action capacity requires the engine to support multiple equipped secondary action command sets per unit. Per existing design notes this path is conceptually allowed; the implementation needs to be wired up. Until it is, Magus Crown either ships disabled or its +1 Action effect is a no-op.
- **Negative evasion (no clamping at 0).** Steel Helm's -20 Side/Back Evade can produce negative effective evasion. The engine's hit-chance formula `weapon_accuracy × (1 - target_evasion/100) × …` should compute that naturally — a -10 evasion produces a 1.10 multiplier on hit rate. The final hit chance is still clamped to `[0.05, 1.0]`, so the practical effect is "harder to miss attacks against you from those angles." If evasion is currently clamped at 0 anywhere in the resolution path, that clamp needs to be removed.
- **Regen magnitude shifts to percentage-based.** Default Regen magnitude changes from flat 5 HP/tick to 5% MaxHP per turn (i.e., per the wearer's CT-100 trigger). This makes Regen scale meaningfully across HP tiers — low-HP Mages (~6 HP/turn) and high-HP tank Knights (~15 HP/turn) both get appropriate sustain. Affects Earth Mage's Buff ability and Tintinibar's Auto-Regen equally.
- **Rasp Pendant's damage-to-MP conversion.** Wielder's outgoing damage gets reduced by 10%; target loses the same as MP; wielder gains it as MP. This is a post-damage-computation effect that sits at the end of the damage pipeline. Engine may already support this via a damage-dealt hook, or may need additional plumbing — flag for verification during implementation.

## Open Questions

- **Does crit apply to spells?** If yes, how does it interact with spell-cast riders like Bolt Hammer? Currently spell damage is treated as deterministic in tuning math.
- **Should the basic Lightning spell have variance?** Lightning Mage's identity is "high burst, swingy" — adding variance to its spells would reinforce that. Currently treated as deterministic.
- **Resistance shift interactions.** When two wands of opposing elements apply their effects to the same target (Wand of Depths + Wand of Deepwood, opposing Fire/Lightning shifts), do they stack additively, cancel out, or override? Working assumption: additive, can produce zero net effect.
- **Future wands (Fire, Lightning).** Suggested pattern follows existing two: Wand of Embers (Fire-themed) → +Earth Res / -Water Res with a Burn-amplification passive; Wand of Storms (Lightning-themed) → +Water Res / -Earth Res with a +20% Lightning spell damage passive. Not yet locked in.
- **Two-handed weapons.** Deferred to post-Mage War expansion. Will trade shield/second-weapon use for substantial weapon power concentration.
