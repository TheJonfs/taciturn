// Stack chip — the stacked-cell layer chooser (S97, bridge over/under
// UI, WI3). A small two-segment picker drawn beside a stacked cell when
// the UI decides disambiguation is warranted (both layers valid for the
// current action, or idle inspection of a stacked cell). Each segment
// shows its layer's elevation digit, deck on top, ground below; the
// active segment carries the gold accent.
//
// Interaction model: the chip is PURELY VISUAL here — it does not own
// Pixi pointer events. BattleRenderer's stage-level hit-test asks
// `segmentAt(point)` FIRST on every tap; a hit routes as a layer-
// explicit tile click on the segment's position (so a chip tap flows
// through exactly the same UI path as clicking the layer's own art),
// and `containsPoint` lets the hover path freeze while the pointer
// travels from the cell to the chip. One code path for mouse and touch
// — a tap is a tap, no modifier keys, per the brief's touch-safety
// requirement.
//
// Placement: anchored to the right of the cell (following the deck's
// lifted top edge); flips to the left edge for cells on the map's last
// column so it never hangs off-map. Drawn in world space above the unit
// layer — it pans/zooms with the map.

import { Container, Graphics, Text } from 'pixi.js';
import type { Position } from '@engine/index.ts';
import type { PixelRect, StackGeometry } from './world.ts';
import {
  ACTIVE_HIGHLIGHT_COLOR,
  STACK_CHIP_BG,
  STACK_CHIP_BG_ALPHA,
  STACK_CHIP_BORDER_INACTIVE,
  STACK_CHIP_CORNER,
  STACK_CHIP_GAP,
  STACK_CHIP_SEG_GAP,
  STACK_CHIP_SEG_HEIGHT,
  STACK_CHIP_SEG_WIDTH,
  STACK_CHIP_TEXT,
  TILE_SIZE,
} from './constants.ts';

// One selectable segment: the layer it commits and the elevation digit
// it shows. Ordered deck-first (top segment = top layer).
export interface StackChipSegment {
  readonly layer: number;
  readonly label: string;
  readonly active: boolean;
}

export interface StackChipConfig {
  readonly x: number;
  readonly y: number;
  readonly segments: ReadonlyArray<StackChipSegment>;
  // True → anchor left of the cell (last-column flip).
  readonly flipToLeft: boolean;
}

interface SegmentHit {
  readonly rect: PixelRect;
  readonly pos: Position;
}

export class StackChipLayer {
  readonly container: Container;
  private readonly graphics: Graphics;
  private readonly labels: Container;
  private hits: SegmentHit[] = [];

  constructor() {
    this.container = new Container();
    this.container.label = 'stack-chip';
    this.graphics = new Graphics();
    this.labels = new Container();
    this.container.addChild(this.graphics, this.labels);
  }

  // Draw the chip beside cell (x, y), or clear it with null. The deck
  // lift aligns the chip's top with the lifted deck art.
  show(config: StackChipConfig | null, geo: StackGeometry | null): void {
    this.graphics.clear();
    for (const child of [...this.labels.children]) {
      this.labels.removeChild(child);
      child.destroy();
    }
    this.hits = [];
    if (config === null) return;

    const lift = geo?.stackAt(config.x, config.y)?.liftPx ?? 0;
    const chipX = config.flipToLeft
      ? config.x * TILE_SIZE - STACK_CHIP_GAP - STACK_CHIP_SEG_WIDTH - lift
      : (config.x + 1) * TILE_SIZE + STACK_CHIP_GAP;
    let segY = config.y * TILE_SIZE - lift;

    for (const seg of config.segments) {
      const rect: PixelRect = {
        px: chipX,
        py: segY,
        w: STACK_CHIP_SEG_WIDTH,
        h: STACK_CHIP_SEG_HEIGHT,
      };
      this.graphics.roundRect(rect.px, rect.py, rect.w, rect.h, STACK_CHIP_CORNER);
      this.graphics.fill({ color: STACK_CHIP_BG, alpha: STACK_CHIP_BG_ALPHA });
      this.graphics.stroke({
        color: seg.active ? ACTIVE_HIGHLIGHT_COLOR : STACK_CHIP_BORDER_INACTIVE,
        width: seg.active ? 2 : 1,
        alpha: 1,
      });
      const text = new Text({
        text: seg.label,
        style: {
          fontFamily: 'system-ui, sans-serif',
          fontSize: 11,
          fontWeight: 'bold',
          fill: seg.active ? ACTIVE_HIGHLIGHT_COLOR : STACK_CHIP_TEXT,
          align: 'center',
        },
      });
      text.anchor.set(0.5);
      text.x = rect.px + rect.w / 2;
      text.y = rect.py + rect.h / 2;
      this.labels.addChild(text);
      this.hits.push({ rect, pos: { x: config.x, y: config.y, layer: seg.layer } });
      segY += STACK_CHIP_SEG_HEIGHT + STACK_CHIP_SEG_GAP;
    }
  }

  // The layer-explicit position a tap at `point` (world coords) picks,
  // or null when the point is outside the chip.
  segmentAt(point: { x: number; y: number }): Position | null {
    for (const { rect, pos } of this.hits) {
      if (
        point.x >= rect.px &&
        point.x < rect.px + rect.w &&
        point.y >= rect.py &&
        point.y < rect.py + rect.h
      ) {
        return pos;
      }
    }
    return null;
  }

  // True when `point` (world coords) is over (or within a small margin
  // of) any chip segment — the hover path freezes rather than
  // re-resolving while crossing to the chip. The margin bridges the
  // cell-to-chip gap so the traverse can't hide the chip mid-way.
  containsPoint(point: { x: number; y: number }): boolean {
    const m = STACK_CHIP_GAP + 2;
    for (const { rect } of this.hits) {
      if (
        point.x >= rect.px - m &&
        point.x < rect.px + rect.w + m &&
        point.y >= rect.py - m &&
        point.y < rect.py + rect.h + m
      ) {
        return true;
      }
    }
    return false;
  }

  get visible(): boolean {
    return this.hits.length > 0;
  }
}
