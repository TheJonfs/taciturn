// S55 regression: the unit sprite's status-badge row was rebuilt every frame
// (setVisualState runs per frame), creating fresh Graphics + Text and only
// DETACHING the old ones via `removeChildren()` — which in Pixi v8 does not
// free GPU resources. Each orphaned Text leaked a GPU texture (JS GC can't
// reclaim WebGL textures without `destroy()`), so a battle with buffed /
// charging units climbed toward 2 GB and crashed the WebGL context. The fix:
// rebuild only when the status set changes, and destroy the old children on a
// real rebuild.

import { describe, expect, it } from 'vitest';
import { Container } from 'pixi.js';
import { UnitSprite, type StatusBadge, type UnitVisualState } from './unit-layer.ts';
import { makeUnit } from '../engine/ct/test-fixtures.ts';

const burn: StatusBadge = { typeId: 'burn', stacks: 1, polarity: 'negative' };
const slow: StatusBadge = { typeId: 'slow', stacks: 2, polarity: 'negative' };

function visualState(statuses: ReadonlyArray<StatusBadge>, ko = false): UnitVisualState {
  return {
    position: { x: 0, y: 0 },
    facing: 'N',
    hp: 50,
    maxHp: 100,
    mp: 10,
    maxMp: 20,
    ko,
    active: false,
    flash: 0,
    statuses,
    counterpart: 0,
  };
}

function statusRowOf(sprite: UnitSprite): Container {
  const row = sprite.container.children.find((c) => c.label === 'statuses');
  if (!(row instanceof Container)) throw new Error('status row not found');
  return row;
}

function newSprite(): UnitSprite {
  return new UnitSprite(makeUnit({ id: 'u', spd: 8 }));
}

describe('UnitSprite status badges — rebuild only on change (S55 leak fix)', () => {
  it('keeps the same badge children across repeated frames with an unchanged status set', () => {
    const sprite = newSprite();
    sprite.setVisualState(visualState([burn]));
    const row = statusRowOf(sprite);
    const afterFirst = [...row.children];
    expect(afterFirst.length).toBeGreaterThan(0);

    // Simulate 10 frames with identical statuses. The old per-frame rebuild
    // would have replaced every child each time (the leak); now the row is
    // untouched.
    for (let i = 0; i < 10; i++) sprite.setVisualState(visualState([burn]));
    expect([...row.children]).toEqual(afterFirst);
  });

  it('rebuilds and DESTROYS the old children when the status set changes', () => {
    const sprite = newSprite();
    sprite.setVisualState(visualState([burn]));
    const row = statusRowOf(sprite);
    const first = [...row.children];

    sprite.setVisualState(visualState([burn, slow]));
    const second = [...row.children];
    expect(second).not.toEqual(first);
    // Old children freed (destroyed), not merely detached — this is what stops
    // the GPU-texture leak.
    for (const child of first) expect(child.destroyed).toBe(true);
  });

  it('clears badges on KO without leaving children attached', () => {
    const sprite = newSprite();
    sprite.setVisualState(visualState([burn]));
    const row = statusRowOf(sprite);
    expect(row.children.length).toBeGreaterThan(0);

    sprite.setVisualState(visualState([burn], true));
    expect(row.children.length).toBe(0);
  });
});
