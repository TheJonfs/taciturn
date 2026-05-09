import type { ClassDefinition } from '@engine/index.ts';
import { earthMage } from './earth-mage.ts';
import { fireMage } from './fire-mage.ts';
import { knight } from './knight.ts';
import { waterMage } from './water-mage.ts';

export const classes: ReadonlyArray<ClassDefinition> = [earthMage, fireMage, knight, waterMage];
