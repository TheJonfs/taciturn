// Unit tests for the deployment-zone layer's pure tint helper. The
// Pixi rendering side (Graphics calls) isn't tested headlessly — same
// posture as the other renderer layers' tests.

import { describe, expect, it } from 'vitest';
import { teamId } from '@engine/index.ts';
import { deploymentZoneTintFor } from './deployment-zone-layer.ts';
import {
  DEPLOYMENT_ZONE_ALPHA_CURRENT,
  DEPLOYMENT_ZONE_ALPHA_OPPONENT,
  DEPLOYMENT_ZONE_STROKE_ALPHA_CURRENT,
  DEPLOYMENT_ZONE_STROKE_ALPHA_OPPONENT,
  TEAM_COLORS,
} from './constants.ts';

const BLUE = teamId('team_a');
const RED = teamId('team_b');

describe('deploymentZoneTintFor', () => {
  it('returns null for non-deployment tiles (undefined / null zone)', () => {
    expect(deploymentZoneTintFor(undefined, BLUE)).toBeNull();
    expect(deploymentZoneTintFor(null, BLUE)).toBeNull();
  });

  it('tints the current team zone bright with that team color', () => {
    const tint = deploymentZoneTintFor(BLUE, BLUE);
    expect(tint).not.toBeNull();
    expect(tint!.color).toBe(TEAM_COLORS.get(BLUE));
    expect(tint!.fillAlpha).toBe(DEPLOYMENT_ZONE_ALPHA_CURRENT);
    expect(tint!.strokeAlpha).toBe(DEPLOYMENT_ZONE_STROKE_ALPHA_CURRENT);
  });

  it('tints an opponent zone faint with that opponent color', () => {
    const tint = deploymentZoneTintFor(RED, BLUE);
    expect(tint).not.toBeNull();
    expect(tint!.color).toBe(TEAM_COLORS.get(RED));
    expect(tint!.fillAlpha).toBe(DEPLOYMENT_ZONE_ALPHA_OPPONENT);
    expect(tint!.strokeAlpha).toBe(DEPLOYMENT_ZONE_STROKE_ALPHA_OPPONENT);
  });

  it('current team zone reads brighter than an opponent zone', () => {
    const current = deploymentZoneTintFor(BLUE, BLUE)!;
    const opponent = deploymentZoneTintFor(RED, BLUE)!;
    expect(current.fillAlpha).toBeGreaterThan(opponent.fillAlpha);
    expect(current.strokeAlpha).toBeGreaterThan(opponent.strokeAlpha);
  });

  it('which zone is "current" flips with the currentTeam argument', () => {
    // Same Red zone tile, but Red is now the deploying team.
    const tint = deploymentZoneTintFor(RED, RED);
    expect(tint!.fillAlpha).toBe(DEPLOYMENT_ZONE_ALPHA_CURRENT);
  });
});
