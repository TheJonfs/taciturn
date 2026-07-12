// World-map node layout — AUTHORED positions for the campaign graph's nodes.
//
// Extracted from WorldMapBeatView (S90, node-authoring structural tier) so
// layout is authored campaign-adjacent data rather than render-layer
// incident: the Atlas graph editor owns this file as codegen output
// (drag-to-place writes it), and the world map + march animation read it.
// Positions are viewBox units; the view derives its viewBox from these
// bounds with the original 640×350 frame as the floor, so the shipped
// six-node layout renders exactly as before.
//
// GENERATED-SHAPED: hand edits are fine while the graph is authored by
// hand, but the Atlas tool (`?atlas`) regenerates this table wholesale on
// export — keep anything that isn't a node position out of this file.

import { M1_NODES } from '@campaign/index.ts';

export interface NodePosition {
  readonly x: number;
  readonly y: number;
}

// Laid out left→right to read as a forward DAG: start at the left, the fork
// splits north/south, the side node hangs above the north route, the
// convergent terminal sits at the right.
export const NODE_LAYOUT: Readonly<Record<string, NodePosition>> = {
  [M1_NODES.riverRidge]: { x: 70, y: 175 },
  [M1_NODES.stonebridge]: { x: 245, y: 85 },
  [M1_NODES.marshmoor]: { x: 245, y: 265 },
  [M1_NODES.theCrossing]: { x: 430, y: 265 },
  [M1_NODES.mountainPass]: { x: 430, y: 85 },
  [M1_NODES.theReturn]: { x: 570, y: 175 },
};
