// Context-first stacked-cell click resolution (S97 / WI2).

import { describe, expect, it } from 'vitest';
import type { Position, Unit } from '@engine/index.ts';
import type { TileStackEntry } from '@renderer/index.ts';
import { resolveContextLayer, resolveInspectionEntry } from './stack-click-resolution.ts';

const deckPos: Position = { x: 2, y: 8, layer: 1 };
const groundPos: Position = { x: 2, y: 8, layer: 0 };
const deckUnit = { id: 'u_deck' } as unknown as Unit;
const groundUnit = { id: 'u_ground' } as unknown as Unit;

function stackWith(deckOccupant: Unit | null, groundOccupant: Unit | null): TileStackEntry[] {
  // Topmost-first, matching the renderer contract.
  return [
    { pos: deckPos, occupant: deckOccupant },
    { pos: groundPos, occupant: groundOccupant },
  ];
}

describe('resolveContextLayer', () => {
  const validOnly = (valid: Position) => (e: TileStackEntry) =>
    e.pos.layer === valid.layer;

  it('keeps a clicked layer that is itself valid (geometry/chip respected)', () => {
    const r = resolveContextLayer(deckPos, stackWith(null, null), validOnly(deckPos));
    expect(r.pos).toEqual(deckPos);
  });

  it('resolves to the single valid other layer (the under-span move fix)', () => {
    // Click landed on the deck; only the ground is a legal destination.
    const r = resolveContextLayer(deckPos, stackWith(null, null), validOnly(groundPos));
    expect(r.pos).toEqual(groundPos);
  });

  it('leaves the click alone when no layer is valid (caller cancels as usual)', () => {
    const r = resolveContextLayer(deckPos, stackWith(null, null), () => false);
    expect(r.pos).toEqual(deckPos);
  });

  it('leaves the click alone when both layers are valid (chip territory)', () => {
    const r = resolveContextLayer(groundPos, stackWith(null, null), () => true);
    expect(r.pos).toEqual(groundPos);
  });

  it('passes single-layer cells through untouched', () => {
    const solo: Position = { x: 5, y: 5, layer: 0 };
    const r = resolveContextLayer(solo, [{ pos: solo, occupant: null }], () => false);
    expect(r.pos).toEqual(solo);
  });

  it('carries the resolved layer occupant with it', () => {
    const r = resolveContextLayer(deckPos, stackWith(null, groundUnit), validOnly(groundPos));
    expect(r.occupant).toBe(groundUnit);
  });
});

describe('resolveInspectionEntry', () => {
  it('prefers the clicked layer occupant', () => {
    const r = resolveInspectionEntry(groundPos, stackWith(deckUnit, groundUnit));
    expect(r.occupant).toBe(groundUnit);
  });

  it('falls back to the topmost occupied layer (the S96 tiebreak, demoted)', () => {
    const r = resolveInspectionEntry(deckPos, stackWith(null, groundUnit));
    expect(r.occupant).toBe(groundUnit);
    const r2 = resolveInspectionEntry(groundPos, stackWith(deckUnit, null));
    expect(r2.occupant).toBe(deckUnit);
  });

  it('returns the clicked entry when the cell is empty', () => {
    const r = resolveInspectionEntry(deckPos, stackWith(null, null));
    expect(r.occupant).toBeNull();
    expect(r.pos).toEqual(deckPos);
  });
});
