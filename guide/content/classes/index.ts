// Prose registry — the instructor's hand-authored prose for every
// class, keyed by the catalog's class id. The build layer looks up a
// class's prose here; it does not import the per-class files directly.

import type { ClassProse } from '../prose.ts';
import { knightProse } from './knight.ts';
import { alchemistProse } from './alchemist.ts';
import { assassinProse } from './assassin.ts';
import { calculatorProse } from './calculator.ts';
import { hunterProse } from './hunter.ts';
import { earthMageProse } from './earth-mage.ts';
import { waterMageProse } from './water-mage.ts';
import { fireMageProse } from './fire-mage.ts';
import { lightningMageProse } from './lightning-mage.ts';
import { templarProse } from './templar.ts';
import { terraformerProse } from './terraformer.ts';

export const classProse: Record<string, ClassProse> = {
  knight: knightProse,
  alchemist: alchemistProse,
  assassin: assassinProse,
  calculator: calculatorProse,
  hunter: hunterProse,
  earth_mage: earthMageProse,
  water_mage: waterMageProse,
  fire_mage: fireMageProse,
  lightning_mage: lightningMageProse,
  templar: templarProse,
  terraformer: terraformerProse,
};
