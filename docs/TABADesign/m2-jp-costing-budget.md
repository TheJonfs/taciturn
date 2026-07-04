# M2 — JP Ability-Costing: Budget Philosophy & Working Values

**Status: living record.** Captures the costing rubric, the pricing logic, and per-class JP costs as we
assign them. Goes to the implementer alongside the job-tree brief once complete. Companion to
`m2-progression-xp-jobtree-brief.md`.

## Budget philosophy — bottom-up
- Costs are assigned per-ability against a shared rubric; per-class near-master totals **sum** to the
  campaign mastery target, and that sum **sets** the macro JP budget (JP/battle). The audit *produces*
  the budget, not the reverse.
- **Mastery target:** ~1 class near-mastered per chapter × 3 chapters, plus dabbling / going one-half-deep.
- **One JP sink (corrected):** ability unlocks. The class tree is *not* a separate sink — its
  thresholds gate on JP already spent on abilities, so buying abilities climbs the tree for free.
  Budget = total ability-spend.
- **Working budget signal:** ~1,750 JP to near-master a class (Monk calibration) → ~5,500–6,500 for the
  mastery target → ~90–110 JP/battle over ~55–65 story+grind battles. Refine as more classes are costed.

## The core rule — price means different things by ability type
- **ACTIVES — unlock-to-USE.** You buy the ability into a Command Set you then wield wholesale (as the
  class, or as your one secondary set). Price paces **how fast the class's combat kit comes online**;
  cheap-early is good — a fresh unit should have toys immediately, so JP pays off in *things to do*, not
  poached passives. Bands: entry ~100, mid ~150, capstone ~300+.
  - *Onboarding lens:* the cheapest active can be chosen to hand the player a specific first experience
    (Monk's Bear's Heave at 100 → repositioning before damage).
- **R/S/M (Reaction/Support/Movement) — FREE in-class; JP = EXPORT tax.** The price is the cost to carry
  the ability *out* to another class's bucket slots (poach it). Scales with export value:
  - *Situational* (narrow use) → low tax.
  - *Identity-carrier* (defines the class; exporting carries its flavor) → mid ~200 (so units don't shift
    too soon).
  - *Universal draw* (auto-include on many builds) → high premium ~400+ (the diversity-protection tax).
  - The `stat × 1.25` supports (Conductor MA×1.25, Martial Expertise PA×1.25) are the ultimate universal
    draws **and** Tier-2 gated → the highest prices (~450–550+, paced twice).
- **Key consequence:** actives can't be individually splashed (they ride the whole Command Set), so the
  export/draw tax lives **mostly on R/S/M**. This collapses "power × splashability" into one clean
  per-type rule — *with one refinement below.*
- **Refinement — utility poach-driver actives.** An active *can* be cherry-picked: learn only it, equip
  its class's Command Set as your secondary, and you've effectively splashed it. Since running a
  secondary set is routine (not a rare commitment), the set-slot isn't a real gate — the JP is. So a
  **utility poach-driver active** — a standalone buff / sustain / control that's the reason a foreign
  unit would equip the set at all (e.g. Geosage's Regen) — carries a **muted export tax** (~200),
  unlike combat actives which stay cheap. Combat actives: cheap. Utility poach-drivers: taxed.
- **Cross-class rule — mage base spell = 100 starter.** Each elemental mage's single-target attack is
  its ~100 entry active (guarantees every mage is functional on unlock; keeps the four parallel).
  Confirm each mage actually leads with a clean single-target damage spell; if one leads with a status
  or AoE, use its most basic damage spell for the slot.

## Bucket cost ≠ JP cost
- Abilities carry a **bucket** cost (loadout-slot capacity, 1–2) — separate from JP. Bucket capacity
  applies only to R/S/M, and to equipping a whole Command Set (budget typically 1 secondary + the class
  default; +1 via Magus's Crown). **Actives cost 0 to equip.**
- Bucket cost is a useful **prior** for the JP band (bucket-2 abilities skew capstone/draw).
- **Complementary throttles.** JP-to-unlock and bucket-to-equip share the load. A bucket-2 draw is
  already throttled at equip-time (eats 2 slots), so it needs *less* JP than an equally-desirable
  bucket-1 draw. Consequence: the priciest JP draws are **bucket-1 universal** ones (Biomastery: cheap
  to equip → JP carries the full throttle, 400+), while heavily-borrowed bucket-2 draws sit a notch
  under (Hotfoot 350, Ignition 200) even when borrowed *more*.
- **Native synergy** can lift an active's cost: one that combos with the class's own in-class passives
  is worth more to the native class (Fireball + Aether Bloom → 200).
- **Combinatorial-kit classes (structural).** Some classes aren't a list of discrete spells but a
  *combinator* operating over *components* — Alchemist = Compound/Throw Item over {Potion, Phoenix
  Down, Remedy, Ether}; Calculator = Math-cast over {Parameters × Values} + payloads. **Rule: gate the
  components (JP-unlock each), keep the combinator always-on-but-empty.** Unlocking the combinator first
  yields a fuel-less engine (swingy dead zones); unlocking components first means every unlock adds
  immediately-usable capability. No separate economy — the Alchemist's limiter is turns + MP, not
  scarcity/gil. *Engine implication:* the combinator reads the unit's unlocked-component set (command-set
  model shifts from fixed-abilities to component-driven). Alchemist and Calculator are a matched pair
  for the ability-access implementation.

## Four-tier rubric (JP placeholder — scales to budget)
| Tier | JP | Anchor |
|---|---|---|
| Basic / entry | ~100 | Fleet of Foot |
| Mid | ~150–250 | Serpent's Coil |
| Capstone | ~300–450 | Megavolt |
| Draw (premium) | power band + ~150, higher for the truly universal | Conductor |

## Unlock grant
- **Tier-scaled grant (supersedes flat 100):** Tier 1 unlocks with **100 + random**, Tier 2 with
  **200 + random**, Tier 3 with **300 + random**. You arrive at higher tiers later (having proven
  investment), so hitting the ground running is the earned reward for the climb — and it's a principled
  rule, not a Calculator special-case. Solves the combinatorial dead-until-3 onboarding (T3's 300 covers
  the Calculator's cheapest functional triple, 275) and improves T2/T3 onboarding generally. Tier 1
  (early game, where the grant matters most vs accumulated JP) is unchanged, so the early economy is
  untouched.
- *Spillover TBD:* does overflow past a tier threshold carry? unused JP from the prior class?

## Watch-fors
- **Bimodal distribution:** cheap-actives + expensive-exports can leave a hole in a class's *sorted*
  cost list (nothing affordable for several battles). Check each class's sorted costs for gaps to hold
  the ~unlock-every-2-3-battles drip.
- **Drip target:** an unlock always ~1–3 battles out.

## Locked per-class costs

### Monk — 1,750 to near-master
| Ability | Type | JP | Note |
|---|---|---|---|
| Bear's Heave | Active | 100 | cheapest — onboards repositioning before damage |
| Serpent's Coil | Active | 150 | stance + Speed refund |
| Foxfire | Active | 150 | ×8 + Burn + stance |
| Storm Stoop | Active | 150 | line AoE + stance |
| Chakra | Active | 300 | capstone — self-heal + MP + AoE |
| Barehanded | Support | 200 | identity-carrier export |
| Vigilance | Movement | 300 | defensive export |
| Counterpunch | Reaction | 400 | universal draw — early counter-of-choice |

*(other 13 classes to follow)*

### Geosage — ~1,750 near-master (the designated utility grab-bag / poach-target)
Diffuse-by-design: sustain (Regen), control (slows, Blind/Silence), lockdown ultimate, mobility,
status-amp. All three passives are universal exports (no filler) → *the* poach-target; poachable on two
axes (R/S/M individually + utility actives via Command Set). Most players **dip** it (Biomastery, maybe
Regen) rather than master it.

| Ability | Type | JP | Note |
|---|---|---|---|
| Rock Toss | Active (base) | 100 | single-target starter (mage-base rule) |
| Life from the Loam | Active (buff) | 200 | Regen; utility poach-driver (muted tax) |
| Gaian Hex | Active (debuff) | 150 | Blind + Silence (borderline poach-driver, situational) |
| Earthquake | Active (AoE) | 250 | AoE dmg + slow |
| Cataclysm | Active (ultimate) | 300 | capstone — Poison + Don't Act + Don't Move AoE |
| Landwalker | Reaction | 150 | weak reaction, low export interest |
| Bedrock Stride | Movement | 200 | +1 Move + fall-immunity |
| Biomastery | Support | **400 / 500 — OPEN** | status ×1.25, the "status Conductor"; 400 debuffs-only, 500 if it composes on buffs |

Biomastery: **400 (debuffs-only) / 450 (if composes on buffs) — CAPPED at Conductor parity per the sweep** (500 would exceed the premier universal, violating the stat-multiplier tier). Near-master ~1,750–1,800.

### Pyromancer — ~1,850 near-master
Identity: stack-based DoT (Burn) — Slow Burn, Flame Lance, Ignition, Smolder all pile Burn stacks.
Confirmed the base-spell caveat: Fire has no plain bolt, so Scorch (damage + debuff) fills the 100 slot.
Another poach-target (more focused than Geosage): three of four passives are export draws.

| Ability | Type | JP | Note |
|---|---|---|---|
| Scorch | Active | 100 | base attack (mage-base rule) |
| Slow Burn | Active | 100 | Burn identity (onboarding-first) |
| Fireball | Active | 200 | AoE — native synergy w/ Aether Bloom |
| Inner Warmth | Active | 150 | ally PA/MA-up buff |
| Flame Lance | Active (ult) | 300 | capstone |
| Aether Bloom | Support | 300 | AoE-expand export draw |
| Ignition | Support | 200 | Burn-on-magic draw; bucket-2 co-throttle |
| Hotfoot | Movement | 350 | most-borrowed passive (even outside MA); bucket-2 co-throttle keeps it under Biomastery |
| Smolder | Reaction | 150 | Burn-counter, situational |

Settled.

### Hydrologist — ~1,550 near-master (the roster's lighter main-it controller)
Identity: tempo / CT manipulation + forced movement — every tool touches time (CT/Speed) or space
(knockback). **Pattern-break: NOT a rich poach-target** (unlike Geosage/Pyromancer) — its passives are
narrow/tempo-flavored, so it's a *main-it controller* rather than a dip-for-passives class. Lower total
reflects lower export value.

| Ability | Type | JP | Note |
|---|---|---|---|
| Water Lash | Active | 100 | base attack + CT-push rider |
| Brine | Active | 150 | Speed Down debuff |
| Rapids Rush | Active | 200 | ally CT-boost — tempo poach-driver (muted tax) |
| Tidal Wave | Active | 200 | AoE + knockback |
| Maelstrom | Active (ult) | 300 | ultimate capstone |
| Flow State | Support | 250 | caster tempo draw |
| Tidal Pull | Reaction | 200 | CT-on-hit tempo |
| Tidewalker | Movement | 150 | situational, water terrain only |

Settled. Tempo passives kept as-is → Hydrologist confirmed as the deliberately lighter class (mastery
cost as a readout of class role: high = strip-mine target, lower = main-it).

### Alchemist — ~1,350 near-master (combinatorial-kit; action-economy-limited)
Structural: Compound + Throw Item are **always-on combinators** (not JP abilities); the four **items**
are the JP-unlocks that populate them. Limiter is turns + MP (no item economy). Low total = power lives
in action-economy, not JP (class-role readout, à la Hydrologist).

| Ability | Type | JP | Note |
|---|---|---|---|
| Potion | Item-unlock | 100 | heal; natural first unlock → healer turn 1 |
| Phoenix Down | Item-unlock | 150 | revive; thrown = ranged revive (poach lens: biggest splash — confirm 150 intended) |
| Remedy | Item-unlock | 150 | cleanse status |
| Ether | Item-unlock | 200 | MP restore; sustains own Compound + caster battery (enabling lens → priciest) |
| Combat Focus | Reaction | 250 | accumulating PA-under-fire |
| Travel Preparations | Support | 250 | seeds items; package-discount (dead without item skills → below Biomastery) |
| Healthy Stride | Movement | 250 | heal (tiles moved)² on move; sustain-mobility |

*Compound / Throw Item: always-on, 0 JP (interface, not ability).* Open: Phoenix-Down-at-150 confirms
revive-democratization is intended. **Calculator will need the same combinatorial treatment.**

### Hunter — ~1,350 near-master (light main-it specialist; ranged/height)
Identity: ranged (bow) + high-ground/verticality specialist. **Correction:** Eagle Eye is NOT a
universal draw — most physical weapons already sit ~90%+ accuracy, so hit×2 only matters for low-acc
weapons (bow-enabler, axe-upside). Its exports are all *conditional* (bows, height) → a light main-it
specialist, not a poach-target. The real universal-PA-draw is Martial Expertise (Knight, T2) — mirror of
Conductor (Aethurge, T2); both stat-multiplier universals gated at T2 by design.

| Ability | Type | JP | Note |
|---|---|---|---|
| Charged Attack | Active | 100 | signature ranged shot (entry) |
| Pin Down | Active | 200 | ranged Slow control (+ gains 6 MP — see note) |
| Scramble | Active | 100 | reposition/climb (+ gains 2 MP — see note) |
| Eagle Eye | Support | 300 | bow-enabler / axe-upside, not a universal draw |
| Vantage | Support | 300 | high-ground draw (conditional on height play) |
| High Jump | Movement | 200 | verticality mobility |
| Updraft | Reaction | 150 | reactive jump-build, niche |

Settled. **Mechanical note (implementation, not JP):** Pin Down → 6 MP, Scramble → 2 MP (currently 0 MP,
inconsistent with all actives except Chakra). **Class-role note:** the Hunter reads as a light main-it
specialist; its total is genuinely low, not size-confounded (its one "big draw," Eagle Eye, turned out
conditional).

---

## JP/battle — first pass (6 of 14 classes costed)
Costs so far: Monk 1750, Geosage 1750, Pyromancer 1850, Hydrologist 1550, Alchemist 1350, Hunter 1400
(range 1350–1850, avg ~1610).

**Estimate: ~90 JP/battle**, story + expected grind. Derivation: mastery target = 3 near-mastered
classes (~4,300–5,350 by choice) + dabbling (~1,200) − unlock grants (~750) = ~4,750–5,800 battle-JP,
over ~60 story+grind battles (Chris's current plan: ~30 story + 20–30 grind) → ~85–90/battle. Anchored by the sanity check: one ~1,610 class per chapter
(~20 battles) = ~80/battle.

Choice (mirror of the XP base-value fork): mastery reachable by **story alone** (~110–130/battle) vs
**story + grind** (~75–92, pure-story ≈ 2.5 classes). Chosen: **story + grind**, consistent with the
grind-as-feature XP decision — grinding funds the exotic finish.

Sensitivities: class-choice (cheap-3 ~75 / expensive-3 ~92 → target ~90 covers avg-to-expensive); mild
level-scale option (~70 early → ~110 late, avg ~90, funds late capstones); if per-action like FFT,
~15 JP/action at 6 actions. **Caveat:** the missing 8 include the expensive Tier-3s (Assassin,
Calculator) + hybrids → avg will likely drift up. Do NOT lock JP/battle until the back nine are costed.

### Aethurge — ~1,950 near-master (Tier 2; elemental template maxed; most expensive class)
The elemental-mage template pushed to its damage extreme: SP-12 base (vs SP-8), SP-36 ultimate (Megavolt,
strongest attack, 25%-HP self-cost), + Conductor (the definitional MA draw). Both a strong main AND the
premier strip-mine target → highest total yet. **Why Tier 2:** it's the pinnacle and it houses Conductor
(the MA stat-multiplier universal — mirror of Knight's Martial Expertise).

| Ability | Type | JP | Note |
|---|---|---|---|
| Lightning Bolt | Active | 100 | base single-target (power in SP-12 + MA-ceiling, not JP) |
| Magnetic Mark | Active | 150 | Vulnerable debuff |
| Static Embrace | Active | 150 | Crit buff (ally) |
| Chain Lightning | Active | 200 | AoE |
| Megavolt | Active (ult) | 450 | signature nuke; 25%-HP self-cost is minor vs the delete → JP is the throttle |
| Conductor | Support | 450 | definitional MA draw; matched pair with Megavolt (the two pinnacle ceilings) |
| Discharge | Reaction | 250 | lightning counter |
| Quickstep | Movement | 200 | caster tempo movement |

Settled. Megavolt's real counter is universal-resistance gear (M3), so until then JP is its only throttle.

### Knight — ~1,450 near-master (Tier 2; PA pinnacle — where the mage-mirror breaks)
Aethurge's Tier-2 counterpart, but the mirror **breaks at the capstone**: the mage's damage ceiling is
an *active* (Megavolt); the Knight has NO active nuke — its ceiling is the free Attack × PA × weapon ×
Martial Expertise. Two 450s for the Aethurge (active nuke + passive multiplier); ONE for the Knight
(just the passive). Build variety lives in **shields/armor**, not ability picks. Low total = power costed
elsewhere (stat curves + equipment), not underpowered.

| Ability | Type | JP | Note |
|---|---|---|---|
| Power Attack | Active | 100 | signature swing (entry) |
| Bull Rush | Active | 150 | knockback control |
| Lightning Stab | Active | 150 | Silence — anti-caster |
| Counter | Reaction | 400 | premiere physical reaction (weapon-swing counter; pairs w/ Monk's Counterpunch — weapon vs PA scaling, non-redundant) |
| Bravestrider | Movement | 200 | +1 Move / +10 Brave (bucket-2 co-throttle) |
| Martial Expertise | Support | 450 | PA draw — Conductor's exact mirror |

Settled (Martial Expertise 450 = Conductor's mirror; Counter 400 = premiere physical reaction).

---

## Pattern — JP total = where a class's power lives (7-class finding)
Not "how strong" — *where the power is bought*:
- **Mages** (power in spell-actives): 1,550–1,950 — you literally buy their damage as abilities.
- **Gear-martials** (power in weapons/stats/gear): Knight ~1,300, Hunter 1,350 — bought in the equipment
  economy, not JP; build variety in shields/armor.
- **Other-economy**: Alchemist 1,350 (action-economy), Hydrologist 1,550 (tempo-in-passives).
- **Revealing exception**: Monk 1,750 — a *barehanded* martial with no weapon to carry its power, so it
  buys it as actives → mage-shaped total.
Budget consequence: martial-heavy parties spend less JP → run a surplus (funds cross-class dabbling);
the ~90/battle rate is effectively calibrated to the mage-ish playstyle.

### Thief — ~1,600 near-master (Tier 2; physical utility-novelty — denial identity)
No damage identity — a **denial** identity: every active *takes* (HP/MP/buffs/hearts). The T2
utility-novelty counterpart to the Enchanter (they're **opposed**: Thief steals buffs, Enchanter applies
them) — mirroring how Knight↔Aethurge are the T2 damage-pinnacle pair. **Momentum = the physical Flow
State** (+CT after any non-magical action; broader than Flow State since it fires on basic Attacks).

| Ability | Type | JP | Note |
|---|---|---|---|
| Steal HP | Active | 100 | lifesteal attack (entry) |
| Steal MP | Active | 150 | MP drain + refuel (anti-caster) |
| Steal Buffs | Active | 250 | signature disruption (strip enemy buffs → self) |
| Steal Heart | Active | 300 — OPEN | charm ultimate; capstone-not-premium (unreliable: gender-gated, 50% break, low contest) |
| Slip Free | Reaction | 200 | self-debuff cleanse |
| Momentum | Support | 300 — OPEN | physical tempo draw (mirror of Flow State) |
| Move +2 | Movement | 300 | premium mobility (mobility ladder: Fleet ~100 / High Jump·Bravestrider 200 / Move+2 300 — reconcile at sweep) |

Settled (Momentum 300, Steal Heart 300, Move +2 300).

**T2 structure (emergent):** each half = damage-pinnacle (Knight/Aethurge, carries stat×1.25 draw) +
utility-novelty (Thief/Enchanter, opposed axes). Clean roster symmetry from the tiering.

### Enchanter — ~1,750 near-master (Tier 2; magical utility-novelty — the Thief's apply-mirror)
**Prediction confirmed:** the Enchanter is the Thief's apply-side mirror — 4 apply-actives (Haste,
Protect, Shell, Esuna) opposing the Thief's 4 steal-actives, same count, same no-nuke utility shape.
Mirror breaks (as Knight/Aethurge did) on the R/S/M export profile: magical side poaches richer. Short
Charge is a near-Conductor universal caster draw (any charged spell faster).

| Ability | Type | JP | Note |
|---|---|---|---|
| Protect | Active | 100 | basic ward (entry) |
| Shell | Active | 150 | magical ward |
| Esuna | Active | 150 | AoE cleanse |
| Haste | Active | 250 | premium tempo-buff; the Enchanter's best active |
| Short Charge | Support | 400 | universal caster tempo draw (any charged spell ×1.33 faster) — near-Conductor |
| Aura Mastery | Support | 300 | buff-amplifier ("buff-Conductor" — cast buffs ×1.33) |
| Resistance Save | Reaction | 200 | accumulating magic-resistance; reliability discount (must survive hits to snowball) |
| Float | Movement | 200 | mobility; forward-priced for anticipated terrain hazards |

Settled. **Tempo family is now a QUINTET for the sweep:** Flow State, Momentum, Quickstep, Hotfoot,
Short Charge (plausibly strongest). Two pricing principles applied: *reliability discount* (accumulating
abilities priced below ceiling — realizing it needs setup/survival) and *forward-pricing* (cost can
anticipate roadmap content).

**Confirmed finding:** magical-side classes carry universal draws (Conductor, Short Charge, Biomastery);
physical-side carry conditional/niche passives (Eagle Eye→bows, Momentum, Move+2). Poach-richness skews
magical.

### Templar — ~1,400 near-master (Hybrid Tier 2; heavy-armor paladin-healer)
Balanced-stat signature: **PA 6 = MA 6** (roster's only equal); universal + heavy gear. Tanky healer-
paladin: heals (Cure), **dedicated repeatable revive** (Raise — the MP-gated revive path, vs Alchemist's
item-gated one), fights (Jump + heavy gear). All passives faith/heal/gear-flavored.

| Ability | Type | JP | Note |
|---|---|---|---|
| Jump | Active | 100 | physical entry |
| Cure | Active | 200 | AoE heal — poach-driver |
| Raise | Active | 300 | dedicated revive — capstone (revive is a huge swing) |
| Emissary of Murond | Support | 250 | heal-amplifier ("heal-Conductor"; narrower than Aura Mastery 300) |
| Unified Calling | Reaction | 150 | MP-on-heal, niche |
| Monkeygrip | Support | 200 | 2H gear-enabler |
| Faithstrider | Movement | 200 | +Move / +Faith |

**FALSIFIED PREDICTION:** "hybrids land between the halves" is WRONG. The Templar lands *low* (~1,350,
with the gear-martials) because it's a heavy-armor gear-hybrid — power in armor + few actives, not a big
JP kit. Corrected rule: **hybrids land by power-source, like everyone else.** Predicts the Terraformer
(Worldcraft = large active kit) lands *high* — the two hybrids diverge, not cluster.

### Terraformer — ~1,800 near-master (Hybrid Tier 2; Worldcraft battlefield-shaper)
**Corrected prediction CONFIRMED:** active-rich (5 Worldcraft actives) → lands high (~1,650), diverging
from the gear-hybrid Templar (~1,400). The two hybrids bridge from **opposite sides**: Templar PA=MA on
heavy gear (physical-leaning), Terraformer MA 8 > PA 6 on magical gear (magic-leaning). Identity is
*indirect* — reshape terrain (elevation, fall damage, walls, chokepoints) so positioning does the work.

| Ability | Type | JP | Note |
|---|---|---|---|
| Pillar | Active | 100 | basic terrain-raise (entry) |
| Pit | Active | 100 | terrain-lower + fall damage (2nd entry — binary onboarding: Pillar for archers / Pit for dropping the immobile) |
| Hill | Active | 300 | AoE raise (capstone — mass-terrain > walls) |
| Valley | Active | 300 | AoE lower (capstone) |
| Barrier | Active | 200 | wall-spawn control |
| Damage Split | Reaction | 400 | premier reaction (playtest); joins Counter/Counterpunch at the 400 reaction-tier |
| Ignore Height | Movement | 200 | any-elevation mobility (bucket-3 co-throttle) |
| Expert Former | Support | 200 | Worldcraft cap — **native-only, no export tax** |

**New refinement — non-exportable supports.** Expert Former only works on a Terraformer (amplifies
Worldcraft, which only it has), so it carries *no export tax* — priced on native value alone. Not all
supports are draws; class-locked enablers are the exception.

### Assassin — ~1,550 near-master (Tier 3; fast debuff-disruptor)
**Prediction partly wrong:** predicted "low gear-martial"; lands *mid*-physical (~1,500). Spirit held
(physical range, below mages, T3-gating from CC power) but "low" was off — two premium picks (Shadow
Stitch, the game's hardest CC / full lockdown; Two Weapons, dual-wield) keep it mid. All four actives are
status (Stop/Poison/Faith Down/Brave Down) — a dismantler, not a damage-dealer; its *damage* is Speed
13 + dual-wield knives, its *kit* is control.

| Ability | Type | JP | Note |
|---|---|---|---|
| Undermine | Active | 150 | Brave Down |
| Sow Doubt | Active | 150 | Faith Down (anti-caster/heal) |
| Blowdart | Active | 100 | Poison DoT — entry (opening play = DoT) |
| Shadow Stitch | Active | 350 | Stop — premier CC (full lockdown), capstone |
| Speed Save | Reaction | 200 | Speed accumulation (reliability-discounted) |
| Two Weapons | Support | 400 | dual-wield; **PA×0.75** (≈1.5× effective, not 2×) + bucket-3 → build-around, not default |
| Fleet of Foot | Movement | 200 | +1 Move/+1 Jump (cheap bucket-1; Jump is a weak rider like Brave) |

Settled. Two Weapons balanced by PA×0.75 (1.5× effective) + bucket-3, not a default pick.

**Refined finding — physical universals are gated harder, not absent.** Two Weapons is a genuine
universal physical draw (dual-wield doubles anyone's swings). So physical HAS universals (Martial
Expertise, Two Weapons) — but gated later/heavier (T2 & T3+bucket-3) vs magical (Biomastery T1/bucket-1,
Conductor T2/bucket-2). Corrected: not "physical lacks universals" but "physical's universals are gated
harder."

**Mobility ladder COHERES (rider-value-driven):** base = Move+1; the *rider* sets price. Weak riders
(Jump+1, Brave+10) → 200 (Fleet, Bravestrider); Speed+1 premium rider → 350 (Hotfoot); +2 Move pure
reach → 300. Sweep should *confirm* this principle, not rebuild.

### Calculator — ~2,400 near-master · PROPOSED (Tier 3; combinatorial capstone — the game's most expensive class)
The extreme combinatorial-kit: Math cast (always-on combinator) over a **payload × parameter × value**
lattice. Identity: *immobile but far-reaching* (Speed 7 slowest, Move/Jump 2, MA 9 modest) — trades
mobility/power for global field-wide reach. Poor stats ARE the gate (pay dues in the weak class to unlock
Math Skill before exporting it to a better-statted class).

**Unlock model: Model 1** — every component unlocked separately (max expression + accelerating-power
curve, right for the capstone). Engine rework required to separate Parameters and Values (matched pair
with the Alchemist's combinator rework).

**Components — Parameters:** Level, Current HP, Height, Current CT. **Values:** Prime, 3, 4, 5.

| Component | Type | JP | Note |
|---|---|---|---|
| Precision Fire | Payload | 100 | SP3 + Burn — entry (damage-triple onboarding) |
| Targeted Treatment | Payload | 150 | field-wide heal |
| Sculpted Enhancement | Payload | 200 | PA/MA up |
| Engineered Defenses | Payload | 200 | defensive buff |
| Exact Rhythm | Payload | 200 | CT adjust — dialed back (ceiling lives in a *fast* borrower, not the slow Calculator) |
| Current CT | Parameter | 150 | dynamic — hits a shifting set each cast (premiere) |
| Level | Parameter | 150 | premiere |
| Height | Parameter | 100 | situational (vertical maps) |
| Current HP | Parameter | 100 | situational |
| Prime | Value | 150 | large shifting set (premiere; matches FFT's "3 was best" instinct — live values worth more) |
| 3 | Value | 100 | |
| 4 | Value | 75 | |
| 5 | Value | 75 | |
| Mathematician | Support | 200 | native-only enabler (no export tax, like Expert Former) |
| Thoughtful Pacing | Movement | 250 | MP-on-move draw |
| Cornered Focus | Reaction | 200 | MA accumulation (reliability-discounted) |

Active lattice (13 components) = 1,750; + R/S/M 650 → **~2,400 near-master (roster ceiling — correct:
T3 combinatorial capstone whose power genuinely lives in JP)**. Cheapest functional triple = 275
(Precision Fire + Height/HP + 4/5), covered by the T3 300+random grant on unlock → no dead zone.
Drip-curve healthy (sorted: 75/75/100×4/150×4/200×3, no gaps).

**Content-sequencing watch-for (not a pricing issue):** the accelerating-power curve means a
near-complete Calculator gains far more power-per-JP than a starting one (the last value lights up ~20
new triples). Reward-for-commitment by design, but authors should avoid landing a hard story battle
exactly as a player closes the lattice — a difficulty cliff risk. Sequencing note for the Calculator's arc.

Pricing structure: payloads-heavy (the effects), parameters-by-reach, values-by-liveness. Open play-reads
folded in: CT scariest parameter, Prime scariest value, Exact Rhythm *not* a runaway (slow-caster ceiling).


---

## VALIDATION SWEEP (all 14 costed) — cross-class family consistency

**Verdict: yardstick held.** Three families confirmed their ladders; each coheres around a *different*
single variable (the sign pricing was principled, not vibes):

- **Mobility ladder** — price = *rider value*. Move+1 + weak rider (Jump/Brave/Faith/fall) = 200;
  +Speed = 350; +2 Move (pure reach) = 300; +2 Jump = 200; resource riders (HP/MP) = 250; situational
  terrain 150–200. Minor: Fleet≈High Jump at 200 (tolerance). Vigilance 300 is defensive, off-ladder.
- **Stat-multiplier tier** — price = *universality*. Universal 400–450 (Conductor/Martial Expertise/
  Short Charge/Two Weapons); broad 300–400 (Biomastery/Eagle Eye); narrow 250–300 (Aura Mastery/Emissary).
- **Reaction ladder** — price = *tier*. Premier 400 (Counter/Counterpunch/Damage Split); mid 200–250
  (accumulators + retaliates + cleanse); situational 150. Accumulating sub-family = stat-value ×
  reliability (Jump 150 < Speed/MA/resist 200 < PA 250). Minor: Combat Focus 250 slightly hot.
- **"Tempo quintet" dissolved** — never one family: 3 conditional-CT (Quickstep 200/Flow State 250/
  Momentum 300, breadth-of-trigger ladder) + Short Charge (multiplier, → stat-multiplier tier) + Hotfoot
  (flat-Speed, → mobility ladder). No inconsistency; grouped by theme not mechanism.

**One correction forced:** Biomastery capped at ≤450 (see Geosage entry).

## JP/BATTLE — recompute with all 14 (supersedes the ~90 point-estimate)
Avg near-master ~1,680 (range Hunter/Alchemist 1,350 → Calculator 2,400). Mastery = 3 classes + ~1,200
dabble − ~1,050 tiered grants, over ~60 battles (30 story + ~25–30 grind):

| playstyle | 3-class | JP/battle |
|---|---|---|
| martial-heavy | ~4,150 | **~72** |
| average | ~5,050 | **~87** |
| mage-heavy (incl. Calculator) | ~6,200 | **~106** |

**Band ~72–106, avg ~87.** Per-playstyle by construction (power-location varies): martial parties run a
surplus (over-master / dabble); mage parties grind the exotic finish (grind-as-feature on the JP axis).
**Carry into the brief: ~87 JP/battle (or ~14/action at 6 actions) as the to-confirm generation rate,**
optionally mild level-scaled (~70 early → ~110 late) to fund late capstones.
