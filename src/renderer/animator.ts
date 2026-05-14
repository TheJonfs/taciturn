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
  CHARGED_RESOLVE_FLASH_DURATION_MS,
  MOVE_STEP_DURATION_MS,
  PRE_RESOLVE_HIGHLIGHT_MS,
  TILE_SIZE,
  TURN_END_PAUSE_MS,
  TURN_START_PAUSE_MS,
} from './constants.ts';
import { lerp, positionCenter, tileCenter, type ScreenPoint } from './world.ts';

// Exhaustiveness helper. Reaching this function means the discriminated
// switch missed an `Action` type — TypeScript turns that into a compile
// error here, and the runtime throw is a defensive fallback for
// bypassed type checks.
function assertNever(x: never): never {
  throw new Error(`Animator.buildAnim: unhandled action type ${JSON.stringify((x as { type?: unknown }).type)}`);
}

export interface UnitVisualSnapshot {
  position: ScreenPoint;
  facing: Direction;
  hp: number;
  maxHp: number;
  // Session 31.5 polish #5: MP tracked on the snapshot (like HP) so MP
  // changes settle in sync with the action's tween, not ahead of it.
  // Pre-31.5 the renderer read MP live from engine state — the value
  // appeared the instant the action committed, before the damage flash
  // completed. Statuses still read live (the visual mismatch is less
  // pronounced and statuses arrive from a wider set of actions; see
  // session-31-5 handoff for the carry-forward).
  mp: number;
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

interface FlashTargetSpec {
  readonly unitId: UnitId;
  readonly hpAfter: number;
  readonly maxHpAfter: number;
  readonly koAfter: boolean;
  // Polish #5: post-flash MP for this unit. `undefined` means the
  // flash does not modify MP (the existing damage-only path).
  readonly mpAfter?: number;
  // Session 31.5 (bug A): post-flash screen position when a knockback
  // rider displaced this target. Settled at finalize so the sprite
  // jumps to the new tile in sync with the damage flash. `undefined`
  // means no displacement (the existing in-place damage path).
  readonly positionAfter?: ScreenPoint;
}

interface FlashAnim {
  readonly kind: 'flash';
  readonly targets: ReadonlyArray<FlashTargetSpec>;
  readonly totalMs: number;
  elapsed: number;
}

interface PauseAnim {
  readonly kind: 'pause';
  readonly totalMs: number;
  elapsed: number;
}

// Pre-resolve tile highlight — session 26.5 / item #5. Paints a set of
// tile positions while it elapses; the renderer reads `getTileHighlight`
// each frame and forwards to `HighlightLayer.setOverlay`.
interface TileHighlightAnim {
  readonly kind: 'tile_highlight';
  readonly tiles: ReadonlyArray<Position>;
  readonly totalMs: number;
  elapsed: number;
}

type Anim = MoveAnim | FlashAnim | PauseAnim | TileHighlightAnim;

export class Animator {
  private readonly snapshots: Map<UnitId, UnitVisualSnapshot> = new Map();
  private readonly queue: Action[] = [];
  // Multi-anim staging: some actions (charged_action_resolve) produce a
  // sequence of anims rather than a single one. `pendingAnims` holds
  // the follow-ups; `startNext` drains it before pulling the next
  // action from `queue`.
  private readonly pendingAnims: Anim[] = [];
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
    return this.current === null && this.queue.length === 0 && this.pendingAnims.length === 0;
  }

  // Read by the renderer each frame to paint a charged-action's
  // pre-resolve tile highlight (session 26.5 / item #5). Returns an
  // empty array when the current anim is not a tile-highlight or when
  // idle. The renderer paints only on transitions to avoid 60fps churn.
  getTileHighlightPositions(): ReadonlyArray<Position> {
    if (this.current !== null && this.current.kind === 'tile_highlight') {
      return this.current.tiles;
    }
    return [];
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
      case 'tile_highlight':
        // pure delay — nothing to apply on the snapshot side. The
        // renderer reads `getTileHighlightPositions()` to paint the
        // tiles during the tile_highlight window.
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
    while (this.current === null) {
      // Drain pending follow-up anims before pulling the next committed
      // action. charged_action_resolve uses this to chain tile_highlight
      // → flash from a single Action.
      if (this.pendingAnims.length > 0) {
        this.current = this.pendingAnims.shift()!;
        return;
      }
      if (this.queue.length === 0) return;
      const action = this.queue.shift()!;
      const built = this.buildAnim(action);
      if (built === null) continue;
      if (Array.isArray(built)) {
        this.current = built[0] ?? null;
        for (let i = 1; i < built.length; i++) this.pendingAnims.push(built[i]!);
      } else {
        this.current = built;
      }
    }
  }

  private buildAnim(action: Action): Anim | ReadonlyArray<Anim> | null {
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
        // Charged-cast commits enter a pending state — the visible
        // effects fire at `charged_action_resolve` time. Pause briefly
        // so the cast itself reads as a beat.
        if (outcome.chargedActionId !== undefined) {
          return { kind: 'pause', totalMs: ATTACK_FLASH_DURATION_MS / 2, elapsed: 0 };
        }
        // Polish #5: thread the actor's post-cast MP into the flash so
        // a cast's MP cost settles in sync with the damage flash, not
        // ahead of it. The flash's finalize writes `mpAfter` onto the
        // actor's snapshot.
        const actorMpDelta = outcome.mpSpent ?? 0;
        const actorMpAfter =
          actorMpDelta > 0 && action.actorId !== undefined
            ? { actorId: action.actorId, mpDelta: -actorMpDelta }
            : undefined;
        return this.buildFlashFromTargets(outcome.perTargetResults, ATTACK_FLASH_DURATION_MS, actorMpAfter);
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

      case 'charged_action_resolve': {
        const outcome = action.outcome;
        if (outcome === undefined) return null;
        // Session 26.5 (item #5): pre-resolve tile highlight + longer
        // flash dwell so the cast reads as a discrete event. Highlight
        // tiles are derived from per-target results (tile-kind targets
        // contribute their position; unit-kind targets contribute the
        // unit's current tile inferred from the snapshot). Empty list
        // → skip the highlight stage and play just the longer flash.
        const tiles = this.tilesFromTargets(outcome.perTargetResults);
        const flash = this.buildFlashFromTargets(
          outcome.perTargetResults,
          CHARGED_RESOLVE_FLASH_DURATION_MS,
        );
        if (tiles.length === 0) return flash;
        const highlight: TileHighlightAnim = {
          kind: 'tile_highlight',
          tiles,
          totalMs: PRE_RESOLVE_HIGHLIGHT_MS,
          elapsed: 0,
        };
        return [highlight, flash];
      }

      case 'system_damage': {
        // Apply HP delta to the targeted unit and play a short flash so
        // damage-over-time ticks (Burn, Poison) and falling damage are
        // visible. No v1 popup for the magnitude.
        const outcome = action.outcome;
        const applied = outcome?.applied ?? action.payload.amount;
        if (applied <= 0) return null;
        const snap = this.snapshots.get(action.payload.targetId);
        if (snap === undefined) return null;
        const hpAfter = Math.max(0, snap.hp - applied);
        return {
          kind: 'flash',
          targets: [{
            unitId: action.payload.targetId,
            hpAfter,
            maxHpAfter: snap.maxHp,
            koAfter: hpAfter <= 0,
          }],
          totalMs: ATTACK_FLASH_DURATION_MS / 2,
          elapsed: 0,
        };
      }

      case 'system_heal': {
        const outcome = action.outcome;
        const applied = outcome?.applied ?? action.payload.amount;
        if (applied <= 0) return null;
        const snap = this.snapshots.get(action.payload.targetId);
        if (snap === undefined) return null;
        const hpAfter = Math.min(snap.maxHp, snap.hp + applied);
        return {
          kind: 'flash',
          targets: [{
            unitId: action.payload.targetId,
            hpAfter,
            maxHpAfter: snap.maxHp,
            koAfter: false,
          }],
          totalMs: ATTACK_FLASH_DURATION_MS / 2,
          elapsed: 0,
        };
      }

      case 'system_mp_drain': {
        // Polish #5: settle MP on the snapshot so the visible value
        // moves in sync with the attack flash that triggered the drain.
        // Short pause + finalize writes mp on both source and target.
        const outcome = action.outcome;
        const sourceApplied = outcome?.sourceApplied ?? 0;
        const targetApplied = outcome?.targetApplied ?? 0;
        if (sourceApplied === 0 && targetApplied === 0) return null;
        const specs: FlashTargetSpec[] = [];
        const sourceSnap = this.snapshots.get(action.payload.source);
        if (sourceSnap !== undefined && sourceApplied > 0) {
          specs.push({
            unitId: action.payload.source,
            hpAfter: sourceSnap.hp,
            maxHpAfter: sourceSnap.maxHp,
            koAfter: sourceSnap.ko,
            mpAfter: sourceSnap.mp + sourceApplied,
          });
        }
        const targetSnap = this.snapshots.get(action.payload.target);
        if (targetSnap !== undefined && targetApplied > 0) {
          specs.push({
            unitId: action.payload.target,
            hpAfter: targetSnap.hp,
            maxHpAfter: targetSnap.maxHp,
            koAfter: targetSnap.ko,
            mpAfter: Math.max(0, targetSnap.mp - targetApplied),
          });
        }
        if (specs.length === 0) return null;
        return {
          kind: 'flash',
          targets: specs,
          totalMs: ATTACK_FLASH_DURATION_MS / 2,
          elapsed: 0,
        };
      }

      case 'wait':
      case 'status_tick':
      case 'system_apply_status':
      case 'system_ct_push':
      case 'system_set_ct':
      case 'status_remove':
      case 'status_decrement_stack':
        // No v1 visual; the renderer can pull the next action.
        // `system_set_ct` lands during the orchestrator's pre-battle
        // phase (per ADR-0071) and updates engine state directly; no
        // tween needed because the visual snapshot reads through
        // `state.units[id].ct` for the queue tower.
        return null;

      default:
        // Exhaustiveness guard (per session 17b's surfaced silent-
        // fallthrough lesson). Adding a new Action type without giving
        // it a case here used to leave `current = undefined` and crash
        // the next tick on `a.elapsed`. The default here turns that
        // into a TypeScript compile error and a runtime throw if the
        // type system is bypassed.
        return assertNever(action);
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
    // Triangular envelope: ramp up to 1 in the first half, back to 0 in
    // the second half. Apply uniformly across all flashed targets.
    const intensity = t < 0.5 ? t * 2 : (1 - t) * 2;
    for (const target of a.targets) {
      const snap = this.snapshots.get(target.unitId);
      if (snap === undefined) continue;
      snap.flash = intensity;
    }
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
        for (const target of a.targets) {
          const snap = this.snapshots.get(target.unitId);
          if (snap === undefined) continue;
          snap.flash = 0;
          snap.hp = target.hpAfter;
          snap.maxHp = target.maxHpAfter;
          snap.ko = target.koAfter;
          if (target.mpAfter !== undefined) {
            snap.mp = target.mpAfter;
          }
          if (target.positionAfter !== undefined) {
            snap.position = target.positionAfter;
          }
        }
        return;
      }
      case 'pause':
      case 'tile_highlight':
        return;
    }
  }

  // Build a flash anim from per-target results (use_ability +
  // charged_action_resolve share the same outcome shape). Filters out
  // misses + non-unit targets. Returns a brief pause when no unit was
  // actually affected so the action still reads as a beat.
  //
  // `durationMs` defaults to `ATTACK_FLASH_DURATION_MS`. Session 26.5
  // (item #5) overrides for charged_action_resolve so the dwell reads
  // as a discrete event.
  private buildFlashFromTargets(
    results: ReadonlyArray<import('@engine/index.ts').AbilityTargetResult>,
    durationMs: number = ATTACK_FLASH_DURATION_MS,
    actorMpAdjustment?: { readonly actorId: UnitId; readonly mpDelta: number },
  ): Anim {
    const specs: FlashTargetSpec[] = [];
    for (const result of results) {
      if (!result.hit) continue;
      if (result.target.kind !== 'unit') continue;
      const targetId = result.target.unitId;
      const snap = this.snapshots.get(targetId);
      if (snap === undefined) continue;
      const damage = result.damage ?? 0;
      const healing = result.healing ?? 0;
      const hpAfter = Math.max(0, Math.min(snap.maxHp, snap.hp - damage + healing));
      // Session 31.5 (bug A): knockback rider displacement settles the
      // sprite onto the new tile at flash finalize. `displacedTo` is
      // populated by the reducer when applyKnockback moved the target.
      const positionAfter =
        result.displacedTo !== undefined ? positionCenter(result.displacedTo) : undefined;
      specs.push({
        unitId: targetId,
        hpAfter,
        maxHpAfter: snap.maxHp,
        koAfter: hpAfter <= 0,
        ...(positionAfter !== undefined ? { positionAfter } : {}),
      });
    }
    // Polish #5: if the actor's MP changed (use_ability mpSpent), bundle
    // it into the flash's finalize. If the actor was also damaged (rare
    // — self-targeted spells), merge the mpAfter into their existing
    // spec; otherwise add a no-HP-change spec just for the MP settle.
    if (actorMpAdjustment !== undefined) {
      const actorSnap = this.snapshots.get(actorMpAdjustment.actorId);
      if (actorSnap !== undefined) {
        const mpAfter = Math.max(0, actorSnap.mp + actorMpAdjustment.mpDelta);
        const existing = specs.find((s) => s.unitId === actorMpAdjustment.actorId);
        if (existing !== undefined) {
          // Replace the existing spec with one that carries mpAfter.
          const idx = specs.indexOf(existing);
          specs[idx] = { ...existing, mpAfter };
        } else {
          specs.push({
            unitId: actorMpAdjustment.actorId,
            hpAfter: actorSnap.hp,
            maxHpAfter: actorSnap.maxHp,
            koAfter: actorSnap.ko,
            mpAfter,
          });
        }
      }
    }
    if (specs.length === 0) {
      return { kind: 'pause', totalMs: durationMs / 2, elapsed: 0 };
    }
    return {
      kind: 'flash',
      targets: specs,
      totalMs: durationMs,
      elapsed: 0,
    };
  }

  // Derive tile positions for the pre-resolve highlight from per-target
  // results. Tile-kind targets contribute their position directly.
  // Unit-kind targets are inferred from the unit's current snapshot
  // position (converted back to tile-space). Duplicates are filtered so
  // overlapping units in a footprint don't double-paint.
  private tilesFromTargets(
    results: ReadonlyArray<import('@engine/index.ts').AbilityTargetResult>,
  ): ReadonlyArray<Position> {
    const seen = new Set<string>();
    const out: Position[] = [];
    for (const r of results) {
      if (!r.hit) continue;
      let pos: Position | null = null;
      if (r.target.kind === 'tile') {
        pos = r.target.position;
      } else if (r.target.kind === 'unit') {
        const snap = this.snapshots.get(r.target.unitId);
        if (snap === undefined) continue;
        pos = {
          x: Math.floor(snap.position.x / TILE_SIZE),
          y: Math.floor(snap.position.y / TILE_SIZE),
          layer: 0,
        };
      }
      if (pos === null) continue;
      const key = `${pos.x},${pos.y},${pos.layer}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(pos);
    }
    return out;
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
