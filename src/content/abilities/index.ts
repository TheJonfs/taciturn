import type { AbilityDefinition } from '@engine/index.ts';
import { attack } from './attack.ts';
import { bolt } from './bolt.ts';
import { counter } from './counter.ts';
import { cure } from './cure.ts';
import { float } from './float.ts';
import { fly } from './fly.ts';
import { movePlus1 } from './move-plus-1.ts';

export const abilities: ReadonlyArray<AbilityDefinition> = [
  attack,
  bolt,
  counter,
  cure,
  float,
  fly,
  movePlus1,
];
