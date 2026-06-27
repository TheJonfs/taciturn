// Both-AI sim — the Session 75 dev harness that exercises the auto-drive
// seam and prints an emergent-feel report for S74 A/B.
//
// NOT a regression suite. This file is gated behind the `TACITURN_SIM`
// env var, so the normal test run (`npm run test:run`) SKIPS it entirely
// — it asserts nothing in CI and guards nothing. It exists to be run on
// demand:
//
//   npm run sim:both-ai
//
// which boots full both-AI battles headlessly (no UI, no clicking) and
// console-logs what the AI actually did, so the implementer can read AI
// *feel* over a deterministic log. Vitest is used only as the alias-aware
// TS runner; the work is in `headless-battle.ts` + `battle-log-inspect.ts`.
//
// Per the S75 brief: D1 = headless runner (c), D2 = action-log primary,
// seam form = runner module + dev script (no permanent A/B assertions).

import { describe, expect, it } from 'vitest';
import { abilityId, classId } from '@engine/index.ts';
import { claudesBulwark, claudesAnswers } from '@content/teams/index.ts';
import { runHeadlessBattle } from './headless-battle.ts';
import { aoeBuffCasts, chargedTilePinResolutions } from './battle-log-inspect.ts';

const SIM_ENABLED = process.env['TACITURN_SIM'] === '1';

// A spread of seeds so the report reflects emergent behaviour across
// several organic battles, not one lucky/unlucky run.
const SEEDS = [0x1, 0x42, 0xabcdef, 0xdec0de, 0xcafebabe];

const ENCHANTER = classId('enchanter');
const CHARGED_ATTACK = abilityId('charged_attack');

function pct(n: number, d: number): string {
  return d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(0)}%`;
}

// `describe.runIf` skips the whole block (suite stays green, zero
// assertions) unless TACITURN_SIM=1.
describe.runIf(SIM_ENABLED)('S75 both-AI sim — claudesBulwark vs claudesAnswers (River Ridge)', () => {
  // Generous timeout: this drives several full battles end-to-end. It is
  // a dev harness, not a CI test, so wall-clock isn't a concern.
  it('runs full both-AI battles and reports S74 A/B feel', () => {
    const lines: string[] = [];
    lines.push('');
    lines.push('═══ S75 both-AI sim — claudesBulwark (A: Enchanter) vs claudesAnswers (B: Hunter) ═══');
    lines.push(`Map: River Ridge · seeds: ${SEEDS.map((s) => s.toString(16)).join(', ')}`);
    lines.push('');

    // Aggregate counters across all seeds.
    let aTotalCasts = 0;
    let aClustered = 0; // casts whose footprint covered >= 2 allies
    let aCoverSum = 0; // sum of allies-in-footprint
    let aBuffedSum = 0; // sum of allies actually buffed
    let bTotal = 0;
    let bLanded = 0;

    for (const seed of SEEDS) {
      const result = runHeadlessBattle({
        teamA: claudesBulwark,
        teamB: claudesAnswers,
        mapId: 'river_ridge',
        seed,
      });

      // Seam smoke (only runs under the flag — not permanent CI coverage):
      // the auto-drive must reach a decided outcome with no manual input.
      expect(result.decided, `seed ${seed.toString(16)} did not decide`).toBe(true);

      const aCasts = aoeBuffCasts(result, { casterClass: ENCHANTER });
      const bRes = chargedTilePinResolutions(result, CHARGED_ATTACK);

      const seedClustered = aCasts.filter((c) => c.alliesInFootprint >= 2).length;
      const seedLanded = bRes.filter((r) => r.landed).length;

      aTotalCasts += aCasts.length;
      aClustered += seedClustered;
      aCoverSum += aCasts.reduce((sum, c) => sum + c.alliesInFootprint, 0);
      aBuffedSum += aCasts.reduce((sum, c) => sum + c.alliesBuffed, 0);
      bTotal += bRes.length;
      bLanded += seedLanded;

      lines.push(
        `seed ${seed.toString(16).padStart(8)} → winner ${String(result.winner)} · ` +
          `${result.steps} steps · ${result.log.length} actions`,
      );
      lines.push(
        `   A  Enchanter AoE-buff casts: ${aCasts.length}` +
          (aCasts.length > 0
            ? ` · allies-in-footprint ${aCasts.map((c) => c.alliesInFootprint).join('/')}` +
              ` · buffed ${aCasts.map((c) => c.alliesBuffed).join('/')}` +
              ` · clustered(≥2) ${seedClustered}/${aCasts.length}`
            : ' (none cast this battle)'),
      );
      lines.push(
        `   B  charged_attack resolutions: ${bRes.length}` +
          (bRes.length > 0
            ? ` · landed ${seedLanded}/${bRes.length} · whiffed ${bRes.length - seedLanded}`
            : ' (none committed this battle)'),
      );
    }

    lines.push('');
    lines.push('─── Aggregate ───');
    lines.push(
      `A — Enchanter AoE-buff casts: ${aTotalCasts} · ` +
        `footprint covering ≥2 allies: ${aClustered} (${pct(aClustered, aTotalCasts)}) · ` +
        `avg allies-in-footprint/cast: ${aTotalCasts === 0 ? 'n/a' : (aCoverSum / aTotalCasts).toFixed(2)} · ` +
        `avg buffed/cast: ${aTotalCasts === 0 ? 'n/a' : (aBuffedSum / aTotalCasts).toFixed(2)}`,
    );
    lines.push(
      `B — charged_attack resolutions: ${bTotal} · ` +
        `landed: ${bLanded} (${pct(bLanded, bTotal)}) · ` +
        `whiffed: ${bTotal - bLanded} (${pct(bTotal - bLanded, bTotal)})`,
    );
    lines.push(
      'Read: A wants most AoE-buff casts to cover ≥2 allies (clustered, not lonely); ' +
        'B wants a LOW whiff rate (the AI declined dodgeable charges).',
    );
    lines.push('');

    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  }, 120_000);
});
