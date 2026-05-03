import type { CommandSetDefinition } from '@engine/index.ts';
import { battleSkill } from './battle-skill.ts';

export const commandSets: ReadonlyArray<CommandSetDefinition> = [battleSkill];
