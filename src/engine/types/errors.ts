// Error types thrown by accessors per ADR-0002.
//
// `UnknownEntityError` — an ID-based accessor was called with an ID not
// present in the relevant collection. Treated as a programmer error: the
// caller should have iterated the collection or validated the ID upstream.
//
// `OutOfBoundsError` — a spatial accessor was called with (x, y) outside
// the map's width/height. Same programmer-error treatment: the caller
// should have validated the coordinates before asking. "Is there a tile
// here?" within bounds is a meaningful runtime question (handled by the
// `T | undefined` return); "is there a tile at coordinates the map can't
// represent?" is a bug.
//
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

export class OutOfBoundsError extends Error {
  override readonly name = 'OutOfBoundsError';

  constructor(
    readonly x: number,
    readonly y: number,
    readonly width: number,
    readonly height: number,
  ) {
    super(
      `Coordinates (${x}, ${y}) are outside map bounds (width=${width}, height=${height})`,
    );
  }
}
