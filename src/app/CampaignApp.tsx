// CampaignApp — the TABA campaign flow driver (M1.5: battle-as-beat).
//
// A node is an ORDERED BEAT SEQUENCE (sequence.ts). This driver WALKS that
// sequence: it plays presentational beats (story scenes, and the driver-
// injected result-summary / world-map) through the generic InterstitialRunner,
// and when it reaches a `battle` beat it runs formation → deployment → battle
// for THAT beat's `NodeBattle` and resumes the sequence on battle end. M1's
// fixed formation → deployment → battle → post-battle pipeline is gone;
// `requireBattle` is gone. (campaign-decomposition §3; ADR for battle-as-beat.)
//
//   node entry → walk beats:
//     story-scene  → run the scene (presentational), advance.
//     battle       → formation → deployment → battle → onBattleEnd:
//        win  → applyBattleBeatWin (apply-back) → result-summary → resume.
//               last battle → resolveNode → (non-terminal) trailing story +
//               world-map-choice → route + autosave → next node;
//               (terminal) → result-summary(campaignComplete) → Title.
//        loss → result-summary(loss) → Retry (re-enter this battle beat, state
//               unchanged) / Quit. A loss runs no apply-back.
//     standalone story node (no battle) → run its scenes → world-map / Title.
//
// PERSISTENCE stays node-granular (M1.5 call — no v3): the only checkpoints are
// node entry (in_progress, saved by the prior route) and `awaiting_route`
// (saved right after a node's LAST battle wins — preserves "never re-fight a
// won battle"). A reload mid-sequence (e.g. during a post-battle scene) resumes
// at the world map. Save schema is unchanged (v2).

import { useState, type CSSProperties, type ReactElement } from 'react';
import { BattleView } from './BattleView.tsx';
import { DeploymentScreen } from './DeploymentScreen.tsx';
import { FormationScreen } from './FormationScreen.tsx';
import { FormationManager } from './formation/FormationManager.tsx';
import { InterstitialRunner } from './interstitial/InterstitialRunner.tsx';
import { RecruitScreen } from './RecruitScreen.tsx';
import { ShopScreen } from './ShopScreen.tsx';
import { buildDeployedBattleConfig, type DeploymentResult } from './deployment-config.ts';
import {
  CAMPAIGN_GRAPH,
  applyBattleBeatWin,
  battleWasWon,
  buildLocationMenuBeat,
  buyItem,
  buildResultSummaryBeat,
  buildRouteChoiceBeat,
  buildSkirmishBattle,
  COMPONENT_CATALOG,
  clearSavedCampaign,
  computeGilReward,
  currentEngagement,
  debugGrantJp,
  debugSeedGrants,
  debugSeedInventory,
  deployableRoster,
  foldBattle,
  getNode,
  grantItems,
  hasBattleAtOrAfter,
  hireGeneric,
  isComplete,
  isHubNow,
  isStoryCleared,
  joinPlotUnit,
  outcomeFollowUpScene,
  probeBattleFor,
  resolveNode,
  routeToNode,
  saveCampaign,
  sellItem,
  setFlag,
  shopStock,
  summarizeBattleResult,
  takeStoryRun,
  type BattleBeat,
  type BeatOutput,
  type CampaignNode,
  type CampaignState,
  type CampaignUnit,
  type InterstitialBeat,
  type NodeBattle,
  type NodeBeat,
} from '@campaign/index.ts';
import type { BattleConfig, Catalog, GameState, TeamId } from '@engine/index.ts';

const GRAPH = CAMPAIGN_GRAPH;

// The beats the driver walks at a node: its CURRENT engagement's (the
// earliest armed-and-uncleared one — engagement queues, M3). Callers reach
// here only when an engagement is armed (planEntry's cleared/hub branch
// filters the rest); a miss is a driver bug — fail loud. Stable throughout a
// walk: `clearedStoryBeats` only changes at resolveNode, after the walk ends.
function armedEngagementBeats(st: CampaignState, n: CampaignNode): ReadonlyArray<NodeBeat> {
  const current = currentEngagement(st, n);
  if (current === undefined) {
    throw new Error(`CampaignApp: node "${n.id}" has no armed engagement to walk`);
  }
  return current.engagement.beats;
}

// What the formation/deployment/battle sub-flow is fighting (M3 economy
// Stage 1). A STORY encounter is one of the node's authored battle beats
// (looked up by index, fresh each render); a SKIRMISH is a synthesized
// `NodeBattle` (the generated party is pinned here for the encounter's
// lifetime, so a loss retries the SAME band).
type Encounter =
  | { readonly kind: 'story'; readonly battleIndex: number }
  | { readonly kind: 'skirmish'; readonly battle: NodeBattle };

// What to do when the current presentational run completes. Each carries the
// state snapshot it acts on (captured at run creation — a presentational run
// never mutates campaign state, so the snapshot stays fresh).
type RunDone =
  | { readonly kind: 'walk'; readonly state: CampaignState; readonly cursor: number }
  | { readonly kind: 'retry'; readonly encounter: Encounter }
  | { readonly kind: 'route'; readonly state: CampaignState } // state = resolved awaiting_route
  // A location-menu run finished; act on its chosen `locationAction`.
  | { readonly kind: 'location'; readonly state: CampaignState }
  | { readonly kind: 'exit' };

// The one screen the driver shows. A single discriminated state replaces M1's
// separate sub/fightConfig/interstitial fields.
// Where the roster-management screen was opened from — and so where its
// exit returns to. `world-map` rebuilds the route-choice run; `formation`
// re-enters deploy selection at the same encounter (S86: pre-battle
// management, so loadouts/gear are editable before the FIRST battle, not
// only after a win).
type ManageOrigin =
  | { readonly kind: 'world-map' }
  | { readonly kind: 'formation'; readonly encounter: Encounter };

type Screen =
  | { readonly kind: 'run'; readonly beats: ReadonlyArray<InterstitialBeat>; readonly done: RunDone; readonly nonce: number }
  | { readonly kind: 'formation'; readonly encounter: Encounter }
  | { readonly kind: 'deployment'; readonly encounter: Encounter; readonly config: BattleConfig }
  | { readonly kind: 'battle'; readonly encounter: Encounter; readonly config: BattleConfig }
  // Roster-management (Formation) surface. Returns to its origin on exit;
  // roster edits persist + autosave either way.
  | { readonly kind: 'manage'; readonly origin: ManageOrigin }
  // The hub shop (M3 economy Stage 2). Entered from a hub's location menu;
  // exits back to it. Transactions mutate live state + autosave.
  | { readonly kind: 'shop' }
  // Hub recruitment (M3 economy Stage 3). Same surface pattern as the shop.
  | { readonly kind: 'recruit' };

export interface CampaignAppProps {
  // The starting state — a fresh `startCampaign(...)` or a resumed save.
  // (The owner has already autosaved it; CampaignApp saves on each advance.)
  readonly initialState: CampaignState;
  readonly catalog: Catalog;
  readonly onExitToTitle: () => void;
}

export function CampaignApp({ initialState, catalog, onExitToTitle }: CampaignAppProps): ReactElement {
  const [state, setState] = useState<CampaignState>(initialState);
  // Monotonic key so each new presentational run remounts the runner fresh
  // (resets its beat cursor). EVERY new run must get a fresh key — a run→run
  // transition that reused the key would keep the prior runner mounted with a
  // stale cursor (it would skip the new run's leading beats). Bumped by
  // `showRun` and by the route transition; the initial mount uses 0.
  const [nonce, setNonce] = useState(0);
  const [screen, setScreen] = useState<Screen>(() => planEntry(initialState, 0));

  // The battle beat currently in the formation/deployment/battle sub-flow reads
  // its NodeBattle from the node's beats by index (fresh across renders).
  const node = getNode(GRAPH, state.currentNodeId);

  // --- run plumbing ---

  // The first screen for a starting/routed-into node — PURE (no save/setState).
  // Node entry is already persisted by the caller (startCampaign owner / the
  // prior route), so entry needs no save of its own. `key` is the runner nonce
  // any run screen it returns must carry (0 at initial mount; a FRESH value on a
  // route transition, so the runner remounts rather than reusing a stale cursor).
  function planEntry(st: CampaignState, key: number): Screen {
    if (st.phase === 'awaiting_route') {
      // Resumed right after a won battle: drop straight to the world map (the
      // transient result is gone — nothing to replay before it).
      return runScreen([buildRouteChoiceBeat(GRAPH, st)], { kind: 'route', state: st }, key);
    }
    const entryNode = getNode(GRAPH, st.currentNodeId);
    if (isStoryCleared(st, entryNode) || isHubNow(st, entryNode)) {
      // ENTRY RESOLUTION (M3 economy Stages 1–2). Two cases share the menu:
      //   - the story beat is CLEARED → the one hard rule: it NEVER replays;
      //     the menu offers what's here now (skirmish/shop). Per-BEAT guard —
      //     a future re-armed later engagement is a new id and walks below.
      //   - the story beat is ARMED but commerce coexists (a hub — the
      //     Dorter pattern): the brief's "presented as options when several
      //     coexist". The menu offers the battle AND the shop; a plain
      //     combat node (no hub) still enters its battle directly below.
      return runScreen([buildLocationMenuBeat(entryNode, st)], { kind: 'location', state: st }, key);
    }
    const entryBeats = armedEngagementBeats(st, entryNode);
    const { scenes, next } = takeStoryRun(entryBeats, 0);
    if (next >= entryBeats.length) {
      // A standalone story node (no battle ahead): play its scenes, then route.
      // (A battle START node can't reach here — bootstrapRosterVitals requires
      // one. This is the routed-into / resumed story-node case.)
      return resolutionRun(st, scenes, key);
    }
    if (scenes.length > 0) return runScreen(scenes, { kind: 'walk', state: st, cursor: next }, key);
    return { kind: 'formation', encounter: { kind: 'story', battleIndex: next } };
  }

  // Build a run screen with an explicit nonce. Callers pass a FRESH nonce for a
  // new run (planEntry at a route transition; showRun for the live path).
  function runScreen(beats: ReadonlyArray<InterstitialBeat>, done: RunDone, key: number): Screen {
    return { kind: 'run', beats, done, nonce: key };
  }

  // Show a presentational run now (bumping the nonce). An empty run would stall
  // the runner, so finish its `done` immediately instead (defensive — authoring
  // never yields one).
  function showRun(beats: ReadonlyArray<InterstitialBeat>, done: RunDone): void {
    if (beats.length === 0) {
      finishRun(done, {});
      return;
    }
    const key = nonce + 1;
    setNonce(key);
    setScreen({ kind: 'run', beats, done, nonce: key });
  }

  // Return from the roster-management screen to the world map. Rebuilds the
  // world-map run from the LIVE state, so any reclass/spend/loadout edits made
  // while managing carry into the route (the `done.state` is the just-edited
  // roster). Only reachable from the world map (phase `awaiting_route`).
  function returnToWorldMap(): void {
    showRun([buildRouteChoiceBeat(GRAPH, state)], { kind: 'route', state });
  }

  // A node whose sequence has ended (standalone / trailing story with no more
  // battles) — set the phase and show its closing run. No `awaiting_route`
  // checkpoint save here (a battle-less resolution has nothing to protect from
  // a re-fight); the route/exit persists on completion.
  function resolutionRun(
    st: CampaignState,
    prefixScenes: ReadonlyArray<InterstitialBeat>,
    key: number,
  ): Screen {
    const resolved = resolveNode(st, GRAPH);
    if (isComplete(resolved)) return runScreen([...prefixScenes], { kind: 'exit' }, key);
    return runScreen(
      [...prefixScenes, buildRouteChoiceBeat(GRAPH, resolved)],
      { kind: 'route', state: resolved },
      key,
    );
  }

  // --- the sequence walk ---

  // Walk the sequence of `st`'s node from `cursor`. Called mid-flow only, where
  // a battle beat is always ahead (pre-battle story → its battle; a post-battle
  // "more battles" summary → the next battle). Node resolution is handled by
  // handleBattleEnd (after a battle) and resolutionRun (standalone), never here.
  function advance(st: CampaignState, cursor: number): void {
    const walkNode = getNode(GRAPH, st.currentNodeId);
    const walkBeats = armedEngagementBeats(st, walkNode);
    const { scenes, next } = takeStoryRun(walkBeats, cursor);
    if (next >= walkBeats.length) {
      // Shouldn't happen from a mid-flow caller — fail loud rather than stall.
      throw new Error(
        `CampaignApp.advance: no battle beat ahead of cursor ${cursor} in node "${walkNode.id}"`,
      );
    }
    if (scenes.length > 0) {
      showRun(scenes, { kind: 'walk', state: st, cursor: next });
    } else {
      setScreen({ kind: 'formation', encounter: { kind: 'story', battleIndex: next } });
    }
  }

  function finishRun(done: RunDone, output: BeatOutput): void {
    switch (done.kind) {
      case 'walk':
        advance(done.state, done.cursor);
        return;
      case 'retry':
        // Loss → re-enter this encounter from the unchanged state (a skirmish
        // retries the SAME generated band — the encounter pins it).
        setScreen({ kind: 'formation', encounter: done.encounter });
        return;
      case 'exit':
        onExitToTitle();
        return;
      case 'location': {
        // The location menu chose an action (M3 economy Stages 1–2).
        if (output.locationAction === 'story') {
          // March on the armed story engagement (a hub whose battle is still
          // ahead) — the same walk planEntry runs for a plain combat node.
          const storyNode = getNode(GRAPH, done.state.currentNodeId);
          const storyBeats = armedEngagementBeats(done.state, storyNode);
          const { scenes, next } = takeStoryRun(storyBeats, 0);
          if (next >= storyBeats.length) {
            // A story-only engagement (no battle beat): play it out and
            // resolve, exactly like planEntry's standalone-story path.
            const key = nonce + 1;
            setNonce(key);
            setScreen(resolutionRun(done.state, scenes, key));
          } else if (scenes.length > 0) {
            showRun(scenes, { kind: 'walk', state: done.state, cursor: next });
          } else {
            setScreen({ kind: 'formation', encounter: { kind: 'story', battleIndex: next } });
          }
          return;
        }
        if (output.locationAction === 'skirmish') {
          const locationNode = getNode(GRAPH, done.state.currentNodeId);
          const battle = buildSkirmishBattle(locationNode, done.state, catalog);
          setScreen({ kind: 'formation', encounter: { kind: 'skirmish', battle } });
        } else if (output.locationAction === 'shop') {
          setScreen({ kind: 'shop' });
        } else if (output.locationAction === 'recruit') {
          setScreen({ kind: 'recruit' });
        } else {
          // 'leave' (or nothing offered) → back to the world map.
          showRun([buildRouteChoiceBeat(GRAPH, done.state)], { kind: 'route', state: done.state });
        }
        return;
      }
      case 'route': {
        const nextNodeId = output.nextNodeId;
        if (nextNodeId === undefined) {
          throw new Error('CampaignApp: world-map run produced no route');
        }
        const routed = routeToNode(done.state, GRAPH, nextNodeId);
        saveCampaign(routed);
        setState(routed);
        // Fresh nonce so the next node's run remounts the runner (it must NOT
        // reuse the just-finished world-map runner's cursor — that stale cursor
        // was the bug where a routed-into story node skipped its dialogue).
        const key = nonce + 1;
        setNonce(key);
        setScreen(planEntry(routed, key));
        return;
      }
    }
  }

  // --- battle sub-flow (story battle beats + skirmishes) ---

  function battleBeatAt(index: number): BattleBeat {
    const beat = armedEngagementBeats(state, node)[index];
    if (beat === undefined || beat.type !== 'battle') {
      throw new Error(`CampaignApp: expected a battle beat at index ${index} of node "${node.id}"`);
    }
    return beat;
  }

  // The encounter's NodeBattle. Story encounters re-read the authored beat by
  // index (fresh across renders); a skirmish carries its synthesized battle.
  function encounterBattle(encounter: Encounter): NodeBattle {
    return encounter.kind === 'story' ? battleBeatAt(encounter.battleIndex).battle : encounter.battle;
  }

  function handleFormationConfirm(encounter: Encounter, selected: ReadonlyArray<CampaignUnit>): void {
    const battle = encounterBattle(encounter);
    // foldBattle folds the deployed player selection AND (if the beat authors
    // progressed enemies — every skirmish does) re-skins the enemy team with
    // curve stats / mid-battle leveling / gated kits.
    const folded = foldBattle(battle, selected, catalog);
    setScreen({ kind: 'deployment', encounter, config: stampControls(folded, battle.playerTeam) });
  }

  function handleDeploymentCommit(encounter: Encounter, config: BattleConfig, result: DeploymentResult): void {
    setScreen({ kind: 'battle', encounter, config: buildDeployedBattleConfig(config, result) });
  }

  function handleBattleEnd(encounter: Encounter, finalState: GameState): void {
    const battle = encounterBattle(encounter);
    const result = summarizeBattleResult(finalState);
    const won = battleWasWon(result, battle.playerTeam);
    const skirmish = encounter.kind === 'skirmish';

    if (!won) {
      // Loss: no apply-back, no rewards. Show how the battle left the deployed
      // units, then retry this same encounter (state unchanged == the last save).
      const summary = buildResultSummaryBeat({
        node,
        roster: state.roster,
        result,
        won: false,
        campaignComplete: false,
        gilEarned: 0, // losses pay nothing
        skirmish,
      });
      showRun([summary], { kind: 'retry', encounter });
      return;
    }

    // Win: apply-back (heal survivors, mark lost, bank XP/JP, pay the gil
    // award — the summary shows the same amount the wallet banked).
    const gilEarned = computeGilReward(finalState, battle.playerTeam);
    let applied = applyBattleBeatWin(state, result, finalState, catalog, battle.playerTeam);

    // Ch1 substrate (WI2): record the fired outcome tag into the flag
    // store (key authored on the battle, value from the victory
    // condition that decided it), and pick the outcome-branched
    // follow-up scene. Both no-op for battles that author neither.
    const firedOutcome = result.outcome.outcome;
    if (battle.recordOutcomeAs !== undefined && firedOutcome !== undefined) {
      applied = setFlag(applied, battle.recordOutcomeAs, firedOutcome);
    }
    const followUp = outcomeFollowUpScene(battle, firedOutcome);
    const followUpBeats = followUp !== undefined ? [followUp] : [];

    // Ch1 authoring: post-battle roster joins + unique item grants, authored
    // on the battle beat (story battles only — a skirmish's synthesized
    // battle never authors them). Joins probe against this node's field;
    // grants enter through the receipt door.
    if (battle.joins !== undefined) {
      for (const unit of battle.joins) applied = joinPlotUnit(applied, node, unit, catalog);
    }
    if (battle.grants !== undefined) {
      applied = grantItems(applied, battle.grants.map((id) => [id, 1] as const));
    }

    if (skirmish) {
      // A skirmish pays its rewards and ends at the world map. It NEVER marks
      // a story beat cleared and never resolves the node — the valve is
      // repeatable by design (no anti-farm friction; reload-risk governs).
      const after: CampaignState = { ...applied, phase: 'awaiting_route' };
      saveCampaign(after);
      setState(after);
      const summary = buildResultSummaryBeat({
        node,
        roster: after.roster,
        result,
        won: true,
        campaignComplete: false,
        gilEarned,
        skirmish: true,
      });
      showRun([summary, buildRouteChoiceBeat(GRAPH, after)], { kind: 'route', state: after });
      return;
    }

    if (hasBattleAtOrAfter(armedEngagementBeats(state, node), encounter.battleIndex + 1)) {
      // More battles in this node (a future multi-battle shape): show the
      // result, then resume the walk into the next battle. No node resolution
      // yet; phase stays in_progress.
      const summary = buildResultSummaryBeat({
        node,
        roster: applied.roster,
        result,
        won: true,
        campaignComplete: false,
        gilEarned,
      });
      setState(applied);
      showRun([summary, ...followUpBeats], { kind: 'walk', state: applied, cursor: encounter.battleIndex + 1 });
      return;
    }

    // Last battle of the node → resolve it. Save the `awaiting_route` checkpoint
    // (or clear on a terminal win) BEFORE the closing run, so a reload doesn't
    // re-fight this won battle.
    const resolved = resolveNode(applied, GRAPH);
    const complete = isComplete(resolved);
    const summary = buildResultSummaryBeat({
      node,
      roster: resolved.roster,
      result,
      won: true,
      campaignComplete: complete,
      gilEarned,
    });
    if (complete) clearSavedCampaign();
    else saveCampaign(resolved);
    setState(resolved);

    // Trailing scenes come from the PRE-RESOLVE state's engagement (`state`,
    // not `resolved`) — after resolveNode the queue's next engagement is
    // current, and reading it here would splice the wrong scenes in.
    const { scenes: trailing } = takeStoryRun(armedEngagementBeats(state, node), encounter.battleIndex + 1);
    if (complete) {
      // Terminal win — the result-summary is the victory screen; then Title.
      // Outcome-branched follow-up plays first, then the shared trailing run.
      showRun([summary, ...followUpBeats, ...trailing], { kind: 'exit' });
    } else {
      showRun([summary, ...followUpBeats, ...trailing, buildRouteChoiceBeat(GRAPH, resolved)], {
        kind: 'route',
        state: resolved,
      });
    }
  }

  // --- render ---

  if (screen.kind === 'run') {
    return (
      <InterstitialRunner
        key={screen.nonce}
        beats={screen.beats}
        onComplete={(output) => finishRun(screen.done, output)}
        onExitToTitle={onExitToTitle}
        onManageRoster={() => setScreen({ kind: 'manage', origin: { kind: 'world-map' } })}
      />
    );
  }

  if (screen.kind === 'manage') {
    return (
      <>
        <FormationManager
          roster={state.roster}
          inventory={state.inventory}
          catalog={catalog}
          onRosterChange={(next) => {
            const updated = { ...state, roster: next };
            setState(updated);
            saveCampaign(updated); // persist reclass/spend/loadout edits immediately
          }}
          onExit={() => {
            if (screen.origin.kind === 'formation') {
              // Back to deploy selection at the same encounter. The screen
              // remounts fresh, so its pre-selection re-derives from the
              // just-edited roster (an invalid unit fixed here becomes
              // selectable; a newly-broken one gets excluded).
              setScreen({ kind: 'formation', encounter: screen.origin.encounter });
            } else {
              returnToWorldMap();
            }
          }}
          exitLabel={screen.origin.kind === 'formation' ? '← Back to Deploy' : '← The Road Ahead'}
        />
        {/* Dev-only gear seed (M3 Stage 0): tops the party inventory up to
            DEBUG_SEED_TARGET of every equippable item so the gear UI is
            testable before the economy pass ships receipt for real. Writes
            the real save (Chris's ruling) — the whole affordance is stripped
            from production builds by the DEV gate. */}
        {import.meta.env.DEV && (
          <button
            type="button"
            style={devSeedChipStyle}
            disabled={debugSeedGrants(state, catalog).length === 0}
            onClick={() => {
              const seeded = debugSeedInventory(state, catalog);
              setState(seeded);
              saveCampaign(seeded);
            }}
            title="Dev: top inventory up to 10 of every equippable item (persists to the save)"
          >
            {debugSeedGrants(state, catalog).length === 0 ? '🎒 Gear seeded ✓' : '🎒 Seed gear (dev)'}
          </button>
        )}
        {/* Dev-only JP grant (Ch3 brief, work item 1): +100 JP to every party
            member in each currently-unlocked class. Repeatable BY DESIGN (no
            once-guard) — press, spend, cross a tier threshold, press again to
            fund the newly-opened tier. Respects the unlock tree; never
            force-unlocks. Same DEV gating + persistence as the seed chip. */}
        {import.meta.env.DEV && (
          <button
            type="button"
            style={devGrantJpChipStyle}
            onClick={() => {
              const granted = debugGrantJp(state, COMPONENT_CATALOG);
              setState(granted);
              saveCampaign(granted);
            }}
            title="Dev: grant 100 JP to every party member in each unlocked class (repeatable; persists to the save)"
          >
            📈 Grant JP (dev)
          </button>
        )}
      </>
    );
  }

  if (screen.kind === 'shop') {
    return (
      <ShopScreen
        nodeName={node.name}
        state={state}
        stock={shopStock(GRAPH, state)}
        catalog={catalog}
        onBuy={(itemId) => {
          const bought = buyItem(state, GRAPH, itemId);
          setState(bought);
          saveCampaign(bought); // transactions persist immediately, like roster edits
        }}
        onSell={(itemId) => {
          const sold = sellItem(state, itemId);
          setState(sold);
          saveCampaign(sold);
        }}
        onExit={() => showRun([buildLocationMenuBeat(node, state)], { kind: 'location', state })}
      />
    );
  }

  if (screen.kind === 'recruit') {
    return (
      <RecruitScreen
        nodeName={node.name}
        state={state}
        probe={probeBattleFor(node)}
        catalog={catalog}
        onHire={(spec) => {
          const hired = hireGeneric(state, node, spec, catalog);
          setState(hired);
          saveCampaign(hired); // the new soldier + debit persist immediately
        }}
        onExit={() => showRun([buildLocationMenuBeat(node, state)], { kind: 'location', state })}
      />
    );
  }

  if (screen.kind === 'formation') {
    const battle = encounterBattle(screen.encounter);
    return (
      <FormationScreen
        nodeName={screen.encounter.kind === 'skirmish' ? `${node.name} — Skirmish` : node.name}
        roster={deployableRoster(state)}
        deployCap={battle.deployCap}
        catalog={catalog}
        onConfirm={(selected) => handleFormationConfirm(screen.encounter, selected)}
        onManageRoster={() =>
          setScreen({ kind: 'manage', origin: { kind: 'formation', encounter: screen.encounter } })
        }
        onQuit={onExitToTitle}
      />
    );
  }

  if (screen.kind === 'deployment') {
    const battle = encounterBattle(screen.encounter);
    return (
      <DeploymentScreen
        template={screen.config}
        zones={battle.zones}
        deployingTeam={battle.playerTeam}
        onCommit={(result) => handleDeploymentCommit(screen.encounter, screen.config, result)}
        onBack={() => setScreen({ kind: 'formation', encounter: screen.encounter })}
      />
    );
  }

  if (screen.kind === 'battle') {
    const encounter = screen.encounter;
    return (
      <BattleView
        template={screen.config}
        deploymentResult={null}
        onBattleEnd={(finalState) => handleBattleEnd(encounter, finalState)}
        // Campaign owns the post-battle flow via onBattleEnd; these exits
        // are unused fallbacks (ResultsScreen is suppressed), but the prop
        // contract requires them.
        onExitToSetup={onExitToTitle}
        onExitToTitle={onExitToTitle}
      />
    );
  }

  // Unreachable in normal flow; render nothing rather than crash.
  return <></>;
}

// The dev gear-seed chip (manage screen only; DEV-gated at the call
// site). Fixed-positioned so it floats over FormationManager without
// touching its layout — mirrors DebugBattleMenu's chip styling.
const devSeedChipStyle: CSSProperties = {
  position: 'fixed',
  left: 10,
  bottom: 10,
  zIndex: 8_000,
  padding: '5px 9px',
  fontSize: 12,
  fontFamily: 'system-ui, sans-serif',
  background: 'rgba(22,24,29,0.85)',
  color: '#c7ccd6',
  border: '1px solid #3a4150',
  borderRadius: 5,
  cursor: 'pointer',
};

// The JP-grant sibling chip sits just above the seed chip in the same corner.
const devGrantJpChipStyle: CSSProperties = {
  ...devSeedChipStyle,
  bottom: 44,
};

// Stamp control flags so BattleView wires a human controller for the player
// team and AI for everyone else. The shipped node templates already set
// these (demoBattle: team_a human / team_b ai), but stamping keeps
// CampaignApp correct regardless of which template a beat reuses.
function stampControls(config: BattleConfig, playerTeam: TeamId): BattleConfig {
  return {
    ...config,
    teams: config.teams.map((t) => ({
      ...t,
      control: t.id === playerTeam ? 'human' : 'ai',
    })),
  };
}
