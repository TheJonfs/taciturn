// TABA campaign — apply-back (battle result → durable roster).
//
// The campaign "applies the deltas back to the durable unit" (the spine's
// return leg). It classifies each player-roster unit from the battle result
// (D-D) and writes the durable roster:
//   - survived / downed → stay `active`, HEALED TO FULL (the M0 between-
//     battle rule, D-E; effective full via the catalog-aware max).
//   - lost              → `fate: 'lost'`. The durable record is RETAINED
//     (not deleted); future death rules read the marker. Dropped from the
//     next deploy roster by Formation (Chunk 3).
//
// Player-side ONLY (watch-for): units are matched by STABLE id against the
// roster. A unit with no summary in the result simply didn't fight this
// node (benched) and passes through unchanged. Enemy units in final state
// have no matching roster id and are ignored by construction.
//
// Wounds-carry later is a ONE-LINE change here: write `summary.vitals`
// instead of the healed full. The plumbing (carry path through the fold,
// vitals on the durable unit) is already proven — see D-E.

import type { Catalog, GameState } from '@engine/index.ts';
import type { BattleResult } from './battle-result.ts';
import type { CampaignUnit } from './types.ts';
import { effectiveMaxVitals } from './vitals.ts';

export function applyBattleResult(
  roster: ReadonlyArray<CampaignUnit>,
  result: BattleResult,
  finalState: GameState,
  catalog: Catalog,
): ReadonlyArray<CampaignUnit> {
  return roster.map((unit) => {
    const summary = result.units.get(unit.id);
    if (summary === undefined) return unit; // didn't fight this node

    if (summary.outcome === 'lost') {
      return { ...unit, fate: 'lost' };
    }

    // survived | downed → heal to effective full, and BANK the JP earned this
    // battle (a `lost` unit above banks nothing — its JP is moot).
    const finalUnit = finalState.units.get(unit.id);
    if (finalUnit === undefined) {
      // The summary was built from this exact map; absence is a bug.
      throw new Error(
        `applyBattleResult: final state missing unit ${JSON.stringify(unit.id)} ` +
          `that the result summarized`,
      );
    }
    return {
      ...unit,
      fate: 'active',
      vitals: effectiveMaxVitals(finalState, catalog, finalUnit),
      jpLedger: { ...unit.jpLedger, earned: unit.jpLedger.earned + summary.earnedJp },
    };
  });
}
