// TABA Chapter 1 — the real campaign-start roster + the staggered plot joins.
//
// Replaces the M1 test roster (five L25 plot leads + three veterans) as the
// campaign's starting party per the Ch1 authoring brief: only Lumen and
// Chris are seeded at start, at LEVEL 1 with starter-band gear; four
// generics are ROLLED at campaign start (names/genders/Brave/Faith from the
// rng; classes fixed); Clio/Thessaly/Sera are NOT seeded — they join
// mid-chapter through the runtime `joinPlotUnit` mechanism (ADR-0149 WI4),
// authored here as fixed-level join units.
//
// Kit convention: every unit built here carries its class starting kit
// EXPLICITLY (`seedStartingKit` at build time) rather than relying on
// `startCampaign`'s auto-seed — the join units never pass through
// campaign-start seeding, and Chris's authored Alchemist JP trickle would
// make the auto-seed skip him (it treats any earned JP as "already
// authored"). Building all of them through one door keeps the whole cast
// uniform. This matches the hire tool's convention: a Tier-1 unit arrives
// with its class kit unlocked; the tree beyond stays earned.
//
// The M1 roster (`m1Roster` — L25 leads + Alice/Miluda/Can'tano) stays
// authored in roster.ts for debug harnesses, and Miluda is slated to join
// in Chapter 2.

import {
  EMPTY_UNIT_EQUIPMENT,
  abilityId,
  bucketId,
  classId,
  itemId,
  unitId,
  type AbilityId,
  type Catalog,
  type ClassId,
  type Gender,
  type Loadout,
  type UnitEquipment,
} from '@engine/index.ts';
import { buildBaseStats } from '@content/teams/index.ts';
import { PLOT_UNIT_IDS } from './plot-unit-ids.ts';
import { HIRE_NAMES, starterGearFor } from './recruit.ts';
import { COMPONENT_CATALOG, seedStartingKit } from './progression/index.ts';
import { EMPTY_EARNED_BY_CLASS, type CampaignUnit } from './types.ts';

const FIRST_ACTION = bucketId('first_action');
const SUPPORT = bucketId('support');

// Everyone starts at the bottom of the curve; the chapter's offsets and the
// XP rubber-band do the rest.
export const CH1_START_LEVEL = 1;

// Chris's Alchemist dispensation: enough banked JP to buy a first ability
// after reclassing ("a trickle... so he can switch around"), sized to the
// low end of Tier-1 component costs. Placeholder — tune with the economy.
export const CH1_CHRIS_ALCHEMIST_JP = 100;

// Authored Brave/Faith for the named cast (the generics roll theirs).
const NAMED_BRAVE = 70;
const NAMED_FAITH = 70;

// The roll band for generic Brave/Faith (Chris: 50–70 inclusive).
const ROLL_MIN = 50;
const ROLL_MAX = 70;

// The four fixed generic classes: with Lumen (Pyromancer) and Clio
// (Hydrologist, joining at Alvera) covering the other two Tier-1 slots, the
// opening party rounds out the whole tier.
export const CH1_GENERIC_CLASSES: ReadonlyArray<ClassId> = [
  classId('alchemist'),
  classId('hunter'),
  classId('monk'),
  classId('earth_mage'),
];

interface Ch1UnitSpec {
  readonly id: string;
  readonly name: string;
  readonly classId: ClassId;
  readonly level: number;
  readonly equipment: UnitEquipment;
  readonly brave?: number;
  readonly faith?: number;
  readonly gender?: Gender;
  // A free innate signature passive, equipped in the support bucket
  // (baseCost 0 — the plot leads' authored identity, unchanged from the
  // L25 versions).
  readonly innate?: AbilityId;
  readonly portrait?: string;
  readonly classAccessOverride?: ReadonlyArray<ClassId>;
  // Extra banked JP merged over the seeded kit's spend (Chris's trickle).
  readonly extraJp?: Readonly<Record<string, number>>;
}

// The one door every Ch1 authored unit is built through: class first-action
// loadout (+ optional innate), the class starting kit seeded explicitly,
// provisional base-max vitals (the campaign-start bootstrap / join probe
// normalizes to effective full).
function ch1Unit(spec: Ch1UnitSpec, catalog: Catalog): CampaignUnit {
  const brave = spec.brave ?? NAMED_BRAVE;
  const faith = spec.faith ?? NAMED_FAITH;
  const loadout: Loadout = {
    actionBuckets: { [FIRST_ACTION]: [catalog.getClass(spec.classId).firstActionCommandSet] },
    passiveBuckets: spec.innate !== undefined ? { [SUPPORT]: [spec.innate] } : {},
  };
  const kit = seedStartingKit(spec.classId, loadout, catalog, COMPONENT_CATALOG);
  let earnedByClass =
    Object.keys(kit.earnedByClass).length > 0 ? kit.earnedByClass : EMPTY_EARNED_BY_CLASS;
  if (spec.extraJp !== undefined) {
    const merged: Record<string, number> = { ...earnedByClass };
    for (const [cls, jp] of Object.entries(spec.extraJp)) {
      merged[cls] = (merged[cls] ?? 0) + jp;
    }
    earnedByClass = merged;
  }
  const stats = buildBaseStats(spec.classId, brave, faith, spec.level);

  const unit: CampaignUnit = {
    id: unitId(spec.id),
    name: spec.name,
    classId: spec.classId,
    level: spec.level,
    brave,
    faith,
    loadout,
    equipment: spec.equipment,
    vitals: { hp: stats.maxHpBase, mp: stats.maxMpBase },
    xp: 0,
    earnedByClass,
    unlocks: kit.unlocks,
    fate: 'active',
  };
  const withGender: CampaignUnit = spec.gender !== undefined ? { ...unit, gender: spec.gender } : unit;
  const withPortrait: CampaignUnit =
    spec.portrait !== undefined ? { ...withGender, portrait: spec.portrait } : withGender;
  return spec.classAccessOverride !== undefined
    ? { ...withPortrait, classAccessOverride: spec.classAccessOverride }
    : withPortrait;
}

// --- The two seeded leads ----------------------------------------------------

// Lumen — L1 Pyromancer. Wand of Lumen (her matching element wand — a
// granted starting loadout, not shop stock) + a Zarghidas body. Innate:
// Ascendant Flame (chapter-scaling fire ×).
function lumenAtStart(catalog: Catalog): CampaignUnit {
  return ch1Unit(
    {
      id: String(PLOT_UNIT_IDS.lumen),
      name: 'Lumen',
      classId: classId('fire_mage'),
      level: CH1_START_LEVEL,
      gender: 'female',
      innate: abilityId('ascendant_flame'),
      portrait: String(PLOT_UNIT_IDS.lumen),
      equipment: {
        ...EMPTY_UNIT_EQUIPMENT,
        rightHand: itemId('wand_of_lumen'),
        armor: itemId('padded_vest'),
      },
    },
    catalog,
  );
}

// Chris — L1 Knight with the Alchemist reclass dispensation (access
// override + a JP trickle so he can switch around from day one). Iron
// Sword + a Zarghidas body. Innate: Bulwark Oath (cover).
function chrisAtStart(catalog: Catalog): CampaignUnit {
  return ch1Unit(
    {
      id: String(PLOT_UNIT_IDS.chris),
      name: 'Chris',
      classId: classId('knight'),
      level: CH1_START_LEVEL,
      gender: 'male',
      innate: abilityId('bulwark_oath'),
      portrait: String(PLOT_UNIT_IDS.chris),
      classAccessOverride: [classId('knight'), classId('alchemist')],
      extraJp: { alchemist: CH1_CHRIS_ALCHEMIST_JP },
      equipment: {
        ...EMPTY_UNIT_EQUIPMENT,
        rightHand: itemId('iron_sword'),
        armor: itemId('padded_jacket'),
      },
    },
    catalog,
  );
}

// --- The rolled generics -------------------------------------------------

// Draw a uniform integer in [min, max] from the campaign-start rng.
function rollBetween(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// Zarghidas class starting gear: a weapon and one piece of armor, resolved
// per class by the hire tool's legality-driven picker — EXCEPT the Geosage,
// whose matching element wand (Wand of the Deepwood) is authored directly
// (the picker would hand it the first legal wand, which is the water one).
function genericStartingGear(cls: ClassId, catalog: Catalog): UnitEquipment {
  let equipment: UnitEquipment = EMPTY_UNIT_EQUIPMENT;
  for (const [slot, id] of starterGearFor(cls, catalog)) {
    equipment = { ...equipment, [slot]: id };
  }
  if (cls === classId('earth_mage')) {
    equipment = { ...equipment, rightHand: itemId('wand_of_deepwood') };
  }
  return equipment;
}

// Roll the four campaign-start generics: classes fixed, names sampled
// without replacement from the hire pool, genders 50/50, Brave/Faith rolled
// 50–70, all L1 with Zarghidas class starting gear. `rng` is the ONLY
// source of variation — the app passes Math.random at the New Campaign
// click and the rolled results persist in the save; tests pass a stub.
export function rollCh1Generics(rng: () => number, catalog: Catalog): ReadonlyArray<CampaignUnit> {
  const namePool = [...HIRE_NAMES];
  return CH1_GENERIC_CLASSES.map((cls, i) => {
    const name = namePool.splice(Math.floor(rng() * namePool.length), 1)[0]!;
    return ch1Unit(
      {
        id: `ch1-gen-${i + 1}-${String(cls)}`,
        name,
        classId: cls,
        level: CH1_START_LEVEL,
        gender: rng() < 0.5 ? 'male' : 'female',
        brave: rollBetween(rng, ROLL_MIN, ROLL_MAX),
        faith: rollBetween(rng, ROLL_MIN, ROLL_MAX),
        equipment: genericStartingGear(cls, catalog),
      },
      catalog,
    );
  });
}

// The Chapter 1 starting roster: Lumen + Chris + the four rolled generics.
export function ch1StartingRoster(rng: () => number, catalog: Catalog): ReadonlyArray<CampaignUnit> {
  return [lumenAtStart(catalog), chrisAtStart(catalog), ...rollCh1Generics(rng, catalog)];
}

// --- The staggered plot joins (fixed levels — brief: below party average;
// the XP rubber-band closes the gap; someday these may become computed) ----

// Clio — joins after the Alvera battle (Node 2), L2 Hydrologist. Innate:
// Tidal Cadence (team CT). Alvera-wave caster gear.
export function clioJoinUnit(catalog: Catalog): CampaignUnit {
  return ch1Unit(
    {
      id: String(PLOT_UNIT_IDS.clio),
      name: 'Clio',
      classId: classId('water_mage'),
      level: 2,
      gender: 'female',
      innate: abilityId('tidal_cadence'),
      portrait: String(PLOT_UNIT_IDS.clio),
      equipment: {
        ...EMPTY_UNIT_EQUIPMENT,
        rightHand: itemId('wand_of_depths'),
        armor: itemId('linen_robe'),
      },
    },
    catalog,
  );
}

// Thessaly — joins after Grek Forest (Node 4), L3 Calculator. No innate
// (her signature Math components are unit-restricted buyables, earned not
// seeded). Fallback class access: Geosage (the Tier-1 anti-dead-end).
export function thessalyJoinUnit(catalog: Catalog): CampaignUnit {
  return ch1Unit(
    {
      id: String(PLOT_UNIT_IDS.thessaly),
      name: 'Thessaly',
      classId: classId('calculator'),
      level: 3,
      gender: 'female',
      portrait: String(PLOT_UNIT_IDS.thessaly),
      classAccessOverride: [classId('calculator'), classId('earth_mage')],
      equipment: {
        ...EMPTY_UNIT_EQUIPMENT,
        leftHand: itemId('battle_dictionary'),
        armor: itemId('linen_robe'),
        headgear: itemId('pointy_hat'),
      },
    },
    catalog,
  );
}

// Sera — the Ordal Canyon guest (Node 6) and, after that battle, the
// guest→roster join, L5 Assassin. No innate (Hamstring is a restricted
// buyable). Fallback class access: Monk. The SAME unit definition serves
// both the `guests` fold and the `joinPlotUnit` call — Sera the guest IS
// Sera the joiner.
export function seraJoinUnit(catalog: Catalog): CampaignUnit {
  return ch1Unit(
    {
      id: String(PLOT_UNIT_IDS.sera),
      name: 'Sera',
      classId: classId('assassin'),
      level: 5,
      gender: 'female',
      portrait: String(PLOT_UNIT_IDS.sera),
      classAccessOverride: [classId('assassin'), classId('monk')],
      equipment: {
        ...EMPTY_UNIT_EQUIPMENT,
        rightHand: itemId('dagger'),
        armor: itemId('padded_vest'),
        headgear: itemId('lookouts_hood'),
      },
    },
    catalog,
  );
}
