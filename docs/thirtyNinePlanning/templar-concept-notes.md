# Templar — Class Concept Notes

*Design notes for a future content session. Working names: **Templar** (class), **Monkeygrip** (passive, from FFTA). Captures the settled vision and the open tuning values — not yet a build brief.*

---

## Identity

A hybrid PA/MA class: a Glabados Church member, precursor to FFT's Holy Knights / Shrine Knights. Distills the **White Mage** (healing, revival) and the **Dragoon** (Lance, Jump) into one slow, balanced body. Two halves, two donor targets — other classes raid its **Command Set** for healing or its passive **Monkeygrip** for weapon-economy shenanigans.

**Spatial identity — "lines and clusters."** The kit is friendly-fire on both ends: the Lance *pierces enemy lines* (and clips an intervening ally), Cure *rewards clustered allies* (and heals clustered enemies). The Templar punishes sloppy positioning — the opponent's and its own. High skill floor and ceiling.

**Action economy.** Slow to act (Speed 8 → infrequent turns) but decisive once committed: Cure and Raise resolve fast, Jump is the most telegraphed. Early game it fights with weapon basics while charging toward decisive heals, revives, and Jumps.

---

## Stat line

- **HP 132 · MP 36 · PA 6 · MA 6 · Speed 8 · Move 2 · Jump 3**
- **Evade 10 / 6 / 2** (front / side / back)
- Speed 8 — tied 2nd-slowest with Geosage / Terraformer, ahead of Calculator (7).
- Move 2 — the slow-caster tier (with Terraformer); Faithstrider lifts it to 3 (no base-4, per the Move-tier principle).

PA 6 sits well below the Knight's functional 12 (base 10 × 1.25 innate), so on shared gear the Knight roughly doubles the Templar's physical output — the gap that protects the Knight's identity even with shared Knight-class gear. MA 6 powers the spells but stays below the four Mages / Calculator / Terraformer. **HP 132 wants a sanity-check against the Knight's HP** — with Auto-Protect (Defender) + a shield available, the Templar shouldn't approach the dedicated tank's durability.

---

## Command Set — 3 abilities + weapon basic

All command abilities carry an MP cost (values TBD). *Action-speed convention: higher = faster resolution; existing fastest spells = 30.*

### Cure
- MA-powered AoE heal. **Heal = MA × SP 8 × faith factor (~0.49 default)** → effective ≈ 3.9 × MA before boosts, ≈ 4.9 × MA with the Templar's innate Emissary (+25%). Below Potion's 12 × PA single-target, as intended; the niche holds (worse on one target, better across a cluster).
- Shape: **1-square cross** (5 tiles); boostable by the **Pyromancer's existing AoE-expand support**.
- Small vertical tolerance (TBD) + infinite vertical range (all magic).
- **Friendly fire ON** — heals enemies caught in the cross.
- **MP 8.** Action speed **40** (fast — lands before the board shifts; placement is a fair reactive puzzle, not commit-and-pray).

### Raise
- Single-target revival (scope = Phoenix Down). **Revive HP = MA × SP 10 × faith factor (~0.49)**, same formula shape as Cure.
- **MP 12.** Action speed **30**.
- At the 0.49 baseline + innate Emissary this is ≈ **37 HP** at MA 6 — clears the Alchemist's Phoenix Down (4 × PA 8 = 32) at baseline, so it's a flat premium revive (SP bumped 8 → 10 for exactly this).

### Jump (the offensive pillar)
- Action speed = **3 × unit Speed** (24 at base Speed 8) — rewards Speed-stacking / Haste; a third build axis orthogonal to PA/MA, and self-balancing (the fast-Jump classes have low PA). The telegraph shrinks as Speed is invested.
- Damage = **PA × WP × (1 + [1 if weapon is Lance])** — Lance doubles it (canonical Dragoon/Lance reward).
- Range: **H6 / V6 to start — likely tune down.** Large to offset the charge and the dodge window (target can vacate the tile).
- **MP 6.**
- **Emergent role:** vertical-6 reach beats melee's vertical-3 defense, so Jump is the roster's answer to perch-camping — a healthy counter to the high-ground meta the AI is currently learning to value.

### Weapon basic
- Non-charged offense (Lance pierce or sword), scaled by PA 6.

---

## Innate & equippable abilities

**Ability-budget model:** each unit has **3 points in each of three categories — reaction, support, movement — plus whatever is innate to its class** (innate is free, separate from the budgets). The Templar's innate kit is generous in *count* (four abilities) but in line with other classes in *value*: its innate support value (Monkeygrip 2 + Emissary 1 = 3) is comparable to the Assassin's innate Two Weapons (3) or the Knight's Martial Expertise (~2). So it's not a passive-economy edge — power is in the *kit's shape*, not its quantity.

Innate to the Templar (free; costed in the pool for others):
- **Monkeygrip** (support, **2 pts**) — two-handed weapons require only one hand. Two-hander + shield, or half of the dual-two-hander combo (see Build interactions).
- **Emissary of Murond** (support, **1 pt**) — all healing applied boosted **+25%**. Cheap → a strong donor for other healer-secondary builds; on the Templar it always multiplies Cure/Raise.
- **Unified Calling** (reaction, **1 pt**) — on receiving healing, also recover MP equal to self's PA. On the Templar (PA 6 → 6 MP), closes a self-sustain loop: stand in your own Cure cross → heal self → regain MP → Cure costs net ~2. *(Assumed innate to the Templar — confirm.)*
- **Faithstrider** (movement, **2 pts**) — Move +1 and Faith +10. Lifts the Templar to Move 3 and boosts its own healing (higher faith factor), at the cost of more vulnerability to enemy magic (faith cuts both ways). *(Assumed innate to the Templar — confirm.)*

*Watch:* the healing stack is multiplicative — Emissary (×1.25), Faithstrider (faith ↑), Imp Halberd (MA +1), high-faith targets all compound (~1.5–1.7× a fully-invested heal). A playtest-watch, not a per-number concern.

---

## Equipment

- Equips **Knight-only Head and Body** armor + all Universal gear. Second class after the Knight with Knight-gear access (Head/Body only). **Weapons are universal — any class can wield any weapon, so Defender is available to the Templar (or anyone).** Only certain armor is class-gated.
- Introduces three items (per-team uniqueness as usual). New weapon type **Lance** ships vanilla + variant, the standard new-type pattern:
  - **Lance** — WP 10, two-handed, Acc 95, reach **H2 / V4** (vs melee 1/3), **pierces** (hits both units when both squares of the 2-tile line are occupied; **pierce friendly-fires** an intervening ally), variance [0.9, 1.1]. The vanilla option.
  - **Imp Halberd** — WP 8, two-handed, Acc 95, H2/V4, pierces, variance [0.9, 1.1], **MA +1**. The variant: −2 WP for +1 MA, favouring the healer/Jump-light build over the striker. *(Flavor: "Imp" reads demonic on a holy knight — confirm intent vs. "Imperial.")*
  - **Defender** (new Knight Sword) — WP 11, two-handed, Acc 95, follows the Knight-Sword Brave rules (implementer has the docs), applies **Auto-Protect**. *Auto-Protect (permanent damage reduction) isn't defined yet but should reuse existing damage-reduction work.*

---

## Build interactions — the degenerate case, gated by budget

Dual-wielding two two-handed weapons needs **both** Two Weapons (3 pts, grants the second attack, ×0.75 PA) **and** Monkeygrip (2 pts, two-handers one-handed) = **5 points** against a **3-point support budget** that a budget accessory lifts only to **4**. So it's reachable only by a class that has one half **innate** (free):

- **Assassin** (innate Two Weapons) pays **2** for Monkeygrip → dual two-handers. But that leaves **1** support point — not enough for Martial Expertise (~2), so the ×1.25 PA can't stack on top.
- **Templar** (innate Monkeygrip) pays its full **3** for Two Weapons → dual two-handers, off PA 6 → ~4.5 with the ×0.75. Burns its whole support budget.
- **Knight** (neither innate) needs the full 5 points; even the +1 accessory gives only 4. **Hard-locked-out.** So the multiplicative case never reaches the functional-12 PA body.

The gate holds at **two levels**: affordability (5 > 3, or > 4 with accessory) excludes the high-PA Knight outright, and opportunity cost (the build eats the whole support budget) blocks the low-PA users from also stacking a PA multiplier. Both reachable cases sit shieldless at ~4.5 PA.

---

## Balance watch-items (playtest)

- **Tanky self-sustainer — the deliberate stress test.** Defender's **Auto-Protect** + Monkeygrip shield + Knight head/body + self-Cure + the Unified Calling MP loop = a very durable, self-refueling, low-threat wall. Chris's planned degenerate test: pile Auto-Protect onto other defensive/sustain capability and see if it becomes too hard to kill. Auto-Protect and HP 132 are the levers.
- **Multiplicative healing stack** — Emissary × faith × MA-gear × target faith compound; eyeball the fully-invested ceiling.
- **Assassin + Monkeygrip dual two-handers** — fastest path to repeated big bursts (paid: all but one support point, ×0.75 PA, shieldless, no room for Martial Expertise).
- **Knight + Lance + Jump** — PA 12 × WP × 2, H6/V6: the Jump damage ceiling. Telegraphed/dodgeable/MP-costed, but the number to watch.
- **Knight + Lance pierce** — two-target efficiency at PA 12.
- **Roster sustain** — a second full heal+revive package (alongside Alchemist's Potion + Phoenix Down) trends games toward attrition; interacts with the AI item-vs-kill scoring already addressed in the AI arc.

---

## Open decisions (pin before / at the content session)

Most things are now set (stat block; SP — Cure 8 / Raise 10; MP 8/12/6; the three weapons; universal weapon access; the ability-budget model). Remaining:

- **Auto-Protect** — define the effect (reuse existing damage-reduction work).
- **HP 132** — sanity-check against the Knight given Auto-Protect + shield access (the deliberate tank stress-test covers this).
- **Cure** — vertical tolerance value.
- **Imp Halberd** — flavor/name (Imp vs. Imperial).
- Confirm **Unified Calling** (reaction) and **Faithstrider** (movement) are innate-free on the Templar, like the two supports.
- Confirm equippable-pool costs used in the gating math: **Martial Expertise ~2**, **Two Weapons 3**.

*Larger watch:* the Auto-Protect tank stack and the multiplicative healing stack are playtest-tuning questions, not armchair ones.

---

*Numbers largely pinned; a handful of open decisions (above) and the playtest watch-items remain before this is a buildable content brief.*
