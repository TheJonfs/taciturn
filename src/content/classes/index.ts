import type { ClassDefinition } from '@engine/index.ts';
import { earthMage } from './earth-mage.ts';
import { knight } from './knight.ts';

export const classes: ReadonlyArray<ClassDefinition> = [earthMage, knight];
