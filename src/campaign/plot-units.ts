// TABA chapter-1 plot-unique units — the durable CampaignUnit definitions.
//
// The five plot leads (Lumen, Chris, Clio, Thessaly, Sera), authored for real on
// the S84 seams instead of standing in as generic Gravity Well fixtures. Each
// carries: a durable stable id (`plot-*`, from `plot-unit-ids.ts`), a portrait
// override key (= the id), the brief's `classAccessOverride` (authored correctly
// at JOIN level even though the L25 fixtures won't stress it), and — for the
// three chapter-scaling leads — a free innate signature passive equipped in the
// support bucket.
//
// SOURCE: four leads reuse their Gravity Well BuiltUnit (same class, valid
// loadout + equipment) via `campaignUnitFromBuilt`; Chris is authored fresh as a
// KNIGHT (the brief's class for him — Gravity Well's Chris is a Templar). The
// two "exclusive-kit" leads (Thessaly, Sera) get NO innate passive: their
// signatures are unit-restricted BUYABLE components (Seam 3), earned not seeded.

import { buildBaseStats, gravityWell } from '@content/teams/index.ts';
import type { BuiltUnit } from '@content/teams/index.ts';
import { abilityId, bucketId, classId, commandSetId, itemId, type AbilityId, type ClassId } from '@engine/index.ts';
import type { CampaignUnit } from './types.ts';
// Import the builder DIRECTLY from its own module (not via roster.ts) to keep
// the roster ⇄ plot-units cycle broken.
import { campaignUnitFromBuilt, M0_BASELINE_LEVEL } from './campaign-unit-from-built.ts';
import { PLOT_UNIT_IDS } from './plot-unit-ids.ts';

const SUPPORT = bucketId('support');

// Pull a Gravity Well BuiltUnit by name (fails loud if the template changes).
function gw(name: string): BuiltUnit {
  const u = gravityWell.units.find((x) => x.name === name);
  if (u === undefined) throw new Error(`plot-units: Gravity Well has no unit '${name}'`);
  return u;
}

// Return a copy of `built` with a free innate signature added to its support
// bucket (the passive is baseCost 0, so it consumes no capacity).
function withInnate(built: BuiltUnit, signature: AbilityId): BuiltUnit {
  const support = built.loadout.passiveBuckets[SUPPORT] ?? [];
  return {
    ...built,
    loadout: {
      ...built.loadout,
      passiveBuckets: { ...built.loadout.passiveBuckets, [SUPPORT]: [...support, signature] },
    },
  };
}

// Chris — authored fresh as a Knight (Gravity Well's Chris is a Templar). Sword-
// and-board frontline; Bulwark Oath innate. (Kit overlaps Miluda's — a
// unique-per-team overlap that campaign mode does not enforce, as authored.)
const chrisKnight: BuiltUnit = {
  name: 'Chris',
  classId: classId('knight'),
  baseStats: buildBaseStats(classId('knight'), 70, 70, M0_BASELINE_LEVEL),
  level: M0_BASELINE_LEVEL,
  gender: 'male',
  loadout: {
    actionBuckets: {
      [bucketId('first_action')]: [commandSetId('battle_skill')],
      [bucketId('secondary_command_sets')]: [],
    },
    passiveBuckets: {
      [SUPPORT]: [abilityId('bulwark_oath')], // innate signature (Seam 2 cover)
    },
  },
  equipment: {
    leftHand: itemId('warriors_aegis'),
    rightHand: itemId('flametongue'),
    headgear: itemId('tactical_mask'),
    armor: itemId('soldiers_leathers'),
    accessory: itemId('gauntlet_of_might'),
  },
};

// Assemble a plot CampaignUnit: convert the BuiltUnit at the uniform baseline
// level, then stamp the durable plot identity (stable id, portrait key = id,
// classAccessOverride). `portrait` falls back to the class face until the plot
// art is registered in FIXED_PORTRAITS.
function plotUnit(
  built: BuiltUnit,
  id: (typeof PLOT_UNIT_IDS)[keyof typeof PLOT_UNIT_IDS],
  override?: ReadonlyArray<ClassId>,
): CampaignUnit {
  const base = campaignUnitFromBuilt(built, String(id));
  const withPortrait: CampaignUnit = { ...base, portrait: String(id) };
  return override !== undefined
    ? { ...withPortrait, classAccessOverride: override }
    : withPortrait;
}

// The five plot leads, in the Gravity Well ordering (Sera, Thessaly, Lumen,
// Chris, Clio) so they slot into `m1Roster` where the fixtures used to sit.
export const plotUnits: ReadonlyArray<CampaignUnit> = [
  // Sera — Assassin. Signature = Hamstring (buyable, Seam 3). Fallback = Monk
  // (the anti-dead-end: a T3-only unit's spend can never satisfy a T1 threshold).
  plotUnit(gw('Sera'), PLOT_UNIT_IDS.sera, [classId('assassin'), classId('monk')]),
  // Thessaly — Calculator. Signature = XP + Square Math components (buyable,
  // Seam 3). Fallback = Geosage (earth_mage) — the Tier-1 anti-dead-end.
  plotUnit(gw('Thessaly'), PLOT_UNIT_IDS.thessaly, [classId('calculator'), classId('earth_mage')]),
  // Lumen — Pyromancer (Tier 1, baseline-reachable → no override). Innate:
  // Ascendant Flame (chapter-scaling fire ×).
  plotUnit(withInnate(gw('Lumen'), abilityId('ascendant_flame')), PLOT_UNIT_IDS.lumen),
  // Chris — Knight. Fallback = Alchemist (his Templar on-ramp: a Physical T1
  // that legitimately opens his tree). Innate: Bulwark Oath (cover).
  plotUnit(chrisKnight, PLOT_UNIT_IDS.chris, [classId('knight'), classId('alchemist')]),
  // Clio — Hydrologist (Tier 1 → no override). Innate: Tidal Cadence (team CT).
  plotUnit(withInnate(gw('Clio'), abilityId('tidal_cadence')), PLOT_UNIT_IDS.clio),
];
