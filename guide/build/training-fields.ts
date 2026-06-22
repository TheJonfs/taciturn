// Training-fields registry — the chapter's table of contents.
//
// Pairs each field's hand-authored prose (`content/training-fields/`)
// with its catalog map (loaded via `data.ts`). The compose layer and
// the TOC both iterate this list, so adding a new field is a matter of
// (1) authoring its FieldProse module, (2) appending an entry here,
// and (3) the page template handles the rest.

import type { BattleMap } from '@engine/index.ts';
import { riverRidgeMap, stonebridgeMap, marshmoorMap, mountainPassMap } from './data.ts';
import { riverRidgeProse } from '../content/training-fields/river-ridge.ts';
import { stonebridgeProse } from '../content/training-fields/stonebridge.ts';
import { marshmoorProse } from '../content/training-fields/marshmoor.ts';
import { mountainPassProse } from '../content/training-fields/mountain-pass.ts';
import type { FieldProse } from '../content/training-fields/river-ridge.ts';

export interface TrainingFieldEntry {
  readonly prose: FieldProse;
  readonly map: BattleMap;
}

/** All training fields, in handbook reading order. */
export const TRAINING_FIELDS: ReadonlyArray<TrainingFieldEntry> = [
  { prose: riverRidgeProse, map: riverRidgeMap() },
  { prose: stonebridgeProse, map: stonebridgeMap() },
  { prose: marshmoorProse, map: marshmoorMap() },
  { prose: mountainPassProse, map: mountainPassMap() },
];
