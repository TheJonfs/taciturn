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

import { Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import type { Direction, StatusInstance, Unit } from '@engine/index.ts';
import {
  ACTIVE_HIGHLIGHT_COLOR,
  COUNTERPART_RING_COLOR,
  FACING_TICK_COLOR,
  FACING_TICK_LENGTH,
  HIT_FLASH_COLOR,
  HP_BAR_BG,
  HP_BAR_FG,
  HP_BAR_FG_LOW,
  HP_BAR_FG_MID,
  HP_BAR_HIGH_THRESHOLD,
  HP_BAR_LOW_THRESHOLD,
  KO_ALPHA,
  KO_X_ALPHA,
  KO_X_COLOR,
  KO_X_WIDTH,
  PERMADEATH_BADGE_BG,
  PERMADEATH_BADGE_BG_IMMINENT,
  PERMADEATH_BADGE_BORDER,
  PERMADEATH_BADGE_BORDER_IMMINENT,
  PERMADEATH_BADGE_TEXT,
  PERMADEATH_BADGE_TEXT_IMMINENT,
  MP_BAR_FG,
  PORTRAIT_BG_COLOR,
  PORTRAIT_FRAME_CORNER,
  PORTRAIT_FRAME_WIDTH,
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
  // 0..1 hover-counterpart pulse strength. Driven by the action log
  // panel's row-hover handler (and the QueueTower's mini-card hover).
  // A non-zero value draws a translucent ring around the unit body so
  // the player can map a log row to the actor/target on the canvas.
  readonly counterpart: number;
  // S41 permadeath countdown — when defined and > 0, draws a numeric
  // badge on the KO'd sprite showing the virtual turns remaining before
  // permadeath. Caller passes `threshold - turnsKOd` so the badge
  // counts *down* (3 → 2 → 1 → removed). Undefined when the unit isn't
  // KO'd or has been removed; the badge isn't drawn.
  readonly permadeathCountdown?: number;
}

export class UnitSprite {
  readonly container: Container;
  private readonly body: Graphics;
  private readonly facingTick: Graphics;
  private readonly hpBar: Graphics;
  private readonly mpBar: Graphics;
  private readonly activeRing: Graphics;
  private readonly counterpartRing: Graphics;
  private readonly teamRing: Graphics;
  private readonly koMarker: Graphics;
  private readonly permadeathBadge: Container;
  private readonly permadeathBadgeBg: Graphics;
  private readonly permadeathBadgeText: Text;
  private readonly statusRow: Container;
  private readonly teamColor: number;
  // Portrait sprite — null until `setPortrait` is called (async asset
  // load) or if the class has no portrait registered. Drawn over the
  // colored body when present; the body stays underneath as the
  // fallback layer (and a backdrop in case the portrait has alpha).
  private portraitSprite: Sprite | null = null;
  // Whether the enemy-team horizontal flip has been applied. Set once
  // at construction so portraitSprite picks it up regardless of the
  // load order vs. construction.
  private readonly isEnemyTeam: boolean;

  constructor(unit: Unit, opts?: { readonly enemyTeam?: boolean }) {
    this.teamColor = TEAM_COLORS.get(unit.team) ?? TEAM_COLOR_FALLBACK;
    this.isEnemyTeam = opts?.enemyTeam ?? false;

    this.container = new Container();
    this.container.label = `unit:${unit.id}`;
    this.container.eventMode = 'none';

    this.counterpartRing = new Graphics();
    this.activeRing = new Graphics();
    this.teamRing = new Graphics();
    this.body = new Graphics();
    this.facingTick = new Graphics();
    this.koMarker = new Graphics();
    this.permadeathBadge = new Container();
    this.permadeathBadge.label = 'permadeath_badge';
    this.permadeathBadgeBg = new Graphics();
    this.permadeathBadgeText = new Text({
      text: '',
      style: {
        fontFamily: 'monospace',
        fontSize: 14,
        fontWeight: 'bold',
        fill: PERMADEATH_BADGE_TEXT,
      },
    });
    this.permadeathBadgeText.anchor.set(0.5, 0.5);
    this.permadeathBadge.addChild(this.permadeathBadgeBg, this.permadeathBadgeText);
    this.permadeathBadge.visible = false;
    this.hpBar = new Graphics();
    this.mpBar = new Graphics();
    this.statusRow = new Container();
    this.statusRow.label = 'statuses';

    // teamRing sits behind the body so the team-color halo surrounds
    // the portrait once it loads (and the colored body before).
    this.container.addChild(
      this.counterpartRing,
      this.activeRing,
      this.teamRing,
      this.body,
      this.facingTick,
      this.koMarker,
      this.hpBar,
      this.mpBar,
      this.statusRow,
      // Permadeath badge sits above everything else on the KO'd sprite
      // so the countdown reads at a glance over the KO X marker.
      this.permadeathBadge,
    );

    // Mount-time initial draw. `maxHp` / `maxMp` here are seeded from the
    // unit's current vitals — a full bar — which is correct for v1 (units
    // enter battle at full computed HP/MP per `fillVitalsFromComputedMaxes`)
    // and is overwritten on frame 1 by `BattleRenderer.applyVisualState`,
    // which live-reads the true effective maxes via `runModifyStatQuery`.
    // The constructor has no `state` / `catalog` to query directly; the
    // full-bar seed is the right placeholder rather than a wrong one
    // (S33.5A / ADR-0074 — the prior `maxHpBase` seed excluded equipment HP).
    this.setVisualState({
      position: positionCenter(unit.position),
      facing: unit.facing,
      hp: unit.vitals.hp,
      maxHp: unit.vitals.hp,
      mp: unit.vitals.mp,
      maxMp: unit.vitals.mp,
      ko: unit.vitals.hp <= 0,
      active: false,
      flash: 0,
      statuses: [],
      counterpart: 0,
    });
  }

  setVisualState(state: UnitVisualState): void {
    this.container.position.set(state.position.x, state.position.y);
    // KO'd units fade rather than recolor — the team color stays
    // visible so allegiance still reads at a glance, but the unit is
    // clearly inert.
    this.container.alpha = state.ko ? KO_ALPHA : 1;
    this.drawBody(state.flash);
    this.drawTeamRing();
    this.drawFacing(state.facing, state.ko);
    this.drawKoMarker(state.ko);
    this.drawHpBar(state.hp, state.maxHp);
    this.drawMpBar(state.mp, state.maxMp);
    this.drawActive(state.active && !state.ko);
    this.drawCounterpart(state.counterpart);
    this.drawStatuses(state.statuses, state.ko);
    this.drawPermadeathBadge(state.ko, state.permadeathCountdown);
    // Hit-flash on the portrait: lerp tint toward HIT_FLASH_COLOR so a
    // damage event still reads visibly even when the colored-body's
    // flash overlay is occluded by the portrait sprite.
    if (this.portraitSprite !== null) {
      this.portraitSprite.tint = lerpTint(0xffffff, HIT_FLASH_COLOR, clamp01(state.flash));
    }
  }

  // Attach a portrait texture to this sprite. Called by BattleRenderer
  // once class textures finish loading (async). When set, the portrait
  // sprite is drawn over the colored body; the body remains as a
  // backdrop for translucent portraits and for the fallback path
  // (no texture available).
  setPortrait(texture: Texture): void {
    if (this.portraitSprite !== null) {
      // Re-assignment shouldn't happen in v1, but be defensive:
      // swap the texture rather than re-add a sibling sprite.
      this.portraitSprite.texture = texture;
      return;
    }
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    const target = UNIT_RADIUS * 2;
    const src = Math.max(texture.width, texture.height, 1);
    sprite.scale.set(target / src);
    if (this.isEnemyTeam) {
      // Horizontal flip so the enemy faces the player's side. Anchor
      // at 0.5 keeps the flip centered on the unit's tile.
      sprite.scale.x *= -1;
    }
    this.portraitSprite = sprite;
    // Insert above the body but below the facing tick / HP / status
    // overlays. Container children order: ... teamRing, body, [portrait],
    // facingTick, koMarker, hpBar, mpBar, statusRow.
    const bodyIndex = this.container.getChildIndex(this.body);
    this.container.addChildAt(sprite, bodyIndex + 1);
  }

  private drawTeamRing(): void {
    const g = this.teamRing;
    g.clear();
    // Session 26.5 (item #2): team-color rounded-square frame drawn
    // OUTSIDE the portrait square. Pre-26.5 the ring was inscribed in
    // a circle at body-edge, which clipped the portrait's corners. Now
    // the ring frames the full portrait square; corners read clean.
    const r = UNIT_RADIUS + PORTRAIT_FRAME_WIDTH / 2;
    g.roundRect(-r, -r, r * 2, r * 2, PORTRAIT_FRAME_CORNER);
    g.stroke({ color: this.teamColor, width: PORTRAIT_FRAME_WIDTH, alpha: 1 });
  }

  private drawKoMarker(ko: boolean): void {
    const g = this.koMarker;
    g.clear();
    if (!ko) return;
    // Cross-out X across the unit body so KO reads at a glance, not
    // only via the alpha fade. Drawn above body + facing tick but
    // below the HP bar / statuses (those are hidden when ko anyway).
    const r = UNIT_RADIUS * 0.85;
    g.moveTo(-r, -r);
    g.lineTo(r, r);
    g.moveTo(-r, r);
    g.lineTo(r, -r);
    g.stroke({ color: KO_X_COLOR, width: KO_X_WIDTH, alpha: KO_X_ALPHA });
  }

  // S41 permadeath countdown badge. Visible only when the unit is KO'd
  // (not removed — caller passes undefined countdown on removed units)
  // AND the countdown is > 0. Imminent (≤ 1) shifts to a red/amber-red
  // palette for "this is the last virtual turn before permadeath."
  // Counters the KO_ALPHA fade by drawing at full alpha on the badge
  // container — the number must read regardless of the unit's
  // translucency.
  private drawPermadeathBadge(ko: boolean, countdown: number | undefined): void {
    if (!ko || countdown === undefined || countdown <= 0) {
      this.permadeathBadge.visible = false;
      return;
    }
    const imminent = countdown <= 1;
    this.permadeathBadge.visible = true;
    // Overlay alpha so the badge is readable above the KO_ALPHA-faded
    // sprite. Divide by KO_ALPHA so the on-screen alpha ends up ~1.
    this.permadeathBadge.alpha = Math.min(1, 1 / KO_ALPHA);

    const text = String(countdown);
    this.permadeathBadgeText.text = text;
    this.permadeathBadgeText.style.fill = imminent
      ? PERMADEATH_BADGE_TEXT_IMMINENT
      : PERMADEATH_BADGE_TEXT;

    // Size the rounded-rect background to the text.
    const padX = 6;
    const padY = 3;
    const w = Math.max(18, this.permadeathBadgeText.width + padX * 2);
    const h = this.permadeathBadgeText.height + padY * 2;

    const g = this.permadeathBadgeBg;
    g.clear();
    g.roundRect(-w / 2, -h / 2, w, h, 4);
    g.fill({ color: imminent ? PERMADEATH_BADGE_BG_IMMINENT : PERMADEATH_BADGE_BG, alpha: 0.95 });
    g.stroke({
      color: imminent ? PERMADEATH_BADGE_BORDER_IMMINENT : PERMADEATH_BADGE_BORDER,
      width: 2,
      alpha: 1,
    });

    // Position over the body center, slightly above the KO X marker's
    // center so the X reads underneath as "down" and the number reads
    // on top as "remaining."
    this.permadeathBadge.position.set(0, -2);
    this.permadeathBadgeText.position.set(0, 0);
  }

  private drawCounterpart(strength: number): void {
    const g = this.counterpartRing;
    g.clear();
    if (strength <= 0) return;
    // Session 31.5 polish #4: match the team-frame's rounded-square
    // shape rather than drawing a circle around a square. Pre-31.5 the
    // ring's curve diverged from the framed-picture portrait silhouette,
    // looking visually loose. Outer corner radius scales with the
    // outer radius so the curvature is proportional to PORTRAIT_FRAME_CORNER.
    const alpha = Math.min(1, strength) * 0.8;
    const outer = UNIT_RADIUS + ACTIVE_RING_PAD + 4;
    const corner = PORTRAIT_FRAME_CORNER + ACTIVE_RING_PAD + 4;
    g.roundRect(-outer, -outer, outer * 2, outer * 2, corner);
    g.stroke({ color: COUNTERPART_RING_COLOR, width: 3, alpha });
  }

  private drawBody(flash: number): void {
    const g = this.body;
    g.clear();
    // Session 26.5 (item #2): black square backdrop matching portrait
    // bounds. The portrait sprite (if loaded) sits directly on top; if
    // the portrait fails / isn't registered, the black backdrop reads
    // as "portrait pending" rather than the prior colored-circle
    // identity. Team identity is carried by the outer frame.
    g.rect(-UNIT_RADIUS, -UNIT_RADIUS, UNIT_RADIUS * 2, UNIT_RADIUS * 2);
    g.fill(PORTRAIT_BG_COLOR);
    g.stroke({ color: UNIT_OUTLINE_COLOR, alpha: UNIT_OUTLINE_ALPHA, width: 2 });

    if (flash > 0) {
      // Hit-flash overlay on the body (visible during the fallback
      // path when no portrait sprite is attached). The portrait
      // sprite's own tint-flash continues to handle the loaded case.
      g.rect(-UNIT_RADIUS, -UNIT_RADIUS, UNIT_RADIUS * 2, UNIT_RADIUS * 2);
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
      const fg =
        fraction <= HP_BAR_LOW_THRESHOLD
          ? HP_BAR_FG_LOW
          : fraction <= HP_BAR_HIGH_THRESHOLD
            ? HP_BAR_FG_MID
            : HP_BAR_FG;
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
    // Session 31.5 polish #4: rounded-square fitment matching the
    // team frame. See drawCounterpart for rationale.
    const outer = UNIT_RADIUS + ACTIVE_RING_PAD;
    const corner = PORTRAIT_FRAME_CORNER + ACTIVE_RING_PAD;
    g.roundRect(-outer, -outer, outer * 2, outer * 2, corner);
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

// Linearly interpolate between two RGB color ints. Used for the
// portrait tint hit-flash. t=0 → a, t=1 → b.
function lerpTint(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
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
