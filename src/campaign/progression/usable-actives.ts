// TABA M2 progression — the battle-facing "usable actives" projection.
//
// The durable side stores `unlocks` (a tagged-union purchase record). The
// battle side wants a flat opaque allowlist of ability ids the unit may
// invoke — `UnitPlacement.usableActives` / `Unit.usableActives`. This is the
// projection between them, applied at the campaign→battle fold.
//
// The allowlist = the class's always-free abilities (Attack and any innate
// actives — never gated) UNION the unit's unlocked ability tokens UNION the
// NON-COMPONENT members of every wielded command set (S94 fix). That last
// clause is the delivery-action rule: Compound / Throw Item are Alchemy's
// structural verbs — they were never JP components, so without it the
// allowlist stranded them (an Alchemist with Potion unlocked couldn't
// throw it; a Knight wielding Alchemy as a secondary was blocked the same
// way). A member that IS a component (Scorch in Fire Spells) stays locked
// until bought — the whole point of "the combat kit comes online as you
// spend" (brief) is untouched; resource gating for items stays on
// `usableItems`. Including passive ids is harmless — passives never route
// through `use_ability`.
//
// The engine consumes the resulting allowlist opaquely (`undefined ⇒ all
// usable`), knowing nothing about JP — so Mage War, whose fold never stamps
// it, is unaffected. See the M2 substrate audit (Option B).

import type {
  AbilityId,
  Catalog,
  ItemId,
  MathSkillParameter,
  MathSkillValue,
} from '@engine/index.ts';
import type { CampaignUnit } from '../types.ts';
import { COMPONENT_CATALOG } from './component-catalog-data.ts';
import { tokenKey } from './tokens.ts';

export function usableActiveIds(
  unit: CampaignUnit,
  catalog: Catalog,
): ReadonlyArray<AbilityId> {
  const cls = catalog.getClass(unit.classId);
  const out = new Set<AbilityId>(cls.freeAbilities);
  // Wielded command sets contribute their NON-gated members (the
  // delivery-action rule — see header).
  for (const sets of Object.values(unit.loadout.actionBuckets)) {
    for (const commandSetId of sets) {
      for (const memberId of catalog.getCommandSet(commandSetId).members) {
        if (!COMPONENT_CATALOG.has(tokenKey({ kind: 'ability', id: memberId }))) {
          out.add(memberId);
        }
      }
    }
  }
  for (const token of unit.unlocks) {
    if (token.kind === 'ability') out.add(token.id);
  }
  return [...out];
}

// Combinator-component projections — the item / math-parameter / math-value
// siblings. Unlike actives, combinator components have NO free/innate members
// (the combinator is an always-on-but-EMPTY shell), so the usable set is
// exactly the unlocked tokens of that kind. These stamp the battle-unit's
// `usableItems` / `usableMathParameters` / `usableMathValues` allowlists.
export function usableItemIds(unit: CampaignUnit): ReadonlyArray<ItemId> {
  const out: ItemId[] = [];
  for (const token of unit.unlocks) if (token.kind === 'item') out.push(token.id);
  return out;
}

export function usableMathParameterIds(unit: CampaignUnit): ReadonlyArray<MathSkillParameter> {
  const out: MathSkillParameter[] = [];
  for (const token of unit.unlocks) if (token.kind === 'mathParameter') out.push(token.id);
  return out;
}

export function usableMathValueIds(unit: CampaignUnit): ReadonlyArray<MathSkillValue> {
  const out: MathSkillValue[] = [];
  for (const token of unit.unlocks) if (token.kind === 'mathValue') out.push(token.id);
  return out;
}
