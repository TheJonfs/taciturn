// Animator — owns the per-unit visual state and plays committed actions
// one at a time. Decoupled from the orchestrator: the orchestrator
// commits and hands a list of just-committed actions; the animator
// queues them and the BattleRenderer pumps the loop.
//
// The animator's visual state is derived from action outcomes (not
// from the engine state mid-flight): a `move`'s `pathTaken` drives
// position tweening; a `use_ability`'s `perTargetResults` updates the
// target's HP and triggers a flash. The engine state stays the source
// of truth; the animator's snapshot reconverges to it whenever the
// queue drains (the BattleRenderer reconciles on idle).
//
// v1 deliberately stays linear and tween-light — easing curves and
// damage-number popups are polish-pass concerns. The action set covered:
//   - move:                 tween along the path (per-step duration)
//   - use_ability:          flash target, apply HP delta
//   - turn_start / _end:    active-unit highlight on / off
//   - set_facing:           instant facing update
//   - battle_end:           hold briefly so the win overlay can fade in
//   - wait / status_tick / charged_action_resolve: no v1 visual

import type { Action, Direction, Position, UnitId } from '@engine/index.ts';
import {
  ATTACK_FLASH_DURATION_MS,
  BATTLE_END_HOLD_MS,
  MOVE_STEP_DURATION_MS,
  TURN_END_PAUSE_MS,
  TURN_START_PAUSE_MS,
} from './constants.ts';
import { lerp, tileCenter, type ScreenPoint } from './world.ts';

export interface UnitVisualSnapshot {
  position: ScreenPoint;
  facing: Direction;
  hp: number;
  maxHp: number;
  ko: boolean;
  flash: number;
}

interface MoveAnim {
  readonly kind: 'move';
  readonly unitId: UnitId;
  readonly path: ReadonlyArray<Position>;
  readonly facingAfter: Direction;
  readonly totalMs: number;
  elapsed: number;
}

interface FlashAnim {
  readonly kind: 'flash';
  readonly targetId: UnitId;
  readonly hpAfter: number;
  readonly maxHpAfter: number;
  readonly koAfter: boolean;
  readonly totalMs: number;
  elapsed: number;
}

interface PauseAnim {
  readonly kind: 'pause';
  readonly totalMs: number;
  elapsed: number;
}

type Anim = MoveAnim | FlashAnim | PauseAnim;

export class Animator {
  private readonly snapshots: Map<UnitId, UnitVisualSnapshot> = new Map();
  private readonly queue: Action[] = [];
  private current: Anim | null = null;
  private activeUnit: UnitId | null = null;

  initSnapshot(unitId: UnitId, snap: UnitVisualSnapshot): void {
    this.snapshots.set(unitId, snap);
  }

  getSnapshot(unitId: UnitId): UnitVisualSnapshot | undefined {
    return this.snapshots.get(unitId);
  }

  getActiveUnit(): UnitId | null {
    return this.activeUnit;
  }

  isIdle(): boolean {
    return this.current === null && this.queue.length === 0;
  }

  enqueue(actions: ReadonlyArray<Action>): void {
    for (const action of actions) this.queue.push(action);
  }

  // Drive the animator forward by `dtMs`. Returns true when an action
  // completed during this tick (the BattleRenderer can use this signal
  // to push more work, but it can also poll isIdle()).
  tick(dtMs: number): void {
    if (this.current === null) {
      this.startNext();
      if (this.current === null) return;
    }

    const a = this.current;
    a.elapsed += dtMs;
    const t = Math.min(1, a.elapsed / a.totalMs);

    switch (a.kind) {
      case 'move':
        this.applyMoveTween(a, t);
        break;
      case 'flash':
        this.applyFlashTween(a, t);
        break;
      case 'pause':
        // pure delay — nothing to apply
        break;
    }

    if (t >= 1) {
      this.finalize(a);
      this.current = null;
      // Try to consume the next action this same tick. Avoids a one-frame
      // gap between every action which would otherwise feel laggy.
      this.startNext();
    }
  }

  // ---- internals ----

  private startNext(): void {
    while (this.current === null && this.queue.length > 0) {
      const action = this.queue.shift()!;
      this.current = this.buildAnim(action);
    }
  }

  private buildAnim(action: Action): Anim | null {
    switch (action.type) {
      case 'move': {
        if (action.actorId === undefined) return null;
        const outcome = action.outcome;
        if (outcome === undefined) return null;
        const path = outcome.pathTaken;
        // path includes start tile; steps = path.length - 1 (no move when 1)
        const stepCount = Math.max(1, path.length - 1);
        return {
          kind: 'move',
          unitId: action.actorId,
          path,
          facingAfter: outcome.facingAfter,
          totalMs: stepCount * MOVE_STEP_DURATION_MS,
          elapsed: 0,
        };
      }

      case 'use_ability': {
        const outcome = action.outcome;
        if (outcome === undefined) return null;
        const result = outcome.perTargetResults[0];
        if (result === undefined || result.target.kind !== 'unit') {
          // Self-target or no result → just a brief pause to keep the
          // beat. Avoids zero-length animations that flash through.
          return { kind: 'pause', totalMs: ATTACK_FLASH_DURATION_MS / 2, elapsed: 0 };
        }
        const targetId = result.target.unitId;
        const snap = this.snapshots.get(targetId);
        if (snap === undefined) return null;
        const damage = result.damage ?? 0;
        const healing = result.healing ?? 0;
        const hpAfter = Math.max(0, Math.min(snap.maxHp, snap.hp - damage + healing));
        return {
          kind: 'flash',
          targetId,
          hpAfter,
          maxHpAfter: snap.maxHp,
          koAfter: hpAfter <= 0,
          totalMs: ATTACK_FLASH_DURATION_MS,
          elapsed: 0,
        };
      }

      case 'turn_start': {
        const outcome = action.outcome;
        if (outcome === undefined) return null;
        // Highlight the active unit immediately on turn_start; pause so
        // the camera can pan to them before their first action.
        this.activeUnit = outcome.unitId;
        return { kind: 'pause', totalMs: TURN_START_PAUSE_MS, elapsed: 0 };
      }

      case 'turn_end': {
        this.activeUnit = null;
        return { kind: 'pause', totalMs: TURN_END_PAUSE_MS, elapsed: 0 };
      }

      case 'set_facing': {
        const outcome = action.outcome;
        if (action.actorId === undefined || outcome === undefined) return null;
        const snap = this.snapshots.get(action.actorId);
        if (snap !== undefined) snap.facing = outcome.to;
        return null; // instant; loop pulls the next
      }

      case 'battle_end':
        // The win overlay is the responsibility of the BattleView; the
        // animator just holds for a beat so the final frame settles.
        return { kind: 'pause', totalMs: BATTLE_END_HOLD_MS, elapsed: 0 };

      case 'wait':
      case 'status_tick':
      case 'charged_action_resolve':
      case 'system_heal':
      case 'system_damage':
      case 'system_apply_status':
      case 'status_remove':
      case 'status_decrement_stack':
        // No v1 visual; the renderer can pull the next action. (System
        // actions are bookkeeping plumbing; the visible HP / status
        // changes are reflected on the next animatable action's snapshot
        // refresh.)
        return null;
    }
  }

  private applyMoveTween(a: MoveAnim, t: number): void {
    const snap = this.snapshots.get(a.unitId);
    if (snap === undefined) return;
    // Walk along path segments. `path[0]` is the start tile.
    const segCount = Math.max(1, a.path.length - 1);
    const totalProgress = t * segCount;
    const segIdx = Math.min(segCount - 1, Math.floor(totalProgress));
    const segT = totalProgress - segIdx;
    const from = a.path[segIdx]!;
    const to = a.path[segIdx + 1] ?? from;
    snap.position = lerp(tileCenter(from.x, from.y), tileCenter(to.x, to.y), segT);
    // Mid-tween facing follows current segment direction.
    snap.facing = inferFacing(from, to, snap.facing);
  }

  private applyFlashTween(a: FlashAnim, t: number): void {
    const snap = this.snapshots.get(a.targetId);
    if (snap === undefined) return;
    // Triangular envelope: ramp up to 1 in the first half, back to 0 in
    // the second half.
    const intensity = t < 0.5 ? t * 2 : (1 - t) * 2;
    snap.flash = intensity;
  }

  private finalize(a: Anim): void {
    switch (a.kind) {
      case 'move': {
        const snap = this.snapshots.get(a.unitId);
        if (snap === undefined) return;
        const last = a.path[a.path.length - 1] ?? a.path[0]!;
        snap.position = tileCenter(last.x, last.y);
        snap.facing = a.facingAfter;
        return;
      }
      case 'flash': {
        const snap = this.snapshots.get(a.targetId);
        if (snap === undefined) return;
        snap.flash = 0;
        snap.hp = a.hpAfter;
        snap.maxHp = a.maxHpAfter;
        snap.ko = a.koAfter;
        return;
      }
      case 'pause':
        return;
    }
  }
}

function inferFacing(from: Position, to: Position, fallback: Direction): Direction {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 1 && dy === 0) return 'E';
  if (dx === -1 && dy === 0) return 'W';
  if (dx === 0 && dy === 1) return 'S';
  if (dx === 0 && dy === -1) return 'N';
  return fallback;
}
