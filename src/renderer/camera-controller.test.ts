// CameraController math tests. The Pixi side-effects (apply) are not
// exercised here; only the pure math (fit-map, zoom-around-focal, pan
// integration, mode transitions, bounds clamping).

import { describe, expect, it } from 'vitest';
import { CameraController } from './camera-controller.ts';
import { CAMERA_LERP, TILE_SIZE } from './constants.ts';

const TF_OPTS = {
  mapWidth: 14,
  mapHeight: 14,
  tileSize: TILE_SIZE,
  screenWidth: 800,
  screenHeight: 600,
};

describe('CameraController fit-map', () => {
  it('centers position on the map midpoint at construction', () => {
    const cam = new CameraController(TF_OPTS);
    const expectedCx = (TF_OPTS.mapWidth * TF_OPTS.tileSize) / 2;
    const expectedCy = (TF_OPTS.mapHeight * TF_OPTS.tileSize) / 2;
    expect(cam.getPosition()).toEqual({ x: expectedCx, y: expectedCy });
  });

  it('picks a zoom that fits the constrained dimension with padding', () => {
    const cam = new CameraController(TF_OPTS);
    // 14×14 at TILE_SIZE=48 → 672×672 world. Fit inside 800×600 →
    // height is the constraint; expected zoom = (600 / 672) * 0.92 ≈ 0.821
    const mapPxH = TF_OPTS.mapHeight * TF_OPTS.tileSize;
    const expectedFit = (TF_OPTS.screenHeight / mapPxH) * 0.92;
    expect(cam.getZoom()).toBeCloseTo(expectedFit, 6);
  });

  it('reframes after a screen resize', () => {
    const cam = new CameraController(TF_OPTS);
    cam.setScreenSize(1600, 1200);
    cam.fitMap();
    // Map is 672×672 (square); screen 1600×1200 is wider than tall, so
    // height (1200) remains the constraint and the new fit zoom is
    // (1200 / 672) × padding.
    const mapPxH = TF_OPTS.mapHeight * TF_OPTS.tileSize;
    const expectedFit = (1200 / mapPxH) * 0.92;
    expect(cam.getZoom()).toBeCloseTo(expectedFit, 6);
  });
});

describe('CameraController zoom math', () => {
  it('zoom-toward-center keeps cameraPos unchanged', () => {
    const cam = new CameraController(TF_OPTS);
    const before = cam.getPosition();
    cam.applyZoom(1.5, { x: TF_OPTS.screenWidth / 2, y: TF_OPTS.screenHeight / 2 });
    const after = cam.getPosition();
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(cam.getZoom()).toBeGreaterThan(0);
  });

  it('zoom-toward-cursor keeps the world point under the cursor stationary', () => {
    const cam = new CameraController(TF_OPTS);
    const focal = { x: 200, y: 100 };
    const oldZoom = cam.getZoom();
    const oldPos = cam.getPosition();
    const cx = TF_OPTS.screenWidth / 2;
    const cy = TF_OPTS.screenHeight / 2;
    const worldUnderBefore = {
      x: oldPos.x + (focal.x - cx) / oldZoom,
      y: oldPos.y + (focal.y - cy) / oldZoom,
    };

    cam.applyZoom(1.4, focal);

    const newZoom = cam.getZoom();
    const newPos = cam.getPosition();
    const worldUnderAfter = {
      x: newPos.x + (focal.x - cx) / newZoom,
      y: newPos.y + (focal.y - cy) / newZoom,
    };
    expect(worldUnderAfter.x).toBeCloseTo(worldUnderBefore.x, 4);
    expect(worldUnderAfter.y).toBeCloseTo(worldUnderBefore.y, 4);
  });

  it('clamps zoom at the fit-map minimum (cannot zoom out beyond fit)', () => {
    const cam = new CameraController(TF_OPTS);
    const startZoom = cam.getZoom();
    cam.applyZoom(0.001, { x: 400, y: 300 });
    expect(cam.getZoom()).toBeCloseTo(startZoom, 6);
  });

  it('clamps zoom at maxZoom', () => {
    const cam = new CameraController({ ...TF_OPTS, maxZoom: 2 });
    cam.applyZoom(100, { x: 400, y: 300 });
    expect(cam.getZoom()).toBeCloseTo(2, 6);
  });

  it('zoom transitions to user-driven mode', () => {
    const cam = new CameraController(TF_OPTS);
    expect(cam.getMode()).toBe('auto-follow');
    cam.applyZoom(1.5, { x: 400, y: 300 });
    expect(cam.getMode()).toBe('user-driven');
  });
});

describe('CameraController pan input', () => {
  it('non-zero pan input shifts position by zoom-scaled distance per second', () => {
    const cam = new CameraController(TF_OPTS);
    cam.applyZoom(1.5, { x: 400, y: 300 }); // bump zoom + flip mode
    const before = cam.getPosition();
    const zoom = cam.getZoom();

    cam.setPanInput({ left: false, right: true, up: false, down: false });
    cam.update(1000); // 1 second

    const expectedDx = (8 * TF_OPTS.tileSize) / zoom; // panTilesPerSec * tileSize / zoom
    const after = cam.getPosition();
    // May have hit the right edge if panning continues all the way; for
    // this 14×14 map the camera starts centered so 1 second of pan can
    // hit the right boundary depending on zoom — assert the camera
    // moved the right way and stayed inside the map.
    expect(after.x).toBeGreaterThan(before.x);
    expect(after.y).toBeCloseTo(before.y, 6);
    // Either we travelled the full expected distance or we hit the
    // right boundary at mapWidth*tileSize.
    const mapPxW = TF_OPTS.mapWidth * TF_OPTS.tileSize;
    expect(after.x).toBeLessThanOrEqual(mapPxW);
    if (after.x < mapPxW) {
      expect(after.x - before.x).toBeCloseTo(expectedDx, 4);
    }
  });

  it('pan input transitions to user-driven mode', () => {
    const cam = new CameraController(TF_OPTS);
    expect(cam.getMode()).toBe('auto-follow');
    cam.setPanInput({ left: true, right: false, up: false, down: false });
    cam.update(16);
    expect(cam.getMode()).toBe('user-driven');
  });

  it('idle pan input does not change mode', () => {
    const cam = new CameraController(TF_OPTS);
    cam.setPanInput({ left: false, right: false, up: false, down: false });
    cam.update(16);
    expect(cam.getMode()).toBe('auto-follow');
  });

  it('diagonal pan moves at the same speed as cardinal pan (length-normalized)', () => {
    const cam = new CameraController(TF_OPTS);
    cam.setPanInput({ left: false, right: true, up: false, down: true });
    cam.update(100);
    const dx = cam.getPosition().x - (TF_OPTS.mapWidth * TF_OPTS.tileSize) / 2;
    const dy = cam.getPosition().y - (TF_OPTS.mapHeight * TF_OPTS.tileSize) / 2;
    const dist = Math.hypot(dx, dy);
    const speedWorldPxPerSec =
      (8 * TF_OPTS.tileSize) / cam.getZoom();
    const expectedDist = speedWorldPxPerSec * 0.1;
    // Allow for clamp at boundary — diagonal pan from center toward
    // (right, down) on a 14×14 map at 100ms shouldn't hit edges.
    expect(dist).toBeCloseTo(expectedDist, 4);
  });
});

describe('CameraController auto-follow', () => {
  it('lerps toward the auto target when in auto-follow mode', () => {
    const cam = new CameraController(TF_OPTS);
    const start = cam.getPosition();
    const target = { x: start.x + 200, y: start.y };
    cam.setAutoFollowTarget(target);
    cam.update(16);
    const after = cam.getPosition();
    const expectedDx = (target.x - start.x) * CAMERA_LERP;
    expect(after.x).toBeCloseTo(start.x + expectedDx, 4);
  });

  it('does not lerp when in user-driven mode even with a target set', () => {
    const cam = new CameraController(TF_OPTS);
    const start = cam.getPosition();
    cam.applyZoom(1.5, { x: 400, y: 300 }); // → user-driven
    const afterZoom = cam.getPosition();
    cam.setAutoFollowTarget({ x: start.x + 500, y: start.y });
    cam.update(16);
    const afterUpdate = cam.getPosition();
    expect(afterUpdate.x).toBeCloseTo(afterZoom.x, 6);
  });

  it('engageAutoFollow re-enables lerping toward target', () => {
    const cam = new CameraController(TF_OPTS);
    const start = cam.getPosition();
    cam.applyZoom(1.5, { x: 400, y: 300 }); // → user-driven
    cam.setAutoFollowTarget({ x: start.x + 200, y: start.y });
    cam.update(16);
    const afterIgnored = cam.getPosition();

    cam.engageAutoFollow();
    cam.update(16);
    const afterEngaged = cam.getPosition();
    expect(afterEngaged.x).toBeGreaterThan(afterIgnored.x);
  });
});

describe('CameraController bounds', () => {
  it('clamps camera position inside the map when panning past an edge', () => {
    const cam = new CameraController(TF_OPTS);
    cam.applyZoom(2.0, { x: 400, y: 300 });
    cam.setPanInput({ left: true, right: false, up: false, down: false });
    cam.update(10000); // far more than enough to overshoot
    const pos = cam.getPosition();
    expect(pos.x).toBeGreaterThanOrEqual(0);
    expect(pos.x).toBeLessThanOrEqual(TF_OPTS.mapWidth * TF_OPTS.tileSize);
  });
});
