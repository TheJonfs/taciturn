import type { StatusEffectType } from '@engine/index.ts';
import { blind } from './blind.ts';
import { charging } from './charging.ts';
import { haste } from './haste.ts';
import { movementDebuff } from './movement-debuff.ts';
import { movementSelfBuff } from './movement-self-buff.ts';
import { regen } from './regen.ts';
import { silence } from './silence.ts';
import { stop } from './stop.ts';

export const statusTypes: ReadonlyArray<StatusEffectType> = [
  blind,
  charging,
  haste,
  movementDebuff,
  movementSelfBuff,
  regen,
  silence,
  stop,
];
