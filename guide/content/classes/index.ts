// Prose registry — the instructor's hand-authored prose for every
// class, keyed by the catalog's class id. The build layer looks up a
// class's prose here; it does not import the per-class files directly.

import type { ClassProse } from '../prose.ts';
import { knightProse } from './knight.ts';
import { earthMageProse } from './earth-mage.ts';
import { waterMageProse } from './water-mage.ts';
import { fireMageProse } from './fire-mage.ts';
import { lightningMageProse } from './lightning-mage.ts';

export const classProse: Record<string, ClassProse> = {
  knight: knightProse,
  earth_mage: earthMageProse,
  water_mage: waterMageProse,
  fire_mage: fireMageProse,
  lightning_mage: lightningMageProse,
};
