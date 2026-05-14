import { describe, expect, it } from 'vitest';
import { elevationLabelFor } from './elevation-label-layer.ts';

describe('elevationLabelFor — every tile labelled', () => {
  it('labels water tiles (elev 0/1)', () => {
    expect(elevationLabelFor(0)).toBe('0');
    expect(elevationLabelFor(1)).toBe('1');
  });

  it('labels baseline ground (elev 2)', () => {
    expect(elevationLabelFor(2)).toBe('2');
  });

  it('labels ridge tiers (elev 3-9)', () => {
    expect(elevationLabelFor(3)).toBe('3');
    expect(elevationLabelFor(7)).toBe('7');
    expect(elevationLabelFor(9)).toBe('9');
  });

  it('generalizes past v1 authored tiers', () => {
    expect(elevationLabelFor(12)).toBe('12');
  });
});
