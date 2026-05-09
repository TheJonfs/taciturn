import type { StatusEffectType } from '@engine/index.ts';
import { blind } from './blind.ts';
import { charging } from './charging.ts';
import { dontAct } from './dont-act.ts';
import { dontMove } from './dont-move.ts';
import { haste } from './haste.ts';
import { movementDebuff } from './movement-debuff.ts';
import { movementSelfBuff } from './movement-self-buff.ts';
import { poison } from './poison.ts';
import { regen } from './regen.ts';
import { silence } from './silence.ts';
import { stop } from './stop.ts';
import { taunted } from './taunted.ts';

export const statusTypes: ReadonlyArray<StatusEffectType> = [
  blind,
  charging,
  dontAct,
  dontMove,
  haste,
  movementDebuff,
  movementSelfBuff,
  poison,
  regen,
  silence,
  stop,
  taunted,
];
