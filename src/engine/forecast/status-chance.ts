// Per-(status, target) chance forecast — enumerates each declared status
// effect on an ability and returns the projected application chance for
// the given target. Composes `computeStatusChance` (the pure helper
// extracted from `rollStatusChance`); same formula the runtime applies.
//
// Used by the UI's forecast hover panel and tooltip.

import { computeStatusChance, computeThiefContestChance } from '../status/chance.ts';
import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import type { GameState, StatusTypeId, Unit } from '../types/index.ts';

export interface StatusChanceForecast {
  // The applied status, when the effect applies one (the renderer shows its
  // name). Absent for effects with no single status to name — the Thief's
  // Steal Buffs (a strip-and-transfer contest), which carries `label` instead.
  readonly statusTypeId?: StatusTypeId;
  // Display label override — used when there's no status to name. The renderer
  // prefers it over the status name.
  readonly label?: string;
  // [0, 1] — same scale `rollStatusChance` returns.
  readonly chance: number;
}

export interface ProjectStatusChancesArgs {
  readonly state: GameState;
  readonly catalog: Catalog;
  readonly caster: Unit;
  readonly target: Unit;
  readonly ability: ActiveAbilityDefinition;
}

// Returns one forecast per declared status effect on the ability whose
// `target` is `primary_target` (matches the AoE-target convention). Effects
// targeting the caster or carrying `applyAlways: true` still return their
// post-modifier chance — the caller (UI) decides whether to render them.
export function projectStatusChances(
  args: ProjectStatusChancesArgs,
): ReadonlyArray<StatusChanceForecast> {
  const out: StatusChanceForecast[] = [];

  // Thief steal contests (Steal Buffs / Steal Heart) use the additive Brave/PA
  // contest, not the `statusEffects` chance pipeline — project them explicitly
  // so the forecast panel shows a connect %. Steal Heart names the charm it
  // applies; Steal Buffs has no single status, so it carries a label.
  const { stealBuffs, stealHeart } = args.ability.effects;
  if (stealBuffs !== undefined) {
    const chance = computeThiefContestChance({
      state: args.state,
      catalog: args.catalog,
      caster: args.caster,
      target: args.target,
      baseChance: stealBuffs.baseChance,
    });
    out.push({ label: 'Steal Buffs', chance: chance / 100 });
  }
  if (stealHeart !== undefined) {
    const chance = computeThiefContestChance({
      state: args.state,
      catalog: args.catalog,
      caster: args.caster,
      target: args.target,
      baseChance: stealHeart.baseChance,
    });
    out.push({ statusTypeId: stealHeart.charmStatus, chance: chance / 100 });
  }

  const effects = args.ability.effects.statusEffects ?? [];
  for (const spec of effects) {
    // Skip caster-targeted effects when the displayed target isn't the
    // caster — the forecast is per-(status, target) for the on-screen
    // hovered target. (The action menu's other surfaces handle caster
    // buffs separately.)
    if (spec.target === 'caster' && args.target.id !== args.caster.id) continue;
    const statusType = args.catalog.getStatusType(spec.typeId);
    const chance = computeStatusChance({
      state: args.state,
      catalog: args.catalog,
      caster: args.caster,
      target: args.target,
      statusType,
      ability: args.ability,
      baseChance: spec.baseChance ?? 100,
      ...(spec.factors !== undefined ? { factors: spec.factors } : {}),
      ...(spec.applyAlways !== undefined ? { applyAlways: spec.applyAlways } : {}),
    });
    out.push({ statusTypeId: spec.typeId, chance });
  }
  return out;
}
