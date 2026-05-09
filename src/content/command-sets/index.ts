import type { CommandSetDefinition } from '@engine/index.ts';
import { arcaneSkill } from './arcane-skill.ts';
import { battleSkill } from './battle-skill.ts';
import { earthSpells } from './earth-spells.ts';
import { fireSpells } from './fire-spells.ts';
import { lightningSpells } from './lightning-spells.ts';
import { waterSpells } from './water-spells.ts';
import { whiteMagic } from './white-magic.ts';

export const commandSets: ReadonlyArray<CommandSetDefinition> = [
  arcaneSkill,
  battleSkill,
  earthSpells,
  fireSpells,
  lightningSpells,
  waterSpells,
  whiteMagic,
];
