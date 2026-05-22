// Structural compliance tests for the "Defensive Front" template
// (Session 38; retrofit Session 39b — Earth-Spells stopgap on the
// Knight + Water Mage replaced by a real Alchemist).

import { describe, expect, it } from 'vitest';
import { abilityId, BUCKET_FIRST_ACTION, BUCKET_REACTION, BUCKET_SUPPORT, BUCKET_MOVEMENT, classId, commandSetId } from '@engine/index.ts';
import { defensiveFront } from './defensive-front.ts';
import { assertTemplateCompliance } from './template-compliance.ts';

describe('Defensive Front template', () => {
  it('passes structural compliance', () => {
    assertTemplateCompliance(defensiveFront);
  });

  it('has the expected display name', () => {
    expect(defensiveFront.name).toBe('Defensive Front');
  });

  it('Beorn (Alchemist) carries the alchemy command set + Field Kit / Field Recovery / Combat Focus', () => {
    const alchemist = defensiveFront.units.find((u) => u.classId === classId('alchemist'));
    expect(alchemist).toBeDefined();
    expect(alchemist!.name).toBe('Beorn');
    // Alchemy is on first-action via class default — first_action bucket
    // entry should include it.
    const firstAction = alchemist!.loadout.actionBuckets[BUCKET_FIRST_ACTION] ?? [];
    expect(firstAction).toContain(commandSetId('alchemy'));
    // R/S/M passives all equipped (Field Kit grants the starting
    // Potion + Phoenix Down + Remedy stockpile, exercised end-to-end
    // by the orchestrator on battle start).
    expect(alchemist!.loadout.passiveBuckets[BUCKET_REACTION] ?? []).toContain(
      abilityId('combat_focus'),
    );
    expect(alchemist!.loadout.passiveBuckets[BUCKET_SUPPORT] ?? []).toContain(
      abilityId('field_kit'),
    );
    expect(alchemist!.loadout.passiveBuckets[BUCKET_MOVEMENT] ?? []).toContain(
      abilityId('field_recovery'),
    );
  });
});
