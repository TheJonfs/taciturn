# Calculator Class — Design Blueprint

*Status: design draft, pre-implementation. Ninth class for Mage War; the magical-knowledge specialist.*

## Class Identity

The Calculator is Taciturn/Mage War's signature **broad-range instant-cast** class, descended from FFT's iconic (and famously broken) Calculator. Their tool is **Math Skill** — abilities that target every unit on the battlefield matching a calculated parameter, friend or foe alike.

The Calculator's tactical posture is **cold equations**: methodical analysis of the battlefield's parameter space, selecting the calculation that produces the best result *across all units* — which sometimes means accepting collateral damage on allies, sometimes means a perfect symmetric strike, sometimes means a single-target heal because no broader option lined up. They play differently from Mages (multi-target instant rather than single-target charged), Alchemists (party-buff-and-control rather than single-target healing), or any other class.

**Identity contrasts:**
- vs. Mages: Math Skill is multi-target and instant but per-target weaker than single-target spells. Mages dominate burst single-target; Calculator dominates distributed effect.
- vs. Alchemists: Calculator's healing is multi-target and Faith-gated; Alchemist's healing is single-target and reliable. Both have legitimate roles.
- vs. Hunters: both have battlefield-wide reach, but Hunter is single-target precision via horizontal range; Calculator is parameter-based selection across all units.

## Base Stats (L25)

| Stat | Value | Note |
|---|---|---|
| HP | 101 | Between Assassin (96) and Hunter (116); modest |
| MP | 47 | Moderate; Mathematician + Thoughtful Pacing extends sustain meaningfully |
| PA | 5 | Low; Calculator doesn't do physical damage |
| MA | 8 | Moderate; not as high as Mage with full equipment |
| Speed | 7 | Slow; fewer turns per battle |
| Move | 2 | Lowest tier (with Knight, Geosage, Pyromancer post-S46) |
| Jump | 2 | Low; can't reach high terrain easily |
| Evade Front/Side/Back | 7 / 3 / 0 | Decent front, minimal side, exposed back |
| Armor types | Mage + Universal | Standard caster gear |

**Stat profile read:** Calculator is a slow, back-line caster with limited mobility and moderate magical output. Their reach comes from Math Skill's battlefield-wide targeting, not from physical positioning. They need protection (positioning behind front-line allies) to operate effectively.

## Native R/S/M

### Reaction: [Name TBD] — MA +1 on hit (accumulating, permanent)

Cost 1. Triggers when the unit takes damage. Each trigger adds +1 to MA permanently for the rest of the battle. Mirrors Speed Save (Assassin, +1 Speed on hit) and Updraft (Hunter, +1 Jump on hit).

**Per-swing throttle:** subject to the same one-per-enemy-turn cap as Speed Save / Updraft (S42 D5 deviation carry).

**Flavor concept** (per Chris): "more focus on a problem as you approach a deadline / are under pressure."

**Name candidates:**
- **Tempered Mind** — fits the Gariland Magic Academy intellectual setting; calm-under-pressure flavor.
- **Sharpened Focus** — clinical; emphasizes the analytical sharpening.
- **Acute Focus** — terse, clinical; pairs well with "Calculator."
- **Quickening Theorem** — explicitly math-flavored; reads as "the mind speeds toward the answer."
- **Cornered Insight** — evocative; the moment of insight when threatened.

I'd lean **Tempered Mind** or **Acute Focus** — both lean into the calm-Calculator-under-fire flavor without being overly math-themed. Chris picks.

### Support: Mathematician — SP boost + per-target MP discount

Cost 2. Two-effect:
- **+1 SP on Math Skill abilities.** Precision Fire becomes SP 4; Targeted Treatment SP 5; Exact Rhythm SP 3; Engineered Defenses unaffected (no SP scaling); Sculpted Enhancement unaffected (status-application, no SP scaling).
- **Per-target MP multiplier reduced 3 → 1.** MP cost formula becomes `4 + targets`, vs. unequipped `4 + 3 × targets`.

**Net impact:**
- Calculator-primary (always has Mathematician free as native Support): Math becomes meaningfully more efficient and powerful. With MP 47 baseline + Thoughtful Pacing recovery: 8-12 Math casts per battle, each at +1 SP.
- Cross-class users (Mage, Knight, Assassin, etc. equipping Math Skill as secondary): can equip Mathematician at cost 2, gaining the same benefits — but at the cost of their Support slot (giving up Conductor on Mage, Two Weapons on Assassin, Martial Expertise on Knight). Real trade-off.
- Without Mathematician: Math costs scale steeply (4 + 3×targets), making sustained multi-target casting unaffordable for most classes. Single-target Math is still viable; multi-target requires Mathematician.

This is the **anti-parasitism lever**. Mage-with-Math-secondary can match Calculator's Math output only by sacrificing Conductor — and even then, Calculator's higher MP pool sustains more casts per battle.

### Movement: Thoughtful Pacing — MP recovery on movement

Cost 1. Single-effect. Recovers MP equal to **2 × spaces moved** at end of turn.

**Net impact:**
- At Calculator base Move 2: +4 MP per turn moved
- With cross-class Move boost (e.g., Bravestrider Move +1 = Move 3): +6 MP per turn moved
- Encourages Calculator to reposition each turn rather than camp; supports the "Calculator surveys the field" play pattern
- Mirrors Healthy Stride (Alchemist, HP = move²) but linear instead of squared, smaller magnitude — same structural concept, different resource

Pairs well with Mathematician (cheaper casts) for sustained Math output across a battle.

## Math Skill — Command Set

**The substrate-defining mechanic.** Each Math Skill ability targets every unit on the battlefield matching the chosen parameter-and-value pair:

**Parameters (chosen at cast time):**
- **CT** — current Charge Time of each unit (dynamic, varies turn-to-turn)
- **Height** — elevation of each unit's tile (positional)
- **Level** — slot-based level (immutable through battle)
- **Current HP** — each unit's current HP (dynamic)

**Values (chosen at cast time):**
- **Prime** — parameter is prime
- **3** — parameter is a multiple of 3
- **4** — parameter is a multiple of 4
- **5** — parameter is a multiple of 5

**Resolution:** instant. The engine enumerates all units on the field where `unit.parameter % value == 0` (or `is_prime(unit.parameter)` for the Prime selection). All matching units receive the ability's effect. Friendly fire applies; self-targeting allowed.

**Damage formula** (for damage and heal Math abilities): `SP × MA × Faith Factor`, identical to mage spells. Faith factor uses caster × target Faith percentages (default 0.49 at 70/70). 

**Status application formula** (for status-applying Math abilities): `base_chance × Faith_caster × Faith_target × MA_factor` (per audit — there's a missing MA factor in the current status formula that the implementer will surface during the audit phase; Math abilities benefit from this when it's added).

### Math Skill Abilities

#### 1. Precision Fire — Multi-target fire damage

- **SP:** 3 (4 with Mathematician)
- **Element:** Fire
- **Effect:** Damage per target = `SP × MA × Faith Factor`
- **Status proc:** 50% base chance (Faith-gated) to apply 1 stack of Burn per target hit

**Damage example** (Calculator MA 9 post-S51, Faith 70/70):
- Base: 3 × 9 × 0.49 = 13.2 per target
- With Mathematician: 4 × 9 × 0.49 = 17.6 per target

**Damage example** (Mage MA 25 via secondary):
- Base: 3 × 25 × 0.49 = 36.75 per target
- With Mathematician: 4 × 25 × 0.49 = 49 per target

#### 2. Targeted Treatment — Multi-target heal

- **SP:** 4 (5 with Mathematician)
- **Effect:** HP restored per target = `SP × MA × Faith Factor`
- **Target filtering:** all units matching parameter (friendly fire applies — healing an enemy is possible, though the AI will dis-prefer doing so)

**Healing example** (Calculator MA 9 post-S51):
- Base: 4 × 9 × 0.49 = 17.6 per target
- With Mathematician: 5 × 9 × 0.49 = 22.1 per target

**Note:** the Calculator's MA 9 makes Targeted Treatment modest as a healer (Alchemist Potion at PA × 12 is single-target ~84 HP, far more effective per-target). Math healing's value is multi-target reach. Mage-with-Math-secondary at MA 25 = 49 HP per ally healed — substantial.

#### 3. Exact Rhythm — Multi-target CT push

- **SP:** 2 (3 with Mathematician)
- **Effect:** CT reduction per target = `SP × MA × Faith Factor`; clamped at CT 0 (no negative CT)

**Reduction example** (Calculator MA 9 post-S51):
- Base: 2 × 9 × 0.49 = 8.8 CT per target
- With Mathematician: 3 × 9 × 0.49 = 13.2 CT per target

**Reduction example** (Mage MA 25 secondary):
- Base: 24.5 CT per target
- With Mathematician: 36.75 CT per target

**Tactical watch:** multi-target CT push is uniquely powerful. A Calculator team chaining Exact Rhythm on enemies + healing themselves could potentially stall enemies via CT lockout. Chris will stress-test post-implementation; if snowballing emerges, levers are SP reduction or per-cast cooldown.

#### 4. Sculpted Enhancement — Multi-target buff application

- **SP:** N/A (status application, no SP scaling)
- **Effect:** 50% base chance to apply PA Up + MA Up (infinite duration, stackable) to each target
- **Faith-gated:** `base_chance × Faith_caster × Faith_target` (≈ 24.5% net at standard Faith)
- **Stackable:** repeat applications stack, snowballing party stats across the battle

**Net expectation per cast** (4-target via Level math):
- ~1 expected buff application per cast
- Over 5+ casts in a battle: most allies eventually receive at least one stack
- High variance — sometimes great rolls, sometimes flat

**Watch-for:** stackable infinite-duration buffs across many casts could become decisive. The trade-off is the Calculator spending entire turns + most MP on buffing rather than offensive output. Chris is willing to playtest and tune.

#### 5. Engineered Defenses — Multi-target defense buff

- **SP:** N/A (status application, no SP scaling)
- **Effect:** 80% base chance to apply per target:
  - +10 to each elemental resistance (Fire, Water, Earth, Lightning, Holy, Dark)
  - +5% to Front, Side, and Back evasion
  - Infinite duration (rest of battle)
- **Faith-gated:** `base_chance × Faith_caster × Faith_target` (≈ 39.2% net at standard Faith)

**Net expectation per cast** (4-target):
- ~1.5 expected applications per cast
- Significant defensive uplift on successful targets
- Stackable? **Open question** — recommend non-stackable (each unit either has the buff or doesn't); else multiple applications make units near-invulnerable

**Watch-for:** trade-off is same as Sculpted Enhancement — entire Calculator turn for defensive uplift. Pairing both: Calculator on turn 1 casts Engineered Defenses, on turn 2 casts Sculpted Enhancement, team becomes substantially harder to kill. Mid-game Calculator transitions to Math damage / CT push.

## Math Skill Substrate Requirements

For the implementation session:

### Parameter targeting system
- Per Math ability cast, the Calculator (or controller) picks one parameter (CT/Height/Level/Current HP) and one value (Prime/3/4/5).
- Engine enumerates all units on the field matching the parameter-value pair.
- All matching units receive the ability's effect.
- Friendly fire applies; self-targeting allowed; KO'd units excluded (likely — to confirm); `removed` units excluded.

### Damage / heal / CT formulas
- Identical to existing mage spell formula: `SP × MA × Faith Factor`.
- Faith factor uses caster.Faith × target.Faith (percentages).
- For status-applying Math abilities (Sculpted Enhancement, Engineered Defenses): use the existing status-application formula, with the MA factor that's missing (audit-surfaced).

### Targeting UI
- Calculator (or controller) needs a UI to:
  1. Pick the Math ability (Precision Fire, Targeted Treatment, etc.)
  2. Pick the parameter (CT/Height/Level/Current HP)
  3. Pick the value (Prime/3/4/5)
  4. Preview which units would be hit (with friend/foe color coding)
  5. Confirm or cancel
- The preview is essential for the cold-equations design intent — players need to see who they'd hit before committing.

### Calculator self-targeting
- Math Skill effects apply to the Calculator themselves if they match the parameter.
- Example: Calculator at L25 (slot 1), casts Level-by-5 calculation → hits themselves (25 is a multiple of 5). If the effect is damaging, they take damage. If healing, they get healed.

## Level Substrate

The Level mechanic is its own substrate piece (potentially separable from Math Skill implementation, but synergistic):

### Slot-based level assignment
- Slot 1 = Level 25 (baseline)
- Slot 2 = Level 24 (-1)
- Slot 3 = Level 26 (+1)
- Slot 4 = Level 23 (-2)
- Slot 5 = Level 27 (+2)
- Slot 6 = Level 22 (-3) [future]
- Slot 7 = Level 28 (+3) [future]
- Pattern: alternates around baseline, expanding outward.

### Level effects on stats
- **L25 (slot 1):** baseline stats per class definition.
- **L24/L26 (slots 2/3):** ±10% HP/MP from baseline.
- **L23/L27 (slots 4/5):** ±10% HP/MP from baseline AND ±1 to the class's dominant stat.

**Dominant stat determination:**
- Knight: PA
- Alchemist: PA
- Assassin: Speed
- Hunter: PA
- Geosage: MA
- Pyromancer: MA
- Hydrologist: MA
- Aethurge: MA
- Calculator: MA

(For ties, the highest baseline stat wins; for further ties, designer's choice. The class-design doc should declare each class's dominant stat explicitly.)

### Level locked at team-build
- Level set when team is finalized; immutable through battle.
- KO recovery and permadeath revival don't change level.
- Future scope (post-v1): class abilities or items that manipulate level.

### Display
- Team builder shows Level prominently per unit slot.
- Level effects on stats applied silently — modified HP/MP/dominant-stat displayed as if base, with no breakdown shown by default.
- Strategy guide / docs explain the level-effect mechanics for interested players.

### Stat calculation order
1. Class base stats (HP, MP, PA, MA, SP from class definition)
2. Level modifiers applied (multiplicative for HP/MP at ±10%; additive ±1 for dominant stat at L23/L27)
3. Equipment modifiers (additive then multiplicative per existing convention)
4. Passive modifiers (per existing pipeline)
5. In-battle status effects

## Implementation Scope Notes

This is a **large content + substrate session** if shipped monolithic. Likely scope:

- **Substrate (~50% of session):** parameter targeting system, Math Skill resolution pipeline, targeting UI, Level system, slot-based stat modifiers, AI Math Skill scoring.
- **Content (~40% of session):** Calculator class definition, 5 Math Skill abilities, 3 native R/S/M passives, status definitions (PA Up / MA Up stackability rules, Engineered Defenses status), team template.
- **Polish (~10% of session):** Math Skill preview UI, tooltips, docs (ADR for Math Skill mechanic + Level system; class spec entry).

**Probable split:** 49a (substrate: parameter targeting + Level system) / 49b (content: Calculator class + abilities + R/S/M + template + UI polish).

**Audit-first.** The audit will determine: how much of the targeting pipeline can be reused vs. needs to be added; whether the Level mechanic requires changes to team-builder state, deployment, battle config, or only stat resolution; whether AI Math Skill scoring is in scope or deferred.

## AI Math Skill Considerations

Chris flagged this as its own design project. Brief framing:

- The Math Skill decision space is bounded: 5 abilities × 4 parameters × 4 values = 80 calculation options per turn.
- For each option, the AI can enumerate matching targets and compute expected effect (damage, healing, status applications).
- Scoring function: weight enemy effect positively (damage, harmful status), ally effect negatively (collateral damage, beneficial-to-enemy if healing), self-effect appropriately.
- Picking the highest-scored calculation is straightforward once the scoring function is defined.

**Possible v1 simplification:** AI evaluates all 80 options for damage abilities, picks max-net-damage; for heals, picks max-net-healing-to-allies-minus-healing-to-enemies; for status, picks max-net-allies-buffed or max-net-enemies-debuffed.

**Possible future polish:** "Aggressive" vs. "Conservative" AI personality variants (per Chris's mention). Aggressive accepts collateral damage to maximize enemy hits; Conservative avoids ally damage even at cost of fewer enemy hits.

For v1 implementation session: AI logic for Calculator can be the simple max-expected-value scoring. Behavior variants are future polish.

## Open Design Questions

1. **Reaction name.** Tempered Mind / Acute Focus / Sharpened Focus / Quickening Theorem / Cornered Insight — Chris's pick.

2. **Sculpted Enhancement and Engineered Defenses stackability.** Recommend Sculpted Enhancement stackable (per Chris's earlier note), Engineered Defenses NON-stackable. Confirm.

3. **Math Skill ability count.** Five abilities (Precision Fire, Targeted Treatment, Exact Rhythm, Sculpted Enhancement, Engineered Defenses) covers damage, heal, CT, buff, defense. Possible v2 additions: a status-debuff Math (Slow/Vulnerable application), a Drain Math (damage + caster heal), a Banish Math (remove target from field temporarily — disruptive but interesting). Five is the v1 ceiling; expansions in future content sessions.

4. **Math Skill secondary command set on Calculator.** What does the Calculator equip as their secondary? Recommend leaving open to the player — Calculator + Pyromancer spells (for damage synergy), Calculator + Geosage (status synergy), Calculator + Alchemy (utility) are all interesting builds.

5. **Calculator default team template name.** Once Calculator ships, a default template featuring them. Suggestions: "The Algorithm," "Cold Equations," "The Coefficient," "Equation of State."

6. **AI personality variants.** Defer to playtest — initial AI uses simple max-EV scoring; variants are future polish if Calculator AI feels too one-dimensional.

7. **Level mechanic Display verbosity.** Chris said "okay with only adding level as something that's displayed, but not the resulting effects." So team builder shows L24 / L26 / etc. on each slot; players read the strategy guide or experiment to understand effects. Confirm UI sketch: small number badge next to unit name in builder? Tooltip on hover? Both?

## Watch-fors (for post-implementation playtest)

- **Exact Rhythm snowball.** Multi-target CT push every turn could lock out enemies. Lever: SP reduction or cooldown.
- **Sculpted Enhancement runaway.** Stackable infinite buffs across many casts. Lever: cap stacks per status, or convert to non-stackable.
- **Engineered Defenses runaway.** Same concern at 80% base rate. Lever: explicit non-stackable rule.
- **Calculator + Conductor-less Mage with Math secondary.** Real build variation. Watch whether Mage-with-Math becomes auto-best for any team comp.
- **L26 immunity to Level math.** Players will preferentially place key units at L26. Watch whether this is interesting tactical depth or trivializes the Level mechanic.
- **Calculator self-damage from indiscriminate Math.** New players will accidentally hit themselves with damaging Math. Tooltip / preview UI should make this visible to mitigate.
- **AI Math evaluation.** Initial simple-scoring AI may produce bad calculations (hitting allies for no reason, missing better options). Iterate.

## Ready for Implementation Brief

This blueprint covers Calculator's stats, R/S/M, Math Skill ability set, substrate requirements, Level system, and watch-fors. The implementation session (likely S49 pending S48 close) will reference this spec for content and substrate decisions.

Outstanding items before brief:
- Reaction name pick.
- Stackability rules for Sculpted Enhancement and Engineered Defenses.
- Engineered Defenses status definition (it's a new status type, needs implementer-side modeling).
- AI Math Skill scoring approach (simple max-EV for v1, per recommendation).
- Calculator default team template — for inclusion in S48's template refresh OR S49's content session.
