// TABA M2 progression — the battle-facing "usable actives" projection.
//
// The durable side stores `unlocks` (a tagged-union purchase record). The
// battle side wants a flat opaque allowlist of ability ids the unit may
// invoke — `UnitPlacement.usableActives` / `Unit.usableActives`. This is the
// projection between them, applied at the campaign→battle fold.
//
// The allowlist = the class's always-free abilities (Attack and any innate
// actives — never gated) UNION the unit's unlocked ability tokens. Note that
// actives are NOT free-in-class (unlike R/S/M passives): a fresh unit's
// command-set actives are all locked until bought, which is the whole point
// of "the combat kit comes online as you spend" (brief). Including passive
// ids is harmless — passives never route through `use_ability`.
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

export function usableActiveIds(
  unit: CampaignUnit,
  catalog: Catalog,
): ReadonlyArray<AbilityId> {
  const cls = catalog.getClass(unit.classId);
  const out = new Set<AbilityId>(cls.freeAbilities);
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
