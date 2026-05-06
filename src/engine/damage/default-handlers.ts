// Default damage-handler registry — the v1 library that the default
// ruleset's stage lists reference by ref string. New rulesets can pass
// their own registry with a different (or extended) handler set; the
// pipeline orchestrator takes the registry as a parameter.

import {
  clampMinMax,
  evasionCheck,
  finalize,
  fireOnDamageDealt,
  fireOnDamageReceived,
  healingBase,
  magicalMaPower,
  physicalPaWp,
  resistanceCheck,
  varianceRoll,
} from './handlers.ts';
import type { DamageHandler, DamageHandlerRegistry } from './registry.ts';

export const defaultDamageHandlers: DamageHandlerRegistry = new Map<string, DamageHandler>([
  // base
  ['physical_pa_wp', physicalPaWp],
  ['healing_base', healingBase],
  ['magical_ma_power', magicalMaPower],
  // attacker
  ['fire_on_damage_dealt', fireOnDamageDealt],
  // target — evasion_check fires first (ADR-0019), then resistance,
  // then onDamageReceived hooks see the resolved hit + resistance.
  ['evasion_check', evasionCheck],
  ['resistance_check', resistanceCheck],
  ['fire_on_damage_received', fireOnDamageReceived],
  // variance
  ['variance_roll', varianceRoll],
  // cap
  ['clamp_min_max', clampMinMax],
  // finalize
  ['finalize', finalize],
]);
