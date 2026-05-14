import type { ClassDefinition } from '@engine/index.ts';
import { earthMage } from './earth-mage.ts';
import { fireMage } from './fire-mage.ts';
import { knight } from './knight.ts';
import { lightningMage } from './lightning-mage.ts';
import { waterMage } from './water-mage.ts';

export const classes: ReadonlyArray<ClassDefinition> = [
  earthMage,
  fireMage,
  knight,
  lightningMage,
  waterMage,
];

// Per-class L25 baseline numeric stats — single source of truth,
// consumed by battle configs and external guide tooling.
export { classBaselineStats, type ClassBaselineStats } from './baseline-stats.ts';
