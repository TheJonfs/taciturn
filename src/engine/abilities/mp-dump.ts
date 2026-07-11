// Cast-time MP dump → Spell Power (TABA Ch3, Del's Stave).
//
// A weapon declaring `castMpDump` converts every 'magical'-tagged cast
// into a full-MP dump: the cast spends ALL current MP, and the spend
// beyond the effective cost converts to bonus Spell Power at
// `floor(excess / mpPerBonusSp)`. NO artificial cap (settled ruling) —
// the MP economy self-caps the nova.
//
// THREE-RESOLVER DISCIPLINE. The bonus is a function of the caster's
// PRE-CAST MP, which only exists at commit time (charged spells resolve
// turns later with MP already at 0). So:
//   - the reducer computes it here at commit and either threads it
//     straight into the instant dispatch or banks it on the
//     ChargedAction (`bonusSpellPower`);
//   - AI projection / UI forecast — always evaluating a PROSPECTIVE
//     cast against live vitals — call `prospectiveMpDumpBonusSp` inside
//     the shared projection pipeline, so all three paths run this one
//     formula. (A math_skill cast's per-target cost scaling isn't
//     visible here; the projection reads the base cost. No content
//     pairs the dump with math_skill today — flagged in the ADR.)
//
// The dump deliberately does NOT gate on the ability having damage:
// per Chris's ruling it applies to ALL magical casts, heals and buffs
// included. A Spell-Power-scaling heal novas; a buff cast just burns
// the tank — that harshness is the weapon's contract.

import type { Catalog } from '../catalog/index.ts';
import type { ActiveAbilityDefinition } from '../catalog/definitions/ability-definition.ts';
import type { GameState, Unit } from '../types/index.ts';
import { computeMpCost } from './cost.ts';

// The wielder's castMpDump spec, if any equipped weapon declares one.
// Scans hand slots only (it's a weapon field); first declaration wins —
// stacking two dump weapons is not a meaningful compose (both would
// spend the same pool).
export function castMpDumpSpec(
  unit: Unit,
  catalog: Catalog,
): { readonly mpPerBonusSp: number } | null {
  for (const slot of ['rightHand', 'leftHand'] as const) {
    const itemId = unit.equipment[slot];
    if (itemId === null) continue;
    const item = catalog.getItem(itemId);
    if (item.kind === 'weapon' && item.castMpDump !== undefined) {
      return item.castMpDump;
    }
  }
  return null;
}

// Whether the dump applies to this cast at all.
function dumpApplies(ability: ActiveAbilityDefinition): boolean {
  return (ability.tags ?? []).includes('magical');
}

// The bonus SP for a dump of `currentMp` against an already-computed
// effective cost. Pure core shared by the reducer (which has the true
// cost, math_skill scaling included) and the prospective read below.
export function mpDumpBonusSp(
  currentMp: number,
  effectiveCost: number,
  spec: { readonly mpPerBonusSp: number },
): number {
  return Math.floor(Math.max(0, currentMp - effectiveCost) / spec.mpPerBonusSp);
}

// Projection/forecast entry: the bonus a cast of `ability` would get if
// committed right now. 0 when no dump weapon / non-magical cast.
export function prospectiveMpDumpBonusSp(
  state: GameState,
  catalog: Catalog,
  unit: Unit,
  ability: ActiveAbilityDefinition,
): number {
  if (!dumpApplies(ability)) return 0;
  const spec = castMpDumpSpec(unit, catalog);
  if (spec === null) return 0;
  const cost = computeMpCost(state, catalog, unit.id, ability.id);
  return mpDumpBonusSp(unit.vitals.mp, cost, spec);
}

export { dumpApplies as castMpDumpApplies };
