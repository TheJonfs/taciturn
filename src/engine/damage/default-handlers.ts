// Default damage-handler registry — the v1 library that the default
// ruleset's stage lists reference by ref string. New rulesets can pass
// their own registry with a different (or extended) handler set; the
// pipeline orchestrator takes the registry as a parameter.

import {
  clampMinMax,
  finalize,
  fireOnDamageDealt,
  fireOnDamageReceived,
  healingBase,
  physicalPaWp,
  varianceRoll,
} from './handlers.ts';
import type { DamageHandler, DamageHandlerRegistry } from './registry.ts';

export const defaultDamageHandlers: DamageHandlerRegistry = new Map<string, DamageHandler>([
  // base
  ['physical_pa_wp', physicalPaWp],
  ['healing_base', healingBase],
  // attacker
  ['fire_on_damage_dealt', fireOnDamageDealt],
  // target
  ['fire_on_damage_received', fireOnDamageReceived],
  // variance
  ['variance_roll', varianceRoll],
  // cap
  ['clamp_min_max', clampMinMax],
  // finalize
  ['finalize', finalize],
]);
