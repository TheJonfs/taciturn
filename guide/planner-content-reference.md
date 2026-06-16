# Mage War — Planner Content Reference

> **What this is.** A terse, mechanical-only mirror of the game's content, maintained for
> the *planner* thread, which reasons about new content without code access. It is the
> stripped-down sibling of the full Player's Guide: **no flavor, no lore, no prose — just
> numbers and one-line effects.** When the planner has this, it stops inferring load-bearing
> values (WP curves, crit multiplier, SP scale, damage formulas) from stale memory.

> **This file is the schema/contract. The live document is generated.** Run
> `npm run build:guide` (or just `npm run build:reference`) and read the artifact at
> `guide/output/planner-content-reference.md` — that's the fresh, full set handed to the
> planner. This file stays as the target schema + maintenance contract; the generator is
> `guide/build/reference.ts`. Output is gitignored (a build artifact, like the PDF).

> **For the guide-writer (maintenance contract).**
> - **Prefer auto-generation — done.** This file defines the *target schema*; the extraction
>   step (`guide/build/reference.ts`) emits §2–§8 and the §1 ruleset table from the same
>   content catalog the Guide imports. §1 *formulas* and §7 passive *effects* are
>   hand-mirrored (they live in engine handler/hook code, not as extractable data) with
>   `src/engine/...` pointers — re-verify those when the cited system changes.
> - **Update trigger:** any change to a class, ability, weapon, accessory, armor, status,
>   RSM, or a system constant. Ideally the same commit that touches content/the Guide.
> - **Style mandate:** terse. One row per item, one line per effect. Currency and accuracy
>   beat completeness of description. If a value is a formula, write the formula.
> - **Example rows below are illustrative of the format** (drawn from known recent content);
>   the generated file should carry the *full* set, with these verified against code.
> - Mark anything genuinely uncertain `[verify]` rather than guessing.

---

## 1. System constants

*Pull: the global mechanics the planner keeps needing. Key: value — one-line note.*

- **Crit:** base 5% per unit; multiplier `[verify ×?]`. Crit chance is a **per-unit**
  parameter (boosted by Arcane Lens, the Aethurge crit buff, Vicious Dagger).
- **Gear uniqueness:** each equipment item is **unique per team** (at most one instance
  across the whole team).
- **Default Brave / Faith:** Brave 70; Faith `[verify]`. Brave is probabilistic for
  reactions (~Brave% fire rate) and feeds status-contest chances.
- **Damage formula by weapon type:** Sword/axe `PA × WP` (Speed-independent); Knife
  `[verify — uses (PA+Speed)]`; Wand/staff `[verify]`; others `[verify]`.
- **Status-application chance (physical):** `baseChance × Brave_factor × PA_factor`,
  `PA_factor = 0.9 + PA/10`; the `{ brave, pa }` shape. `[verify Brave term = caster]`
- **Thief contest chance (new form):** `baseChance + 3·PA + 0.5·(caster_Brave −
  target_Brave)`, clamp [1, 95]. Target-Brave-as-resistance.
- **Spell Power (SP) scale:** `[verify — what does +1 SP buy? base SP magnitude?]` (open
  per the Math-Skill SP-scaling review).
- **CT / turns:** unit acts at 100 CT; CT accrues by Speed per tick `[verify]`. Status
  durations in turns; e.g. Stop/Don't-Move/Don't-Act = 3 turns.
- **Evasion:** front / side / back triple; physical attacks rolled against it `[verify
  mechanic]`.
- **MP system channels:** `system_mp` (costs/restores), `system_mp_drain.restoreFraction`
  (Thief), `system_damage` (Spiked Mail, falls, barrier, reflect, Worldcraft revert).

## 2. Weapons

*Pull: every weapon. Columns fixed below.*

| Name | Type | WP | Acc | 2H? | Riders / on-hit effect |
|---|---|---|---|---|---|
| Longsword | Sword | 8 | 95 | – | — |
| Scimitar | Sword | 7 | 95 | – | Speed +1 |
| Flametongue | Sword | 6 | 95 | – | 25% to apply 1 Burn stack on hit |
| Parrying Sword | Sword | 6 | 95 | – | +10/+5 front/side evasion |
| Vicious Dagger | Knife | 5 | 95 | – | +25% crit (per-unit) |
| Sai | Knife | 4 | `[verify]` | – | Speed +1 (Knife formula → also feeds own damage) |
| Wand of Potential | Wand | 2 | 90 | – | wand resist-mod on hit + 1 SP to lightning magic |
| *(… full set …)* | | | | | |

## 3. Accessories

*Pull: every accessory.*

| Name | Effect | Notes |
|---|---|---|
| Arcane Lens | +10% crit (per-unit) | |
| Gauntlet of Might | PA +3 | contested premium |
| Focus Band | −25% all status chance | head-slot? `[verify slot]` |
| Purifier | halves negative-status duration | |
| *(… full set …)* | | |

## 4. Armor — head / body

*Pull: every armor piece. Class restriction matters.*

| Name | Slot | Class restriction | Stat mods | Riders / effect |
|---|---|---|---|---|
| Circlet | head | mage | HP +10, MP +10 | grants `mana_font` (MA/2 MP regen/turn) |
| Barbut | head | Knight, Templar | HP +30 | Stop / Don't-Move / Don't-Act ×0.5 |
| Pointy Hat | head | mage | `[verify]` | Silence resist |
| Battlemage's Chain | body | Knight, Templar | HP +80, MP +10, MA +1 | — |
| *(… full set …)* | | | | |

## 5. Classes — stat lines

*Pull: every class. One row each.*

| Class | HP | MP | PA | MA | Spd | Brave | Faith | Move | Jump | Eva F/S/B | Gear access | Innate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Thief | 90 | 28 | 7 | 3 | 11 | 70 | `[v]` | 3 | 3 | 8/4/0 | universal | — |
| Templar | `[v]` | `[v]` | 6 | 6 | 8 | `[v]` | `[v]` | `[v]` | `[v]` | `[v]` | Knight head/body | Monkeygrip |
| Assassin | `[v]` | `[v]` | `[v]` | `[v]` | `[v]` | `[v]` | `[v]` | `[v]` | `[v]` | `[v]` | universal | Two Weapons |
| *(… all 12 …)* | | | | | | | | | | | | |

## 6. Abilities

*Pull: every active. Group by class/command set or one master table.*

| Ability | Class / set | MP | Range | AoE | actSpd | Effect | Scaling / chance |
|---|---|---|---|---|---|---|---|
| Steal HP | Thief | 5 | melee | – | `[v]` | 75% wpn dmg, heal 50% dmg dealt | PA×WP; evadable |
| Steal MP | Thief | 3 | melee | – | `[v]` | drain PA×3 MP, restore 50% removed | PA×3; evadable |
| Steal Buffs | Thief | 4 | 4 | – | `[v]` | strip all positive statuses → self | contest, base 33 |
| Steal Heart | Thief | 24 | 3 line | – | `[v]` | charm 3 turns (gender-gated) | contest, base 10; 50% break on attack dmg |
| Bull Rush | Knight | 6 | melee | – | `[v]` | 1.0× dmg + 1-tile knockback | Brave×PA gate |
| *(… all actives …)* | | | | | | | |

## 7. RSM passives

*Pull: every reaction / support / movement, native class noted.*

| Name | Bucket | Cost | Effect | Native |
|---|---|---|---|---|
| Slip Free | Reaction | 1 | advance an applied debuff 1 tick (Brave-gated) | Thief |
| Momentum | Support | 1 | +CT on any non-magical action (incl. basic attack) | Thief |
| Move +2 | Movement | 2 | +2 Move | Thief |
| Flow State | Support | 1 | +CT on magical actions | Hydrologist |
| *(… full set …)* | | | | |

## 8. Statuses

*Pull: every status. Polarity drives Steal Buffs / dispel filters.*

| Status | Polarity | Duration | Effect | Notes |
|---|---|---|---|---|
| Burn | debuff | `[v]` | DoT | stacks; rewards stacking |
| Stop | neither | 3 turns | unit cannot act | not stealable/dispellable as a buff |
| mana_font | buff | while equipped | MA/2 MP regen/turn | from Circlet |
| enthralled | neither | 3 turns | control-override (charm) | Steal Heart |
| heartwarded | buff | 5 | charm immunity | post-charm buffer |
| *(… full set …)* | | | | |

---

## Update checklist (guide-writer)

- New **weapon** → §2 row (+ §1 if it introduces a new type/formula).
- New **accessory / armor** → §3 / §4 row.
- New **class** → §5 stat row, §6 ability rows, §7 RSM rows, §1 if it adds a constant.
- New **ability** → §6 row.
- New **status** → §8 row (set polarity — it gates Steal Buffs / dispel).
- Changed **system constant** (crit mult, SP scale, a damage formula, gear rules) → §1.
- Re-verify any `[verify]` cells when the relevant system is next touched.
