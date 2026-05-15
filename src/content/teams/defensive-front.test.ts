// Structural compliance tests for the "Defensive Front" template
// (Session 38).

import { describe, expect, it } from 'vitest';
import { BUCKET_SECONDARY_COMMAND_SETS, commandSetId } from '@engine/index.ts';
import { defensiveFront } from './defensive-front.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('Defensive Front template', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(defensiveFront);
  });

  it('has the expected display name', () => {
    expect(defensiveFront.name).toBe('Defensive Front');
  });

  it('Knight carries Earth Spells as the secondary command set (Regen substrate)', () => {
    const knight = defensiveFront.units[0]!;
    expect(String(knight.classId)).toBe('knight');
    expect(
      knight.loadout.actionBuckets[BUCKET_SECONDARY_COMMAND_SETS] ?? [],
    ).toContain(commandSetId('earth_spells'));
  });
});
