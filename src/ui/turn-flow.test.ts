// Tests for the turn-flow state machine reducer.
// Exhaustive over the documented transitions (one happy-path per
// transition + cancel back-paths + lifecycle overrides).

import { describe, expect, it } from 'vitest';
import { abilityId, commandSetId, type ProposedAction } from '@engine/index.ts';
import { INITIAL_TURN_FLOW, transition, type TurnFlowState } from './turn-flow.ts';

const setA = commandSetId('battle_skill');
const setB = commandSetId('water_magic');
const attack = abilityId('attack');
const wait: ProposedAction = {
  type: 'wait',
  source: 'player',
  actorId: 'u1' as never,
  payload: {},
};
const attackAction: ProposedAction = {
  type: 'use_ability',
  source: 'player',
  actorId: 'u1' as never,
  payload: { abilityId: attack, target: { kind: 'unit', unitId: 'enemy' as never } },
};

describe('turn-flow reducer — lifecycle', () => {
  it('starts idle', () => {
    expect(INITIAL_TURN_FLOW).toEqual({ kind: 'idle' });
  });

  it('activeTurnStart → action-menu from any state', () => {
    const s: TurnFlowState = { kind: 'animation' };
    expect(transition(s, { kind: 'activeTurnStart' })).toEqual({ kind: 'action-menu' });
  });

  it('activeTurnEnd → idle from any state', () => {
    const s: TurnFlowState = { kind: 'move-select' };
    expect(transition(s, { kind: 'activeTurnEnd' })).toEqual({ kind: 'idle' });
  });

  it('animationEnded → action-menu when still our turn', () => {
    const s: TurnFlowState = { kind: 'animation' };
    expect(transition(s, { kind: 'animationEnded', stillOurTurn: true })).toEqual({
      kind: 'action-menu',
    });
  });

  it('animationEnded → idle when not our turn anymore', () => {
    const s: TurnFlowState = { kind: 'animation' };
    expect(transition(s, { kind: 'animationEnded', stillOurTurn: false })).toEqual({
      kind: 'idle',
    });
  });
});

describe('turn-flow reducer — top-level menu picks', () => {
  it('pickMove → move-select', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    expect(transition(s, { kind: 'pickMove' })).toEqual({ kind: 'move-select' });
  });

  it('pickAct with single command set → ability-list directly', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    const next = transition(s, { kind: 'pickAct', commandSets: [setA] });
    expect(next).toEqual({
      kind: 'ability-list',
      commandSetId: setA,
      commandSetCount: 1,
    });
  });

  it('pickAct with two command sets → command-set-select', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    const next = transition(s, { kind: 'pickAct', commandSets: [setA, setB] });
    expect(next).toEqual({ kind: 'command-set-select' });
  });

  it('pickAct with zero command sets is a no-op', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    expect(transition(s, { kind: 'pickAct', commandSets: [] })).toEqual(s);
  });

  it('commitWait → animation', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    expect(transition(s, { kind: 'commitWait' })).toEqual({ kind: 'animation' });
  });
});

describe('turn-flow reducer — submenu picks', () => {
  it('pickCommandSet from command-set-select → ability-list (count 2)', () => {
    const s: TurnFlowState = { kind: 'command-set-select' };
    expect(transition(s, { kind: 'pickCommandSet', commandSetId: setA })).toEqual({
      kind: 'ability-list',
      commandSetId: setA,
      commandSetCount: 2,
    });
  });

  it('pickAbility from ability-list → target-select', () => {
    const s: TurnFlowState = {
      kind: 'ability-list',
      commandSetId: setA,
      commandSetCount: 1,
    };
    expect(transition(s, { kind: 'pickAbility', abilityId: attack })).toEqual({
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      hoverTarget: null,
    });
  });

  it('hoverTarget updates target-select state', () => {
    const s: TurnFlowState = {
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      hoverTarget: null,
    };
    const next = transition(s, {
      kind: 'hoverTarget',
      position: { x: 5, y: 6, layer: 0 },
    });
    expect(next.kind).toBe('target-select');
    if (next.kind !== 'target-select') return;
    expect(next.hoverTarget).toEqual({ x: 5, y: 6, layer: 0 });
  });
});

describe('turn-flow reducer — commit paths', () => {
  it('commitMove from move-select → animation', () => {
    const s: TurnFlowState = { kind: 'move-select' };
    expect(transition(s, { kind: 'commitMove' })).toEqual({ kind: 'animation' });
  });

  it('commitTarget with confirmStep=true → await-confirm', () => {
    const s: TurnFlowState = {
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      hoverTarget: null,
    };
    const next = transition(s, { kind: 'commitTarget', action: attackAction, confirmStep: true });
    expect(next).toEqual({
      kind: 'await-confirm',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      action: attackAction,
    });
  });

  it('commitTarget with confirmStep=false → animation', () => {
    const s: TurnFlowState = {
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      hoverTarget: null,
    };
    const next = transition(s, { kind: 'commitTarget', action: attackAction, confirmStep: false });
    expect(next).toEqual({ kind: 'animation' });
  });

  it('confirmAccept from await-confirm → animation', () => {
    const s: TurnFlowState = {
      kind: 'await-confirm',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      action: attackAction,
    };
    expect(transition(s, { kind: 'confirmAccept' })).toEqual({ kind: 'animation' });
  });
});

describe('turn-flow reducer — cancel back-paths', () => {
  it('cancel from move-select → action-menu', () => {
    const s: TurnFlowState = { kind: 'move-select' };
    expect(transition(s, { kind: 'cancel' })).toEqual({ kind: 'action-menu' });
  });

  it('cancel from command-set-select → action-menu', () => {
    const s: TurnFlowState = { kind: 'command-set-select' };
    expect(transition(s, { kind: 'cancel' })).toEqual({ kind: 'action-menu' });
  });

  it('cancel from ability-list with single set → action-menu', () => {
    const s: TurnFlowState = {
      kind: 'ability-list',
      commandSetId: setA,
      commandSetCount: 1,
    };
    expect(transition(s, { kind: 'cancel' })).toEqual({ kind: 'action-menu' });
  });

  it('cancel from ability-list with multiple sets → command-set-select', () => {
    const s: TurnFlowState = {
      kind: 'ability-list',
      commandSetId: setA,
      commandSetCount: 2,
    };
    expect(transition(s, { kind: 'cancel' })).toEqual({ kind: 'command-set-select' });
  });

  it('cancel from target-select → ability-list with same set', () => {
    const s: TurnFlowState = {
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 2,
      abilityId: attack,
      hoverTarget: null,
    };
    expect(transition(s, { kind: 'cancel' })).toEqual({
      kind: 'ability-list',
      commandSetId: setA,
      commandSetCount: 2,
    });
  });

  it('cancel from await-confirm → target-select with same ability', () => {
    const s: TurnFlowState = {
      kind: 'await-confirm',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      action: attackAction,
    };
    expect(transition(s, { kind: 'cancel' })).toEqual({
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      hoverTarget: null,
    });
  });
});

describe('turn-flow reducer — guards', () => {
  it('idle ignores menu events (only lifecycle leaves idle)', () => {
    const s: TurnFlowState = { kind: 'idle' };
    expect(transition(s, { kind: 'pickMove' })).toEqual(s);
    expect(transition(s, { kind: 'cancel' })).toEqual(s);
  });

  it('animation ignores menu events', () => {
    const s: TurnFlowState = { kind: 'animation' };
    expect(transition(s, { kind: 'pickMove' })).toEqual(s);
    expect(transition(s, { kind: 'cancel' })).toEqual(s);
  });
});
