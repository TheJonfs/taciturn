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
  runModifyStatQuery,
  type AbilityId,
  type BattleConfig,
  type BucketId,
  type Catalog,
  type ClassId,
  type CommandSetId,
  type EquipmentSlotId,
  type ItemDefinition,
  type ItemId,
  type Loadout,
  type RulesetId,
  type UnitEquipment,
  type UnitPlacement,
} from '@engine/index.ts';
import {
  buildBaseStats,
  BRAVE_FAITH_MIN,
  BRAVE_FAITH_MAX,
  type BuiltTeam,
  type BuiltUnit,
} from '@content/teams/index.ts';
import { pickName } from '@content/names/index.ts';

// Player-facing unit names cap at 24 characters — long enough for
// "Cidolfas" or "Meliadoul"; short enough to fit the team-builder
// roster cell and the action-log line.
export const UNIT_NAME_MAX_LENGTH = 24;

// River Ridge / Mage War v1 team size. Locked at four.
export const TEAM_SIZE = 4;

// One unit under construction. `classId` is null until the player picks
// a class; while null, `loadout` is empty and the unit is invalid.
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
  readonly brave: number;
  readonly faith: number;
  readonly equipment: UnitEquipment;
  readonly loadout: Loadout;
}

export interface TeamBuilderState {
  readonly name: string;
  readonly units: readonly [DraftUnit, DraftUnit, DraftUnit, DraftUnit];
  // Which unit slot (0-3) the edit panel is focused on.
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

// A blank four-unit team — the "build from scratch" entry point. Every
// unit is classless, so the team is invalid until all four are given a
// class.
export function createEmptyTeamBuilderState(): TeamBuilderState {
  return {
    name: 'Custom Team',
    units: [
      emptyDraftUnit(),
      emptyDraftUnit(),
      emptyDraftUnit(),
      emptyDraftUnit(),
    ],
    selectedIndex: 0,
  };
}

// Load a `BuiltTeam` template into builder state. Brave / Faith are read
// back off the assembled `baseStats`; everything else copies straight
// across, including the template's authored `name`.
export function teamBuilderStateFromBuiltTeam(team: BuiltTeam): TeamBuilderState {
  const units = team.units.map(
    (unit): DraftUnit => ({
      classId: unit.classId,
      name: unit.name,
      brave: unit.baseStats.brave,
      faith: unit.baseStats.faith,
      equipment: unit.equipment,
      loadout: unit.loadout,
    }),
  );
  return {
    name: team.name,
    units: units as unknown as TeamBuilderState['units'],
    selectedIndex: 0,
  };
}

// Convert builder state back to a `BuiltTeam` — the output contract.
// Throws if any unit is still classless; the "Continue to Deployment"
// affordance gates on team validity, so reaching here with a classless
// unit is a programmer error, not a user-facing case.
export function teamBuilderStateToBuiltTeam(
  state: TeamBuilderState,
  catalog: Catalog,
): BuiltTeam {
  const units = state.units.map((unit, index): BuiltUnit => {
    if (unit.classId === null) {
      throw new Error(
        `teamBuilderStateToBuiltTeam: unit slot ${index} has no class assigned`,
      );
    }
    return {
      // `setClass` auto-picks a name on first class assignment, so an
      // active unit always carries one. The class-name fallback covers
      // any path that bypassed `setClass` (e.g., a hand-built state in
      // a test).
      name: unit.name ?? catalog.getClass(unit.classId).name,
      classId: unit.classId,
      baseStats: buildBaseStats(unit.classId, unit.brave, unit.faith),
      loadout: unit.loadout,
      equipment: unit.equipment,
    };
  });
  return {
    name: state.name,
    units: units as unknown as BuiltTeam['units'],
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
    const delta = catalog.getItem(itemId).bucketCapacityMods?.get(bucketId);
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
export function computeDraftUnitStats(
  unit: DraftUnit,
  catalog: Catalog,
  mapTemplate: BattleConfig,
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
    baseStats: buildBaseStats(unit.classId, unit.brave, unit.faith),
    loadout: unit.loadout,
    equipment: unit.equipment,
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

// ---------------------------------------------------------------------
// Mutations — each returns a new state; the input is never modified.
// ---------------------------------------------------------------------

function withUnit(
  state: TeamBuilderState,
  index: number,
  next: DraftUnit,
): TeamBuilderState {
  const units = state.units.map((unit, i) => (i === index ? next : unit));
  return { ...state, units: units as unknown as TeamBuilderState['units'] };
}

export function selectUnit(state: TeamBuilderState, index: number): TeamBuilderState {
  if (index < 0 || index >= TEAM_SIZE) {
    throw new Error(`selectUnit: index ${index} out of range [0, ${TEAM_SIZE})`);
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

export function setEquipment(
  state: TeamBuilderState,
  index: number,
  slot: EquipmentSlotId,
  itemId: ItemId | null,
): TeamBuilderState {
  const unit = state.units[index]!;
  return withUnit(state, index, {
    ...unit,
    equipment: { ...unit.equipment, [slot]: itemId },
  });
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
  readonly valid: boolean;
}

export interface TeamValidity {
  readonly units: readonly [UnitValidity, UnitValidity, UnitValidity, UnitValidity];
  // Items appearing on more than one unit of the team.
  readonly duplicateItemIds: ReadonlyArray<ItemId>;
  // Classes appearing on more than one unit of the team — a team carries
  // at most one unit of any class.
  readonly duplicateClassIds: ReadonlyArray<ClassId>;
  readonly valid: boolean;
}

function computeUnitValidity(
  unit: DraftUnit,
  catalog: Catalog,
  rulesetId: RulesetId,
): UnitValidity {
  const hasClass = unit.classId !== null;
  if (!hasClass) {
    return {
      hasClass: false,
      invalidEquipmentSlots: [],
      bucketOverages: [],
      valid: false,
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

  return {
    hasClass: true,
    invalidEquipmentSlots,
    bucketOverages,
    valid: invalidEquipmentSlots.length === 0 && bucketOverages.length === 0,
  };
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

// The full team validity predicate (plan decision 12). A team is valid
// when every unit has a class, no two units share a class, no unit has
// invalid equipment or an over-capacity bucket, and no equipment item is
// used twice on the team.
export function computeTeamValidity(
  state: TeamBuilderState,
  catalog: Catalog,
  rulesetId: RulesetId,
): TeamValidity {
  const units = state.units.map((unit) =>
    computeUnitValidity(unit, catalog, rulesetId),
  ) as unknown as TeamValidity['units'];
  const duplicateItemIds = findDuplicateItemIds(state);
  const duplicateClassIds = findDuplicateClassIds(state);
  const valid =
    units.every((unit) => unit.valid) &&
    duplicateItemIds.length === 0 &&
    duplicateClassIds.length === 0;
  return { units, duplicateItemIds, duplicateClassIds, valid };
}
