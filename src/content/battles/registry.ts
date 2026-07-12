// Battle-template registry — the ENUMERABLE index of campaign-usable battle
// templates (S90, node-authoring structural tier).
//
// Templates themselves are loose exports (one file per battlefield); campaign
// beats import them directly and that stays fine. What was missing is a way
// to ENUMERATE them: the Atlas graph editor needs a picker ("which template
// does this placeholder battle use?") and its codegen needs a stable KEY to
// reference a template by, instead of emitting per-template import gymnastics.
//
// Registry keys deliberately equal the deployment-zone registry's map keys
// (river_ridge, stonebridge, …) — one name per battlefield across both
// registries. Only templates WITH a deployment-zone config are listed: an
// entry here promises `deploymentZonesFor(entry.zonesKey)` resolves, which is
// what makes a placeholder battle beat on this template immediately walkable.
// (training-field is the canonical PROBE field, not a walkable battle — it
// has no zones and stays out; demo.ts predates the campaign and stays out.)

import type { BattleConfig } from '@engine/index.ts';
import { riverRidgeBattle } from './river-ridge-battle.ts';
import { stonebridgeBattle } from './stonebridge-battle.ts';
import { marshmoorBattle } from './marshmoor-battle.ts';
import { mountainPassBattle } from './mountain-pass-battle.ts';

export interface BattleTemplateEntry {
  // Display name for authoring pickers.
  readonly label: string;
  readonly template: BattleConfig;
  // The deployment-zone registry key (always the registry key itself today;
  // kept explicit so a template could one day point at a shared zone set).
  readonly zonesKey: string;
}

// key → entry. Key order is picker display order.
export const BATTLE_TEMPLATE_REGISTRY: Readonly<Record<string, BattleTemplateEntry>> = {
  river_ridge: { label: 'River Ridge', template: riverRidgeBattle, zonesKey: 'river_ridge' },
  stonebridge: { label: 'Stonebridge', template: stonebridgeBattle, zonesKey: 'stonebridge' },
  marshmoor: { label: 'Marshmoor', template: marshmoorBattle, zonesKey: 'marshmoor' },
  mountain_pass: { label: 'Mountain Pass', template: mountainPassBattle, zonesKey: 'mountain_pass' },
};

// Look up a template by registry key. Throws loud on an unknown key — a
// dangling template reference is a content wiring bug, not a fallback case.
export function battleTemplateFor(key: string): BattleTemplateEntry {
  const entry = BATTLE_TEMPLATE_REGISTRY[key];
  if (entry === undefined) {
    throw new Error(`battleTemplateFor: no battle template registered under key '${key}'`);
  }
  return entry;
}
