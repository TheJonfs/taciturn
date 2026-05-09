import type { StatusEffectType } from '@engine/index.ts';
import { blind } from './blind.ts';
import { burn } from './burn.ts';
import { charging } from './charging.ts';
import { dontAct } from './dont-act.ts';
import { dontMove } from './dont-move.ts';
import { haste } from './haste.ts';
import { maDown } from './ma-down.ts';
import { maUp } from './ma-up.ts';
import { movementDebuff } from './movement-debuff.ts';
import { movementSelfBuff } from './movement-self-buff.ts';
import { paDown } from './pa-down.ts';
import { paUp } from './pa-up.ts';
import { poison } from './poison.ts';
import { regen } from './regen.ts';
import { silence } from './silence.ts';
import { speedDown } from './speed-down.ts';
import { stop } from './stop.ts';
import { taunted } from './taunted.ts';

export const statusTypes: ReadonlyArray<StatusEffectType> = [
  blind,
  burn,
  charging,
  dontAct,
  dontMove,
  haste,
  maDown,
  maUp,
  movementDebuff,
  movementSelfBuff,
  paDown,
  paUp,
  poison,
  regen,
  silence,
  speedDown,
  stop,
  taunted,
];
