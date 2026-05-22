// Per-(status, target) chance forecast — enumerates each declared status
// effect on an ability and returns the projected application chance for
// the given target. Composes `computeStatusChance` (the pure helper
// extracted from `rollStatusChance`); same formula the runtime applies.
//
// Used by the UI's forecast hover panel and tooltip.

import { computeStatusChance } from '../status/chance.ts';
import type { ActiveAbilityDefinition, Catalog } from '../catalog/index.ts';
import type { GameState, StatusTypeId, Unit } from '../types/index.ts';

export interface StatusChanceForecast {
  readonly statusTypeId: StatusTypeId;
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
  const effects = args.ability.effects.statusEffects ?? [];
  if (effects.length === 0) return [];
  const out: StatusChanceForecast[] = [];
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
