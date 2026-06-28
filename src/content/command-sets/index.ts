import type { CommandSetDefinition } from '@engine/index.ts';
import { alchemy } from './alchemy.ts';
import { arcaneSkill } from './arcane-skill.ts';
import { auramancy } from './auramancy.ts';
import { battleSkill } from './battle-skill.ts';
import { earthSpells } from './earth-spells.ts';
import { fireSpells } from './fire-spells.ts';
import { lightningSpells } from './lightning-spells.ts';
import { marksmanship } from './marksmanship.ts';
import { martialArts } from './martial-arts.ts';
import { mathSkill } from './math-skill.ts';
import { shadowArts } from './shadow-arts.ts';
import { templarArts } from './templar-arts.ts';
import { thiefArts } from './thief-arts.ts';
import { waterSpells } from './water-spells.ts';
import { whiteMagic } from './white-magic.ts';
import { worldcraft } from './worldcraft.ts';

export const commandSets: ReadonlyArray<CommandSetDefinition> = [
  alchemy,
  arcaneSkill,
  auramancy,
  battleSkill,
  earthSpells,
  fireSpells,
  lightningSpells,
  marksmanship,
  martialArts,
  mathSkill,
  shadowArts,
  templarArts,
  thiefArts,
  waterSpells,
  whiteMagic,
  worldcraft,
];
