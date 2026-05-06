import type { CommandSetDefinition } from '@engine/index.ts';
import { battleSkill } from './battle-skill.ts';
import { whiteMagic } from './white-magic.ts';

export const commandSets: ReadonlyArray<CommandSetDefinition> = [battleSkill, whiteMagic];
