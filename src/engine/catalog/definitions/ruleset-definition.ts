// RulesetDefinition is structurally a leaf type (`engine/types/ruleset.ts`)
// rather than a catalog-only concept; this file is the catalog's pointer
// at it. The Catalog stores rulesets in a Registry keyed on RulesetId
// the same way it stores other definition kinds.

export type { RulesetDefinition } from '../../types/ruleset.ts';
