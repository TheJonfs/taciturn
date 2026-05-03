import type { RulesetDefinition } from '@engine/index.ts';
import { defaultRuleset } from './default.ts';

export { defaultRuleset } from './default.ts';

export const rulesets: ReadonlyArray<RulesetDefinition> = [defaultRuleset];
