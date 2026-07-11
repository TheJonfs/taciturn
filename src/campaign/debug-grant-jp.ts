// TABA Ch3 brief — the dev JP grant (the class-gated-playtest unblocker).
//
// The JP economy is only fed in real play by battle earnings, which are far
// too slow to exercise the roster's breadth in a manual playtest (Trident
// needs a Templar, Command Cap needs a second secondary, T2/T3 classes need
// thresholds crossed). This grant funds that band: +DEBUG_JP_GRANT into each
// party member's pool for EVERY class they currently have unlocked.
//
// Deliberately repeatable (no once-guard, unlike nothing here — the seed
// chip's idempotence comes from top-up semantics; this one accumulates by
// design): press → spend → cross a tier threshold → press again, and the
// newly-opened classes join the grant set. That loop doubles as the
// job-tree-unlock test rig.
//
// Respects the unlock tree — `reclassableClasses` is DERIVED from spend (+
// any plot-unit `classAccessOverride`), so nothing is force-unlocked and a
// class opened between presses starts receiving on the next press for free.
//
// Local-only: sole caller is the dev chip on the campaign's manage screen,
// gated on `import.meta.env.DEV` — unreachable in production builds.

import type { CampaignState, CampaignUnit } from './types.ts';
import type { ComponentCatalog } from './progression/component-catalog.ts';
import { reclassableClasses } from './progression/ledger.ts';
import { grantJp } from './progression/unlock.ts';

export const DEBUG_JP_GRANT = 100;

// One press: every ACTIVE roster unit gains DEBUG_JP_GRANT in each of its
// currently-unlocked classes. Lost units keep their ledger untouched (they
// aren't party members; if a future rule restores one, it can be funded by
// the next press).
export function debugGrantJp(state: CampaignState, catalog: ComponentCatalog): CampaignState {
  const roster = state.roster.map((unit) => {
    if (unit.fate !== 'active') return unit;
    return reclassableClasses(unit, catalog).reduce<CampaignUnit>(
      (u, classId) => grantJp(u, classId, DEBUG_JP_GRANT),
      unit,
    );
  });
  return { ...state, roster };
}
