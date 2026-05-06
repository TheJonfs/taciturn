# Battle Mechanics Guide

*Reference document — v0.2*

This is the canonical reference for combat formulas, stat composition, hit/damage/status mechanics, and the numerical relationships that define how Taciturn plays. It complements the design docs in `docs/design/` — those docs describe *what systems exist and why*; this doc describes *how their numbers work*.

When implementing or balancing an ability, read this guide first. When the guide is silent on something, the design docs are authoritative for behavior; numerical defaults belong here.

## How to read this guide

- **Formula notation**: variables are written as `Stat_user` and `Stat_target` to disambiguate ownership; constants are written as numbers; ranges are given as `[min, max]`.
- **Defaults vs. tunables**: every number in this guide is a v1 default unless marked `(constant)`. Tunable values may be adjusted via Ruleset overrides without engine changes.
- **Composition rules**: when multiple effects apply to a value, the composition rule is stated explicitly (additive, multiplicative, max-wins, etc.). Mixing rules silently is a bug.

---

## Stat layers and composition

Every stat on a Unit at a given moment is computed by composing four layers:

1. **Character layer** — persistent, character-bound values that survive across battles, class changes, and equipment swaps.
2. **Class+Level layer** — values determined by the character's current class and level in that class.
3. **Equipment+Loadout layer** — modifications from currently-equipped items, R/S/M abilities, and class-inherent passives.
4. **Status layer** — modifications from active status effects.

### What lives in each layer

**Character layer:**
- Brave (1-100)
- Faith (1-100)
- Identity (name, character ID)
- Per-class progression history

**Class+Level layer:**
- HP, MP (curves indexed by level in current class)
- PA, MA, Speed (curves indexed by level in current class)
- Move Range, Jump (typically per-class flat values, occasionally curved)
- Front/Side/Back Evasion (per-class flat values)
- Resistances (per-class flat values per tag)
- Available command sets, default First Action command set
- Class-inherent passive abilities (cost-0 while in this class)

**Equipment+Loadout layer:**
- Equipment stat modifications (weapon PA, armor HP/Phys.Def, etc.)
- R/S/M ability modifications via hooks
- Bucket capacity modifications

**Status layer:**
- Active status effect modifications via hooks (Haste's Speed multiplier, Protect's defense bonus, etc.)

### Composition order

Stats are computed by walking the layers in order: Class+Level provides the base, Equipment+Loadout modifies, Status modifies further. The Character layer doesn't directly modify combat stats (Brave and Faith are their own stats, not modifiers on others); it provides values consumed by formulas.

Note on storage: Brave and Faith are *stored* on the unit's `BaseStats` alongside other primary stats (PA, MA, Speed). The "character layer" model describes their *progression durability* — they survive across battles, class changes, and equipment swaps — not a separate per-battle storage location. Within a single battle, Brave and Faith read like any other stat; their character-layer nature is about long-term persistence (deferred to the progression system) rather than how they're laid out in `Unit`.

```
base_stat = class_level_curve(class, level)
after_equipment = base_stat + equipment_modifiers + loadout_additive_modifiers
after_loadout = after_equipment × loadout_multiplicative_modifiers
final_stat = clamp(after_loadout × status_multiplicative_modifiers + status_additive_modifiers, min_cap, max_cap)
```

Concretely, the engine resolves a stat query by firing the `modifyStatQuery` hook with `(unit, statName, baseValue)` and collecting handler returns in standard hook order (Equipment → Class → Passive → Statuses). Handlers contribute additive or multiplicative deltas; the engine composes them per the rules above.

### Stat caps

Hard caps on final stat values:

| Stat | Min | Max |
|---|---|---|
| HP, MP | 0 (current); 1 (max) | 999 |
| PA, MA, Speed | 1 | 99 |
| Brave, Faith | 1 | 100 |
| Move Range, Jump | 0 | (no hard cap; soft via design) |
| Evasion (per facing) | 0 | 99 |
| Resistance (per tag) | -100 | 200 |

Speed has a Ruleset-configurable ceiling separate from the hard cap, intended to prevent runaway Haste stacking. v1 default Speed ceiling: per-Ruleset, suggested **3.0× base** as a starting point.

---

## Damage

### Physical damage

Used by physical attacks, weapon abilities, and any ability with damage tag `physical`.

```
base_damage = PA_user × WP × power_coefficient
final_damage = base_damage × variance × resistance_modifier × critical × physical_modifiers
```

Where:
- **PA_user**: caster's effective PA at resolution time (after all layers).
- **WP**: weapon power. For unarmed or non-weapon abilities, WP defaults to 1; the ability's `power_coefficient` does the work instead.
- **power_coefficient**: ability-specific multiplier. A basic Attack uses 1.0; a Power Attack might use 1.5; a heavy ability 2.0+.
- **variance**: random multiplier in a per-ability range. Default range `[1.0, 1.0]` (deterministic damage). Per-ability override allows variance on specific weapons or abilities.
- **resistance_modifier**: see Resistance section below.
- **critical**: `1.5` if the attack crits, else `1.0`.
- **physical_modifiers**: composed from hooks (Strength Up, weak-against-armored, height differential, etc.). Multiplicative composition.

### Magical damage

Used by spells, magical abilities, and any ability with damage tag `magical`.

```
base_damage = MA_user × power_coefficient × Faith_factor
final_damage = base_damage × variance × resistance_modifier × magical_modifiers
```

Where:
- **MA_user**: caster's effective MA at resolution time.
- **power_coefficient**: ability-specific. Spells in the Mage classes typically use power_coefficient in the 4-12 range depending on tier.
- **Faith_factor**: `(Faith_user / 100) × (Faith_target / 100)`. Symmetric — both caster and target Faith multiply in. Range `[0.0001, 1.0]` (since both are clamped to 1-100).
- **variance**: same as physical. Default 0.
- **resistance_modifier**: see Resistance.
- **magical_modifiers**: hooks (Magic Boost, elemental amplification, etc.). Multiplicative.

Magical damage **always lands** on a valid in-range target — no hit roll for damage. The chance-to-hit dimension applies to status applications, not damage application.

### Healing

Healing uses the same pipeline as damage with the damage tag `healing`. Sign is implicit — healing handlers produce values that are subtracted from incoming damage, and at the apply step healing values become HP increases.

```
base_heal = MA_user × power_coefficient × Faith_factor
final_heal = base_heal × variance × healing_modifiers
```

Note: healing **uses symmetric Faith** (both caster and target) — high-Faith targets receive more healing, low-Faith targets receive less. This is FFT-faithful and creates the party composition tension noted in design.

Healing doesn't roll against resistance — effects with the `'healing'` tag opt out of resistance modulation entirely. Other tags on a healing effect (e.g., the `'holy'` tag on Cure) classify the ability for purposes of "is this holy magic" but do not contribute to resistance lookup against the heal amount. A target with `holy: +50` resistance receives Cure's full heal, not half. See ADR-0016 for the rule and the Cure case study; an "undead" tag could later flip the polarity for specific units, but the base rule is that healing is unresisted.

### Variance

`variance` defaults to **1.0** — projected damage is the actual damage, contingent on hit. Per-ability variance is expressed as a range around 1.0 (e.g., `[0.85, 1.15]` for ±15%). The variance roll picks a value in the range; default is the degenerate range `[1.0, 1.0]`.

Per-ability values:
- Daggers, precision weapons: `[1.0, 1.0]` (deterministic)
- Most weapons: `[1.0, 1.0]`
- Axes, flails, "messy" weapons: `[0.85, 1.15]` (±15%)
- Some chaotic spells: `[0.90, 1.10]`
- Most spells: `[1.0, 1.0]`

The choice to default to deterministic damage means the damage previewer in UI shows exact numbers for >90% of abilities. Variance is opt-in by ability designer, used as a flavor/balance lever.

### Critical hits

- **Base rate**: 5%, modifiable via hooks. (Lightning Buff's `Crit_modifier` is a hook handler that raises this for the buffed unit.)
- **Multiplier**: 1.5× damage on crit.
- **Applies to**: physical damage by default. Magical damage doesn't crit unless an ability or status specifically enables magical crits (Lightning Buff being one such).
- **Roll timing**: crit roll happens during damage pipeline at the variance stage, after the hit determination.
- **Per-ability override**: abilities may declare their own crit rate or "cannot crit" (e.g., AoE damage typically doesn't crit per-target).

### Hit chance — physical attacks

Physical attacks roll to hit:

```
hit_chance = weapon_accuracy × (1 - target_evasion[facing] / 100) × elevation_modifier × hit_modifiers
```

Where:
- **weapon_accuracy**: weapon-defined, typically [85, 100]. Default for "no weapon / unarmed" is 100.
- **target_evasion[facing]**: target's effective Front/Side/Back evasion based on facing relative to attacker.
- **elevation_modifier**: 
  - Attacker higher than target: 1.05
  - Attacker lower than target: 0.95
  - Same elevation: 1.0
- **hit_modifiers**: hooks (Concentration, Blind status, etc.). Multiplicative.

Hit chance is clamped to `[0.05, 1.0]` (always at least 5% chance, never auto-hit unless the ability specifies).

Some abilities auto-hit and bypass this roll entirely. The ability format spec marks these by *omitting* the `hitRoll` field on `ActiveAbilityFields` (the absence of a hitRoll spec means "no roll"); most heals and most utility abilities are auto-hit by this convention.

Pipeline placement: the evasion check runs at the **target stage** of the seven-stage damage pipeline (the `evasion_check` handler). It computes `hit_chance`, rolls against the action seed, and sets `ctx.hit = false` on the context if the roll fails. The `finalize` stage reads `ctx.hit` and produces `finalDamage = 0` when false. See ADR-0019 for the placement rationale.

### Hit chance — magical attacks

Magical damage **always lands** in range. There is no magical hit roll for damage. Resistance modifies damage; Faith modifies damage; but the spell goes off.

Status applications are the magical equivalent of "hit chance" — see Status Application below.

### Damage-and-status abilities

Many abilities deal damage AND apply a status (e.g., Burn-applying Fire spells). Resolution is **split**:

1. Damage resolves first using the appropriate damage formula. Damage always lands for magical; physical rolls hit.
2. Status application rolls separately using the Status Application formula.

A spell can deal full damage and fail to apply its status, or vice versa (rare, for abilities that hit-on-damage-applied; usually independent).

---

## Resistance

The resistance system uses a single linear scale per tag (element, status type, etc.), applied multiplicatively to damage or status chance.

### Scale

| Resistance value | Effect |
|---|---|
| -100 | Doubled damage (200%) |
| -50 | 1.5× damage (150%) |
| 0 | Normal damage (100%) |
| 50 | Half damage (50%) |
| 100 | No damage (0%) |
| 150 | Half-healing (the unit recovers HP equal to 50% of base damage) |
| 200 | Full absorption (the unit recovers HP equal to 100% of base damage) |

Formula (for damage):
```
resistance_modifier = (100 - resistance) / 100
```

This produces:
- resistance 0 → modifier 1.0 (full damage)
- resistance 50 → modifier 0.5 (half damage)
- resistance 100 → modifier 0.0 (no damage)
- resistance 200 → modifier -1.0 (full damage as healing)
- resistance -50 → modifier 1.5 (1.5× damage)
- resistance -100 → modifier 2.0 (double damage)

When `resistance_modifier` is negative, the engine applies the result as healing rather than damage (positive HP change rather than subtraction).

> **v1 implementation note (per ADR-0022):** absorption (`resistance > 100` → healing) is deferred until the first content consumer. The session 14 `resistance_check` handler caps the effective resistance at 100 (immune); values above 100 read as 100 and produce zero damage rather than negative-multiplier healing. The full scale stays documented here as the design intent; the cap is removed alongside the first content with resistance > 100.

### Tag-based application

Resistances are stored per tag in a map: `{ fire: 50, ice: -50, holy: 100, mental: 25, ... }`. Damage tags and status tags are the same namespace.

When an ability's damage carries multiple tags (e.g., a holy fire spell tagged both `fire` and `holy`), composition takes the **signed maximum** across applicable tag resistances: `signedMax(resistance_a, resistance_b, …)`. The largest signed value wins — most resistant tag takes precedence; ties (e.g., `+50` vs. `-50`) resolve to the resistant side.

Examples:
- Target has `fire: 50, holy: 0`. Holy fire spell hits. `signedMax(50, 0) = 50` → half damage.
- Target has `fire: -50, holy: -25`. Holy fire spell hits. `signedMax(-50, -25) = -25` → 1.25× damage (least weakness wins).
- Target has `holy: +50, fire: -50`. Holy fire spell hits. `signedMax(50, -50) = +50` → half damage (resistance wins ties).

The `'healing'` tag is excluded from this composition — healing-tagged effects skip the resistance stage entirely (see ADR-0016). The signed-max set only contains the non-healing tags on the effect. See ADR-0015 for the rationale.

### Resistance composition across sources

Resistances from class baseline, equipment, and statuses compose **additively**:

```
total_resistance[tag] = class_baseline[tag] + Σ equipment[tag] + Σ status[tag]
```

The result is clamped to the resistance cap range [-100, 200].

This is different from stat-modifier composition (which is multiplicative). Resistance is a percentage-shift, and additive composition is the natural read.

---

## Status effects

Status effect mechanics are documented in detail in `docs/design/status-effects.md`. This section captures formulas and numerical defaults.

### Status application chance

When an ability has a chance to apply a status:

```
hit_chance = base_chance × Faith_factor × MA_factor × (1 - target_resistance / 100) × status_modifiers
```

Where:
- **base_chance**: per-ability, typically [30, 80]. A reliable status applier is ~70%; a coin-flip is 50%; a "lucky shot" is 30%.
- **Faith_factor**: `(Faith_user / 100) × (Faith_target / 100)`, same shape as damage Faith.
- **MA_factor**: `0.9 + MA_user / 10`. Constrains MA's contribution to a modest multiplicative range. At MA 1, factor ≈ 1.0; at MA 10, factor = 1.9; at MA 20, factor = 2.9. This shape rewards investment in MA without making low-MA casters useless or high-MA casters dominant. *v1 starting point — revisit after Earth Mage testing reveals typical MA values in play.*
- **target_resistance**: target's resistance to the status's primary tag.
- **status_modifiers**: hooks (Earth Mage's Support `× 1.25`, Mediator-style accuracy boosters, etc.). Multiplicative.

Final hit_chance is clamped to `[0, 1]`. Unlike physical hit chance, status applications can result in 0% or 100% — Faith-0 targets are immune to most status applications, fully-resistant targets are immune.

### Application pipeline

(Per `docs/design/status-effects.md`, recap.)

1. Resistance check — does the target's tag-immunity flag reject this status outright?
2. Application chance roll using the formula above.
3. Stacking check — does an instance of this type already exist? Apply the type's stacking rule.
4. Instantiate — create the StatusInstance.
5. Fire `onApply` hooks.
6. Side-effect actions if any.

### Status duration defaults

Typical duration ranges in CT-units (per-status configurable):

| Status type | Typical duration |
|---|---|
| Buff (Haste, Protect, Reflect) | 32 |
| Debuff (Slow, Stop, Sleep) | 24 |
| Burn / DoT (per stack) | 36 (ticks at unit's CT cadence) |
| Charging | conditional (tied to charged action lifecycle) |
| Don't Move / Don't Act | 24 |
| Vulnerable | one-shot (consumed on next damaging hit) |
| Poison (long-form) | permanent (cleared by item / ability) |

A unit at base Speed 12 takes ~8 ticks per turn (100/12 ≈ 8.3), so 24 CT-units ≈ 3 turns at base Speed. Faster units experience statuses for fewer of their turns; slower units for more. Duration is in CT-units, not turns, by default.

### Stacking and composition

Per design doc: stacking rules per type are REFRESH, REPLACE_IF_STRONGER, REPLACE, STACK_INDEPENDENT, STACK_ADDITIVE, REJECT.

For mixed sources of the same effect (Haste from spell + Haste from class trait, etc.):
- **Multiplicative stat modifiers compose multiplicatively across all sources.** Spell-Haste 1.5× × class-Haste 1.2× = 1.8× total Speed multiplier.
- **Additive modifiers compose additively across all sources.** PA +1 from item + PA +2 from buff = +3 total.
- **Discrete effects** (Burn stacks, Vulnerable, etc.) compose per their type's stacking rule.

Worth noting: multiplicative stacking with no ceiling can compound dramatically. The Speed ceiling (per Ruleset) is the safety on Haste stacking specifically; analogous ceilings should be considered for other stat types if compound stacking becomes problematic during balancing.

### Burn-specific stacking and decay

Burn doesn't follow the standard "tick at duration interval" pattern. Instead:

- **Stacks accumulate** via STACK_ADDITIVE — each application of Burn adds 1 (or more) stacks to the same StatusInstance.
- **Trigger condition**: the affected unit reaching CT 100 (i.e., the start of their next turn).
- **On trigger**: deal damage equal to `current_stack_count × burn_damage_per_stack`, then **decrement stack count by 1**.
- **Removal**: when stack count reaches 0, the StatusInstance is removed.

A unit with 3 Burn stacks experiences:
- Turn N (apply): no damage at application (Burn doesn't tick on apply).
- Turn N+1 (CT 100 reached): 3× damage, stacks → 2.
- Turn N+2: 2× damage, stacks → 1.
- Turn N+3: 1× damage, stacks → 0, status removed.

This makes Burn a **front-loaded** damage type: applying a fresh stack to a unit with existing stacks isn't strictly additive over time (the new stack only contributes at a couple of upcoming turns before decaying), so spamming Burn into Burn has diminishing returns. Combined with low `burn_damage_per_stack` values, this prevents Burn from running away as the dominant strategy while still rewarding aggressive Burn stacking for burst.

Implementation note: Burn is the first content consumer for this trigger pattern. The architecture-level mechanism — "status type with custom trigger condition different from duration tick" — generalizes if other statuses want similar behavior. For now, Burn is the only such status; the engine implements its specific trigger rather than introducing a generic custom-trigger system before it's needed.

---

## Charge time and charged actions

(See `docs/design/ct-system.md` and `docs/design/action-resolution.md` for full architecture.)

### CT cost when committing a charged spell

Casting a charged spell consumes the standard turn budget — same as any Act. If the unit also Moved that turn, full Move+Act CT cost (100). If only Acted, Act-only cost.

The charged action enters the projection queue with its own Action Speed and CT counter, independent of the caster's CT.

### Action Speed values

Per `docs/design/ct-system.md`. Charged actions accumulate CT at their own Action Speed. Typical ranges (per ability designer):

| Spell type | Action Speed |
|---|---|
| Quick / instant | 100+ (resolves on next tick) |
| Fast spell | 25-30 |
| Standard spell | 15-25 |
| Heavy spell / Ultimate | 10-15 |
| Long-charge ritual | 5-10 |

Higher Action Speed = faster charging. Action Speed is a per-ability constant, modifiable by hooks (Quicken, Slow Action).

### Interruption rules

Caster status checks happen at resolution time:

- **KO during charge**: spell **fizzles** at resolution. MP not refunded.
- **Stop status during charge**: charged action's CT accumulation **pauses** while caster is Stopped. Resumes when Stop clears. The charged action waits in the queue at its current CT value.
- **Silence during charge** (for spells with the `magical` or `voice` tag): spell **fizzles** at resolution. MP not refunded.
- **Don't Act during charge**: spell **fizzles** at resolution. MP not refunded.
- **Damage taken during charge**: no interruption. Charge continues normally.
- **Caster moved (knockback, forced movement)**: no interruption. Range checked at resolution against caster's current position.

Target validity is checked at resolution:

- **Single-target spell, target KO'd before resolution**: fizzles, MP not refunded.
- **Single-target spell, target moved out of range**: still resolves on the original target. (FFT pinning behavior — once you've targeted them, the spell finds them.)
- **AoE spell anchored on tile**: resolves regardless of who's on the tile at resolution time.
- **AoE spell anchored on unit**: resolves at the unit's current position. If the unit is KO'd, the AoE still resolves centered on the KO'd unit's tile (treating it as a position anchor at that point). The unit being KO'd doesn't fizzle the spell — the spatial pattern still hits whatever is in range.

The architectural commitment: targets can be either tiles or units. Tile-anchored spells resolve location-deterministically (whoever is there gets hit). Unit-anchored spells follow their unit (FFT-pinning) but fizzle if the unit is KO'd.

### Pause mechanic for Stop

The charged action carries a `paused` flag. When set, CT accumulation stops; when clear, accumulates normally. The flag is set/cleared by the engine when the caster's Stop status is applied/removed.

This is the only condition that pauses (rather than fizzles) a charged action. All other "caster can't act" statuses fizzle at resolution.

---

## MP system

- **Initial MP**: each unit starts each battle at full MP.
- **No regeneration by default**. MP doesn't regenerate over time, by turn, or per-action.
- **Cost timing**: MP is deducted on commit (when the ability is used, not when a charged action resolves). For charged spells, MP leaves the caster's pool at the moment of casting.
- **Refund on fizzle**: MP is **not** refunded when a charged spell fizzles. Casting is a commitment.
- **MP recovery sources**: per-ability content (e.g., Chemist's Ether item, MP-restoring abilities, MP-on-kill class traits). These are content additions, not engine defaults.
- **MP theft / drain**: per-ability content. The engine supports any MP modification via standard mechanisms.

This system creates a real "MP economy" where mages have a battle-long resource budget. Long battles favor non-magical builds; short battles favor magical bursts. Content can introduce regeneration as a class or ability feature without engine changes.

---

## Movement

(See `docs/design/map-and-battlefield.md` for full architecture.)

### Move Range

Per-class baseline, modifiable by Movement-bucket abilities and equipment. Typical ranges:

| Class type | Move Range |
|---|---|
| Heavy classes (Knight, Lancer) | 3 |
| Standard classes (Mage, Archer, Priest) | 3-4 |
| Mobile classes (Thief, Ninja, Dancer) | 4-5 |
| Specialty (Mounted, Flying) | 5+ |

Modifications are typically additive (`Move +1`, `Move +2`).

### Jump

Per-class baseline. Typical ranges:

| Class type | Jump |
|---|---|
| Heavy classes | 2 |
| Standard | 3 |
| Mobile | 4 |
| Flying / specialty | 6+ |

Jump caps maximum elevation differential per single tile step.

### Terrain costs

Default: 1 per tile (any traversable terrain). Per-terrain overrides via Ruleset:

| Terrain | Default cost |
|---|---|
| Grass, road, stone | 1 |
| Sand, snow | 2 |
| Mud, swamp | 3 |
| Water (where wadeable) | 2-3 |

Movement-bucket abilities like "Walk on Sand" or "Ignore Difficult Terrain" override these costs back to 1 for specific terrains.

---

## Evasion and accuracy

### Evasion stats

Three values per unit: Front, Side, Back. Computed from class baseline + equipment + statuses. Typical ranges:

| Source | Front | Side | Back |
|---|---|---|---|
| Class baseline (most) | 5-15 | 3-8 | 0 |
| Class baseline (Thief) | 20 | 15 | 5 |
| Shield equipment | +10-25 | +5-15 | 0 |
| Defensive R/S/M | varies | varies | varies |

Back evasion is conventionally low or zero — back attacks are tactically advantageous in FFT, and we preserve that.

### Facing determination

When attacker A attacks target T:
- Compute angle from T's position to A's position relative to T's facing.
- Within ±45° of T's facing direction → Front
- Within 45-135° on either side → Side
- Within 135-180° → Back

This is the standard "front cone, two side cones, back cone" division.

For ranged attacks, facing relative to attacker's tile, not the line of attack. This means a target's Back stays Back even if the attacker is at an oblique angle.

---

## KO and death

- **HP reaches 0**: unit becomes KO'd.
- **KO'd units occupy their tile** (cannot be walked through normally).
- **Death timer**: KO'd units carry a 3-turn countdown. Counter ticks at the unit's natural CT cadence — 3 of their turns elapse before permanent death.
- **Permanent death**: triggered by `unit_death` system action. Removes the unit from the battle entirely; their tile becomes free.
- **Raise / Revival**: if applied within the death window, KO'd unit recovers with HP equal to the Raise ability's specified amount (typically a percentage of max HP). Death timer resets — if KO'd again, fresh 3-turn window.
- **AoE on KO'd units**: AoE damage can hit KO'd units; this doesn't accelerate the death timer. KO'd units take damage but stay at 0 HP. If a specific ability says "deals X damage to corpses" or similar, content-defined behavior.
- **Status effects on KO'd units**: persistent statuses remain through KO (they reactivate on Raise). DoT statuses (Poison, Burn) do **not** tick while KO'd — the unit is unconscious, not actively suffering.

---

## Brave

Brave (1-100) is character-bound and primarily affects Reaction triggers and some physical damage formulas.

### Reaction trigger chance

When a Reaction's trigger condition fires (e.g., a Counter reaction's owner takes a melee hit):

```
trigger_chance = Brave / 100
```

A unit with Brave 100 triggers Reactions deterministically (matches the v1 design intent of "early units have Brave 100 for testing"). Lower Brave introduces probability — a Brave 50 unit reacts ~50% of the time.

The Brave roll is the *only* gate on whether a Reaction fires for an in-scope incoming action — Counter, for example, fires on physical attempts regardless of whether damage landed. A miss against a high-evasion target still triggers a Brave-passing Counter. See ADR-0021 for the rationale and the engine implementation in `runOnActionTargeted`.

### Physical damage modifier

For abilities that incorporate Brave (typically heroic / berserker-style classes' signature abilities):

```
modifier = Brave / 100
```

Used multiplicatively in the ability's damage formula. Most physical abilities don't use Brave; specific ability designs do.

### No on-use Brave loss

Per design call: Brave does not decrease through specific *self*-ability use (FFT had this for some abilities; we don't). Brave changes through:
- **Deliberate progression** outside battle (TBD when progression system lands).
- **Ability targeting** in battle: certain abilities (typically class-specific signatures) may raise or lower a target's Brave. These changes are persistent within the battle. The persistence beyond battle is gated on the cross-battle progression system; until that lands, Brave changes reset between battles.

---

## Faith

Faith (1-100) is character-bound and primarily affects magical damage and status applications, on both caster and target sides (symmetric).

### Magical damage

`Faith_factor = (Faith_user / 100) × (Faith_target / 100)`. See Magical damage formula.

### Status application

`Faith_factor = (Faith_user / 100) × (Faith_target / 100)`. See Status application formula.

### Healing

Same formula — symmetric Faith. High-Faith healer + high-Faith ally → full effect; low Faith on either side reduces effectiveness.

### Faith and party composition

The symmetric Faith design creates a real party-composition tension:
- **High-Faith units** are easier to heal but easier to magic-damage.
- **Low-Faith units** are physical-magic resistant but hard to heal magically.
- A mixed-Faith party requires deliberate magic-vs-physical role assignment.

This is a feature — it makes class composition matter beyond just "who fills which damage role."

### Faith manipulation by abilities

Like Brave, Faith may be raised or lowered by specific abilities targeting a unit. Faith changes are persistent within the battle. Cross-battle persistence depends on the progression system (deferred); for v1, Faith changes reset between battles.

---

## AoE behavior

- **Friendly fire**: ON by default. AoE abilities affect all units (allies and enemies) in their footprint, regardless of whether the ability is offensive, defensive, or healing. A standard Cure-style heal AoE will heal both allies *and* enemies in range.
- **Per-ability override**: abilities may specify `friendly_fire: false` (or analogous flag for healing-AoE that excludes enemies) to limit affected units. This is reserved for specifically-designed advanced abilities, not the default for healing.
- **Anchor types**:
  - **Tile anchor**: AoE centered on a tile. Resolves at the tile's location regardless of unit movement.
  - **Unit anchor**: AoE centered on a unit's position at resolution. Follows the target unit (FFT pinning).
- **Vertical tolerance**: per-ability. Specifies max elevation differential from anchor that affected tiles can have. AoE doesn't penetrate large elevation changes by default.
- **Multi-layer behavior**: by default, all qualifying tiles within vertical tolerance at any layer are affected (e.g., Fire AoE under a bridge hits both the ground and the bridge if both within tolerance). Per-ability override allows "highest layer only" semantics.

The default-on friendly fire for healing matches FFT (basic heal AoE is indiscriminate). It creates real positional decisions — you can't safely heal an ally surrounded by enemies without also restoring the enemies. Advanced abilities that selectively heal allies are a content-tier feature, not a baseline.

### Damage application order in AoE

Targets affected by an AoE are hit in deterministic order (stable unit ID). Each target runs its own damage pipeline independently. Reactions per target fire after their target's damage applies, in target-order.

---

## Quick reference: typical numbers

For first-pass tuning, expect numbers in these ranges:

| Quantity | Typical range |
|---|---|
| HP (level 1, low-tier class) | 40-60 |
| HP (level 30, high-tier class) | 200-400 |
| MP (level 1, mage class) | 10-15 |
| MP (level 30, mage class) | 60-100 |
| MP (non-mage classes) | 5-30 |
| PA, MA (level 1) | 3 |
| PA, MA (level 30) | 12-18 |
| Speed (most units) | 4-10 |
| Speed (Thief, Ninja, mobile) | 8-15 |
| Brave, Faith | 40-80 typical, 1-100 possible |
| Move Range | 3-5 |
| Jump | 2-5 |
| Front Evasion | 5-25 |
| Standard physical attack damage | 15-60 (level-dependent) |
| Standard magical spell damage | 25-100 (level and Faith-dependent) |
| Critical multiplier | 1.5× |

These are rough; actual balancing is its own process. They're listed here so when content designers ask "is 200 a reasonable damage value?" the answer is calibrated.

---

## Decisions captured

- Stat composition order: Class+Level → Equipment+Loadout → Status, with multiplicative for stat-multipliers and additive for stat-additives.
- Damage variance defaults to deterministic (range `[1.0, 1.0]`); per-ability override.
- Critical hits: 5% base rate, 1.5× multiplier; per-ability/source modifiable.
- Physical hits roll against weapon accuracy and target evasion; magical damage always lands.
- Status applications use the symmetric-Faith formula with target resistance and `MA_factor = 0.9 + MA/10`.
- Faith is symmetric (caster × target) for damage, status application, and healing.
- Resistance scale: -100 (double) to 200 (absorb), 0 = normal, 100 = immune.
- Resistance composition: additive across sources, multiplicative onto damage/status. Multi-tag composition: signed maximum across applicable tags (resistance wins ties; `'healing'` tag opts out of resistance entirely). See ADR-0015 and ADR-0016.
- Stat modifier composition: multiplicative across sources for multiplicative modifiers; additive for additive modifiers.
- Burn uses custom trigger pattern: damage = stack count × per-stack damage at CT 100 trigger, then stack count decrements. Generalizes to a "custom trigger" pattern if more statuses need it.
- Charged spell CT cost: standard turn budget (Move+Act = 100, Act-only = standard Act cost).
- Charged spell interruption: KO/Silence/Don't Act fizzle at resolution; Stop pauses; damage and movement don't interrupt.
- Targets: tile-anchored (location-deterministic) or unit-anchored (FFT pinning, including KO'd units' last position).
- MP: full at battle start, no regen by default, cost on commit, no refund on fizzle.
- KO: 3-turn revival window, then permanent. KO'd units occupy tile, statuses persist but DoT doesn't tick.
- Brave: triggers Reactions probabilistically (Brave/100); modifier on certain physical formulas; manipulable in-battle by abilities; no on-self-use loss.
- Faith: symmetric in formulas; manipulable in-battle by abilities. Cross-battle persistence of Brave/Faith changes deferred to progression system.
- AoE friendly fire: on by default for ALL abilities (offensive, defensive, healing); per-ability override for advanced designs.
- Stat caps: 999 HP/MP, 99 PA/MA/Speed, 100 Brave/Faith, [-100, 200] resistance.

---

## Open questions / deferred for tuning

- Specific class baseline curves for HP/MP/PA/MA/Speed across levels.
- Specific weapon WP and accuracy values.
- Specific armor stat contributions.
- Specific status duration values per status.
- Specific Burn `burn_damage_per_stack` value (small per-stack damage to limit runaway accumulation).
- Whether class change between battles preserves or resets level (likely preserves per-class level).
- Speed ceiling specific value (currently suggested 3.0× base).
- Healing crits — currently disabled by default; re-evaluate.
- Cross-battle persistence of Brave/Faith changes (gated on progression system).
