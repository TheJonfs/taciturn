// Unit layer — one sprite per unit; each is a colored circle plus a
// facing tick, an HP bar, an MP bar, and a row of status badges.
//
// The renderer's "visual state" for a unit (position + KO + HP/MP +
// facing + active highlight + flash level + status list) lives on the
// sprite. Position / HP / KO / facing / flash come from the animator's
// snapshot (tween-friendly); MP and statuses snap to the engine state
// per frame (instant) since per-frame tweening for those is more
// machinery than Session 22 needs.
//
// KO'd units stay on the map at reduced alpha (per the design doc's
// "translucent or grayed" treatment + the future revival / 3-turn
// permadeath rule). The team color stays so allegiance reads even
// when downed.

import { Container, Graphics, Text } from 'pixi.js';
import type { Direction, StatusInstance, Unit } from '@engine/index.ts';
import {
  ACTIVE_HIGHLIGHT_COLOR,
  FACING_TICK_COLOR,
  FACING_TICK_LENGTH,
  HIT_FLASH_COLOR,
  HP_BAR_BG,
  HP_BAR_FG,
  HP_BAR_FG_LOW,
  HP_BAR_LOW_THRESHOLD,
  KO_ALPHA,
  MP_BAR_FG,
  STATUS_BADGE_BG_NEGATIVE,
  STATUS_BADGE_BG_NEUTRAL,
  STATUS_BADGE_BG_POSITIVE,
  STATUS_BADGE_STACK_BG,
  STATUS_BADGE_STACK_TEXT,
  STATUS_BADGE_TEXT,
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
const MP_BAR_WIDTH = TILE_SIZE * 0.6;
const MP_BAR_HEIGHT = 3;
const MP_BAR_OFFSET_Y = HP_BAR_OFFSET_Y + HP_BAR_HEIGHT + 2;
const ACTIVE_RING_PAD = 4;

// Status badges sit above the unit. Cap the visible count; the rest
// fold into a "+N" overflow indicator.
const STATUS_BADGE_SIZE = 12;
const STATUS_BADGE_GAP = 2;
const STATUS_BADGE_OFFSET_Y = -(UNIT_RADIUS + 12);
const STATUS_BADGE_VISIBLE_MAX = 4;

// Polarity-coded backgrounds per the design doc's status visual
// language ("color coding by polarity"). Driven off the `tags` array
// on the StatusInstance's catalog entry, but here we accept a polarity
// tag derived upstream and just look up the color.
type StatusPolarity = 'positive' | 'negative' | 'neutral';

const POLARITY_BG: Readonly<Record<StatusPolarity, number>> = {
  positive: STATUS_BADGE_BG_POSITIVE,
  negative: STATUS_BADGE_BG_NEGATIVE,
  neutral: STATUS_BADGE_BG_NEUTRAL,
};

export interface StatusBadge {
  readonly typeId: string;
  readonly stacks: number;
  readonly polarity: StatusPolarity;
}

export interface UnitVisualState {
  // Visual position in screen pixels (already translated through
  // tileCenter + tween). The animator tweens this; the engine state's
  // `position` is the discrete authoritative value.
  readonly position: ScreenPoint;
  readonly facing: Direction;
  readonly hp: number;
  readonly maxHp: number;
  readonly mp: number;
  readonly maxMp: number;
  readonly ko: boolean;
  readonly active: boolean;
  // 0..1 — the renderer overlays a hit-flash tint at this strength.
  readonly flash: number;
  readonly statuses: ReadonlyArray<StatusBadge>;
}

export class UnitSprite {
  readonly container: Container;
  private readonly body: Graphics;
  private readonly facingTick: Graphics;
  private readonly hpBar: Graphics;
  private readonly mpBar: Graphics;
  private readonly activeRing: Graphics;
  private readonly statusRow: Container;
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
    this.mpBar = new Graphics();
    this.statusRow = new Container();
    this.statusRow.label = 'statuses';

    this.container.addChild(
      this.activeRing,
      this.body,
      this.facingTick,
      this.hpBar,
      this.mpBar,
      this.statusRow,
    );

    this.setVisualState({
      position: positionCenter(unit.position),
      facing: unit.facing,
      hp: unit.vitals.hp,
      maxHp: unit.baseStats.maxHpBase,
      mp: unit.vitals.mp,
      maxMp: unit.vitals.mp,
      ko: unit.vitals.hp <= 0,
      active: false,
      flash: 0,
      statuses: [],
    });
  }

  setVisualState(state: UnitVisualState): void {
    this.container.position.set(state.position.x, state.position.y);
    // KO'd units fade rather than recolor — the team color stays
    // visible so allegiance still reads at a glance, but the unit is
    // clearly inert.
    this.container.alpha = state.ko ? KO_ALPHA : 1;
    this.drawBody(state.flash);
    this.drawFacing(state.facing, state.ko);
    this.drawHpBar(state.hp, state.maxHp);
    this.drawMpBar(state.mp, state.maxMp);
    this.drawActive(state.active && !state.ko);
    this.drawStatuses(state.statuses, state.ko);
  }

  private drawBody(flash: number): void {
    const g = this.body;
    g.clear();
    g.circle(0, 0, UNIT_RADIUS);
    g.fill(this.teamColor);
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
    const fraction = clamp01(hp / maxHp);
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

  private drawMpBar(mp: number, maxMp: number): void {
    const g = this.mpBar;
    g.clear();
    // No bar for units with 0 max-MP (Knight v1 has 20; this branch is
    // a defensive guard for fixtures or future no-MP units).
    if (maxMp <= 0) return;
    const fraction = clamp01(mp / maxMp);
    const x = -MP_BAR_WIDTH / 2;
    const y = MP_BAR_OFFSET_Y;
    g.rect(x, y, MP_BAR_WIDTH, MP_BAR_HEIGHT);
    g.fill({ color: HP_BAR_BG, alpha: 0.85 });
    if (fraction > 0) {
      g.rect(x, y, MP_BAR_WIDTH * fraction, MP_BAR_HEIGHT);
      g.fill(MP_BAR_FG);
    }
  }

  private drawActive(active: boolean): void {
    const g = this.activeRing;
    g.clear();
    if (!active) return;
    g.circle(0, 0, UNIT_RADIUS + ACTIVE_RING_PAD);
    g.stroke({ color: ACTIVE_HIGHLIGHT_COLOR, width: 2, alpha: 0.8 });
  }

  private drawStatuses(statuses: ReadonlyArray<StatusBadge>, ko: boolean): void {
    // Tear down previous badges. Pixi v8 needs explicit removal — the
    // children of statusRow are reused per-frame so a fresh build each
    // frame is the cleanest path; sprites are cheap to recreate at
    // this scale (max ~5 per unit).
    this.statusRow.removeChildren();
    if (ko || statuses.length === 0) return;

    const visible = statuses.slice(0, STATUS_BADGE_VISIBLE_MAX);
    const overflow = statuses.length - visible.length;
    const totalCount = visible.length + (overflow > 0 ? 1 : 0);
    const totalWidth = totalCount * STATUS_BADGE_SIZE + (totalCount - 1) * STATUS_BADGE_GAP;
    let x = -totalWidth / 2;

    for (const s of visible) {
      this.drawBadge(s, x);
      x += STATUS_BADGE_SIZE + STATUS_BADGE_GAP;
    }
    if (overflow > 0) {
      this.drawOverflowBadge(overflow, x);
    }
  }

  private drawBadge(s: StatusBadge, x: number): void {
    const bg = POLARITY_BG[s.polarity];
    const badge = new Graphics();
    badge.roundRect(x, STATUS_BADGE_OFFSET_Y, STATUS_BADGE_SIZE, STATUS_BADGE_SIZE, 2);
    badge.fill(bg);
    badge.stroke({ color: UNIT_OUTLINE_COLOR, alpha: UNIT_OUTLINE_ALPHA, width: 1 });
    this.statusRow.addChild(badge);

    // Glyph: first letter of typeId, uppercased. Placeholder until
    // status iconography ships.
    const glyph = new Text({
      text: glyphFor(s.typeId),
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 9,
        fontWeight: 'bold',
        fill: STATUS_BADGE_TEXT,
      },
    });
    glyph.anchor.set(0.5, 0.5);
    glyph.position.set(x + STATUS_BADGE_SIZE / 2, STATUS_BADGE_OFFSET_Y + STATUS_BADGE_SIZE / 2);
    this.statusRow.addChild(glyph);

    if (s.stacks > 1) {
      const stackBg = new Graphics();
      const sx = x + STATUS_BADGE_SIZE - 4;
      const sy = STATUS_BADGE_OFFSET_Y + STATUS_BADGE_SIZE - 4;
      stackBg.circle(sx, sy, 4);
      stackBg.fill(STATUS_BADGE_STACK_BG);
      this.statusRow.addChild(stackBg);
      const stackText = new Text({
        text: String(s.stacks),
        style: {
          fontFamily: 'system-ui, sans-serif',
          fontSize: 7,
          fontWeight: 'bold',
          fill: STATUS_BADGE_STACK_TEXT,
        },
      });
      stackText.anchor.set(0.5, 0.5);
      stackText.position.set(sx, sy);
      this.statusRow.addChild(stackText);
    }
  }

  private drawOverflowBadge(count: number, x: number): void {
    const badge = new Graphics();
    badge.roundRect(x, STATUS_BADGE_OFFSET_Y, STATUS_BADGE_SIZE, STATUS_BADGE_SIZE, 2);
    badge.fill(POLARITY_BG.neutral);
    badge.stroke({ color: UNIT_OUTLINE_COLOR, alpha: UNIT_OUTLINE_ALPHA, width: 1 });
    this.statusRow.addChild(badge);
    const text = new Text({
      text: `+${count}`,
      style: {
        fontFamily: 'system-ui, sans-serif',
        fontSize: 8,
        fontWeight: 'bold',
        fill: STATUS_BADGE_TEXT,
      },
    });
    text.anchor.set(0.5, 0.5);
    text.position.set(x + STATUS_BADGE_SIZE / 2, STATUS_BADGE_OFFSET_Y + STATUS_BADGE_SIZE / 2);
    this.statusRow.addChild(text);
  }
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function glyphFor(typeId: string): string {
  return typeId.length > 0 ? typeId[0]!.toUpperCase() : '?';
}

// Polarity classifier — the StatusInstance's catalog tags include
// 'positive' / 'negative' / 'neutral'. Caller passes the tags array
// to map to the discriminator we use here; this lookup centralizes
// the rule.
export function polarityFromTags(tags: ReadonlyArray<string>): StatusPolarity {
  if (tags.includes('negative')) return 'negative';
  if (tags.includes('positive')) return 'positive';
  return 'neutral';
}

// Convenience converter: build a StatusBadge from a StatusInstance plus
// its catalog tags. The renderer calls this from BattleRenderer.apply
// VisualState (which has the catalog handy).
export function statusBadgeFromInstance(
  instance: StatusInstance,
  tags: ReadonlyArray<string>,
): StatusBadge {
  return {
    typeId: String(instance.typeId),
    stacks: instance.stacks ?? 1,
    polarity: polarityFromTags(tags),
  };
}

function directionVector(d: Direction): { x: number; y: number } {
  switch (d) {
    case 'N': return { x: 0, y: -1 };
    case 'S': return { x: 0, y: 1 };
    case 'E': return { x: 1, y: 0 };
    case 'W': return { x: -1, y: 0 };
  }
}
