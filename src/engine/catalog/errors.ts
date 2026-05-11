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

// Per ADR-0049: every ability, item, and command set must declare an
// `availability` value at catalog construction time. The TypeScript type
// already requires the field; this runtime guard catches definitions
// that slipped through via `as` casts or dynamic content authoring.
export class MissingAvailabilityError extends Error {
  override readonly name = 'MissingAvailabilityError';

  constructor(
    readonly kindName: string,
    readonly id: string,
  ) {
    super(
      `${kindName} ${JSON.stringify(id)} is missing the required \`availability\` field. ` +
        `Every ability, item, and command set must declare 'available' or 'hidden'.`,
    );
  }
}
