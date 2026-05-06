# Ability and Content Definition Format

*Specification — v0.1*

This document specifies the schema for class definitions, ability definitions, status type definitions, and command set definitions in `src/content/`. The schema is the contract between content designers and the engine: content authors write data files matching these schemas, the engine catalog loads them, and runtime resolution consumes them through known fields.

The schemas use TypeScript-style notation but content files may be written as TS objects, JSON, or another serialization format — the loader handles parsing. Format-on-disk is implementation detail; the *shape* is the spec.

## Design principles

A few principles informed every choice in this spec:

- **Defaults over verbosity.** Most fields have sensible defaults. A simple physical attack should be expressible in 5-10 lines, not 50.
- **Explicit over inferred.** Where a field's meaning could be ambiguous, prefer requiring it. Implicit defaults that depend on other fields create bugs.
- **Composition through tags.** Damage tags, status tags, ability tags. Tags drive lookups and modifications. Adding a new tag is data; adding a new tag *type* is engine work.
- **Effects as a list.** Most abilities have one effect. Some have many (damage + status, multi-stage). Effects are list-shaped from the start so multi-effect abilities don't need a different schema.
- **Hooks as named handlers.** Passive abilities and statuses register hooks by name. The named handler is a function defined in `src/engine/handlers/` (or a content-side utility folder); the catalog stores the name. This keeps content data declarative.
- **Pure data where possible.** Numeric formulas, threshold checks, etc. are values in fields rather than function bodies. When logic is unavoidable (a unique trigger condition), it's a named handler.

## Class definition

A class describes a unit's identity at a particular role: stat curves, default loadout, available command sets, and class-inherent traits.

```typescript
interface ClassDefinition {
  id: ClassId;                          // unique identifier ('knight', 'earth_mage')
  name: string;                         // 'Knight', 'Earth Mage'
  
  // Stat curves indexed by level
  curves: {
    hp: StatCurve;
    mp: StatCurve;
    pa: StatCurve;
    ma: StatCurve;
    speed: StatCurve;
    // optional: per-level Move/Jump if those grow
    moveRange?: StatCurve;
    jump?: StatCurve;
  };
  
  // Flat baselines (don't grow with level)
  baselines: {
    moveRange: number;                  // default if no curve
    jump: number;                       // default if no curve
    evasion: { front: number; side: number; back: number };
    resistances: Partial<Record<DamageTag, number>>;  // sparse; missing tags = 0
  };
  
  // Loadout defaults
  defaultActiveCommandSet: CommandSetId;  // fills First Action bucket
  availableCommandSets: CommandSetId[];   // command sets a unit in this class can equip in Second Action
  classInherentPassives: AbilityId[];     // free-cost while in this class
  
  // Optional class traits — registered as hooks while unit is in this class
  traits?: ClassTrait[];
}

type StatCurve = 
  | { kind: 'linear'; base: number; growth: number }   // value = base + growth × level
  | { kind: 'piecewise'; points: Array<[number, number]> }  // [level, value] pairs, linearly interpolated
  | { kind: 'table'; values: number[] };                // values[level - 1]

interface ClassTrait {
  id: string;                           // 'knight_armor_proficiency'
  description: string;
  hooks: HookHandlerSpec[];
}
```

### Example class definition: Earth Mage (sketch)

```typescript
{
  id: 'earth_mage',
  name: 'Earth Mage',
  curves: {
    hp: { kind: 'linear', base: 45, growth: 5 },
    mp: { kind: 'linear', base: 12, growth: 3 },
    pa: { kind: 'linear', base: 3, growth: 0.3 },
    ma: { kind: 'linear', base: 4, growth: 0.5 },
    speed: { kind: 'linear', base: 7, growth: 0.1 },
  },
  baselines: {
    moveRange: 3,
    jump: 3,
    evasion: { front: 8, side: 5, back: 0 },
    resistances: { earth: 25 },         // sparse; other tags default to 0
  },
  defaultActiveCommandSet: 'earth_spells',
  availableCommandSets: ['earth_spells', /* ... */],
  classInherentPassives: [],            // none for v1, may add later
}
```

## Ability definition

The schema for an ability — what shows up in command sets (active abilities) or in passive buckets (R/S/M abilities).

### Shared structure

```typescript
interface AbilityDefinitionCommon {
  id: AbilityId;
  name: string;
  description: string;

  // Top-level discriminator: just two values. Active abilities live in
  // command sets and are usable on a turn; passive abilities equip into
  // a passive bucket and register hooks while equipped.
  kind: 'active' | 'passive';

  // Bucket pricing. For passives, also identifies which Passive bucket
  // (reaction / support / movement) the ability equips into — i.e., the
  // bucket field is the *sub-discriminator* for passive variants.
  bucket: BucketId;
  baseCost: number;

  // Optional ability tags for category-based interactions (gating logic
  // in hooks, e.g. Silence blocking 'voice'-tagged actions). Open string
  // — adding a new tag is content work, not engine work.
  tags?: AbilityTagId[];                // ['magical', 'fire', 'voice'], etc.
}

type AbilityDefinition = ActiveAbilityDefinition | PassiveAbilityDefinition;

interface ActiveAbilityDefinition extends AbilityDefinitionCommon {
  kind: 'active';
  // Active-specific fields (targeting, range, actionSpeed, mpCost, effects, …)
  // see "Active ability fields" below.
}

interface PassiveAbilityDefinition extends AbilityDefinitionCommon {
  kind: 'passive';
  // Per-flavor variant chosen by the passive's bucket:
  //   bucket = 'reaction'  → ReactionAbilityFields populated
  //   bucket = 'support'   → SupportAbilityFields populated
  //   bucket = 'movement'  → MovementAbilityFields populated
  reaction?: ReactionAbilityFields;
  support?: SupportAbilityFields;
  movement?: MovementAbilityFields;
}
```

The top-level discriminator is `kind: 'active' | 'passive'`. The R/S/M passive flavors are sub-discriminated by the `bucket` field — that's the engine's existing model (per ADR-0005, all passives share the same hook surface; the bucket determines registration, not mechanism). An active ability has only its active fields populated; a reaction-bucket passive has only `reaction`; a support-bucket passive has only `support`; movement only `movement`.

### Active ability fields

```typescript
interface ActiveAbilityFields {
  // Targeting — discriminated union shared with the engine's TargetingSpec.
  targeting: TargetingSpec;

  // Charging — omit for instant; present means charged. The reducer
  // spawns a ChargedAction at ct: 0, speed: actionSpeed when committed;
  // resolution fires when the ChargedAction's CT reaches the trigger
  // threshold. See docs/design/ct-system.md.
  actionSpeed?: number;

  // AoE shape (omit for single-target). Per-(x,y) within the footprint
  // is the unit of layer selection — see multiLayerBehavior below.
  aoe?: {
    shape: AoEShape;                    // single, line, cross, diamond, square, cone, custom
    radius?: number;                    // for diamond/square/cone
    verticalTolerance: number;
    multiLayerBehavior?: 'all' | 'highest' | 'lowest';  // default 'all'
    friendlyFire?: boolean;             // default true
  };

  // Cost
  mpCost: number;

  // What the ability does
  effects: AbilityEffect[];

  // Hit determination. *Omit* for auto-hit (the absence of hitRoll means
  // "no roll"); present means physical hit chance applies (per
  // docs/battle-mechanics-guide.md "Hit chance — physical attacks").
  // The evasion_check pipeline handler reads this field; if absent, the
  // handler short-circuits and the action auto-hits. See ADR-0019.
  hitRoll?: HitRollSpec;

  // Damage variance (omit for deterministic, [1.0, 1.0])
  variance?: [number, number];
}

// Targeting is a discriminated union by kind. Three v1 cases:
//
//   { kind: 'self' }
//     — no target; the ability targets the actor.
//
//   { kind: 'single_unit'; range; rangeMode }
//     — target is a unit. AbilityTarget payload: { unitId }. The actor's
//       range and rangeMode (melee/straight_line/arc) gate validation.
//
//   { kind: 'tile'; range; rangeMode }
//     — target is a tile. AbilityTarget payload: { position }. AoE
//       abilities (Earth's Earthquake, Fire's line spells) target tiles.
//       Single-tile non-AoE abilities are also valid (e.g., a ground
//       trap placed at a tile).
type TargetingSpec =
  | { kind: 'self' }
  | { kind: 'single_unit'; range: AbilityRange; rangeMode: RangeMode }
  | { kind: 'tile';        range: AbilityRange; rangeMode: RangeMode };

interface AbilityRange { horizontal: number; vertical: number; minHorizontal?: number; }
type RangeMode = 'melee' | 'straight_line' | 'arc';

// AbilityTarget — the controller-supplied payload for a UseAbility
// action, dispatched on the targeting kind:
//   targeting kind 'self'        → AbilityTarget = undefined
//   targeting kind 'single_unit' → AbilityTarget = { unitId: UnitId }
//   targeting kind 'tile'        → AbilityTarget = { position: Position }

type AoEShape =
  | { kind: 'single' }
  | { kind: 'line'; length: number }
  | { kind: 'cross' }
  | { kind: 'diamond' }
  | { kind: 'square' }
  | { kind: 'cone' }
  | { kind: 'custom'; pattern: Position[] };  // relative coords
```

#### AoE multi-layer behavior

The `multiLayerBehavior` field describes how the AoE selects affected tiles when more than one tile-layer at the same (x,y) qualifies (e.g., a bridge over a riverbed). Semantics are **per-(x,y)** within the AoE footprint, not globally over the footprint:

- `'all'` (default): for each (x,y) within the footprint that has multiple qualifying layers, all qualifying layers are affected. A fire AoE under a bridge hits both the riverbed and the bridge if both are within vertical tolerance.
- `'highest'`: for each (x,y), only the highest-qualifying layer is affected. The fire AoE hits the bridge (top layer) and skips the riverbed.
- `'lowest'`: for each (x,y), only the lowest-qualifying layer is affected. The AoE hits the riverbed and skips the bridge.

The decision is made independently for each (x,y) — the AoE doesn't pick a single global "highest layer in footprint" tile and project it across columns.

### Effect types

Effects are the building blocks of an ability's outcome. An ability has a list of effects; each is resolved in order.

```typescript
type AbilityEffect =
  | DamageEffect
  | HealEffect
  | StatusApplicationEffect
  | StatModificationEffect
  | CTPushEffect
  | KnockbackEffect
  | RaiseEffect
  | CustomEffect;

interface DamageEffect {
  kind: 'damage';
  damageType: 'physical' | 'magical';
  power: number;                        // power_coefficient in formulas
  damageTags: TagId[];                  // ['fire'], ['holy'], etc.
  selfDamage?: boolean;                 // applied to caster instead of target
  selfDamageFraction?: number;          // for "deals X to self" patterns
}

interface HealEffect {
  kind: 'heal';
  power: number;
  healTags?: TagId[];
}

interface StatusApplicationEffect {
  kind: 'status';
  statusTypeId: StatusTypeId;
  baseChance: number;                   // 0-100
  duration?: number;                    // override status type's default
  magnitude?: number;                   // override status type's default
  targetSelector?: TargetSelector;      // who from the AoE gets this status
}

interface StatModificationEffect {
  kind: 'stat_mod';
  stat: StatId;                         // 'pa', 'ma', etc.
  delta: number;                        // additive
  targetSelector?: TargetSelector;
}

interface CTPushEffect {
  kind: 'ct_push';
  delta: number;                        // can be negative
  // delta can also reference user stats via formula:
  formula?: string;                     // e.g., '-2 * MA_user'
  targetSelector?: TargetSelector;
}

interface KnockbackEffect {
  kind: 'knockback';
  distance: number;
  direction: 'away_from_caster' | 'random' | 'toward_caster' | 'random_cardinal';
}

interface RaiseEffect {
  kind: 'raise';
  hpFraction: number;                   // 0.5 = revive at 50% max HP
}

interface CustomEffect {
  kind: 'custom';
  handlerId: string;                    // references a function in src/content/handlers/
  params: Record<string, unknown>;
}
```

Effects compose. A typical magical attack with a status rider has two effects: a `damage` effect and a `status` effect. Each rolls independently per the Battle Mechanics Guide.

### Examples — constructing each Earth Mage ability

To validate the schema, here's how each Earth Mage ability translates:

**Earth Base spell** (single-target damage with stat-mod debuff rider):

```typescript
{
  id: 'earth_strike',
  name: 'Earth Strike',
  description: 'Hurl earth at a target. Reduces target Move and Jump.',
  kind: 'active',
  bucket: 'first_action',
  baseCost: 1,                          // primary command set ability
  tags: ['magical', 'earth'],
  active: {
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 2 }, rangeMode: 'arc' },
    actionSpeed: 25,                    // charged, fast
    mpCost: 4,
    variance: [1.0, 1.0],
    effects: [
      {
        kind: 'damage',
        damageType: 'magical',
        power: 6,
        damageTags: ['earth', 'magical'],
      },
      {
        kind: 'status',
        statusTypeId: 'movement_debuff',
        baseChance: 60,
        duration: 36,
      },
    ],
  },
}
```

**Earth Buff** (Regen application to ally):

```typescript
{
  id: 'earth_blessing',
  name: "Earth's Blessing",
  description: "Grant an ally Regen.",
  kind: 'active',
  bucket: 'first_action',
  baseCost: 1,
  tags: ['magical', 'earth', 'support'],
  active: {
    targeting: { kind: 'single_unit', range: { horizontal: 4, vertical: 2 }, rangeMode: 'arc' },
    actionSpeed: 30,
    mpCost: 6,
    effects: [
      {
        kind: 'status',
        statusTypeId: 'regen',
        baseChance: 100,                 // hit roll vs. resistance still applies
        duration: 36,
      },
    ],
  },
}
```

**Earth AoE spell** (cross damage with debuff rider):

```typescript
{
  id: 'earth_quake',
  name: 'Earthquake',
  description: 'Shake the earth in a cross pattern. Damages and may slow.',
  kind: 'active',
  bucket: 'first_action',
  baseCost: 1,
  tags: ['magical', 'earth', 'aoe'],
  active: {
    targeting: { kind: 'tile', range: { horizontal: 5, vertical: 3 }, rangeMode: 'arc' },
    actionSpeed: 20,
    aoe: {
      shape: { kind: 'cross' },
      verticalTolerance: 1,
      friendlyFire: true,
    },
    mpCost: 8,
    effects: [
      {
        kind: 'damage',
        damageType: 'magical',
        power: 5,
        damageTags: ['earth', 'magical'],
      },
      {
        kind: 'status',
        statusTypeId: 'movement_debuff',
        baseChance: 50,
        duration: 36,
      },
    ],
  },
}
```

**Earth Reaction** (self-buff Move/Jump on hit):

```typescript
{
  id: 'earth_resilience',
  name: 'Earth Resilience',
  description: 'When struck, ground your steps. Move +1 and Jump +1 for a short duration.',
  kind: 'passive',
  bucket: 'reaction',
  baseCost: 2,
  tags: ['magical', 'earth'],
  reaction: {
    triggerOn: ['onActionTargeted'],
    triggerCondition: { type: 'damage_received', minDamage: 1 },
    effects: [
      {
        kind: 'status',
        statusTypeId: 'earth_resilience_status',
        baseChance: 100,                 // applied to self deterministically when triggered
        duration: 24,
        targetSelector: 'self',
      },
    ],
  },
}
```

**Earth Support** (status chance modifier):

```typescript
{
  id: 'earth_communion',
  name: 'Earth Communion',
  description: 'Status applications by this unit are 1.25× more likely.',
  kind: 'passive',
  bucket: 'support',
  baseCost: 2,
  tags: ['magical', 'earth'],
  support: {
    hooks: [
      {
        hookName: 'modifyStatusApplicationChance',
        handlerId: 'multiply_by',
        params: { factor: 1.25 },
      },
    ],
  },
}
```

### Reaction ability fields

```typescript
interface ReactionAbilityFields {
  triggerOn: HookName[];                // which hooks this listens on
  triggerCondition?: TriggerCondition;  // additional filtering beyond hook firing
  effects: AbilityEffect[];
  // Brave-modulated chance is automatic; Brave 100 is deterministic.
  customBraveCheck?: 'use_brave' | 'always';  // default 'use_brave'
}

type TriggerCondition =
  | { type: 'damage_received'; minDamage?: number; damageTagsAny?: TagId[]; damageTagsNone?: TagId[] }
  | { type: 'status_applied'; statusTags?: TagId[] }
  | { type: 'attacker_in_range'; range: number }
  | { type: 'always' }
  | { type: 'custom'; handlerId: string };
```

This shape is data-driven: a reaction declares what hook(s) to listen on, what condition to gate on, and what effects to fire. A reaction *compiler* — landing in session 16 alongside the first content consumer that benefits from it (Earth's Reaction) — translates `ReactionAbilityFields` into one or more `PassiveHookRegistration` objects that the engine consumes through its existing passive-hook machinery (per ADR-0005, all passives share the same hook surface).

Until the compiler ships, hand-coded passive reactions (the Counter pattern in `src/content/abilities/counter.ts` today) coexist with the spec. When the compiler lands, Counter is refactored to use `ReactionAbilityFields` as a worked example, and subsequent reactions (Earth, Fire, Water, Lightning) flow through the compiler.

### Support ability fields

```typescript
interface SupportAbilityFields {
  hooks: HookHandlerSpec[];
}

interface HookHandlerSpec {
  hookName: HookName;                   // 'modifyStatQuery', 'onDamageDealt', etc.
  handlerId: string;                    // named handler in src/engine/handlers/
  params: Record<string, unknown>;      // handler-specific config
  priority?: number;                    // optional override of standard ordering
}
```

Support abilities express their effect entirely as registered hook handlers. The handler ID names a function in the engine; params configure it. Common handlers:

- `modify_stat_additive` — params: `{ stat: 'pa', delta: 1 }`
- `modify_stat_multiplicative` — params: `{ stat: 'speed', factor: 1.5 }`
- `multiply_by` — generic multiplier with `{ factor }`
- `add_damage_tag_on_hit` — params: `{ tag: 'fire' }`
- `refund_ct_after_action` — params: `{ amount: 10, actionTagsAny: ['magical'] }`

New handlers are added by writing a function and registering it in `src/engine/handlers/registry.ts`. Adding a handler is engine work; using it is content work.

### Movement ability fields

```typescript
interface MovementAbilityFields {
  hooks: HookHandlerSpec[];             // modifications to MovementProfile
  specialMovementType?: 'fly' | 'teleport' | 'phase';
}
```

Most movement abilities express through hook modifications: `Move +1` modifies the `moveRange` query; `Float` modifies `canEnter` to add Water; `Walk on Sand` modifies `terrainCosts`. Special movement (fly, teleport, phase) is flagged and replaces standard pathfinding.

## Status type definition

```typescript
interface StatusEffectType {
  id: StatusTypeId;
  name: string;
  description: string;
  
  tags: StatusTagId[];                  // 'positive' | 'negative' | 'mental' | 'time' | etc.
  durationMode: DurationMode;
  defaultDuration?: number;             // for non-permanent modes
  defaultMagnitude?: number;
  
  stackingRule: StackingRule;
  
  // Custom trigger (for Burn-style and Vulnerable-style statuses)
  customTrigger?: CustomTriggerSpec;
  
  hooks: HookHandlerSpec[];             // what this status does while active
  
  // Resistance and immunity interactions
  resistanceTag?: TagId;                // which resistance tag gates this status
  immunityTags?: TagId[];               // tags that grant full immunity
}

type DurationMode = 'global_ticks' | 'per_unit_ct' | 'turn_based' | 'conditional' | 'permanent';

type StackingRule =
  | 'REFRESH'                // existing instance's duration resets; magnitude unchanged
  | 'REPLACE_IF_STRONGER'    // new replaces existing iff new magnitude > existing
  | 'REPLACE'                // new unconditionally replaces existing
  | 'STACK_INDEPENDENT'      // multiple instances coexist; each with own duration/magnitude
  | 'STACK_ADDITIVE'         // one instance; magnitudes sum; duration refreshes
  | 'STACK_COUNT_ADDITIVE'   // one instance; stack count increments; magnitude is per-stack constant; duration refreshes
  | 'REJECT';                // new application rejected if any existing instance present

interface CustomTriggerSpec {
  triggerEvent: 'unit_ct_threshold' | 'damage_received' | 'damage_dealt' | 'turn_start' | 'custom';
  condition?: { handlerId: string; params: Record<string, unknown> };
  effect: { handlerId: string; params: Record<string, unknown> };
  removeOnTrigger: boolean;
  decrementStacksOnTrigger?: boolean;
}
```

### Examples

**Regen** (heal-over-time tied to unit CT):

```typescript
{
  id: 'regen',
  name: 'Regen',
  description: 'Restore HP over time.',
  tags: ['positive'],
  durationMode: 'per_unit_ct',
  defaultDuration: 36,
  defaultMagnitude: 5,                  // HP per tick
  stackingRule: 'REFRESH',
  hooks: [
    {
      hookName: 'onTick',
      handlerId: 'apply_healing',
      params: { source: 'magnitude' },
    },
  ],
}
```

**Burn** (custom-trigger, stacks-decay-on-trigger):

```typescript
{
  id: 'burn',
  name: 'Burn',
  description: 'Take fire damage at the start of each turn. Stacks decrement after dealing damage.',
  tags: ['negative', 'fire'],
  durationMode: 'conditional',          // managed by custom trigger
  stackingRule: 'STACK_COUNT_ADDITIVE', // each application increments stack count
  defaultMagnitude: 5,                  // per-stack damage; trigger reads stacks × magnitude
  customTrigger: {
    triggerEvent: 'unit_ct_threshold',  // fires when affected unit's CT reaches 100
    effect: {
      handlerId: 'deal_damage_per_stack',
      params: { damagePerStack: 6, damageTags: ['fire', 'magical'] },
    },
    removeOnTrigger: false,
    decrementStacksOnTrigger: true,
  },
  hooks: [],                            // no continuous hooks; trigger does the work
  resistanceTag: 'fire',
}
```

**Vulnerable** (custom-trigger, single-shot consumed):

```typescript
{
  id: 'vulnerable',
  name: 'Vulnerable',
  description: 'Next damage taken is multiplied 1.5×.',
  tags: ['negative'],
  durationMode: 'conditional',
  stackingRule: 'REJECT',
  customTrigger: {
    triggerEvent: 'damage_received',
    effect: {
      handlerId: 'multiply_incoming_damage',
      params: { factor: 1.5 },
    },
    removeOnTrigger: true,
  },
  hooks: [],
}
```

**Stop** (pauses CT):

```typescript
{
  id: 'stop',
  name: 'Stop',
  description: 'Speed reduced to 0; charged actions paused.',
  tags: ['negative', 'time'],
  durationMode: 'per_unit_ct',
  defaultDuration: 24,
  stackingRule: 'REFRESH',
  hooks: [
    {
      hookName: 'modifyStatQuery',
      handlerId: 'set_stat',
      params: { stat: 'speed', value: 0 },
    },
    {
      hookName: 'onActionAttempted',
      handlerId: 'block_action',
      params: { reason: 'stopped' },
    },
  ],
  resistanceTag: 'time',
}
```

## Command set definition

A command set bundles a set of active abilities into a named group that can be equipped in an Active Bucket.

```typescript
interface CommandSetDefinition {
  id: CommandSetId;
  name: string;
  description: string;
  abilities: AbilityId[];               // which abilities are part of this set
  // Per-ability learning is per-character state, not part of this definition
}
```

Example:

```typescript
{
  id: 'earth_spells',
  name: 'Earth Spells',
  description: 'Magic that calls upon the earth and its weight.',
  abilities: [
    'earth_strike',
    'earth_blessing',
    'earth_quake',
    'earth_curse',
    'earth_calamity',
  ],
}
```

## File organization

```
src/content/
├── classes/
│   ├── knight.ts
│   ├── earth_mage.ts
│   ├── water_mage.ts
│   ├── fire_mage.ts
│   └── lightning_mage.ts
├── abilities/
│   ├── knight/
│   │   ├── attack.ts
│   │   └── ...
│   ├── earth/
│   │   ├── earth_strike.ts
│   │   ├── earth_blessing.ts
│   │   └── ...
│   └── ...
├── statuses/
│   ├── core/                          # widely-used statuses
│   │   ├── stop.ts
│   │   ├── slow.ts
│   │   └── ...
│   ├── per-class/                     # statuses primarily used by one class
│   └── ...
├── command_sets/
│   ├── battle_skill.ts
│   ├── earth_spells.ts
│   └── ...
├── handlers/                          # content-specific handler functions
│   └── (named handlers referenced by ability definitions)
└── catalog.ts                         # registers everything in the catalog
```

The `catalog.ts` file is the single registration point — it imports each definition and registers it. The engine reads from the catalog at startup, never touches content files directly.

## Validation

Every content definition is validated at catalog load time. Validation catches:

- Missing required fields.
- References to nonexistent IDs (an ability references a StatusType that doesn't exist).
- Type errors (a `power` field is a string instead of number).
- Circular references (Class A's inherent passive references an ability from Class B's set, which references Class A).
- Hook handler IDs that aren't registered in the engine.

A failed validation aborts startup with a clear error message. Content errors should never reach runtime as a silent bug.

## Adding a new ability — concrete workflow

When adding an ability to a class:

1. **Determine ability type** (active / reaction / support / movement).
2. **Pick effect types** from the AbilityEffect union, or write a new one if existing ones don't fit (escalate to engine work if so).
3. **Write the definition** in `src/content/abilities/<class>/<ability_id>.ts`.
4. **Add to command set** if active (in `src/content/command_sets/<set>.ts`).
5. **Register in catalog** (in `src/content/catalog.ts`).
6. **Write a test** that creates a unit with the ability, casts it on a fixture target, asserts the expected outcome.
7. **Validate the catalog loads.** Any reference errors surface here.
8. **Update the design doc / mechanics guide** if the ability surfaces a new pattern that warrants documentation.

The first 4-5 steps are mechanical; step 7-8 is where design pressure catches things.

## Open questions / deferred

- **Ability description templating.** Some descriptions reference specific numbers ("deals 5 damage per stack"). Whether to template these from the ability's params for consistency, or write them as freeform text. Defer to UI work.
- **Damage formulas as first-class data.** Currently effects use named fields (`power`); a formula like "deals (PA + WP) × 1.5" is built into the engine. We may want content-defined formulas for unique abilities — defer until a content design needs it.
- **Conditional effects.** "If target is Burning, deal 2× damage." Currently expressible only via a custom-handler effect. May warrant a structured `condition` field on effects later.
- **Multi-stage abilities.** An ability that hits, then on-hit applies status, then if status applies fires another effect. Currently expressible by ordering in the effects list, but for complex chains a more structured mini-flow may help.
- **Localization.** name/description are English-only for v1. Localization is post-v1.
- **Editor tooling.** Long-term, a content editor that validates schemas and provides autocomplete. Post-v1, but the schema design here makes such tooling cleanly possible.
