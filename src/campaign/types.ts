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
import type { UnlockToken } from './progression/tokens.ts';

// Per-unit, PER-CLASS earned JP — the M2 economy's stored state (ADR-0138,
// per-class revision). JP is tracked per class (FFT-style): Knight JP only
// buys Knight abilities. A unit earns into a class's pool while acting AS that
// class (or via the roster spillover into its *current* class), and from
// tier-scaled unlock grants into the newly-unlocked class's pool.
//
// Keyed by ClassId (as a plain string — D-C plain-serializable; a branded
// ClassId is a string subtype, so `earnedByClass[classId]` indexes directly).
// Only `earned` is STORED — `spent` is fully DERIVED from `unlocks` + the
// static component-cost catalog (sum of a class's unlocked components' costs),
// so `available(class) = earned[class] − spent(class)`. See
// `progression/ledger.ts`.
export type EarnedByClass = Readonly<Record<string, number>>;

export const EMPTY_EARNED_BY_CLASS: EarnedByClass = {};

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
  // TABA (ADR-0136 completion): an ENDURING portrait override key for plot-unique
  // units — a bespoke face that survives reclassing (the plot-unit whole point).
  // A plain string (D-C plain-serializable), NOT the full `PortraitRef`: plot
  // faces are always `fixed` keys, so the durable record stores just the key and
  // the assets layer resolves it (with a class-portrait fallback when the key is
  // unregistered → art can land incrementally). Threaded to `Unit.portrait` via
  // the fold. Omitted for generic units.
  readonly portrait?: string;

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

  // --- M2 progression (stored inputs; D-A / rule 5). ---
  // Between-battle XP carry (the remainder below `per_level`). Accrues in
  // battle via `system_xp_award`; `level` increments on rollover. Read back
  // from the battle unit at apply-back. Fresh units start 0.
  readonly xp: number;
  // Per-class earned JP. Fresh units start EMPTY_EARNED_BY_CLASS. Spent is
  // derived from `unlocks`, so only earnings are stored here.
  readonly earnedByClass: EarnedByClass;
  // The purchase record — every component (ability / item / math parameter /
  // value) this unit has unlocked. The source of truth for BOTH ability-use
  // gating and the per-tier-per-half spend accumulators (which are DERIVED
  // from this + the static component catalog, never stored). Array, not Set,
  // per D-C plain-serializable. Fresh units start `[]`.
  readonly unlocks: ReadonlyArray<UnlockToken>;
  // Plot-unique relief valve: classes this unit may reclass into REGARDLESS of
  // the tier thresholds (an early-Ch1 Assassin/Calculator "taste" without
  // opening that tier for generics). The first consumer of the unique-character
  // override layer. Optional — omitted for generic units (under
  // exactOptionalPropertyTypes; omitted, not `undefined`).
  readonly classAccessOverride?: ReadonlyArray<ClassId>;

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
  // TABA M3 — the party inventory: OWNED count per item id, TOTAL
  // (instances currently equipped on roster units included). Equipped
  // counts are DERIVED from roster equipment (rule 5: computed vs
  // stored), so free-to-equip = owned − equipped is computed on read
  // (see inventory.ts) and equip/unequip never mutate this record —
  // only RECEIPT (shop purchases, drops, the dev seed) adds to it.
  // Uniqueness is receipt-gated, not inventory-capped: this record
  // holds whatever count exists, uniques included (the economy pass
  // owns how items are received). Keyed by ItemId as a plain string
  // (D-C plain-serializable).
  readonly inventory: Readonly<Record<string, number>>;
  // TABA M3 economy — the party gil wallet: one SHARED pool (not per-unit),
  // a non-negative integer. Mutated only through `grantGil`/`spendGil`
  // (gil.ts) — battle wins credit it, shop/recruitment debit it. Absent in
  // pre-economy saves → defaults to 0 on load (lenient-field convention,
  // like `inventory`).
  readonly gil: number;
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
