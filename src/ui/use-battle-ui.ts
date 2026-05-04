// useBattleUi — input state machine for the battle HUD.
//
// Owns the "what's the player doing right now" state:
//   idle → picking-move → (commit move, back to idle)
//   idle → picking-attack → (commit attack, back to idle)
//   idle → picking-cure → (commit cure, back to idle)
//   idle → submitWait (commits end-turn directly)
//
// On each mode change it tells the renderer which tiles to highlight
// and installs / removes a tile-click handler. Click → if the clicked
// tile is in the highlight set, the corresponding action is submitted
// to the UiController; otherwise the selection is canceled back to
// idle.
//
// The hook is purely concerned with player input. All "is the engine
// idle, is it our turn, what's the budget" gating decisions are derived
// from the GameState passed in, not from internal state.
//
// v1 hardcodes the two abilities the demo uses: Attack (offensive,
// targets enemies) and Cure (heal, targets allies). The general
// ability-picker (read each equipped command set, render one button
// per active member, route by ability kind) lands in its own session
// when more abilities ship.

import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  abilityId as mkAbilityId,
  getLegalMoves,
  validateAction,
  type Catalog,
  type GameState,
  type Position,
  type ProposedAction,
  type TeamId,
  type Unit,
  type UnitId,
} from '@engine/index.ts';
import type { BattleRenderer } from '@renderer/index.ts';
import type { UiController } from '@app/controllers/index.ts';

const ATTACK = mkAbilityId('attack');
const CURE = mkAbilityId('cure');

export type UiMode =
  | { readonly kind: 'idle' }
  | { readonly kind: 'picking-move' }
  | { readonly kind: 'picking-attack' }
  | { readonly kind: 'picking-cure' };

export interface BattleUi {
  readonly mode: UiMode;
  // The unit whose turn is in progress, regardless of team. `null`
  // between turns.
  readonly activeUnit: Unit | null;
  // True when our team controls the active unit. Drives whether the
  // action menu is interactive.
  readonly isOurTurn: boolean;
  // True when the renderer is mid-animation OR the engine has nothing
  // for us to act on. Disables the action menu.
  readonly waiting: boolean;
  // True when the active unit has Cure equipped (any active command
  // set contains the `cure` ability). Drives ActionMenu visibility of
  // the Cure button — Knights have it in v1, future classes may not.
  readonly hasCure: boolean;
  // Action menu callbacks.
  readonly startMove: () => void;
  readonly startAttack: () => void;
  readonly startCure: () => void;
  readonly submitWait: () => void;
  readonly cancelSelection: () => void;
  // Pre-computed legal-target sets surfaced for downstream UI (mostly
  // for unit-tests / future tooltips). The renderer uses them via
  // setHighlights internally.
  readonly legalMoveDestinations: ReadonlyArray<Position>;
  readonly legalAttackTargets: ReadonlyArray<UnitId>;
  readonly legalCureTargets: ReadonlyArray<UnitId>;
}

export function useBattleUi(args: {
  readonly state: GameState | null;
  readonly catalog: Catalog;
  readonly uiController: UiController;
  readonly renderer: BattleRenderer | null;
  readonly uiTeam: TeamId;
  readonly waiting: boolean;
}): BattleUi {
  const { state, catalog, uiController, renderer, uiTeam, waiting } = args;
  const [mode, setMode] = useState<UiMode>({ kind: 'idle' });

  const activeUnit = useMemo<Unit | null>(() => {
    if (state === null || state.turnState === null) return null;
    return state.units.get(state.turnState.unitId) ?? null;
  }, [state]);

  const isOurTurn = activeUnit !== null && activeUnit.team === uiTeam;

  // Reset mode to idle whenever the active unit changes (turn boundary
  // or animation transition that drops us out of "our turn"). Also
  // cancel any queued decision so the orchestrator doesn't carry stale
  // input across turns.
  useEffect(() => {
    setMode({ kind: 'idle' });
    if (uiController.hasPending()) uiController.cancel();
  }, [activeUnit?.id, uiController]);

  // Pre-compute legal targets for the active unit. We only compute when
  // it's our turn — other teams' active units are not interactive. The
  // memos are cheap to recompute (O(map) Dijkstra; O(units) attack
  // probe), so re-running on each state tick is fine.
  const legalMoveDestinations = useMemo<ReadonlyArray<Position>>(() => {
    if (!isOurTurn || state === null || activeUnit === null) return [];
    if (state.turnState === null || state.turnState.budget.movesAvailable <= 0) return [];
    const result = getLegalMoves(state, activeUnit.id, catalog);
    const positions: Position[] = [];
    for (const path of result.reachable.values()) {
      const dest = path.destination;
      // Skip the no-op (staying on the current tile). The renderer
      // shouldn't suggest "move here to not move."
      if (
        dest.x === activeUnit.position.x &&
        dest.y === activeUnit.position.y &&
        dest.layer === activeUnit.position.layer
      ) {
        continue;
      }
      positions.push(dest);
    }
    return positions;
  }, [isOurTurn, state, activeUnit, catalog]);

  const legalAttackTargets = useMemo<ReadonlyArray<UnitId>>(() => {
    if (!isOurTurn || state === null || activeUnit === null) return [];
    if (state.turnState === null || state.turnState.budget.actsAvailable <= 0) return [];
    const targets: UnitId[] = [];
    for (const candidate of state.units.values()) {
      if (candidate.team === activeUnit.team) continue;
      if (candidate.vitals.hp <= 0) continue;
      const proposed: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: activeUnit.id,
        payload: {
          abilityId: ATTACK,
          target: { kind: 'unit', unitId: candidate.id },
        },
      };
      if (validateAction(state, proposed, catalog).valid) targets.push(candidate.id);
    }
    return targets;
  }, [isOurTurn, state, activeUnit, catalog]);

  // True when Cure is in any of the active unit's equipped command sets.
  // Used to gate the Cure button in the ActionMenu — every Knight has
  // it in v1's demo, but future classes may not.
  const hasCure = useMemo<boolean>(() => {
    if (activeUnit === null) return false;
    for (const csId of Object.values(activeUnit.loadout.actionBuckets)) {
      if (csId === null) continue;
      if (!catalog.hasCommandSet(csId)) continue;
      const cs = catalog.getCommandSet(csId);
      if (cs.members.includes(CURE)) return true;
    }
    return false;
  }, [activeUnit, catalog]);

  // Legal Cure targets: living allies (including self) where the
  // proposed UseAbility passes engine validation. Unlike Attack, the
  // candidate set is allies, not enemies — `cure` is healing-tagged so
  // `damage_pipeline.finalize` flips polarity and HP rises.
  const legalCureTargets = useMemo<ReadonlyArray<UnitId>>(() => {
    if (!isOurTurn || state === null || activeUnit === null) return [];
    if (state.turnState === null || state.turnState.budget.actsAvailable <= 0) return [];
    if (!hasCure) return [];
    const targets: UnitId[] = [];
    for (const candidate of state.units.values()) {
      if (candidate.team !== activeUnit.team) continue;
      if (candidate.vitals.hp <= 0) continue;
      const proposed: ProposedAction = {
        type: 'use_ability',
        source: 'player',
        actorId: activeUnit.id,
        payload: {
          abilityId: CURE,
          target: { kind: 'unit', unitId: candidate.id },
        },
      };
      if (validateAction(state, proposed, catalog).valid) targets.push(candidate.id);
    }
    return targets;
  }, [isOurTurn, state, activeUnit, catalog, hasCure]);

  // Paint highlights on the renderer based on the current mode. Cleared
  // whenever we leave a picking mode.
  useEffect(() => {
    if (renderer === null) return;
    if (mode.kind === 'picking-move') {
      renderer.setHighlights(legalMoveDestinations, 'move');
    } else if (mode.kind === 'picking-attack') {
      const targetPositions: Position[] = [];
      if (state !== null) {
        for (const unitId of legalAttackTargets) {
          const u = state.units.get(unitId);
          if (u !== undefined) targetPositions.push(u.position);
        }
      }
      renderer.setHighlights(targetPositions, 'attack');
    } else if (mode.kind === 'picking-cure') {
      const targetPositions: Position[] = [];
      if (state !== null) {
        for (const unitId of legalCureTargets) {
          const u = state.units.get(unitId);
          if (u !== undefined) targetPositions.push(u.position);
        }
      }
      renderer.setHighlights(targetPositions, 'heal');
    } else {
      renderer.setHighlights([], 'none');
    }
  }, [renderer, mode, legalMoveDestinations, legalAttackTargets, legalCureTargets, state]);

  // Wire the renderer's tile-click event into our state machine.
  useEffect(() => {
    if (renderer === null) return;

    const handler = (pos: Position, occupant: Unit | null): void => {
      // Only react to clicks while it's our turn and we're in a
      // picking sub-mode. Clicks outside of those contexts are
      // information-only (a future "inspect this tile" tooltip can hook
      // here without changing the contract).
      if (!isOurTurn || activeUnit === null) return;
      if (uiController.hasPending()) return;

      if (mode.kind === 'picking-move') {
        const isLegal = legalMoveDestinations.some(
          (d) => d.x === pos.x && d.y === pos.y && d.layer === pos.layer,
        );
        if (!isLegal) {
          // Cancel back to idle — clicking outside the highlights is
          // an explicit "I changed my mind."
          setMode({ kind: 'idle' });
          return;
        }
        uiController.submit({
          type: 'move',
          source: 'player',
          actorId: activeUnit.id,
          payload: { destination: pos },
        });
        setMode({ kind: 'idle' });
        return;
      }

      if (mode.kind === 'picking-attack') {
        if (occupant === null || !legalAttackTargets.includes(occupant.id)) {
          setMode({ kind: 'idle' });
          return;
        }
        uiController.submit({
          type: 'use_ability',
          source: 'player',
          actorId: activeUnit.id,
          payload: {
            abilityId: ATTACK,
            target: { kind: 'unit', unitId: occupant.id },
          },
        });
        setMode({ kind: 'idle' });
        return;
      }

      if (mode.kind === 'picking-cure') {
        if (occupant === null || !legalCureTargets.includes(occupant.id)) {
          setMode({ kind: 'idle' });
          return;
        }
        uiController.submit({
          type: 'use_ability',
          source: 'player',
          actorId: activeUnit.id,
          payload: {
            abilityId: CURE,
            target: { kind: 'unit', unitId: occupant.id },
          },
        });
        setMode({ kind: 'idle' });
        return;
      }
    };

    renderer.setOnTileClick(handler);
    return () => renderer.setOnTileClick(null);
  }, [renderer, mode, isOurTurn, activeUnit, legalMoveDestinations, legalAttackTargets, legalCureTargets, uiController]);

  // Action menu callbacks.
  const startMove = useCallback(() => {
    if (!isOurTurn || waiting) return;
    if (state === null || state.turnState === null) return;
    if (state.turnState.budget.movesAvailable <= 0) return;
    setMode({ kind: 'picking-move' });
  }, [isOurTurn, waiting, state]);

  const startAttack = useCallback(() => {
    if (!isOurTurn || waiting) return;
    if (state === null || state.turnState === null) return;
    if (state.turnState.budget.actsAvailable <= 0) return;
    setMode({ kind: 'picking-attack' });
  }, [isOurTurn, waiting, state]);

  const startCure = useCallback(() => {
    if (!isOurTurn || waiting) return;
    if (state === null || state.turnState === null) return;
    if (state.turnState.budget.actsAvailable <= 0) return;
    if (!hasCure) return;
    setMode({ kind: 'picking-cure' });
  }, [isOurTurn, waiting, state, hasCure]);

  const submitWait = useCallback(() => {
    if (!isOurTurn || waiting) return;
    if (uiController.hasPending()) return;
    uiController.endTurn();
    setMode({ kind: 'idle' });
  }, [isOurTurn, waiting, uiController]);

  const cancelSelection = useCallback(() => {
    setMode({ kind: 'idle' });
  }, []);

  return {
    mode,
    activeUnit,
    isOurTurn,
    waiting,
    hasCure,
    startMove,
    startAttack,
    startCure,
    submitWait,
    cancelSelection,
    legalMoveDestinations,
    legalAttackTargets,
    legalCureTargets,
  };
}
