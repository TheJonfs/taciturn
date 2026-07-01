// TABA campaign — the durable, between-battle data model.
//
// This is the spine of the campaign engine (campaign-decomposition.md §3):
// a persistent unit identity that lives in campaign state, and the
// serializable container that holds everything carrying between battles.
// See docs/TABADesign/taba-m0-brief.md and ADR-0133.
//
// Design invariants this file commits to:
//   - STORE INPUTS, NEVER DERIVED STATE (CLAUDE.md rule 5; TABA D-A).
//     A `CampaignUnit` holds `(classId, level, brave, faith, loadout,
//     equipment, gender)` — the inputs to `buildBaseStats(...)` — plus
//     carried vitals. `baseStats` are *recomputed at fold time*, never
//     persisted. M2 progression will mutate exactly these inputs (level,
//     and eventually learned abilities), so getting the durable shape
//     right now pays off then.
//   - PLAIN-SERIALIZABLE (TABA D-C). Every field is a plain string,
//     number, array, or record — no `Map`/`Set`, class instances, or
//     closures. The whole `CampaignState` is the between-battle save
//     target and must survive a naive JSON round-trip.
//   - STABLE MINTED IDENTITY (TABA D-B). A unit's `id` is minted once at
//     roster authoring and threaded into every battle's `UnitPlacement.id`
//     — never regenerated per battle. This is what makes "the same unit
//     across battles" expressible (it replaces the engine's per-battle
//     positional id assignment).

import type {
  ClassId,
  Gender,
  Loadout,
  UnitEquipment,
  UnitId,
  Vitals,
} from '@engine/index.ts';

// Terminal-fate marker on a durable unit. M0 distinguishes only:
//   - `active` — on the roster, deployable.
//   - `lost`   — permadeath-removed in a prior battle (the engine's
//     `Unit.removed` flag, S39a). The durable record is RETAINED (not
//     hard-deleted) and dropped from future deploy rosters. Future death
//     rules (true permadelete / effortful restoration) are a *rules change
//     reading this marker*, not a rearchitecture (TABA D-D).
// `downed` (KO'd but not removed) is NOT a fate — a downed survivor stays
// `active` and is healed at the between-battle boundary.
export type UnitFate = 'active' | 'lost';

// The durable, between-battle unit. The campaign owns this; the battle
// only ever sees a `UnitPlacement` snapshot folded from it.
export interface CampaignUnit {
  // Minted once at authoring (D-B); carried into every battle's
  // `UnitPlacement.id`. Stable across the whole campaign.
  readonly id: UnitId;
  readonly name: string;

  // --- Stored inputs (D-A): the arguments to `buildBaseStats(...)`. ---
  readonly classId: ClassId;
  // Durable per-unit level — NOT slot-derived (that's Mage War's
  // team-builder path, which the campaign bypasses entirely). M0 authors a
  // uniform baseline; M2 leveling mutates this.
  readonly level: number;
  readonly brave: number;
  readonly faith: number;
  readonly loadout: Loadout;
  readonly equipment: UnitEquipment;
  // Cosmetic portrait variant. Optional — absent means the class default.
  // (Omitted, not set to `undefined`, under exactOptionalPropertyTypes.)
  readonly gender?: Gender;

  // --- Carried state (stored, not derived). ---
  // Current HP/MP carried between nodes. The persist-vitals path is
  // exercised in M0 even though the M0 rule heals everyone to full each
  // boundary (D-E): the snapshot-fold supplies these explicitly (clamped
  // to the recomputed effective max), so attrition-style wounds-carry
  // later is a one-line change in apply-back, not new plumbing. Normalized
  // to effective-full at campaign start and at each between-battle
  // apply-back (Chunk 2 — needs the catalog to read equipment-adjusted
  // maxes, so it is NOT computed here).
  readonly vitals: Vitals;

  readonly fate: UnitFate;
}

// The persistent campaign container — the ENTIRE between-battle save
// target (D-C). Plain-serializable by construction.
//
// The node-GRAPH definition (maps, enemy teams, deploy zones, edges) is
// static authored content referenced by position, NOT serialized here —
// only the *position* into it (`currentNodeId`) lives in the save, per
// "identity by ID" (CLAUDE.md rule 4). M1's graph is a branching DAG, so
// position is a node ID, not M0's linear index (a branch can't be an integer
// offset — taba-m1-brief).
export interface CampaignState {
  // Bumped when the persisted shape changes; `deserializeCampaign`
  // rejects unknown versions loudly rather than silently migrating.
  readonly schemaVersion: number;
  readonly roster: ReadonlyArray<CampaignUnit>;
  // The node the campaign is currently at (the next battle to fight, or the
  // just-won node while its interstitial runs). Advances along a win-edge
  // when the player picks at the world map.
  readonly currentNodeId: string;
  readonly phase: CampaignPhase;
}

// Where the campaign run stands. Resume reads this to know where to drop the
// player back in:
//   - `in_progress`    — at a node, about to fight it (Formation).
//   - `awaiting_route` — the current node is CLEARED (roster already healed via
//     apply-back); the player must pick the next node at the world map. Saved
//     right after a winning battle so a reload doesn't re-fight the won node.
//     `routeToNode` clears it back to `in_progress` at the chosen next node.
//   - `won`            — the terminal node was cleared; campaign complete.
//   - `lost`           — reserved (player wiped at a node); unused in M1.
export type CampaignPhase = 'in_progress' | 'awaiting_route' | 'won' | 'lost';
