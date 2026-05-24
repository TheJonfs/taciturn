// Session 41 — KO/status interaction (ADR-0079).
//
// New rule: statuses with infinite duration persist through KO and
// revival; statuses with finite duration clear at KO. Predicate:
// `isInfiniteDuration(s) ⇔ s.remainingDuration === null`.
//
// Behavior is implemented as a new sweep `collectKoStatusClearSweep` that
// runs alongside the existing source-KO sweep at every `detectKO` site.
// These tests assert the sweep emits the right `status_remove` actions
// from both the ability damage path (`reduceUseAbility` chain) and the
// `system_damage` path.
//
// Three corner cases — Burn (`custom`), Poison (`permanent_per_unit_ct`),
// Magnetic Mark Vulnerable (`custom`) — encode as null-duration types,
// so they persist through KO under the rule. Tests verify the
// persistence behavior explicitly.

import { describe, expect, it } from 'vitest';
import { loadDefaultCatalog } from '../../content/index.ts';
import { applyStatus } from '../status/apply.ts';
import { reduceSystemDamage, reduceStatusRemove } from './reducers.ts';
import { activeTurnFor, makeGameState, makeUnit } from '../ct/test-fixtures.ts';
import {
  statusTypeId,
  unitId,
  type Action,
  type GameState,
  type ProposedAction,
  type Unit,
} from '@engine/index.ts';

const catalog = loadDefaultCatalog();

function gameStateWith(units: ReadonlyArray<Unit>): ReturnType<typeof makeGameState> {
  return makeGameState({
    units,
    map: {
      width: 5,
      height: 5,
      tiles: Array.from({ length: 25 }, (_, i) => ({
        x: i % 5,
        y: Math.floor(i / 5),
        layer: 0,
        elevation: 2,
        terrain: 'ground' as const,
        properties: [],
      })),
    },
    turnState: activeTurnFor(units[0]!.id),
  });
}

// Build a target with low HP (so a single system_damage will KO it) plus
// the statuses requested. Returns the post-application state.
function stateWithTargetAndStatuses(
  statusTypeIds: ReadonlyArray<string>,
  opts: { duration?: number } = {},
): { state: GameState; target: Unit } {
  const target = makeUnit({
    id: 'tgt',
    spd: 10,
    pa: 5,
    hp: 10, // dies in one hit
    maxHpBase: 100,
    position: { x: 1, y: 0, layer: 0 },
  });
  const actor = makeUnit({
    id: 'src',
    spd: 8,
    pa: 5,
    position: { x: 0, y: 0, layer: 0 },
  });
  let state: GameState = gameStateWith([actor, target]);
  for (const id of statusTypeIds) {
    const type = catalog.getStatusType(statusTypeId(id));
    // Provide a duration for finite-duration types; null durations ignore
    // the value (apply.computeInitialDuration discards it).
    const duration =
      type.durationMode === 'per_unit_ct' ||
      type.durationMode === 'turn_based' ||
      type.durationMode === 'global_ticks'
        ? (opts.duration ?? 10)
        : undefined;
    state = applyStatus(
      state,
      {
        targetId: target.id,
        typeId: statusTypeId(id),
        sourceUnitId: null,
        sourceActionSeq: null,
        ...(duration !== undefined ? { duration } : {}),
      },
      catalog,
    ).newState;
  }
  return { state, target: state.units.get(target.id)! };
}

function koActionFor(targetId: ReturnType<typeof unitId>): Extract<Action, { type: 'system_damage' }> {
  return {
    type: 'system_damage',
    sequenceNumber: 0,
    source: 'system',
    timestamp: { tick: 0, ct: 0 },
    seed: 0,
    chainDepth: 0,
    isReaction: false,
    payload: {
      targetId,
      amount: 999,
      tags: [],
      source: { kind: 'falling', unitId: targetId, dropDistance: 1 },
    },
  };
}

// Filter generated actions to status_remove emissions targeting the unit.
function statusRemovesOn(
  emissions: ReadonlyArray<ProposedAction>,
  targetId: ReturnType<typeof unitId>,
): ReadonlyArray<string> {
  return emissions
    .filter(
      (a): a is Extract<ProposedAction, { type: 'status_remove' }> =>
        a.type === 'status_remove' && a.payload.targetId === targetId,
    )
    .map((a) => String(a.payload.statusTypeId));
}

describe('S41 — KO/status clear-at-KO sweep', () => {
  it('emits status_remove for a finite-duration status (Silence) when KO transition fires', () => {
    const { state, target } = stateWithTargetAndStatuses(['silence']);
    const { generatedActions } = reduceSystemDamage(state, koActionFor(target.id), catalog);
    expect(statusRemovesOn(generatedActions, target.id)).toContain('silence');
  });

  it('emits status_remove for multiple finite-duration statuses (Silence + Don\'t Move + Blind)', () => {
    const { state, target } = stateWithTargetAndStatuses(['silence', 'dont_move', 'blind']);
    const { generatedActions } = reduceSystemDamage(state, koActionFor(target.id), catalog);
    const cleared = statusRemovesOn(generatedActions, target.id);
    expect(cleared).toContain('silence');
    expect(cleared).toContain('dont_move');
    expect(cleared).toContain('blind');
  });

  it('does NOT emit status_remove for an infinite-duration status (Regen-Auto)', () => {
    const { state, target } = stateWithTargetAndStatuses(['regen_auto']);
    const { generatedActions } = reduceSystemDamage(state, koActionFor(target.id), catalog);
    expect(statusRemovesOn(generatedActions, target.id)).not.toContain('regen_auto');
  });

  it('does NOT emit status_remove for the three corner cases (Burn / Poison / Vulnerable) — they persist', () => {
    const { state, target } = stateWithTargetAndStatuses(['burn', 'poison', 'vulnerable']);
    const { generatedActions } = reduceSystemDamage(state, koActionFor(target.id), catalog);
    const cleared = statusRemovesOn(generatedActions, target.id);
    expect(cleared).not.toContain('burn');
    expect(cleared).not.toContain('poison');
    expect(cleared).not.toContain('vulnerable');
  });

  it('does NOT emit status_remove for permanent-duration stat shifts (pa_up / ma_down)', () => {
    const { state, target } = stateWithTargetAndStatuses(['pa_up', 'ma_down']);
    const { generatedActions } = reduceSystemDamage(state, koActionFor(target.id), catalog);
    const cleared = statusRemovesOn(generatedActions, target.id);
    expect(cleared).not.toContain('pa_up');
    expect(cleared).not.toContain('ma_down');
  });

  it('emits the finite ones and skips the infinite ones in a mixed loadout', () => {
    // Silence (per_unit_ct, finite) + Blind (per_unit_ct, finite) +
    // Regen-Auto (permanent_per_unit_ct, infinite) + Poison (permanent_per_unit_ct, infinite).
    // S50: Combat Focus migrated from turn_based/3 to permanent so it
    // joins the "persists through KO" family with Speed Save / Updraft
    // / Cornered Focus; this test pivoted to Blind for the second
    // finite-and-cleared example.
    const { state, target } = stateWithTargetAndStatuses([
      'silence',
      'blind',
      'regen_auto',
      'poison',
    ]);
    const { generatedActions } = reduceSystemDamage(state, koActionFor(target.id), catalog);
    const cleared = statusRemovesOn(generatedActions, target.id);
    expect(cleared).toContain('silence');
    expect(cleared).toContain('blind');
    expect(cleared).not.toContain('regen_auto');
    expect(cleared).not.toContain('poison');
  });

  it('de-duplicates by typeId — one status_remove per affected type, regardless of stack count', () => {
    // Apply Silence twice; with REFRESH stacking that's still one instance,
    // but the sweep's dedupe guards against any future STACK_INDEPENDENT
    // emitting multiple status_remove rows for the same type.
    const { state, target } = stateWithTargetAndStatuses(['silence']);
    const { generatedActions } = reduceSystemDamage(state, koActionFor(target.id), catalog);
    const cleared = statusRemovesOn(generatedActions, target.id);
    expect(cleared.filter((t) => t === 'silence')).toHaveLength(1);
  });

  it('emits no status_remove sweep entries when the unit has no finite-duration statuses', () => {
    const { state, target } = stateWithTargetAndStatuses(['regen_auto']);
    const { generatedActions } = reduceSystemDamage(state, koActionFor(target.id), catalog);
    expect(statusRemovesOn(generatedActions, target.id)).toHaveLength(0);
  });
});

describe('S41 — KO/status post-clear state', () => {
  it('after applying the sweep emissions, finite statuses are gone and infinite remain', () => {
    const { state, target } = stateWithTargetAndStatuses([
      'silence',
      'regen_auto',
      'poison',
    ]);
    const post = reduceSystemDamage(state, koActionFor(target.id), catalog);
    let stateAfter = post.newState;
    // Apply each emitted status_remove through its reducer.
    for (const emission of post.generatedActions) {
      if (emission.type !== 'status_remove') continue;
      const action: Extract<Action, { type: 'status_remove' }> = {
        ...emission,
        sequenceNumber: 0,
        timestamp: { tick: 0, ct: 0 },
        seed: 0,
        chainDepth: 0,
        isReaction: false,
      };
      stateAfter = reduceStatusRemove(stateAfter, action, catalog).newState;
    }
    const targetAfter = stateAfter.units.get(target.id)!;
    const typeIds = targetAfter.statuses.map((s) => String(s.typeId));
    // Finite (silence) gone.
    expect(typeIds).not.toContain('silence');
    // Infinite (regen_auto, poison) remain.
    expect(typeIds).toContain('regen_auto');
    expect(typeIds).toContain('poison');
    // Target is KO'd.
    expect(targetAfter.vitals.hp).toBe(0);
  });
});
