// Unit layer — one sprite per unit; each is a colored circle plus a
// facing tick and a small HP bar.
//
// The renderer's "visual state" for a unit (position + KO + HP fraction
// + facing + active highlight + flash level) lives on the sprite. The
// animator writes to the sprite; the sprite owns its own redraw. This
// keeps per-frame work to setting a few transforms / fill values
// without rebuilding Pixi objects.

import { Container, Graphics } from 'pixi.js';
import type { Direction, Unit } from '@engine/index.ts';
import {
  ACTIVE_HIGHLIGHT_COLOR,
  FACING_TICK_COLOR,
  FACING_TICK_LENGTH,
  HIT_FLASH_COLOR,
  HP_BAR_BG,
  HP_BAR_FG,
  HP_BAR_FG_LOW,
  HP_BAR_LOW_THRESHOLD,
  KO_COLOR,
  TEAM_COLOR_FALLBACK,
  TEAM_COLORS,
  TILE_SIZE,
  UNIT_OUTLINE_ALPHA,
  UNIT_OUTLINE_COLOR,
} from './constants.ts';
import { positionCenter, type ScreenPoint } from './world.ts';

const UNIT_RADIUS = TILE_SIZE * 0.34;
const HP_BAR_WIDTH = TILE_SIZE * 0.6;
const HP_BAR_HEIGHT = 4;
const HP_BAR_OFFSET_Y = UNIT_RADIUS + 6;
const ACTIVE_RING_PAD = 4;

export interface UnitVisualState {
  // Visual position in screen pixels (already translated through
  // tileCenter + tween). The animator tweens this; the engine state's
  // `position` is the discrete authoritative value.
  readonly position: ScreenPoint;
  readonly facing: Direction;
  readonly hp: number;
  readonly maxHp: number;
  readonly ko: boolean;
  readonly active: boolean;
  // 0..1 — the renderer overlays a hit-flash tint at this strength.
  readonly flash: number;
}

export class UnitSprite {
  readonly container: Container;
  private readonly body: Graphics;
  private readonly facingTick: Graphics;
  private readonly hpBar: Graphics;
  private readonly activeRing: Graphics;
  private readonly teamColor: number;

  constructor(unit: Unit) {
    this.teamColor = TEAM_COLORS.get(unit.team) ?? TEAM_COLOR_FALLBACK;

    this.container = new Container();
    this.container.label = `unit:${unit.id}`;
    this.container.eventMode = 'none';

    this.activeRing = new Graphics();
    this.body = new Graphics();
    this.facingTick = new Graphics();
    this.hpBar = new Graphics();

    this.container.addChild(this.activeRing, this.body, this.facingTick, this.hpBar);

    this.setVisualState({
      position: positionCenter(unit.position),
      facing: unit.facing,
      hp: unit.vitals.hp,
      maxHp: unit.baseStats.maxHpBase,
      ko: unit.vitals.hp <= 0,
      active: false,
      flash: 0,
    });
  }

  setVisualState(state: UnitVisualState): void {
    this.container.position.set(state.position.x, state.position.y);
    this.drawBody(state.ko, state.flash);
    this.drawFacing(state.facing, state.ko);
    this.drawHpBar(state.hp, state.maxHp);
    this.drawActive(state.active && !state.ko);
  }

  private drawBody(ko: boolean, flash: number): void {
    const g = this.body;
    g.clear();
    const baseColor = ko ? KO_COLOR : this.teamColor;
    g.circle(0, 0, UNIT_RADIUS);
    g.fill(baseColor);
    g.stroke({ color: UNIT_OUTLINE_COLOR, alpha: UNIT_OUTLINE_ALPHA, width: 2 });

    if (flash > 0) {
      g.circle(0, 0, UNIT_RADIUS);
      g.fill({ color: HIT_FLASH_COLOR, alpha: Math.min(1, flash) });
    }
  }

  private drawFacing(facing: Direction, ko: boolean): void {
    const g = this.facingTick;
    g.clear();
    if (ko) return;
    const dir = directionVector(facing);
    const len = UNIT_RADIUS * FACING_TICK_LENGTH;
    g.moveTo(0, 0);
    g.lineTo(dir.x * (UNIT_RADIUS + len * 0.4), dir.y * (UNIT_RADIUS + len * 0.4));
    g.stroke({ color: FACING_TICK_COLOR, width: 3, alpha: 0.95 });
  }

  private drawHpBar(hp: number, maxHp: number): void {
    const g = this.hpBar;
    g.clear();
    if (maxHp <= 0) return;
    const fraction = Math.max(0, Math.min(1, hp / maxHp));
    const x = -HP_BAR_WIDTH / 2;
    const y = HP_BAR_OFFSET_Y;
    g.rect(x, y, HP_BAR_WIDTH, HP_BAR_HEIGHT);
    g.fill({ color: HP_BAR_BG, alpha: 0.9 });
    if (fraction > 0) {
      const fg = fraction <= HP_BAR_LOW_THRESHOLD ? HP_BAR_FG_LOW : HP_BAR_FG;
      g.rect(x, y, HP_BAR_WIDTH * fraction, HP_BAR_HEIGHT);
      g.fill(fg);
    }
  }

  private drawActive(active: boolean): void {
    const g = this.activeRing;
    g.clear();
    if (!active) return;
    g.circle(0, 0, UNIT_RADIUS + ACTIVE_RING_PAD);
    g.stroke({ color: ACTIVE_HIGHLIGHT_COLOR, width: 2, alpha: 0.8 });
  }
}

function directionVector(d: Direction): { x: number; y: number } {
  switch (d) {
    case 'N': return { x: 0, y: -1 };
    case 'S': return { x: 0, y: 1 };
    case 'E': return { x: 1, y: 0 };
    case 'W': return { x: -1, y: 0 };
  }
}
