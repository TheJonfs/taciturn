// Error types thrown by accessors per ADR-0002.
//
// `UnknownEntityError` — an ID-based accessor was called with an ID not
// present in the relevant collection. Treated as a programmer error: the
// caller should have iterated the collection or validated the ID upstream.
// Catch points are deliberately scarce; the reducer (session 7) catches at
// the top of action processing as a last-ditch safeguard.

export class UnknownEntityError extends Error {
  override readonly name = 'UnknownEntityError';

  constructor(
    readonly entityKind: string,
    readonly id: string,
  ) {
    super(`No ${entityKind} with id ${JSON.stringify(id)}`);
  }
}
