import type { ClassDefinition } from '@engine/index.ts';
import { alchemist } from './alchemist.ts';
import { assassin } from './assassin.ts';
import { calculator } from './calculator.ts';
import { earthMage } from './earth-mage.ts';
import { fireMage } from './fire-mage.ts';
import { hunter } from './hunter.ts';
import { knight } from './knight.ts';
import { lightningMage } from './lightning-mage.ts';
import { terraformer } from './terraformer.ts';
import { waterMage } from './water-mage.ts';

export const classes: ReadonlyArray<ClassDefinition> = [
  alchemist,
  assassin,
  calculator,
  earthMage,
  fireMage,
  hunter,
  knight,
  lightningMage,
  terraformer,
  waterMage,
];

// Per-class L25 baseline numeric stats — single source of truth,
// consumed by battle configs and external guide tooling.
export { classBaselineStats, type ClassBaselineStats } from './baseline-stats.ts';
