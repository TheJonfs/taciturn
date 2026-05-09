import type { AbilityDefinition } from '@engine/index.ts';
import { attack } from './attack.ts';
import { bolt } from './bolt.ts';
import { bulwarkStance } from './bulwark-stance.ts';
import { counter } from './counter.ts';
import { cure } from './cure.ts';
import { damageReduction } from './damage-reduction.ts';
import { earthBlessing } from './earth-blessing.ts';
import { earthCataclysm } from './earth-cataclysm.ts';
import { earthCommunion } from './earth-communion.ts';
import { earthCurse } from './earth-curse.ts';
import { earthQuake } from './earth-quake.ts';
import { earthResilience } from './earth-resilience.ts';
import { earthStrike } from './earth-strike.ts';
import { float } from './float.ts';
import { fly } from './fly.ts';
import { movePlus1 } from './move-plus-1.ts';
import { powerAttack } from './power-attack.ts';
import { stasisSword } from './stasis-sword.ts';
import { taunt } from './taunt.ts';

export const abilities: ReadonlyArray<AbilityDefinition> = [
  attack,
  bolt,
  bulwarkStance,
  counter,
  cure,
  damageReduction,
  earthBlessing,
  earthCataclysm,
  earthCommunion,
  earthCurse,
  earthQuake,
  earthResilience,
  earthStrike,
  float,
  fly,
  movePlus1,
  powerAttack,
  stasisSword,
  taunt,
];
