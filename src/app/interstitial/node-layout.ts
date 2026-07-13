// GENERATED-SHAPED — world-map node layout (Atlas graph editor).
//
// Authored positions for the campaign graph's nodes, in viewBox units. The
// world map + march animation read this table; the Atlas tool (`?atlas`)
// owns it as codegen output — drag-to-place rewrites it WHOLESALE on
// export, so keep anything that isn't a node position out of this file.
// The view derives its viewBox from these bounds with the original 640×350
// frame as the floor. Paired with src/campaign/node.ts; round-trip pinned
// by the Atlas codegen test.

import { CAMPAIGN_NODES } from '@campaign/index.ts';

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

export const NODE_LAYOUT: Readonly<Record<string, NodePosition>> = {
  [CAMPAIGN_NODES.zarghidas]: { x: 80, y: 90 },
  [CAMPAIGN_NODES.oskun]: { x: 200, y: 60 },
  [CAMPAIGN_NODES.alvera]: { x: 330, y: 55 },
  [CAMPAIGN_NODES.zelmoniaCastle]: { x: 350, y: 150 },
  [CAMPAIGN_NODES.zelmoniaHills]: { x: 430, y: 190 },
  [CAMPAIGN_NODES.grekForest]: { x: 520, y: 100 },
  [CAMPAIGN_NODES.fortCator]: { x: 650, y: 120 },
  [CAMPAIGN_NODES.ordalCanyon]: { x: 680, y: 230 },
  [CAMPAIGN_NODES.oldOrdal]: { x: 700, y: 330 },
  [CAMPAIGN_NODES.mountEska]: { x: 450, y: 320 },
  [CAMPAIGN_NODES.esterRoad]: { x: 280, y: 390 },
  [CAMPAIGN_NODES.rukVillage]: { x: 140, y: 300 },
  [CAMPAIGN_NODES.viura]: { x: 760, y: 420 },
};
