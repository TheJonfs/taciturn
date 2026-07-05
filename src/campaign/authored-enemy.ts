// TABA M2 — authored enemy progression.
//
// Enemies are per-battle authored content, not a persistent roster — but for a
// tuned difficulty curve we want to author them with the SAME progression a
// player unit has: a chosen level (→ curve-correct stats + mid-battle leveling)
// and a chosen ability kit (→ tier-appropriate power via gating). The insight
// that makes this cheap: `campaignPlacement` already stamps all of that
// (baseStats via the curve, `statsByLevel`, and the `usable*` masks), and it is
// team-agnostic. So an authored enemy is just a `CampaignUnit` folded through
// the same path (see `foldEnemyTeam` in snapshot-fold.ts).
//
// LAYERING: this lives in the campaign shell (it builds a `CampaignUnit`), so
// enemy specs are authored in campaign node/battle content, NOT in
// `src/content/battles` (content must not depend on the campaign shell). The
// content template still supplies the map + enemy POSITIONS; the spec supplies
// WHO stands there.
//
// GATING is explicit: `unlocks` is the enemy's usable kit. List a SUBSET of the
// class's components for a weak, tier-1 enemy; use the full set (e.g. via
// `seedStartingKit`) for a fully-realized one. This is the only lever for a
// partial kit, since command sets are whole-class.

import type {
  ClassId,
  Gender,
  Loadout,
  UnitEquipment,
  UnitId,
} from '@engine/index.ts';
import { unitId } from '@engine/index.ts';
import type { CampaignUnit } from './types.ts';
import { EMPTY_EARNED_BY_CLASS } from './types.ts';
import type { UnlockToken } from './progression/index.ts';

export interface AuthoredEnemySpec {
  readonly id: string;
  readonly name: string;
  readonly classId: ClassId;
  readonly level: number;
  readonly loadout: Loadout;
  readonly equipment: UnitEquipment;
  // The enemy's usable kit — its `usableActives`/items/math come from this. A
  // subset of the class's components makes a deliberately-limited enemy.
  readonly unlocks: ReadonlyArray<UnlockToken>;
  readonly brave?: number;
  readonly faith?: number;
  readonly gender?: Gender;
}

const DEFAULT_BRAVE = 70;
const DEFAULT_FAITH = 70;

// Build an enemy `CampaignUnit` from a spec. `vitals` is a placeholder — the
// fold supplies `undefined`, so the engine fills the enemy to its effective max
// at setup (enemies walk in at full). `earnedByClass` is empty (enemies never
// spend JP); `spent`/`available` are irrelevant to a non-roster unit — only
// `unlocks` matters, and only for gating.
export function authoredEnemy(spec: AuthoredEnemySpec): CampaignUnit {
  const unit: CampaignUnit = {
    id: unitId(spec.id) as UnitId,
    name: spec.name,
    classId: spec.classId,
    level: spec.level,
    brave: spec.brave ?? DEFAULT_BRAVE,
    faith: spec.faith ?? DEFAULT_FAITH,
    loadout: spec.loadout,
    equipment: spec.equipment,
    vitals: { hp: 1, mp: 1 }, // placeholder; fold passes undefined → engine auto-fills
    xp: 0,
    earnedByClass: EMPTY_EARNED_BY_CLASS,
    unlocks: spec.unlocks,
    fate: 'active',
  };
  return spec.gender !== undefined ? { ...unit, gender: spec.gender } : unit;
}
