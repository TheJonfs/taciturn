// Training Field shape tests. The map is data-only; the assertions
// here lock in the spec called out in `training-field.ts` and the
// roadmap (14×14, single-layer, uniform `ground` terrain at elevation
// 2). If a future change shifts any of these — say, adding a deployment
// zone marker once Cluster 2's `deploymentZone` field ships — these
// tests are the canary.

import { describe, expect, it } from 'vitest';
import {
  trainingField,
  TRAINING_FIELD_ELEVATION,
  TRAINING_FIELD_HEIGHT,
  TRAINING_FIELD_WIDTH,
} from './training-field.ts';

describe('Training Field map', () => {
  it('is a 14×14 grid', () => {
    expect(TRAINING_FIELD_WIDTH).toBe(14);
    expect(TRAINING_FIELD_HEIGHT).toBe(14);
    expect(trainingField.width).toBe(14);
    expect(trainingField.height).toBe(14);
    expect(trainingField.tiles.length).toBe(14 * 14);
  });

  it('has every (x, y) covered exactly once at layer 0', () => {
    const seen = new Set<string>();
    for (const t of trainingField.tiles) {
      const key = `${t.x},${t.y},${t.layer}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(t.layer).toBe(0);
      expect(t.x >= 0 && t.x < trainingField.width).toBe(true);
      expect(t.y >= 0 && t.y < trainingField.height).toBe(true);
    }
    expect(seen.size).toBe(14 * 14);
  });

  it('is uniform ground terrain at elevation 2 with no properties', () => {
    expect(TRAINING_FIELD_ELEVATION).toBe(2);
    for (const t of trainingField.tiles) {
      expect(t.terrain).toBe('ground');
      expect(t.elevation).toBe(2);
      expect(t.properties.length).toBe(0);
    }
  });
});
