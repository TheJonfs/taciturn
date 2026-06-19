// Deployment-zone layer — tints each team's deployment-zone tiles
// during the deployment phase (Session 35 / Phase E).
//
// Engine-blind: reads only the `DeploymentZoneConfig` (S70 — zones live
// beside the terrain now, not on the tiles) and the id of the team
// currently deploying. Static for the lifetime of the deployment screen
// — `draw` is called once at mount and `clear` once on transition into
// the battle proper.
//
// The current team's zone reads bright (it's interactive — the player
// places units there); any other team's zone reads faint (visible, so
// the player can plan around enemy positioning, but not interactive).
//
// Layer placement: above the elevation labels, below the highlight
// layer and the unit layer — the tint sits on the terrain, units and
// the facing picker draw over it.

import { Container, Graphics } from 'pixi.js';
import type { DeploymentZoneConfig, TeamId } from '@engine/index.ts';
import {
  DEPLOYMENT_ZONE_ALPHA_CURRENT,
  DEPLOYMENT_ZONE_ALPHA_OPPONENT,
  DEPLOYMENT_ZONE_STROKE_ALPHA_CURRENT,
  DEPLOYMENT_ZONE_STROKE_ALPHA_OPPONENT,
  DEPLOYMENT_ZONE_STROKE_WIDTH,
  TEAM_COLOR_FALLBACK,
  TEAM_COLORS,
  TILE_INSET,
  TILE_SIZE,
} from './constants.ts';

export interface DeploymentZoneTint {
  readonly color: number;
  readonly fillAlpha: number;
  readonly strokeAlpha: number;
}

// The tint for a tile's `deploymentZone` field, relative to the team
// currently deploying. `null` / `undefined` zone (a non-deployment
// tile) → `null` (no tint). Pure; exposed for unit tests.
export function deploymentZoneTintFor(
  zone: TeamId | null | undefined,
  currentTeam: TeamId,
): DeploymentZoneTint | null {
  if (zone === undefined || zone === null) return null;
  const color = TEAM_COLORS.get(zone) ?? TEAM_COLOR_FALLBACK;
  const isCurrent = zone === currentTeam;
  return {
    color,
    fillAlpha: isCurrent
      ? DEPLOYMENT_ZONE_ALPHA_CURRENT
      : DEPLOYMENT_ZONE_ALPHA_OPPONENT,
    strokeAlpha: isCurrent
      ? DEPLOYMENT_ZONE_STROKE_ALPHA_CURRENT
      : DEPLOYMENT_ZONE_STROKE_ALPHA_OPPONENT,
  };
}

export class DeploymentZoneLayer {
  readonly container: Container;
  private readonly gfx: Graphics;

  constructor() {
    this.container = new Container();
    this.container.label = 'deployment-zone';
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  // Tint each side's deployment-zone tiles relative to `currentTeam`.
  // Called once at deployment-screen mount; supports repaints (clears
  // first) if a future caller re-invokes it. Iterates the zone config's
  // sub-zones (a split zone simply contributes more tiles under the same
  // team tint).
  draw(zones: DeploymentZoneConfig, currentTeam: TeamId): void {
    this.gfx.clear();
    for (const zone of zones.teams) {
      const tint = deploymentZoneTintFor(zone.team, currentTeam);
      if (tint === null) continue;
      for (const subZone of zone.subZones) {
        for (const tile of subZone.tiles) {
          const px = tile.x * TILE_SIZE + TILE_INSET / 2;
          const py = tile.y * TILE_SIZE + TILE_INSET / 2;
          const size = TILE_SIZE - TILE_INSET;
          this.gfx.rect(px, py, size, size);
          this.gfx.fill({ color: tint.color, alpha: tint.fillAlpha });
          this.gfx.stroke({
            color: tint.color,
            alpha: tint.strokeAlpha,
            width: DEPLOYMENT_ZONE_STROKE_WIDTH,
          });
        }
      }
    }
  }

  clear(): void {
    this.gfx.clear();
  }
}
