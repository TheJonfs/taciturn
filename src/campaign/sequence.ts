// TABA campaign — the node beat-sequence model (M1.5: battle-as-beat).
//
// M1 gave a node one optional `battle` and ran a fixed pipeline
// (formation → deployment → battle → post-battle interstitial). M1.5
// generalizes that: a node owns an ORDERED SEQUENCE OF BEATS, and a battle is
// one beat-type among others (taba-m1_5-brief). A node's beats are AUTHORED —
// `story-scene` beats and `battle` beats, in whatever order the content wants:
//
//   [story, battle]          — dialogue, then a fight (the FFT pre-battle scene)
//   [battle, story]          — a fight, then its aftermath
//   [story]                  — a standalone story node, no battle at all
//   [battle, story, battle]  — consecutive battles at one node (a FUTURE shape;
//                              the MODEL supports it, the M1.5 driver + save do
//                              not exercise it — see the brief's persistence call)
//
// This module is PURE: the beat descriptors + the small cursor helpers the
// driver walks the sequence with. The two beat KINDS split by nature:
//   - `battle` is the engine-launching STRUCTURAL beat (it runs
//     formation/deployment/battle for its own `NodeBattle`). The driver knows
//     it by construction.
//   - `story-scene` is a PRESENTATIONAL beat — one of the open set the generic
//     runner dispatches by type (alongside the runtime result-summary /
//     world-map beats). Adding rewards/shops later means a new presentational
//     descriptor + renderer, never a driver change.
//
// `NodeBattle` lives here (not graph.ts) so graph.ts can import the beat types
// without a cycle: sequence.ts → engine only; graph.ts → sequence.ts.

import type { BattleConfig, DeploymentZoneConfig, ItemId, TeamId } from '@engine/index.ts';
import type { PortraitRef } from '../assets/portraits/index.ts';
import type { CampaignUnit } from './types.ts';

// The per-battle-beat definition: map + enemy team (in the template) +
// placeholder player slots the snapshot-fold replaces + deploy zones + K.
// (Was node-level in M1; now it hangs off a `battle` beat so a node can hold
// zero, one, or several.)
export interface NodeBattle {
  // Map + enemy team + placeholder player slots. The fold replaces the
  // `playerTeam` placements; everything else (enemies, victory conditions)
  // is consumed as-authored.
  readonly template: BattleConfig;
  readonly playerTeam: TeamId;
  readonly zones: DeploymentZoneConfig;
  // K — the per-battle deploy cap. The Formation screen selects up to this
  // many `active` roster units. (N — roster size — is a campaign property.)
  readonly deployCap: number;
  // TABA M2 — authored enemy progression (optional). When present, these specs
  // re-skin the template's enemy-team slots via `foldEnemyTeam`: each enemy gets
  // curve stats at its authored level, mid-battle leveling (`statsByLevel`), and
  // a kit GATED to its `unlocks`. Absent → the template's enemy placements pass
  // through as-authored (ungated, no leveling) — backward-compatible.
  readonly enemies?: ReadonlyArray<CampaignUnit>;
  // Ch1 substrate (WI4) — authored guest allies (optional). Each spec
  // re-skins one of the template's player-team placements flagged
  // `guest: true` (via `foldGuestTeam`, the guest sibling of the enemy
  // fold): the guest fights on the player's side, AI-driven,
  // uncommandable, not in the roster, battle-long. Guest ≠ join — a
  // post-battle roster join (Sera at Node 6) is a separate, explicit
  // `joinPlotUnit` step; the guest system doesn't know about joining.
  readonly guests?: ReadonlyArray<CampaignUnit>;
  // Ch1 substrate (WI2) — record this battle's fired outcome tag into the
  // campaign-flag store under this key (e.g. key 'ester', value
  // 'ester-good'). Only meaningful when the template authors predicate
  // victory conditions carrying `outcome` tags; a battle decided by an
  // untagged condition records nothing.
  readonly recordOutcomeAs?: string;
  // Ch1 substrate (WI2) — outcome-branched follow-up scene: after a win,
  // the driver plays `onOutcome[firedTag]` (when present) BEFORE the
  // node's positional trailing scenes, which stay shared across
  // outcomes. Tags with no entry (and wins with no tag) add nothing.
  readonly onOutcome?: Readonly<Record<string, StoryScene>>;
  // Ch1 authoring — post-battle roster joins (optional): plot units the
  // driver appends to the durable roster via `joinPlotUnit` after this
  // battle is won (Clio at Alvera, Thessaly at Grek Forest, Sera at
  // Ordal Canyon). A story battle never replays (per-beat cleared
  // guard), so a join fires exactly once; skirmishes never author joins.
  readonly joins?: ReadonlyArray<CampaignUnit>;
  // Ch1 authoring — unique item grants on win (optional): found gear
  // keyed to this battle (Pendant of Lumara at Oskun, Flametongue at
  // Zelmonia Hills, Freelancer's Charm at Mount Eska), entering the
  // party inventory through the receipt door (`grantItems`).
  readonly grants?: ReadonlyArray<ItemId>;
}

// One line of authored dialogue. Placeholder-friendly: a display name + text,
// with an optional portrait named as a `PortraitRef` — so a line points at a
// PORTRAIT (a class portrait today, a plot character's enduring face later via
// the `fixed` variant), not hard-coded class derivation. No branching / choices
// in M1.5 (brief D3).
export interface DialogueLine {
  readonly speaker: string;
  readonly text: string;
  // Optional portrait ref. Absent means a nameplate with no portrait (a
  // narrator line, an unseen speaker); an unresolved ref falls back to a plate.
  readonly portrait?: PortraitRef;
}

// An authored story scene: an optional heading + an ordered set of lines the
// player clicks through. Pure data; the renderer is app-layer.
export interface StoryScene {
  readonly title?: string;
  readonly lines: ReadonlyArray<DialogueLine>;
}

// A presentational beat: dialogue the player reads. Both an AUTHORED node beat
// and a member of the runner's presentational `InterstitialBeat` union (same
// descriptor, one renderer) — see interstitial.ts.
export interface StorySceneBeat {
  readonly type: 'story-scene';
  readonly scene: StoryScene;
}

// The structural beat: launch a battle. Authored-only (never a runtime beat).
export interface BattleBeat {
  readonly type: 'battle';
  readonly battle: NodeBattle;
}

// A node's authored beats (the open AUTHORED set). The runtime beats
// (result-summary, world-map-choice) are NOT authored — the driver injects
// them — so they are not in this union.
export type NodeBeat = StorySceneBeat | BattleBeat;

// --- Pure cursor helpers (what the driver walks the sequence with) ---

// The maximal run of consecutive presentational (story) beats starting at
// `from`, plus the index just past them (where a battle beat or the end sits).
// The driver hands `scenes` to the generic runner as one presentational run,
// then continues at `next`.
export function takeStoryRun(
  beats: ReadonlyArray<NodeBeat>,
  from: number,
): { readonly scenes: ReadonlyArray<StorySceneBeat>; readonly next: number } {
  const scenes: StorySceneBeat[] = [];
  let i = from;
  while (i < beats.length && beats[i]!.type === 'story-scene') {
    scenes.push(beats[i] as StorySceneBeat);
    i += 1;
  }
  return { scenes, next: i };
}

// Every battle beat in a node, in authored order. Used to reason about the
// node's battles without the driver caring where they sit.
export function battleBeats(beats: ReadonlyArray<NodeBeat>): ReadonlyArray<BattleBeat> {
  return beats.filter((b): b is BattleBeat => b.type === 'battle');
}

// The node's first battle beat, or undefined for a standalone story node.
// `bootstrapRosterVitals` reads this for a template to probe effective maxes.
export function firstBattleBeat(beats: ReadonlyArray<NodeBeat>): BattleBeat | undefined {
  return beats.find((b): b is BattleBeat => b.type === 'battle');
}

// Is there a battle beat at index `from` or later? The driver uses this after
// a battle win to decide whether the node is "battle-cleared" (no more fights
// → resolve/route) or still has battles ahead (stay in_progress).
export function hasBattleAtOrAfter(beats: ReadonlyArray<NodeBeat>, from: number): boolean {
  for (let i = from; i < beats.length; i += 1) {
    if (beats[i]!.type === 'battle') return true;
  }
  return false;
}

// A standalone story node has no battle beats: it plays its scenes and routes,
// never entering a formation/deployment/battle sub-flow.
export function isStandalone(beats: ReadonlyArray<NodeBeat>): boolean {
  return firstBattleBeat(beats) === undefined;
}

// Ch1 substrate (WI2) — the outcome-branched follow-up pick, pure so the
// driver's wiring stays a one-liner. Returns the scene beat for the
// fired outcome tag, or undefined when the battle authored no branch /
// the win carried no tag / the tag has no entry (all valid: the shared
// trailing scenes still play).
export function outcomeFollowUpScene(
  battle: NodeBattle,
  firedOutcome: string | undefined,
): StorySceneBeat | undefined {
  if (firedOutcome === undefined || battle.onOutcome === undefined) return undefined;
  const scene = battle.onOutcome[firedOutcome];
  return scene === undefined ? undefined : { type: 'story-scene', scene };
}
