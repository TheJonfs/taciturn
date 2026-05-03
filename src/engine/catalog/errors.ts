// Catalog-side errors. Distinct from the runtime-state errors in
// `engine/types/errors.ts`: those report missing per-battle entities,
// these report missing or duplicate static definitions.

export class UnknownDefinitionError extends Error {
  override readonly name = 'UnknownDefinitionError';

  constructor(
    readonly kindName: string,
    readonly id: string,
  ) {
    super(`No ${kindName} in catalog with id ${JSON.stringify(id)}`);
  }
}

export class DuplicateDefinitionError extends Error {
  override readonly name = 'DuplicateDefinitionError';

  constructor(
    readonly kindName: string,
    readonly id: string,
  ) {
    super(`Duplicate ${kindName} in catalog: id ${JSON.stringify(id)} appears more than once`);
  }
}
