// Human-readable labels for bucket and equipment-slot ids.
//
// Per Session 30 fold-in: bucket and slot ids render raw in the unit
// detail panel today (`'secondary_command_sets'`, `'leftHand'`, etc.).
// This module is the single source of truth for the player-facing
// strings; the helper functions (`bucketLabel`, `slotLabel`) wrap the
// constants so a future icon-or-text migration is a one-helper change
// rather than a sweep across every consumer.
//
// To rename a label: edit the relevant constant map entry. Every
// consumer reads through `bucketLabel(id)` / `slotLabel(id)` so the
// string change propagates automatically.
//
// To introduce icons later: extend the helpers to return either text
// or { text, icon } and update each call site's rendering once. The
// constant maps stay the source of truth; only the helper return
// shape grows.

import type { BucketId, EquipmentSlotId } from '../engine/types/index.ts';
import {
  BUCKET_FIRST_ACTION,
  BUCKET_MOVEMENT,
  BUCKET_REACTION,
  BUCKET_SECONDARY_COMMAND_SETS,
  BUCKET_SUPPORT,
} from '../engine/abilities/constants.ts';

// Bucket labels keyed by BucketId. Note the (s) plurals: a bucket
// can hold multiple entries when capacity is raised by equipment
// (Magus Crown lifting `secondary_command_sets` from 1 to 2), so the
// label reads naturally whether the bucket has one or many entries.
const BUCKET_LABELS: ReadonlyMap<BucketId, string> = new Map([
  [BUCKET_FIRST_ACTION, 'Primary Action'],
  [BUCKET_SECONDARY_COMMAND_SETS, 'Secondary Action(s)'],
  [BUCKET_REACTION, 'Reaction(s)'],
  [BUCKET_SUPPORT, 'Support(s)'],
  [BUCKET_MOVEMENT, 'Movement(s)'],
]);

// Equipment-slot labels keyed by EquipmentSlotId. "Body" and "Head"
// read more naturally to the player than the internal "armor" and
// "headgear" engine names; the engine names stay for module / hook
// identity, and this layer translates.
const SLOT_LABELS: ReadonlyMap<EquipmentSlotId, string> = new Map([
  ['leftHand', 'Left Hand'],
  ['rightHand', 'Right Hand'],
  ['headgear', 'Head'],
  ['armor', 'Body'],
  ['accessory', 'Accessory'],
]);

// Read site for a bucket label. Falls back to the raw id when an
// unknown bucket id arrives — defensive against catalog drift; the
// unit detail panel still renders something rather than the empty
// string, and the fallback is grep-able if it ever appears in a
// screenshot.
export function bucketLabel(id: BucketId): string {
  return BUCKET_LABELS.get(id) ?? String(id);
}

// Read site for a slot label. Same fallback discipline as bucketLabel.
export function slotLabel(id: EquipmentSlotId): string {
  return SLOT_LABELS.get(id) ?? String(id);
}
