import type { StatusEffectType } from '@engine/index.ts';
import { charging } from './charging.ts';
import { haste } from './haste.ts';
import { stop } from './stop.ts';

export const statusTypes: ReadonlyArray<StatusEffectType> = [charging, haste, stop];
