// ClassDefinition — the catalog definition of a unit class.
// See docs/design/ability-slots.md and the deferred class/progression doc.
//
// Session 4 added `movement` (the class baseline read by
// computeMovementProfile). Session 5 added `firstActionCommandSet` (the
// CommandSet pinned into the unit's First Action active bucket — class-
// determined per design) and `freeAbilities` (abilities the class grants
// at cost 0 per the design's "cost-0 modulation" mechanism).
//
// `ClassMovementBaseline` is the per-class anchor for the move profile.
// Required so authors must consciously declare what their class can enter
// and how far it can move. Session 5 introduces hooks that let passive-
// bucket abilities (Float, Fly, Move+1, Jump+2) modify the profile; this
// baseline is the starting point those modifiers compose over.
//
// `freeAbilities` is the set of AbilityIds whose `getCost` is 0 when the
// unit is in this class. Per design, class is just one input to per-
// character cost computation; this is its v1 hook. Future modifier
// sources (equipment, status, traits) will compose on top in their
// respective sessions.

import type {
  AbilityId,
  ClassId,
  CommandSetId,
  DamageTag,
  Gender,
  SpecialMovementType,
  TerrainType,
} from '../../types/index.ts';

export interface ClassMovementBaseline {
  readonly moveRange: number;
  readonly jump: number;
  readonly terrainCosts: ReadonlyMap<TerrainType, number>;
  readonly canEnter: ReadonlySet<TerrainType>;
  readonly specialMovement?: SpecialMovementType;
}

// Per-facing evasion baseline. Front/Side/Back follow the FFT-style
// "front cone, two side cones, back cone" facing model (see
// docs/battle-mechanics-guide.md "Evasion and accuracy"). Values are
// percentages on the [0, 99] scale; they compose with equipment and
// status-tier evasion modifiers (additive composition is v1's default).
//
// Added 13.7 ahead of session 14's evasion_check pipeline handler
// (per ADR-0019). v1 classes set zero evasion until tuning lands.
export interface ClassEvasionBaseline {
  readonly front: number;
  readonly side: number;
  readonly back: number;
}

// Per-class equipment slot allowance. v1 classes ship with all five
// slots permitted; future class content (a Wizard with no armor, a
// Monk with no weapon) sets `false` to forbid a slot. `createInitialState`
// validates that each placement's equipment lands only in permitted
// slots. Per ADR-0028.
export interface ClassEquipmentSlots {
  readonly leftHand: boolean;
  readonly rightHand: boolean;
  readonly headgear: boolean;
  readonly armor: boolean;
  readonly accessory: boolean;
}

// Per-class baseline resistances. Sparse map keyed by damage tag (signed
// values per BMG; v1 caps at ±100 per ADR-0022). Merged into each unit's
// `resistances` map at `createInitialState` time, before any per-placement
// `resistances` overrides are applied. Future status-driven resistance
// changes layer on top via the resistance composition path in
// `composeResistance`.
//
// Session 49: the Level system substrate keys its dominant-stat modifier
// off `dominantStat` — at L23 the unit's dominant stat is -1; at L27 +1.
// Mage-flavor classes declare 'ma'; physical brawlers declare 'pa'; speed
// specialists declare 'spd'. Matches `BaseStats` field names so
// `buildBaseStats` can index directly. The `classDominantStats` map
// (in src/content/classes/baseline-stats.ts) carries the same data so
// templates can apply level modifiers without a catalog lookup; a
// loader-side cross-check pins the two in sync.
export type DominantStat = 'pa' | 'ma' | 'spd';

export interface ClassDefinition {
  readonly id: ClassId;
  readonly name: string;
  readonly movement: ClassMovementBaseline;
  readonly evasion: ClassEvasionBaseline;
  readonly equipmentSlots: ClassEquipmentSlots;
  readonly firstActionCommandSet: CommandSetId;
  readonly freeAbilities: ReadonlySet<AbilityId>;
  readonly dominantStat: DominantStat;
  // The class's default gender — used both for the portrait variant when a
  // placement leaves `gender` unset AND, since the Thief's Steal Heart (which
  // gender-gates Male ↔ Female), as the *mechanical* resolved gender. A
  // default-team unit that never had a gender authored resolves to this, so
  // Steal Heart can still judge opposite-gender targeting. Every real class
  // declares it (a cross-check test pins the 12 to the UI portrait module's
  // `defaultGender`); optional only so the engine's lightweight test fixtures
  // needn't author one. Consumers fall back to `'male'` when absent.
  readonly defaultGender?: Gender;
  // Optional per-class resistance baseline. Missing = no class-level
  // resistance (the unit's resistances come entirely from the placement).
  readonly baselineResistances?: ReadonlyMap<DamageTag, number>;
}
