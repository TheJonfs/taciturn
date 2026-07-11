// TABA economy — recruitment, the gil sink (M3 economy brief, Stage 3).
//
// Hire a GENERIC at a chosen level, hard-capped at the party's current
// average (§6 framework: a hire tops out at what an organic unit *starts*
// becoming — the whole convenience-premium philosophy rests on this cap).
// Priced by a config curve; a high-level hire arrives with a Tier-1 JP
// signing bonus (functional on arrival, not a stat-shell) — the tree stays
// earned.
//
// The hire is a REAL generic through the existing doors:
//   - Tier-1 class + its standard starting kit (`seedStartingKit`, the same
//     seeding a campaign-start unit gets);
//   - starting gear chosen BY the draft-legality resolver (first legal
//     candidate per slot via `slotIneligibilityReason` — legal by
//     construction, not by hand-audit), entering through `grantItems`
//     (receipt stays the one door);
//   - vitals at effective full via the same probe the campaign-start
//     bootstrap uses (needs the hub node's battlefield to size against —
//     the documented bootstrapRosterVitals constraint).

import {
  EMPTY_UNIT_EQUIPMENT,
  bucketId,
  itemId,
  slotIneligibilityReason,
  unitId,
  type Catalog,
  type ClassId,
  type EquipmentSlotId,
  type ItemId,
  type Loadout,
  type UnitEquipment,
} from '@engine/index.ts';
import {
  HIRE_COST_BASE,
  HIRE_COST_PER_LEVEL,
  HIRE_JP_TIER1_STEPS,
} from './economy-config.ts';
import { partyAverageLevel } from './enemy-level.ts';
import { storyBeatIdOf, type CampaignNode } from './graph.ts';
import { grantItems } from './inventory.ts';
import { spendGil } from './gil.ts';
import { COMPONENT_CATALOG, classesInSlot, seedStartingKit, tierSlot } from './progression/index.ts';
import { firstBattleBeat } from './sequence.ts';
import { probeEffectiveMaxes } from './snapshot-fold.ts';
import { EMPTY_EARNED_BY_CLASS, type CampaignState, type CampaignUnit } from './types.ts';

// The classes a hub will hire out: Tier 1, both halves (the tier map is the
// source — a new Tier-1 class becomes hireable by existing).
export function hireableClasses(): ReadonlyArray<ClassId> {
  return [...classesInSlot(tierSlot('physical', 1)), ...classesInSlot(tierSlot('magical', 1))];
}

// The hire-level cap: the party's current average (active units). The UI
// caps its picker here; `hireGeneric` re-validates loudly.
export function maxHireLevel(state: CampaignState): number {
  return partyAverageLevel(state.roster);
}

// The gil price for a level-L hire (config curve; placeholder).
export function hireCost(level: number): number {
  return HIRE_COST_BASE + HIRE_COST_PER_LEVEL * level;
}

// The Tier-1 JP signing bonus for a level-L hire: the highest config step at
// or below L (0 below the first step).
export function hireJpBonus(level: number): number {
  let bonus = 0;
  for (const step of HIRE_JP_TIER1_STEPS) {
    if (level >= step.minLevel && step.jp > bonus) bonus = step.jp;
  }
  return bonus;
}

// Starter-gear candidates, tried in order per slot — all Ch1-band shop
// staples. The RESOLVER picks: the first candidate the class may legally
// wear in that slot (slotIneligibilityReason === null) wins, so the kit is
// legal by construction and a class with no legal candidate simply gets an
// empty slot (legal by absence).
const STARTER_CANDIDATES: Readonly<Partial<Record<EquipmentSlotId, ReadonlyArray<string>>>> = {
  rightHand: ['iron_sword', 'cutlass', 'woodmans_axe', 'dagger', 'short_bow', 'wand_of_depths', 'staff_of_abundance'],
  armor: ['padded_vest', 'chain_shirt', 'padded_jacket', 'linen_robe', 'arcane_robe'],
};

export function starterGearFor(classId: ClassId, catalog: Catalog): ReadonlyArray<readonly [EquipmentSlotId, ItemId]> {
  const picks: Array<readonly [EquipmentSlotId, ItemId]> = [];
  for (const [slot, candidates] of Object.entries(STARTER_CANDIDATES) as Array<
    [EquipmentSlotId, ReadonlyArray<string>]
  >) {
    for (const raw of candidates) {
      const id = itemId(raw);
      if (!catalog.hasItem(id)) continue;
      if (slotIneligibilityReason(classId, slot, catalog.getItem(id), catalog) === null) {
        picks.push([slot, id]);
        break;
      }
    }
  }
  return picks;
}

// Placeholder name pool for generics (indexed by roster size; a repeat gets
// a numeral suffix so the barracks stays readable).
const HIRE_NAMES: ReadonlyArray<string> = [
  'Bram', 'Odette', 'Fenwick', 'Isolde', 'Corin', 'Maren',
  'Tobias', 'Elsbeth', 'Garrick', 'Nyra', 'Piers', 'Sable',
];

function hireName(state: CampaignState): string {
  const base = HIRE_NAMES[state.roster.length % HIRE_NAMES.length]!;
  const taken = state.roster.filter((u) => u.name === base || u.name.startsWith(`${base} `)).length;
  return taken === 0 ? base : `${base} ${taken + 1}`;
}

export interface HireSpec {
  readonly classId: ClassId;
  readonly level: number;
}

// Build the hire as a durable CampaignUnit (pure — no wallet/inventory
// effects; `hireGeneric` composes those). Exported so the UI can preview the
// exact unit (probeUnitStats on this) before committing gil.
export function buildHire(state: CampaignState, spec: HireSpec, catalog: Catalog): CampaignUnit {
  const classDef = catalog.getClass(spec.classId);
  const loadout: Loadout = {
    actionBuckets: { [bucketId('first_action')]: [classDef.firstActionCommandSet] },
    passiveBuckets: {},
  };
  const kit = seedStartingKit(spec.classId, loadout, catalog, COMPONENT_CATALOG);

  let equipment: UnitEquipment = EMPTY_UNIT_EQUIPMENT;
  for (const [slot, id] of starterGearFor(spec.classId, catalog)) {
    equipment = { ...equipment, [slot]: id };
  }

  // The Tier-1 signing bonus banks into the hire's own class pool.
  const bonus = hireJpBonus(spec.level);
  const earnedByClass =
    bonus > 0
      ? { ...kit.earnedByClass, [String(spec.classId)]: (kit.earnedByClass[String(spec.classId)] ?? 0) + bonus }
      : (Object.keys(kit.earnedByClass).length > 0 ? kit.earnedByClass : EMPTY_EARNED_BY_CLASS);

  const unit: CampaignUnit = {
    // Roster length only grows (lost units are retained), so it mints a
    // collision-free, deterministic id.
    id: unitId(`hire-${state.roster.length + 1}-${String(spec.classId)}`),
    name: hireName(state),
    classId: spec.classId,
    level: spec.level,
    brave: 70,
    faith: 70,
    loadout,
    equipment,
    // Provisional; hireGeneric heals to effective full via the probe.
    vitals: { hp: 1, mp: 1 },
    xp: 0,
    earnedByClass,
    unlocks: kit.unlocks,
    fate: 'active',
  };
  const gender = classDef.defaultGender;
  return gender !== undefined ? { ...unit, gender } : unit;
}

// Execute the hire at `node` (the hub the player stands at): validate the
// class/level/cap, debit the curve price, receive the starter gear through
// the receipt door, and add the unit at effective-full vitals (probed
// against the hub's own battlefield — fail loud if it has none, the same
// constraint the campaign-start bootstrap documents).
export function hireGeneric(
  state: CampaignState,
  node: CampaignNode,
  spec: HireSpec,
  catalog: Catalog,
): CampaignState {
  if (!hireableClasses().includes(spec.classId)) {
    throw new Error(`hireGeneric: ${JSON.stringify(String(spec.classId))} is not a hireable (Tier-1) class`);
  }
  const cap = maxHireLevel(state);
  if (!Number.isInteger(spec.level) || spec.level < 1 || spec.level > cap) {
    throw new Error(`hireGeneric: level ${spec.level} is out of range (1..${cap} — capped at party average)`);
  }
  const beat = firstBattleBeat(node.beats);
  if (beat === undefined) {
    throw new Error(
      `hireGeneric: hub "${node.id}" (beat ${storyBeatIdOf(node)}) has no battlefield to size the hire's vitals against`,
    );
  }

  const hire = buildHire(state, spec, catalog);

  // Wallet out, gear in (receipt), unit on the roster at effective full.
  let next = spendGil(state, hireCost(spec.level));
  const gear = starterGearFor(spec.classId, catalog).map(([, id]) => [id, 1] as const);
  next = grantItems(next, gear);

  const maxes = probeEffectiveMaxes(beat.battle.template, [hire], beat.battle.playerTeam, catalog);
  const healed: CampaignUnit = { ...hire, vitals: maxes.get(hire.id)! };
  return { ...next, roster: [...next.roster, healed] };
}
