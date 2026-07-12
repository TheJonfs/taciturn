// TABA campaign — the PLACEHOLDER battle beat (Atlas structural tier, S90).
//
// The structural tier authors topology + capabilities, not encounters. But
// several invariants want a node to carry a battle beat (`farmable` borrows
// the node's battlefield; a start node should have a first fight), and the
// whole point of the tier is that every exported skeleton is IMMEDIATELY
// WALKABLE. So a structural node without hand-authored content can carry a
// placeholder battle beat: a registered template's map + default enemies +
// its deployment zones + the standard deploy cap. Real battlefields and
// authored enemies replace placeholders in the detail tier — same beat slot,
// richer content.

import { teamId } from '@engine/index.ts';
import { battleTemplateFor } from '@content/battles/registry.ts';
import { deploymentZonesFor } from '@content/deployment/index.ts';
import type { NodeBeat } from './sequence.ts';

// Every shipped battle deploys 5 of the roster; placeholders follow suit.
// Per-node deploy caps are detail-tier authoring.
export const PLACEHOLDER_DEPLOY_CAP = 5;

// The default template for a fresh Atlas node (Chris, S90): River Ridge —
// it has deployment zones attached and a full enemy garrison.
export const DEFAULT_PLACEHOLDER_TEMPLATE_KEY = 'river_ridge';

// The stub scene's fixed title — BOTH the player-visible "this is a stub"
// flag and the Atlas importer's classification marker (a generated
// placeholder scene is recognized by this title; hand-authored content is
// classified by reference first, so a real scene can even reuse the words
// without colliding).
export const PLACEHOLDER_SCENE_TITLE = 'Placeholder Scene';

// A stand-in STORY beat (engagement queues WI4): a one-line scene carrying
// the author's marker text ("Scene between Lumen and Chris here"). Lets a
// full chapter — scene → battle → scene → return-to-camp → new scene — walk
// as pure structure before any real dialogue exists. Swapped for real
// content later by flipping the engagement's beats source to 'content'.
export function placeholderSceneBeat(marker: string): NodeBeat {
  return {
    type: 'story-scene',
    scene: {
      title: PLACEHOLDER_SCENE_TITLE,
      lines: [{ speaker: 'Author’s note', text: marker }],
    },
  };
}

// A stand-in battle beat on a registered template. Throws loud (via the
// registries) on an unknown template key or an unregistered zones key.
export function placeholderBattleBeat(templateKey: string): NodeBeat {
  const entry = battleTemplateFor(templateKey);
  return {
    type: 'battle',
    battle: {
      template: entry.template,
      playerTeam: teamId('team_a'),
      zones: deploymentZonesFor(entry.zonesKey),
      deployCap: PLACEHOLDER_DEPLOY_CAP,
    },
  };
}
