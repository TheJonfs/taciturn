// Team builder state — the editable draft a player assembles before
// deployment, plus its validity predicate.
//
// Per the Session 36 plan (decision 2A): a flat editable record, not a
// sequential state machine. Each of the four units is a `DraftUnit`
// (class, Brave/Faith, equipment, loadout); any mutation produces a new
// state and validity is re-derived on read. This module is pure — React
// wiring lives in `use-team-builder.ts`.
//
// Capacity / cost are computed here directly from the catalog rather
// than through the engine's `getCapacity` / `getCost`, which need a
// fully-built `GameState` (and `createInitialState` throws on an
// invalid loadout, so it can't double as a validity probe). For a
// pre-battle draft unit — no statuses — bucket capacity is exactly
// `ruleset baseline + Σ equipped items' bucketCapacityMods` and ability
// cost is exactly `class.freeAbilities.has(id) ? 0 : baseCost`. These
// helpers mirror that composition; `team-builder-state.test.ts` pins
// them against the real engine functions so drift fails loud, and
// `createInitialState` at the "Continue to Deployment" gate is the
// authoritative backstop.

import {
  EQUIPMENT_SLOT_IDS,
  BUCKET_FIRST_ACTION,
  BUCKET_SECONDARY_COMMAND_SETS,
  PASSIVE_BUCKET_IDS,
  ALL_BUCKET_IDS,
  EMPTY_LOADOUT,
  createInitialState,
  isEquipment,
  runModifyStatQuery,
  type AbilityId,
  type BattleConfig,
  type BucketId,
  type Catalog,
  type ClassId,
  type Gender,
  type CommandSetId,
  type EquipmentDefinition,
  type EquipmentSlotId,
  type ItemDefinition,
  type ItemId,
  type Loadout,
  type RulesetId,
  type UnitEquipment,
  type UnitPlacement,
} from '@engine/index.ts';
import { items } from '@content/index.ts';
import {
  buildBaseStats,
  slotLevelFor,
  BRAVE_FAITH_MIN,
  BRAVE_FAITH_MAX,
  MAX_TEAM_SIZE,
  MIN_TEAM_SIZE,
  type BuiltTeam,
  type BuiltUnit,
} from '@content/teams/index.ts';
import { pickName } from '@content/names/index.ts';

// Player-facing unit names cap at 24 characters — long enough for
// "Cidolfas" or "Meliadoul"; short enough to fit the team-builder
// roster cell and the action-log line.
export const UNIT_NAME_MAX_LENGTH = 24;

// S48 team-size bounds. Sourced from `@content/teams/built-team.ts` so
// content (template compliance, battle-config wiring) and the UI share
// a single constant; re-exported here for the team-builder UI's
// historic import path. Pre-S48 this was a single `TEAM_SIZE = 4`.
export { MAX_TEAM_SIZE, MIN_TEAM_SIZE };

// One unit under construction. `classId` is null until the player picks
// a class; while null, `loadout` is empty and the slot is empty (S48:
// empty = valid-but-empty rather than invalid).
//
// `name` is auto-picked from the Ivalician pool on first class
// assignment (see `setClass`) so an active unit always carries a
// display name. The player can edit it via `setUnitName`; clearing the
// input re-rolls. Templates supply their own authored names.
//
// Future-extensible per Session 38 decision 13A: `gender?: Gender` and
// `zodiac?: Zodiac` slot in alongside `name?` without restructure.
export interface DraftUnit {
  readonly classId: ClassId | null;
  readonly name?: string;
  // Session 55: cosmetic gender → portrait variant. Optional; when unset the
  // unit shows the class's default portrait. The toggle sets it explicitly.
  readonly gender?: Gender;
  readonly brave: number;
  readonly faith: number;
  readonly equipment: UnitEquipment;
  readonly loadout: Loadout;
}

export interface TeamBuilderState {
  readonly name: string;
  // Up to `MAX_TEAM_SIZE` slots; empty slots (classId === null) are
  // valid-but-empty. Pre-S48 this was a 4-tuple at the type level.
  readonly units: ReadonlyArray<DraftUnit>;
  // Which unit slot the edit panel is focused on.
  readonly selectedIndex: number;
}

const EMPTY_EQUIPMENT: UnitEquipment = {
  leftHand: null,
  rightHand: null,
  headgear: null,
  armor: null,
  accessory: null,
};

// Placement default Brave / Faith — matches `demo.ts`'s
// `SHARED_STAT_DEFAULTS`. A scratch-built unit starts here.
const DEFAULT_BRAVE = 70;
const DEFAULT_FAITH = 70;

function emptyDraftUnit(): DraftUnit {
  return {
    classId: null,
    brave: DEFAULT_BRAVE,
    faith: DEFAULT_FAITH,
    equipment: EMPTY_EQUIPMENT,
    loadout: EMPTY_LOADOUT,
  };
}

// A blank team — `MAX_TEAM_SIZE` empty slots, the "build from scratch"
// entry point. S48: empty slots are valid-but-empty; the team becomes
// valid for battle once at least one unit has a class (subject to the
// usual loadout / dual-wield / unique-per-team checks).
export function createEmptyTeamBuilderState(): TeamBuilderState {
  const units: DraftUnit[] = [];
  for (let i = 0; i < MAX_TEAM_SIZE; i++) units.push(emptyDraftUnit());
  return {
    name: 'Custom Team',
    units,
    selectedIndex: 0,
  };
}

// Load a `BuiltTeam` template into builder state. Brave / Faith are read
// back off the assembled `baseStats`; everything else copies straight
// across, including the template's authored `name`. Templates shorter
// than `MAX_TEAM_SIZE` (e.g., S38's 4-unit legacy templates) pad with
// empty slots so the builder always presents `MAX_TEAM_SIZE` rows.
export function teamBuilderStateFromBuiltTeam(team: BuiltTeam): TeamBuilderState {
  const units: DraftUnit[] = team.units.map(
    (unit): DraftUnit => ({
      classId: unit.classId,
      name: unit.name,
      ...(unit.gender !== undefined ? { gender: unit.gender } : {}),
      brave: unit.baseStats.brave,
      faith: unit.baseStats.faith,
      equipment: unit.equipment,
      loadout: unit.loadout,
    }),
  );
  while (units.length < MAX_TEAM_SIZE) units.push(emptyDraftUnit());
  return {
    name: team.name,
    units,
    selectedIndex: 0,
  };
}

// Convert builder state back to a `BuiltTeam` — the output contract.
// Empty (classless) slots are filtered out so a `BuiltTeam` only ever
// holds the team's active units. Throws when no slot has a class — that
// state should be unreachable because `computeTeamValidity` flags it,
// and the "Continue to Deployment" affordance gates on validity.
export function teamBuilderStateToBuiltTeam(
  state: TeamBuilderState,
  catalog: Catalog,
): BuiltTeam {
  const units: BuiltUnit[] = [];
  for (let index = 0; index < state.units.length; index += 1) {
    const unit = state.units[index]!;
    if (unit.classId === null) continue;
    // S71 (Chris's call): level is a fixed property of the slot *position*
    // (`slotLevelFor(index)`), not the unit's rank among filled slots.
    // Slot 0 = captain L25, ±1 outward. Placement determines level, and a
    // unit's level never shifts as other slots fill — matching the roster
    // display. (Reverses the S49 compacted scheme; empty slots no longer
    // renumber the units after them.)
    const level = slotLevelFor(index);
    units.push({
      // `setClass` auto-picks a name on first class assignment, so an
      // active unit always carries one. The class-name fallback covers
      // any path that bypassed `setClass` (e.g., a hand-built state in
      // a test).
      name: unit.name ?? catalog.getClass(unit.classId).name,
      classId: unit.classId,
      ...(unit.gender !== undefined ? { gender: unit.gender } : {}),
      baseStats: buildBaseStats(unit.classId, unit.brave, unit.faith, level),
      loadout: unit.loadout,
      equipment: unit.equipment,
      level,
    });
  }
  if (units.length < MIN_TEAM_SIZE) {
    throw new Error(
      `teamBuilderStateToBuiltTeam: team has no active units (need at least ${MIN_TEAM_SIZE})`,
    );
  }
  return {
    name: state.name,
    units,
  };
}

// ---------------------------------------------------------------------
// Loadout helpers
// ---------------------------------------------------------------------

// The class-default loadout: First Action pinned to the class's command
// set, secondary command sets empty, and each free passive ability
// dropped into its home bucket. This is what a unit's loadout resets to
// whenever its class is (re)assigned — the prior class's free abilities
// and pinned command set do not carry across a class change.
export function buildDefaultLoadout(classId: ClassId, catalog: Catalog): Loadout {
  const cls = catalog.getClass(classId);
  const passiveBuckets: Record<BucketId, ReadonlyArray<AbilityId>> = {};
  for (const bucketId of PASSIVE_BUCKET_IDS) {
    passiveBuckets[bucketId] = [];
  }
  for (const abilityId of cls.freeAbilities) {
    const ability = catalog.getAbility(abilityId);
    // `freeAbilities` includes `attack` (an active base ability); only
    // the passives belong in the passive buckets.
    if (ability.kind !== 'passive') continue;
    const existing = passiveBuckets[ability.bucket] ?? [];
    passiveBuckets[ability.bucket] = [...existing, abilityId];
  }
  return {
    actionBuckets: {
      [BUCKET_FIRST_ACTION]: [cls.firstActionCommandSet],
      [BUCKET_SECONDARY_COMMAND_SETS]: [],
    },
    passiveBuckets,
  };
}

// ---------------------------------------------------------------------
// Equipment eligibility
// ---------------------------------------------------------------------

// Does this slot accept this item kind? Hand slots take weapons or
// shields; the other three slots' names match their item kind exactly.
export function slotAcceptsKind(
  slot: EquipmentSlotId,
  kind: ItemDefinition['kind'],
): boolean {
  if (slot === 'leftHand' || slot === 'rightHand') {
    return kind === 'weapon' || kind === 'shield';
  }
  return slot === kind;
}

// Can a unit of `classId` equip `item` in `slot`? Checks slot/kind
// match, the class's slot permission, and the item's optional class
// allowlist. Mirrors `createInitialState`'s equipment-placement check.
export function classCanEquip(
  classId: ClassId,
  slot: EquipmentSlotId,
  item: ItemDefinition,
  catalog: Catalog,
): boolean {
  // Consumables aren't equipment — no slot accepts them.
  if (!isEquipment(item)) return false;
  if (!slotAcceptsKind(slot, item.kind)) return false;
  const cls = catalog.getClass(classId);
  if (!cls.equipmentSlots[slot]) return false;
  if (item.classRestrictions !== undefined && !item.classRestrictions.includes(classId)) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// Capacity / cost — see the module header on why these are local.
// ---------------------------------------------------------------------

export function draftBucketCapacity(
  equipment: UnitEquipment,
  bucketId: BucketId,
  catalog: Catalog,
  rulesetId: RulesetId,
): number {
  const ruleset = catalog.getRuleset(rulesetId);
  let capacity = ruleset.bucketCapacities.get(bucketId) ?? 0;
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const itemId = equipment[slot];
    if (itemId === null) continue;
    const item = catalog.getItem(itemId);
    if (!isEquipment(item)) continue;
    const delta = item.bucketCapacityMods?.get(bucketId);
    if (delta !== undefined) capacity += delta;
  }
  return Math.max(0, Math.floor(capacity));
}

export function draftAbilityCost(
  classId: ClassId,
  abilityId: AbilityId,
  catalog: Catalog,
): number {
  if (catalog.getClass(classId).freeAbilities.has(abilityId)) return 0;
  return catalog.getAbility(abilityId).baseCost;
}

export function draftCommandSetCost(
  commandSetId: CommandSetId,
  catalog: Catalog,
): number {
  return catalog.getCommandSet(commandSetId).baseCost;
}

// Cost used in a single bucket of a draft unit's loadout.
function bucketUsed(
  unit: DraftUnit,
  bucketId: BucketId,
  catalog: Catalog,
): number {
  if (unit.classId === null) return 0;
  if (PASSIVE_BUCKET_IDS.includes(bucketId)) {
    const abilities = unit.loadout.passiveBuckets[bucketId] ?? [];
    return abilities.reduce(
      (sum, abilityId) => sum + draftAbilityCost(unit.classId!, abilityId, catalog),
      0,
    );
  }
  const commandSets = unit.loadout.actionBuckets[bucketId] ?? [];
  return commandSets.reduce(
    (sum, commandSetId) => sum + draftCommandSetCost(commandSetId, catalog),
    0,
  );
}

export interface BucketUsage {
  readonly used: number;
  readonly capacity: number;
}

// Used cost vs. capacity for one bucket of a draft unit — the budget
// indicator the ability picker shows. Capacity reflects equipment
// (Steel Helm, Augmentor, Magus Crown) live.
export function draftBucketUsage(
  unit: DraftUnit,
  bucketId: BucketId,
  catalog: Catalog,
  rulesetId: RulesetId,
): BucketUsage {
  return {
    used: bucketUsed(unit, bucketId, catalog),
    capacity: draftBucketCapacity(unit.equipment, bucketId, catalog, rulesetId),
  };
}

// ---------------------------------------------------------------------
// Effective stats — live equipment/ability-modified values (decision 14)
// ---------------------------------------------------------------------

export interface DraftUnitStats {
  readonly maxHp: number;
  readonly maxMp: number;
  readonly pa: number;
  readonly ma: number;
  readonly spd: number;
  readonly moveRange: number;
  readonly jump: number;
}

// Compute a draft unit's *effective* stats — the equipment- and
// ability-modified values a player sees while choosing gear (decision
// 14). Builds a throwaway one-unit `BattleConfig` off the map template
// and runs the real engine `createInitialState` + `runModifyStatQuery`,
// so the numbers match what the battle will use — no reimplemented
// composition. Returns `null` when the unit has no class yet, or when
// its current loadout is invalid (over-capacity): `createInitialState`
// throws on an invalid loadout, and a draft mid-edit may briefly be in
// that state. The caller falls back to class-baseline display.
//
// S49: `level` is the unit's assigned level (slot-derived; the caller
// computes it from the draft's active-unit position via `slotLevelFor`).
// Threaded into `buildBaseStats` so the displayed stats are the
// level-adjusted values (per Session 49 / ADR-0087: effects applied
// silently — the stat panel shows the modified numbers without a
// breakdown).
export function computeDraftUnitStats(
  unit: DraftUnit,
  catalog: Catalog,
  mapTemplate: BattleConfig,
  level: number = 25,
): DraftUnitStats | null {
  if (unit.classId === null) return null;
  // Any authored placement supplies a valid id / team / on-map position
  // for the throwaway config — the unit never reaches a battle, the
  // position only has to pass `createInitialState`'s structural checks.
  const slot = mapTemplate.units[0];
  if (slot === undefined) return null;
  const placement: UnitPlacement = {
    id: slot.id,
    name: catalog.getClass(unit.classId).name,
    team: slot.team,
    classId: unit.classId,
    position: slot.position,
    facing: slot.facing,
    baseStats: buildBaseStats(unit.classId, unit.brave, unit.faith, level),
    loadout: unit.loadout,
    equipment: unit.equipment,
    level,
  };
  const config: BattleConfig = { ...mapTemplate, units: [placement] };

  let resolved;
  try {
    resolved = createInitialState(config, catalog);
  } catch {
    // Invalid loadout (over-capacity, mid-edit). The validity panel
    // surfaces the reason; stats fall back to baseline at the call site.
    return null;
  }

  const built = resolved.units.get(slot.id)!;
  const movement = catalog.getClass(unit.classId).movement;
  const query = (statName: Parameters<typeof runModifyStatQuery>[2]['statName'], baseValue: number): number =>
    runModifyStatQuery(resolved, catalog, { unit: built, statName, baseValue });
  return {
    // `createInitialState`'s fillVitalsFromComputedMaxes already ran the
    // maxHp / maxMp queries (the placement omits explicit vitals).
    maxHp: built.vitals.hp,
    maxMp: built.vitals.mp,
    pa: query('pa', built.baseStats.pa),
    ma: query('ma', built.baseStats.ma),
    spd: query('spd', built.baseStats.spd),
    moveRange: query('moveRange', movement.moveRange),
    jump: query('jump', movement.jump),
  };
}

// The level of slot `index` — a fixed property of the slot *position*
// (S71 playtest, Chris's call): slot 0 = L25, then ±1 outward per
// `slotLevelFor` (1→24, 2→26, 3→23, 4→27). A unit placed here gets this
// level regardless of how many other slots are filled or in what order, so
// the roster shows the correct level in each slot all the way — no
// shifting as the team fills. Empty slots still have a level (it's the
// slot's, shown as a preview); the caller distinguishes filled vs empty by
// `unit.classId`. Replaces the prior fill-order (compacted) scheme.
export function slotLevel(index: number): number {
  return slotLevelFor(index);
}

// ---------------------------------------------------------------------
// Mutations — each returns a new state; the input is never modified.
// ---------------------------------------------------------------------

function withUnit(
  state: TeamBuilderState,
  index: number,
  next: DraftUnit,
): TeamBuilderState {
  const units = state.units.map((unit, i) => (i === index ? next : unit));
  return { ...state, units };
}

export function selectUnit(state: TeamBuilderState, index: number): TeamBuilderState {
  if (index < 0 || index >= state.units.length) {
    throw new Error(
      `selectUnit: index ${index} out of range [0, ${state.units.length})`,
    );
  }
  return { ...state, selectedIndex: index };
}

// Names already assigned to other units in the team — the exclusion
// set the picker reads when auto-rolling a new unit's name.
function siblingNames(
  state: TeamBuilderState,
  excludeIndex: number,
): Set<string> {
  const names = new Set<string>();
  state.units.forEach((unit, i) => {
    if (i === excludeIndex) return;
    if (unit.name !== undefined) names.add(unit.name);
  });
  return names;
}

// Assign (or reassign) a class to a unit. The loadout resets to that
// class's default — First Action is class-pinned and the free-ability
// set differs per class, so a prior loadout cannot carry across. Any
// equipped item the new class cannot use is cleared, keeping the draft's
// equipment always class-valid (the same invariant the filtered
// dropdowns maintain).
//
// First class assignment also auto-rolls an Ivalician name, so an
// active unit always carries a display name. Subsequent class changes
// leave the existing name alone — Cidolfas is Cidolfas whether they're
// a Knight or a Mage. The player can re-roll by clearing the name input
// (see `setUnitName`).
export function setClass(
  state: TeamBuilderState,
  index: number,
  classId: ClassId,
  catalog: Catalog,
): TeamBuilderState {
  const unit = state.units[index]!;
  let clearedEquipment: UnitEquipment = unit.equipment;
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const itemId = clearedEquipment[slot];
    if (itemId === null) continue;
    if (!classCanEquip(classId, slot, catalog.getItem(itemId), catalog)) {
      clearedEquipment = { ...clearedEquipment, [slot]: null };
    }
  }
  const name = unit.name ?? pickName(siblingNames(state, index));
  return withUnit(state, index, {
    ...unit,
    classId,
    name,
    equipment: clearedEquipment,
    loadout: buildDefaultLoadout(classId, catalog),
  });
}

// Set a unit's display name. Trims input and caps length at
// `UNIT_NAME_MAX_LENGTH`. Empty (after trim) re-rolls a fresh
// Ivalician name excluding sibling names, so the field never holds
// `undefined` for an active unit — clearing the input is the player's
// re-roll affordance.
export function setUnitName(
  state: TeamBuilderState,
  index: number,
  name: string,
): TeamBuilderState {
  const unit = state.units[index]!;
  const trimmed = name.trim();
  if (trimmed === '') {
    // Pick excluding sibling names AND the current name (so the re-roll
    // produces something different).
    const excluded = siblingNames(state, index);
    if (unit.name !== undefined) excluded.add(unit.name);
    return withUnit(state, index, { ...unit, name: pickName(excluded) });
  }
  const capped = trimmed.slice(0, UNIT_NAME_MAX_LENGTH);
  return withUnit(state, index, { ...unit, name: capped });
}

// Session 55: set a unit's cosmetic gender (portrait variant). Stored
// explicitly on the draft so it persists across class changes and serializes
// into the BuiltTeam; the portrait the renderer/builder shows is
// `unit.gender ?? defaultGenderFor(classId)`.
export function setUnitGender(
  state: TeamBuilderState,
  index: number,
  gender: Gender,
): TeamBuilderState {
  const unit = state.units[index]!;
  return withUnit(state, index, { ...unit, gender });
}

export function setEquipment(
  state: TeamBuilderState,
  index: number,
  slot: EquipmentSlotId,
  itemId: ItemId | null,
  catalog: Catalog,
): TeamBuilderState {
  const unit = state.units[index]!;
  let equipment = { ...unit.equipment, [slot]: itemId };
  // Session 45: a two-handed weapon (the bow class) occupies both hands —
  // placing one clears the off-hand so the equipment never lands in the
  // illegal "two-handed + off-hand item" state the engine rejects. S62: skip
  // the clear when the unit has Monkeygrip (relaxesTwoHandedGrip) — then a
  // two-hander + off-hand item is legal, so keep whatever's in the off-hand.
  if (
    (slot === 'leftHand' || slot === 'rightHand') &&
    itemId !== null &&
    !unitGrantsTwoHandedGrip(unit, catalog)
  ) {
    const item = catalog.getItem(itemId);
    if (item.kind === 'weapon' && item.twoHanded === true) {
      const otherHand: EquipmentSlotId = slot === 'leftHand' ? 'rightHand' : 'leftHand';
      equipment = { ...equipment, [otherHand]: null };
    }
  }
  return withUnit(state, index, { ...unit, equipment });
}

function clampBraveFaith(value: number): number {
  return Math.max(BRAVE_FAITH_MIN, Math.min(BRAVE_FAITH_MAX, Math.round(value)));
}

export function setBrave(
  state: TeamBuilderState,
  index: number,
  value: number,
): TeamBuilderState {
  const unit = state.units[index]!;
  return withUnit(state, index, { ...unit, brave: clampBraveFaith(value) });
}

export function setFaith(
  state: TeamBuilderState,
  index: number,
  value: number,
): TeamBuilderState {
  const unit = state.units[index]!;
  return withUnit(state, index, { ...unit, faith: clampBraveFaith(value) });
}

// Toggle a passive ability in one of the R/S/M buckets. Adding appends
// (equip order is the hook-dispatch tiebreak); removing drops it. Pure
// data op — over-capacity is reported by `computeTeamValidity`, and the
// UI disables the add affordance when the budget is exhausted.
export function togglePassive(
  state: TeamBuilderState,
  index: number,
  bucketId: BucketId,
  abilityId: AbilityId,
): TeamBuilderState {
  const unit = state.units[index]!;
  const current = unit.loadout.passiveBuckets[bucketId] ?? [];
  const next = current.includes(abilityId)
    ? current.filter((id) => id !== abilityId)
    : [...current, abilityId];
  return withUnit(state, index, {
    ...unit,
    loadout: {
      ...unit.loadout,
      passiveBuckets: { ...unit.loadout.passiveBuckets, [bucketId]: next },
    },
  });
}

// Toggle a secondary command set. First Action is class-pinned and is
// never touched here — only the `secondary_command_sets` bucket.
export function toggleSecondaryCommandSet(
  state: TeamBuilderState,
  index: number,
  commandSetId: CommandSetId,
): TeamBuilderState {
  const unit = state.units[index]!;
  const current = unit.loadout.actionBuckets[BUCKET_SECONDARY_COMMAND_SETS] ?? [];
  const next = current.includes(commandSetId)
    ? current.filter((id) => id !== commandSetId)
    : [...current, commandSetId];
  return withUnit(state, index, {
    ...unit,
    loadout: {
      ...unit.loadout,
      actionBuckets: {
        ...unit.loadout.actionBuckets,
        [BUCKET_SECONDARY_COMMAND_SETS]: next,
      },
    },
  });
}

// ---------------------------------------------------------------------
// Validity
// ---------------------------------------------------------------------

export interface BucketOverage {
  readonly bucketId: BucketId;
  readonly used: number;
  readonly capacity: number;
}

export interface UnitValidity {
  readonly hasClass: boolean;
  // Slots whose equipped item the unit's class cannot use (wrong kind,
  // slot not permitted, or class-restricted).
  readonly invalidEquipmentSlots: ReadonlyArray<EquipmentSlotId>;
  // Buckets whose equipped cost exceeds capacity.
  readonly bucketOverages: ReadonlyArray<BucketOverage>;
  // True when both hand slots hold a weapon. v1 disallows dual-wield;
  // a future ability will unlock it (and a separate two-handed grip
  // bonus). A shield + weapon combination is fine.
  readonly dualWielding: boolean;
  // Session 45: true when a two-handed weapon (a bow) shares a hand with
  // any off-hand item — the engine rejects this combination. The picker
  // normally prevents it (auto-clearing the off-hand), so this guards
  // loaded templates / edge states.
  readonly twoHandedConflict: boolean;
  // S48: a unit is valid when it has no rule violations. An empty
  // (classless) slot is valid-but-empty — the slot doesn't contribute
  // any active unit, but it also doesn't fail validation.
  readonly valid: boolean;
}

export interface TeamValidity {
  readonly units: ReadonlyArray<UnitValidity>;
  // Items appearing on more than one unit of the team.
  readonly duplicateItemIds: ReadonlyArray<ItemId>;
  // Classes appearing on more than one unit of the team — a team carries
  // at most one unit of any class.
  readonly duplicateClassIds: ReadonlyArray<ClassId>;
  // S48: number of non-empty (class-assigned) slots. A team is valid for
  // battle when this is at least `MIN_TEAM_SIZE` and at most
  // `MAX_TEAM_SIZE`, in addition to per-unit / team-level rule checks.
  readonly activeUnitCount: number;
  readonly valid: boolean;
}

function computeUnitValidity(
  unit: DraftUnit,
  catalog: Catalog,
  rulesetId: RulesetId,
): UnitValidity {
  const hasClass = unit.classId !== null;
  if (!hasClass) {
    // S48: empty slot — no class, no equipment, no rule violations.
    // Valid-but-empty so the team's overall validity is unaffected by
    // leftover slots beyond the player's chosen unit count.
    return {
      hasClass: false,
      invalidEquipmentSlots: [],
      bucketOverages: [],
      dualWielding: false,
      twoHandedConflict: false,
      valid: true,
    };
  }
  const classId = unit.classId!;

  const invalidEquipmentSlots: EquipmentSlotId[] = [];
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const itemId = unit.equipment[slot];
    if (itemId === null) continue;
    if (!classCanEquip(classId, slot, catalog.getItem(itemId), catalog)) {
      invalidEquipmentSlots.push(slot);
    }
  }

  const bucketOverages: BucketOverage[] = [];
  for (const bucketId of ALL_BUCKET_IDS) {
    const used = bucketUsed(unit, bucketId, catalog);
    const capacity = draftBucketCapacity(unit.equipment, bucketId, catalog, rulesetId);
    if (used > capacity) {
      bucketOverages.push({ bucketId, used, capacity });
    }
  }

  const dualWielding = isDualWielding(unit, catalog);
  const twoHandedConflict = isTwoHandedConflict(unit, catalog);

  return {
    hasClass: true,
    invalidEquipmentSlots,
    bucketOverages,
    dualWielding,
    twoHandedConflict,
    valid:
      invalidEquipmentSlots.length === 0 &&
      bucketOverages.length === 0 &&
      !dualWielding &&
      !twoHandedConflict,
  };
}

// Illegal-dual-wield detection — true when both hand slots hold a weapon
// AND the unit lacks a dual-wield-granting passive. One weapon + one
// shield is always fine. Session 42: Two Weapons (any passive with a
// `modifyDualWield` hook) lifts the restriction, so a unit carrying it
// may legally hold a weapon in each hand. Detected content-agnostically
// (no hard-coded ability id); `passiveBuckets` already folds in the
// class's free abilities, so the native Assassin and a cross-class equip
// both resolve here.
function isDualWielding(unit: DraftUnit, catalog: Catalog): boolean {
  const left = unit.equipment.leftHand;
  const right = unit.equipment.rightHand;
  if (left === null || right === null) return false;
  const bothWeapons =
    catalog.getItem(left).kind === 'weapon' &&
    catalog.getItem(right).kind === 'weapon';
  if (!bothWeapons) return false;
  return !unitGrantsDualWield(unit, catalog);
}

// Session 45: true when a two-handed weapon shares a hand with any
// off-hand item (weapon or shield) — the engine's slotting validation
// rejects this. Mirrors `validateEquipmentPlacement`'s two-handed rule.
function isTwoHandedConflict(unit: DraftUnit, catalog: Catalog): boolean {
  // Monkeygrip (relaxesTwoHandedGrip, ADR-0100) lifts the rule — a two-hander
  // may share a hand with an off-hand item. Mirrors the engine validator and
  // the equipment picker's gate, so the validity panel agrees with both.
  if (unitGrantsTwoHandedGrip(unit, catalog)) return false;
  const left = unit.equipment.leftHand;
  const right = unit.equipment.rightHand;
  const isTwoHanded = (id: ItemId | null): boolean => {
    if (id === null) return false;
    const item = catalog.getItem(id);
    return item.kind === 'weapon' && item.twoHanded === true;
  };
  if (isTwoHanded(right) && left !== null) return true;
  if (isTwoHanded(left) && right !== null) return true;
  return false;
}

// True when any equipped passive declares `relaxesTwoHandedGrip`
// (Monkeygrip) — a two-hander may then share a hand with an off-hand
// item. Mirrors the engine's `validateEquipmentPlacement` (ADR-0100).
// Exported as the single UI-side source: the validity checker, the
// equipment picker, and `equipmentOptionsForSlot` all read it (the old
// per-component copies are gone).
export function unitGrantsTwoHandedGrip(unit: DraftUnit, catalog: Catalog): boolean {
  for (const abilityIds of Object.values(unit.loadout.passiveBuckets)) {
    for (const aid of abilityIds) {
      const ability = catalog.getAbility(aid);
      if (ability.kind === 'passive' && ability.relaxesTwoHandedGrip === true) {
        return true;
      }
    }
  }
  return false;
}

// True when any equipped passive registers a `modifyDualWield` hook
// (Two Weapons) — both hands may then hold a weapon. Content-agnostic
// (no hard-coded id). The single UI-side source, shared by the validity
// checker, the picker, and `equipmentOptionsForSlot`.
export function unitGrantsDualWield(unit: DraftUnit, catalog: Catalog): boolean {
  for (const abilityIds of Object.values(unit.loadout.passiveBuckets)) {
    for (const aid of abilityIds) {
      const ability = catalog.getAbility(aid);
      if (ability.kind === 'passive' && ability.hooks.some((h) => h.name === 'modifyDualWield')) {
        return true;
      }
    }
  }
  return false;
}

// All equipment the picker can ever offer: available, equippable items
// (consumables and hidden items excluded). `classCanEquip` narrows
// further per slot/class at enumeration time.
const AVAILABLE_EQUIPMENT: ReadonlyArray<EquipmentDefinition> = items.filter(
  (item): item is EquipmentDefinition =>
    isEquipment(item) && item.availability === 'available',
);

// The legal equipment options for one slot of one unit — the picker's
// candidate list. Encapsulates every gate the old per-slot dropdown
// applied inline: class eligibility, unique-per-team (an item equipped
// anywhere on the team is dropped, except this slot's own current item,
// which stays selectable), the two-handed off-hand lock (relaxed by
// Monkeygrip), and the dual-wield off-hand gate (lifted by Two Weapons).
// Mirrors the engine's `validateEquipmentPlacement`; the new grouped
// picker and any future caller read this one function instead of
// re-deriving the rules. Returns creation order; the picker sorts.
export function equipmentOptionsForSlot(
  state: TeamBuilderState,
  unit: DraftUnit,
  slot: EquipmentSlotId,
  catalog: Catalog,
): ReadonlyArray<EquipmentDefinition> {
  const classId = unit.classId;
  if (classId === null) return [];

  const dualWieldEnabled = unitGrantsDualWield(unit, catalog);
  const gripRelaxed = unitGrantsTwoHandedGrip(unit, catalog);
  const currentItemId = unit.equipment[slot];

  // Every item equipped anywhere on the team (unique-per-team pool).
  const usedByOthers = new Set<ItemId>();
  for (const u of state.units) {
    for (const s of EQUIPMENT_SLOT_IDS) {
      const id = u.equipment[s];
      if (id !== null) usedByOthers.add(id);
    }
  }

  // The off-hand's contents gate this hand (two-handed lock / dual-wield).
  const otherHand: EquipmentSlotId | null =
    slot === 'leftHand' ? 'rightHand' : slot === 'rightHand' ? 'leftHand' : null;
  const otherHandItemId = otherHand !== null ? unit.equipment[otherHand] : null;
  const otherHandItem =
    otherHandItemId !== null ? catalog.getItem(otherHandItemId) : null;
  const otherHandHasWeapon = otherHandItem?.kind === 'weapon';
  const otherHandTwoHanded =
    otherHandItem?.kind === 'weapon' && otherHandItem.twoHanded === true;

  return AVAILABLE_EQUIPMENT.filter((item) => {
    if (!classCanEquip(classId, slot, item, catalog)) return false;
    // Keep the slot's current item; drop anything used elsewhere.
    if (item.id === currentItemId) return true;
    if (usedByOthers.has(item.id)) return false;
    // Two-handed off-hand lock — nothing fits beside a two-hander unless
    // Monkeygrip relaxes it.
    if (otherHandTwoHanded && !gripRelaxed) return false;
    // Dual-wield gate — no second weapon for the off-hand without Two Weapons.
    if (otherHandHasWeapon && item.kind === 'weapon' && !dualWieldEnabled) return false;
    return true;
  });
}

// Items appearing on more than one unit — the unique-per-team rule's
// violation list. Cross-slot duplicates count (a weapon on two units is
// a violation regardless of which hand).
function findDuplicateItemIds(state: TeamBuilderState): ItemId[] {
  const counts = new Map<ItemId, number>();
  for (const unit of state.units) {
    for (const slot of EQUIPMENT_SLOT_IDS) {
      const itemId = unit.equipment[slot];
      if (itemId === null) continue;
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

// Classes appearing on more than one unit — a team carries at most one
// unit of any class. Classless units are skipped.
function findDuplicateClassIds(state: TeamBuilderState): ClassId[] {
  const counts = new Map<ClassId, number>();
  for (const unit of state.units) {
    if (unit.classId === null) continue;
    counts.set(unit.classId, (counts.get(unit.classId) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
}

// The full team validity predicate (plan decision 12; S48-extended).
// A team is valid when:
//   - at least `MIN_TEAM_SIZE` and at most `MAX_TEAM_SIZE` slots are
//     active (have a class assigned);
//   - every active unit passes `computeUnitValidity` (empty slots are
//     valid-but-empty);
//   - no two units share a class;
//   - no equipment item is used twice on the team.
export function computeTeamValidity(
  state: TeamBuilderState,
  catalog: Catalog,
  rulesetId: RulesetId,
): TeamValidity {
  const units: ReadonlyArray<UnitValidity> = state.units.map((unit) =>
    computeUnitValidity(unit, catalog, rulesetId),
  );
  const duplicateItemIds = findDuplicateItemIds(state);
  const duplicateClassIds = findDuplicateClassIds(state);
  const activeUnitCount = state.units.reduce(
    (n, u) => n + (u.classId !== null ? 1 : 0),
    0,
  );
  const sizeOk =
    activeUnitCount >= MIN_TEAM_SIZE && activeUnitCount <= MAX_TEAM_SIZE;
  const valid =
    sizeOk &&
    units.every((unit) => unit.valid) &&
    duplicateItemIds.length === 0 &&
    duplicateClassIds.length === 0;
  return {
    units,
    duplicateItemIds,
    duplicateClassIds,
    activeUnitCount,
    valid,
  };
}
