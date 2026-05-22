// Structural compliance tests for the "Highland Hunters" template
// (Session 45 — Hunter showcase).

import { describe, expect, it } from 'vitest';
import {
  abilityId,
  BUCKET_FIRST_ACTION,
  BUCKET_REACTION,
  BUCKET_SUPPORT,
  BUCKET_MOVEMENT,
  classId,
  commandSetId,
  itemId,
} from '@engine/index.ts';
import { highlandHunters } from './highland-hunters.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('Highland Hunters template', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(highlandHunters);
  });

  it('has the expected display name', () => {
    expect(highlandHunters.name).toBe('Highland Hunters');
  });

  it('Faramund (Hunter) wields a two-handed Longbow with an empty off-hand', () => {
    const hunter = highlandHunters.units.find((u) => u.classId === classId('hunter'));
    expect(hunter).toBeDefined();
    expect(hunter!.name).toBe('Faramund');
    expect(hunter!.equipment.rightHand).toBe(itemId('longbow'));
    // Two-handed → the off-hand must be empty (slotting would reject it).
    expect(hunter!.equipment.leftHand).toBeNull();
  });

  it('Faramund carries Marksmanship + the native R/S/M (Updraft / Eagle Eye / High Jump)', () => {
    const hunter = highlandHunters.units.find((u) => u.classId === classId('hunter'))!;
    expect(hunter.loadout.actionBuckets[BUCKET_FIRST_ACTION] ?? []).toContain(
      commandSetId('marksmanship'),
    );
    expect(hunter.loadout.passiveBuckets[BUCKET_REACTION] ?? []).toContain(abilityId('updraft'));
    expect(hunter.loadout.passiveBuckets[BUCKET_SUPPORT] ?? []).toContain(abilityId('eagle_eye'));
    expect(hunter.loadout.passiveBuckets[BUCKET_MOVEMENT] ?? []).toContain(abilityId('high_jump'));
  });
});
