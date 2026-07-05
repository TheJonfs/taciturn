// Formation Training tab — the pure view-model (TABA M2 UI).
//
// Turns the current class's slice of the component catalog into typed, grouped,
// priced rows. The spend list is a TAGGED UNION (ability | item | mathParameter
// | mathValue), so rows carry a type glyph and group into: Items (Alchemist) ·
// Math Skill (Calculator params/values) · Command Set (actives) · Passives
// (R/S/M). Affordability is checked against the CURRENT class's purse
// (`availableInClass`) — components are only ever bought from their native
// class here (the dossier's current class == the component's native class).
//
// Pure + catalog-parameterized. Names come from the engine catalog (abilities/
// items) or the math display table; effect taglines + enabler conditions from
// `component-display`.

import type { Catalog, ClassId } from '@engine/index.ts';
import {
  COMPONENT_ENTRIES,
  availableInClass,
  isComponentAvailableTo,
  tokenKey,
  type CampaignUnit,
  type ComponentCatalog,
  type UnlockToken,
} from '@campaign/index.ts';
import { COMPONENT_TAGLINE, ENABLER_CONDITION, MATH_DISPLAY_NAME } from './component-display.ts';

export type ComponentType = 'A' | 'R' | 'S' | 'M' | 'I' | 'PA' | 'VA';

export const TYPE_NAME: Readonly<Record<ComponentType, string>> = {
  A: 'Active',
  R: 'Reaction',
  S: 'Support',
  M: 'Movement',
  I: 'Item',
  PA: 'Parameter',
  VA: 'Value',
};

export interface TrainingRow {
  readonly token: UnlockToken;
  readonly key: string;
  readonly type: ComponentType;
  readonly name: string;
  readonly effect: string;
  readonly cost: number;
  readonly learned: boolean;
  readonly affordable: boolean; // meaningful only when !learned
  readonly shortBy: number; // cost − purse, floored at 0
  readonly isPassive: boolean; // R/S/M — the two-state "Innate" treatment
  readonly condition?: string; // enabler passive's required command set
}

export interface TrainingGroups {
  readonly purse: number;
  readonly affordableCount: number;
  readonly items: ReadonlyArray<TrainingRow>;
  readonly math: ReadonlyArray<TrainingRow>;
  readonly actives: ReadonlyArray<TrainingRow>;
  readonly passives: ReadonlyArray<TrainingRow>;
}

// Passive bucket id → glyph. The three passive buckets are the closed set.
function passiveGlyph(bucket: string): ComponentType {
  switch (bucket) {
    case 'reaction':
      return 'R';
    case 'support':
      return 'S';
    case 'movement':
      return 'M';
    default:
      return 'S';
  }
}

function typeOf(token: UnlockToken, catalog: Catalog): ComponentType {
  switch (token.kind) {
    case 'item':
      return 'I';
    case 'mathParameter':
      return 'PA';
    case 'mathValue':
      return 'VA';
    case 'ability': {
      const ability = catalog.getAbility(token.id);
      return ability.kind === 'active' ? 'A' : passiveGlyph(String(ability.bucket));
    }
  }
}

function nameOf(token: UnlockToken, catalog: Catalog): string {
  switch (token.kind) {
    case 'ability':
      return catalog.hasAbility(token.id) ? catalog.getAbility(token.id).name : String(token.id);
    case 'item':
      return catalog.hasItem(token.id) ? catalog.getItem(token.id).name : String(token.id);
    case 'mathParameter':
    case 'mathValue':
      return MATH_DISPLAY_NAME[String(token.id)] ?? String(token.id);
  }
}

export function buildTrainingGroups(
  unit: CampaignUnit,
  classId: ClassId,
  catalog: Catalog,
  componentCatalog: ComponentCatalog,
): TrainingGroups {
  const purse = availableInClass(unit, classId, componentCatalog);
  const owned = new Set(unit.unlocks.map(tokenKey));

  const items: TrainingRow[] = [];
  const math: TrainingRow[] = [];
  const actives: TrainingRow[] = [];
  const passives: TrainingRow[] = [];
  let affordableCount = 0;

  for (const meta of COMPONENT_ENTRIES) {
    if (meta.nativeClass !== classId) continue;
    // TABA Seam 3: a unit-restricted component only appears in its unit's catalog.
    if (!isComponentAvailableTo(meta, unit.id)) continue;
    const key = tokenKey(meta.token);
    const learned = owned.has(key);
    const type = typeOf(meta.token, catalog);
    const isPassive = type === 'R' || type === 'S' || type === 'M';
    const affordable = meta.cost <= purse;
    if (!learned && affordable) affordableCount += 1;

    const displayKey = String(meta.token.id);
    const condition = ENABLER_CONDITION[displayKey];
    const row: TrainingRow = {
      token: meta.token,
      key,
      type,
      name: nameOf(meta.token, catalog),
      effect: COMPONENT_TAGLINE[displayKey] ?? '',
      cost: meta.cost,
      learned,
      affordable,
      shortBy: Math.max(0, meta.cost - purse),
      isPassive,
      ...(condition ? { condition } : {}),
    };

    if (type === 'I') items.push(row);
    else if (type === 'PA' || type === 'VA') math.push(row);
    else if (type === 'A') actives.push(row);
    else passives.push(row);
  }

  return { purse, affordableCount, items, math, actives, passives };
}
