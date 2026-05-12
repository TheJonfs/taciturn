// Tests for the bucket / slot label helpers.

import { describe, expect, it } from 'vitest';
import {
  BUCKET_FIRST_ACTION,
  BUCKET_MOVEMENT,
  BUCKET_REACTION,
  BUCKET_SECONDARY_COMMAND_SETS,
  BUCKET_SUPPORT,
} from '../engine/abilities/constants.ts';
import { bucketLabel, slotLabel } from './labels.ts';
import { bucketId } from '../engine/types/index.ts';

describe('bucketLabel', () => {
  it('returns human-readable labels for every v1 bucket id', () => {
    expect(bucketLabel(BUCKET_FIRST_ACTION)).toBe('Primary Action');
    expect(bucketLabel(BUCKET_SECONDARY_COMMAND_SETS)).toBe('Secondary Action(s)');
    expect(bucketLabel(BUCKET_REACTION)).toBe('Reaction(s)');
    expect(bucketLabel(BUCKET_SUPPORT)).toBe('Support(s)');
    expect(bucketLabel(BUCKET_MOVEMENT)).toBe('Movement(s)');
  });

  it('falls back to the raw id string when an unknown bucket id arrives', () => {
    // Catalog drift / future bucket added without a label — defensive
    // fallback keeps the panel rendering something.
    expect(bucketLabel(bucketId('hypothetical_new_bucket'))).toBe('hypothetical_new_bucket');
  });
});

describe('slotLabel', () => {
  it('returns human-readable labels for every equipment slot id', () => {
    expect(slotLabel('leftHand')).toBe('Left Hand');
    expect(slotLabel('rightHand')).toBe('Right Hand');
    expect(slotLabel('headgear')).toBe('Head');
    expect(slotLabel('armor')).toBe('Body');
    expect(slotLabel('accessory')).toBe('Accessory');
  });
});
