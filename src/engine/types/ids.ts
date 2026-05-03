// Branded ID types. Each is structurally a string, but the brand makes
// `UnitId` and `AbilityId` non-interchangeable at the type level even though
// both are strings at runtime. See CLAUDE.md ground rule 4 ("identity by ID").
//
// Mint with the corresponding factory (`unitId(s)`, etc.). The cast is
// localized to one function per kind so the rest of the codebase never sees
// `as UnitId`.

declare const idBrand: unique symbol;

type Branded<K extends string> = string & { readonly [idBrand]: K };

export type UnitId = Branded<'UnitId'>;
export type ChargedActionId = Branded<'ChargedActionId'>;
export type TeamId = Branded<'TeamId'>;
export type AbilityId = Branded<'AbilityId'>;
export type ClassId = Branded<'ClassId'>;
export type CommandSetId = Branded<'CommandSetId'>;
export type ItemId = Branded<'ItemId'>;
export type BucketId = Branded<'BucketId'>;
export type StatusTypeId = Branded<'StatusTypeId'>;
export type RulesetId = Branded<'RulesetId'>;

export const unitId = (s: string): UnitId => s as UnitId;
export const chargedActionId = (s: string): ChargedActionId => s as ChargedActionId;
export const teamId = (s: string): TeamId => s as TeamId;
export const abilityId = (s: string): AbilityId => s as AbilityId;
export const classId = (s: string): ClassId => s as ClassId;
export const commandSetId = (s: string): CommandSetId => s as CommandSetId;
export const itemId = (s: string): ItemId => s as ItemId;
export const bucketId = (s: string): BucketId => s as BucketId;
export const statusTypeId = (s: string): StatusTypeId => s as StatusTypeId;
export const rulesetId = (s: string): RulesetId => s as RulesetId;
