// GENERATED-SHAPED — world-map node layout (Atlas graph editor).
//
// Authored positions for the campaign graph's nodes, in viewBox units. The
// world map + march animation read this table; the Atlas tool (`?atlas`)
// owns it as codegen output — drag-to-place rewrites it WHOLESALE on
// export, so keep anything that isn't a node position out of this file.
// The view derives its viewBox from these bounds with the original 640×350
// frame as the floor. Paired with src/campaign/node.ts; round-trip pinned
// by the Atlas codegen test.

import { M1_NODES } from '@campaign/index.ts';

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

export const NODE_LAYOUT: Readonly<Record<string, NodePosition>> = {
  [M1_NODES.riverRidge]: { x: 70, y: 175 },
  [M1_NODES.stonebridge]: { x: 245, y: 85 },
  [M1_NODES.marshmoor]: { x: 245, y: 265 },
  [M1_NODES.theCrossing]: { x: 430, y: 265 },
  [M1_NODES.mountainPass]: { x: 430, y: 85 },
  [M1_NODES.theReturn]: { x: 570, y: 175 },
};
