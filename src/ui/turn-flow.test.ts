// Tests for the turn-flow state machine reducer.
// Exhaustive over the documented transitions (one happy-path per
// transition + cancel back-paths + lifecycle overrides).

import { describe, expect, it } from 'vitest';
import { abilityId, commandSetId, type ProposedAction } from '@engine/index.ts';
import { INITIAL_TURN_FLOW, escCancelsFrom, transition, type TurnFlowState } from './turn-flow.ts';
import { shouldDeferToConfirm } from './use-turn-flow.ts';

const setA = commandSetId('battle_skill');
const setB = commandSetId('water_magic');
const attack = abilityId('attack');
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

describe('turn-flow reducer — Math Skill picker (Session 49)', () => {
  const mathAbility = abilityId('precision_fire');

  it('pickAbility with route=math_skill from ability-list → math-skill-target-select with null picks', () => {
    const s: TurnFlowState = { kind: 'ability-list', commandSetId: setA, commandSetCount: 1 };
    expect(
      transition(s, { kind: 'pickAbility', abilityId: mathAbility, route: 'math_skill' }),
    ).toEqual({
      kind: 'math-skill-target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: mathAbility,
      parameter: null,
      value: null,
    });
  });

  it('pickMathSkillParameter sets parameter and clears value', () => {
    const s: TurnFlowState = {
      kind: 'math-skill-target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: mathAbility,
      parameter: 'ct',
      value: 5,
    };
    expect(transition(s, { kind: 'pickMathSkillParameter', parameter: 'level' })).toEqual({
      kind: 'math-skill-target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: mathAbility,
      parameter: 'level',
      value: null,
    });
  });

  it('pickMathSkillValue is ignored when parameter is null', () => {
    const s: TurnFlowState = {
      kind: 'math-skill-target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: mathAbility,
      parameter: null,
      value: null,
    };
    expect(transition(s, { kind: 'pickMathSkillValue', value: 3 })).toEqual(s);
  });

  it('pickMathSkillValue sets value when parameter is non-null', () => {
    const s: TurnFlowState = {
      kind: 'math-skill-target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: mathAbility,
      parameter: 'ct',
      value: null,
    };
    expect(transition(s, { kind: 'pickMathSkillValue', value: 'prime' })).toEqual({
      kind: 'math-skill-target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: mathAbility,
      parameter: 'ct',
      value: 'prime',
    });
  });

  it('commitTarget transitions to animation (no await-confirm gate; picker is implicit confirm)', () => {
    const s: TurnFlowState = {
      kind: 'math-skill-target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: mathAbility,
      parameter: 'ct',
      value: 5,
    };
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: 'u1' as never,
      payload: { abilityId: mathAbility, target: { kind: 'math_skill', parameter: 'ct', value: 5 } },
    };
    expect(
      transition(s, { kind: 'commitTarget', action, confirmStep: true }),
    ).toEqual({ kind: 'animation' });
  });

  // S50 regression: the FSM reducer correctly bypasses await-confirm
  // for math-skill-target-select (it transitions straight to animation
  // regardless of confirmStep — picker is the implicit confirm surface).
  // The submit-helper in use-turn-flow.ts must honor the same convention,
  // otherwise it short-circuits on `confirmStep === 'confirm'` and the
  // action never reaches the controller. `shouldDeferToConfirm` is the
  // extracted decision; this test pins the asymmetry that caused the bug.
  it("shouldDeferToConfirm: false for math_skill targets even when confirmStep='confirm'", () => {
    const mathAction: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: 'u1' as never,
      payload: {
        abilityId: mathAbility,
        target: { kind: 'math_skill', parameter: 'current_hp', value: 4 },
      },
    };
    expect(shouldDeferToConfirm(mathAction, 'confirm')).toBe(false);
    expect(shouldDeferToConfirm(mathAction, 'skip')).toBe(false);
  });

  it("shouldDeferToConfirm: true for non-math_skill use_ability when confirmStep='confirm'", () => {
    // Sanity: the helper still defers for normal target-select actions.
    expect(shouldDeferToConfirm(attackAction, 'confirm')).toBe(true);
    expect(shouldDeferToConfirm(attackAction, 'skip')).toBe(false);
  });

  it('cancel from math-skill-target-select returns to ability-list when commandSetId is set', () => {
    const s: TurnFlowState = {
      kind: 'math-skill-target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: mathAbility,
      parameter: null,
      value: null,
    };
    expect(transition(s, { kind: 'cancel' })).toEqual({
      kind: 'ability-list',
      commandSetId: setA,
      commandSetCount: 1,
    });
  });
});

describe('turn-flow reducer — tile-set (Barrier) picker (Session 55)', () => {
  const barrier = abilityId('barrier');
  const anchorPhase: TurnFlowState = {
    kind: 'tile-set-target-select',
    commandSetId: setA,
    commandSetCount: 1,
    abilityId: barrier,
    anchor: null,
    hoverTarget: null,
  };

  it('pickAbility with route=tile_set from ability-list → tile-set-target-select with null anchor', () => {
    const s: TurnFlowState = { kind: 'ability-list', commandSetId: setA, commandSetCount: 1 };
    expect(transition(s, { kind: 'pickAbility', abilityId: barrier, route: 'tile_set' })).toEqual({
      kind: 'tile-set-target-select',
      commandSetId: setA,
      commandSetCount: 1,
      abilityId: barrier,
      anchor: null,
      hoverTarget: null,
    });
  });

  it('pickTileSetAnchor sets the anchor and clears hover (anchor → extent phase)', () => {
    const anchor = { x: 2, y: 3, layer: 0 };
    expect(transition({ ...anchorPhase, hoverTarget: { x: 1, y: 1, layer: 0 } }, { kind: 'pickTileSetAnchor', anchor })).toEqual({
      ...anchorPhase,
      anchor,
      hoverTarget: null,
    });
  });

  it('hoverTarget updates the preview tile in both phases', () => {
    const hover = { x: 4, y: 3, layer: 0 };
    expect(transition(anchorPhase, { kind: 'hoverTarget', position: hover })).toEqual({
      ...anchorPhase,
      hoverTarget: hover,
    });
  });

  it('commitTarget transitions to animation (picker is the implicit confirm surface)', () => {
    const extentPhase: TurnFlowState = { ...anchorPhase, anchor: { x: 2, y: 3, layer: 0 } };
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: 'u1' as never,
      payload: {
        abilityId: barrier,
        target: { kind: 'tile_set', positions: [{ x: 2, y: 3, layer: 0 }, { x: 3, y: 3, layer: 0 }, { x: 4, y: 3, layer: 0 }] },
      },
    };
    expect(transition(extentPhase, { kind: 'commitTarget', action, confirmStep: true })).toEqual({ kind: 'animation' });
  });

  it('cancel in extent phase drops back to anchor re-pick (clears anchor)', () => {
    const extentPhase: TurnFlowState = { ...anchorPhase, anchor: { x: 2, y: 3, layer: 0 }, hoverTarget: { x: 4, y: 3, layer: 0 } };
    expect(transition(extentPhase, { kind: 'cancel' })).toEqual(anchorPhase);
  });

  it('cancel in anchor phase returns to ability-list when commandSetId is set', () => {
    expect(transition(anchorPhase, { kind: 'cancel' })).toEqual({
      kind: 'ability-list',
      commandSetId: setA,
      commandSetCount: 1,
    });
  });

  it('cancel in anchor phase falls back to action-menu for a single-entry free-ability picker', () => {
    const freeAnchor: TurnFlowState = { ...anchorPhase, commandSetId: null, commandSetCount: 0 };
    expect(transition(freeAnchor, { kind: 'cancel' })).toEqual({ kind: 'action-menu' });
  });

  it('shouldDeferToConfirm: false for tile_set targets even when confirmStep=confirm', () => {
    const action: ProposedAction = {
      type: 'use_ability',
      source: 'player',
      actorId: 'u1' as never,
      payload: { abilityId: barrier, target: { kind: 'tile_set', positions: [{ x: 0, y: 0, layer: 0 }] } },
    };
    expect(shouldDeferToConfirm(action, 'confirm')).toBe(false);
  });
});

// --- S100: ESC policy — escCancelsFrom paired with the reducer ---
//
// BattleView routes ESC via `escCancelsFrom`: cancelable states get a
// `cancel` event, the rest open the pause overlay. This suite pins the
// pairing BOTH ways over one representative of EVERY state kind, so a
// future sub-state can't repeat the original bug (added to the union,
// forgotten by the ESC handler, ESC silently pauses instead of backing
// out). The reducer returns the same reference for ignored events, so
// reference (in)equality IS the "cancel is meaningful" probe.

describe('escCancelsFrom — paired with the cancel transitions', () => {
  const u1 = 'u1' as never;
  // One representative per TurnFlowState kind. Exhaustiveness is
  // enforced by the Record type — adding a state kind without a row
  // here is a compile error.
  const REPRESENTATIVES: Record<TurnFlowState['kind'], TurnFlowState> = {
    idle: { kind: 'idle' },
    'action-menu': { kind: 'action-menu' },
    'move-select': { kind: 'move-select', hoverTarget: null },
    'move-await-confirm': { kind: 'move-await-confirm', destination: { x: 1, y: 1, layer: 0 } },
    'command-set-select': { kind: 'command-set-select' },
    'ability-list': { kind: 'ability-list', commandSetId: setA, commandSetCount: 2 },
    'target-select': {
      kind: 'target-select',
      commandSetId: setA,
      commandSetCount: 2,
      abilityId: attack,
      hoverTarget: null,
      tileMode: false,
    },
    'await-confirm': {
      kind: 'await-confirm',
      commandSetId: setA,
      commandSetCount: 2,
      abilityId: attack,
      action: attackAction,
      tileMode: false,
    },
    'wait-confirm': { kind: 'wait-confirm' },
    'compound-item-select': { kind: 'compound-item-select', commandSetId: setA, commandSetCount: 2 },
    'throw-item-item-select': {
      kind: 'throw-item-item-select',
      commandSetId: setA,
      commandSetCount: 2,
      abilityId: attack,
      targetUnitId: u1,
    },
    'math-skill-target-select': {
      kind: 'math-skill-target-select',
      commandSetId: setA,
      commandSetCount: 2,
      abilityId: attack,
      parameter: null,
      value: null,
    },
    'tile-set-target-select': {
      kind: 'tile-set-target-select',
      commandSetId: setA,
      commandSetCount: 2,
      abilityId: attack,
      anchor: null,
      hoverTarget: null,
    },
    'grapple-throw-target-select': {
      kind: 'grapple-throw-target-select',
      commandSetId: setA,
      commandSetCount: 2,
      abilityId: attack,
      throweeId: null,
      hoverTarget: null,
    },
    animation: { kind: 'animation' },
  };

  it('every cancelable state actually consumes the cancel event', () => {
    for (const state of Object.values(REPRESENTATIVES)) {
      if (!escCancelsFrom(state)) continue;
      const after = transition(state, { kind: 'cancel' });
      expect(after, `'${state.kind}' claims ESC-cancels but ignored the cancel event`).not.toBe(
        state,
      );
    }
  });

  it('every non-cancelable state ignores cancel (ESC correctly falls through to pause)', () => {
    for (const state of Object.values(REPRESENTATIVES)) {
      if (escCancelsFrom(state)) continue;
      const after = transition(state, { kind: 'cancel' });
      expect(after, `'${state.kind}' routes ESC to pause but would also consume a cancel`).toBe(
        state,
      );
    }
  });

  it('the four once-forgotten sub-states are ESC-cancelable (the S100 report)', () => {
    for (const kind of [
      'compound-item-select',
      'throw-item-item-select',
      'math-skill-target-select',
      'grapple-throw-target-select',
      'move-await-confirm',
    ] as const) {
      expect(escCancelsFrom(REPRESENTATIVES[kind]), kind).toBe(true);
    }
  });
});
