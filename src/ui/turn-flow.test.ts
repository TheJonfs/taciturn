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
    const s: TurnFlowState = { kind: 'move-select', hoverTarget: null };
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
  it('pickMove → move-select with null hoverTarget', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    expect(transition(s, { kind: 'pickMove' })).toEqual({
      kind: 'move-select',
      hoverTarget: null,
    });
  });

  it('hoverMove in move-select updates hoverTarget', () => {
    const s: TurnFlowState = { kind: 'move-select', hoverTarget: null };
    const pos = { x: 2, y: 3, layer: 0 };
    expect(transition(s, { kind: 'hoverMove', position: pos })).toEqual({
      kind: 'move-select',
      hoverTarget: pos,
    });
  });

  it('hoverMove with null clears hoverTarget', () => {
    const s: TurnFlowState = { kind: 'move-select', hoverTarget: { x: 1, y: 1, layer: 0 } };
    expect(transition(s, { kind: 'hoverMove', position: null })).toEqual({
      kind: 'move-select',
      hoverTarget: null,
    });
  });

  it('pickMoveDestination → move-await-confirm', () => {
    const s: TurnFlowState = { kind: 'move-select', hoverTarget: null };
    const dest = { x: 4, y: 5, layer: 0 };
    expect(transition(s, { kind: 'pickMoveDestination', destination: dest })).toEqual({
      kind: 'move-await-confirm',
      destination: dest,
    });
  });

  it('confirmAccept from move-await-confirm → animation', () => {
    const s: TurnFlowState = {
      kind: 'move-await-confirm',
      destination: { x: 4, y: 5, layer: 0 },
    };
    expect(transition(s, { kind: 'confirmAccept' })).toEqual({ kind: 'animation' });
  });

  it('cancel from move-await-confirm → move-select (re-pick destination)', () => {
    const s: TurnFlowState = {
      kind: 'move-await-confirm',
      destination: { x: 4, y: 5, layer: 0 },
    };
    expect(transition(s, { kind: 'cancel' })).toEqual({
      kind: 'move-select',
      hoverTarget: null,
    });
  });

  it('pickAct with a single command-set entry → ability-list directly', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    const next = transition(s, {
      kind: 'pickAct',
      entries: [{ kind: 'command_set', commandSetId: setA }],
    });
    expect(next).toEqual({
      kind: 'ability-list',
      commandSetId: setA,
      commandSetCount: 1,
    });
  });

  it('pickAct with two command-set entries → command-set-select', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    const next = transition(s, {
      kind: 'pickAct',
      entries: [
        { kind: 'command_set', commandSetId: setA },
        { kind: 'command_set', commandSetId: setB },
      ],
    });
    expect(next).toEqual({ kind: 'command-set-select' });
  });

  it('pickAct with zero entries is a no-op', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    expect(transition(s, { kind: 'pickAct', entries: [] })).toEqual(s);
  });

  it('pickAct with a single free-ability entry → target-select directly', () => {
    // Hypothetical class with only Attack free and no command sets:
    // the picker is skipped.
    const s: TurnFlowState = { kind: 'action-menu' };
    const next = transition(s, {
      kind: 'pickAct',
      entries: [{ kind: 'free_ability', abilityId: attack }],
    });
    expect(next).toEqual({
      kind: 'target-select',
      commandSetId: null,
      commandSetCount: 0,
      abilityId: attack,
      hoverTarget: null,
      tileMode: false,
    });
  });

  it('pickAct with free-ability + command-set entries → command-set-select (the typical Knight/Mage shape)', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    const next = transition(s, {
      kind: 'pickAct',
      entries: [
        { kind: 'free_ability', abilityId: attack },
        { kind: 'command_set', commandSetId: setA },
      ],
    });
    expect(next).toEqual({ kind: 'command-set-select' });
  });

  it('pickFreeAbility from command-set-select → target-select with cancel routing back to the picker', () => {
    const s: TurnFlowState = { kind: 'command-set-select' };
    const next = transition(s, { kind: 'pickFreeAbility', abilityId: attack });
    expect(next).toEqual({
      kind: 'target-select',
      commandSetId: null,
      commandSetCount: 2,
      abilityId: attack,
      hoverTarget: null,
      tileMode: false,
    });
  });

  it('cancel from target-select on a free ability picked via picker → command-set-select', () => {
    const s: TurnFlowState = {
      kind: 'target-select',
      commandSetId: null,
      commandSetCount: 2,
      abilityId: attack,
      hoverTarget: null,
      tileMode: false,
    };
    expect(transition(s, { kind: 'cancel' })).toEqual({ kind: 'command-set-select' });
  });

  it('cancel from target-select on a free ability picked without a picker → action-menu', () => {
    const s: TurnFlowState = {
      kind: 'target-select',
      commandSetId: null,
      commandSetCount: 0,
      abilityId: attack,
      hoverTarget: null,
      tileMode: false,
    };
    expect(transition(s, { kind: 'cancel' })).toEqual({ kind: 'action-menu' });
  });

  it('pickWait → wait-confirm (facing picker)', () => {
    const s: TurnFlowState = { kind: 'action-menu' };
    expect(transition(s, { kind: 'pickWait' })).toEqual({ kind: 'wait-confirm' });
  });

  it('commitWait from wait-confirm → animation', () => {
    const s: TurnFlowState = { kind: 'wait-confirm' };
    expect(transition(s, { kind: 'commitWait', facing: 'N' })).toEqual({ kind: 'animation' });
  });

  it('cancel from wait-confirm → action-menu', () => {
    const s: TurnFlowState = { kind: 'wait-confirm' };
    expect(transition(s, { kind: 'cancel' })).toEqual({ kind: 'action-menu' });
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
      tileMode: false,
    });
  });

  it('hoverTarget updates target-select state', () => {
    const s: TurnFlowState = {
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      hoverTarget: null,
      tileMode: false,
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
    const s: TurnFlowState = { kind: 'move-select', hoverTarget: null };
    expect(transition(s, { kind: 'commitMove' })).toEqual({ kind: 'animation' });
  });

  it('commitTarget with confirmStep=true → await-confirm', () => {
    const s: TurnFlowState = {
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      hoverTarget: null,
      tileMode: false,
    };
    const next = transition(s, { kind: 'commitTarget', action: attackAction, confirmStep: true });
    expect(next).toEqual({
      kind: 'await-confirm',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      action: attackAction,
      tileMode: false,
    });
  });

  it('commitTarget with confirmStep=false → animation', () => {
    const s: TurnFlowState = {
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      hoverTarget: null,
      tileMode: false,
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
      tileMode: false,
    };
    expect(transition(s, { kind: 'confirmAccept' })).toEqual({ kind: 'animation' });
  });
});

describe('turn-flow reducer — cancel back-paths', () => {
  it('cancel from move-select → action-menu', () => {
    const s: TurnFlowState = { kind: 'move-select', hoverTarget: null };
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
      tileMode: false,
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
      tileMode: false,
    };
    expect(transition(s, { kind: 'cancel' })).toEqual({
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: attack,
      hoverTarget: null,
      tileMode: false,
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
