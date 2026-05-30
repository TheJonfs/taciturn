import type { CommandSetDefinition } from '@engine/index.ts';
import { alchemy } from './alchemy.ts';
import { arcaneSkill } from './arcane-skill.ts';
import { battleSkill } from './battle-skill.ts';
import { earthSpells } from './earth-spells.ts';
import { fireSpells } from './fire-spells.ts';
import { lightningSpells } from './lightning-spells.ts';
import { marksmanship } from './marksmanship.ts';
import { mathSkill } from './math-skill.ts';
import { shadowArts } from './shadow-arts.ts';
import { waterSpells } from './water-spells.ts';
import { whiteMagic } from './white-magic.ts';
import { worldcraft } from './worldcraft.ts';

export const commandSets: ReadonlyArray<CommandSetDefinition> = [
  alchemy,
  arcaneSkill,
  battleSkill,
  earthSpells,
  fireSpells,
  lightningSpells,
  marksmanship,
  mathSkill,
  shadowArts,
  waterSpells,
  whiteMagic,
  worldcraft,
];
