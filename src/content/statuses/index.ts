import type { StatusEffectType } from '@engine/index.ts';
import { haste } from './haste.ts';
import { stop } from './stop.ts';

export const statusTypes: ReadonlyArray<StatusEffectType> = [haste, stop];
