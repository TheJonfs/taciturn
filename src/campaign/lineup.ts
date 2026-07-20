// Authored-lineup consumption (Cartographer unit mode, S98 Tier 2).
//
// A generated lineup module (src/content/battles/<key>-battle.ts) carries a
// `LineupSpec`: the SPATIAL half of the battle (ordered slots with position +
// facing) plus each enemy slot's authored class + level. The content layer
// consumes only the spatial half (`buildBattleFromLineup` restages fixture
// units). THIS module consumes the identity half: it turns the authored
// class/level list into the `NodeBattle.enemies` specs, each framed by the
// enemy-kit framework (level-budgeted curriculum kit, deterministic
// Brave/Faith, basic gear) — the same constructor the skirmish stub uses.
//
// Index alignment is the contract: `enemiesFromLineup(spec)[i]` re-skins the
// template slot built from `spec.enemies[i]` (the fold maps by order), so an
// authored lineup's classes stand exactly where the tool placed them. Named
// story units (Theo, the Ruk captain) stay hand-authored in node-content.ts —
// author them as `[theoRenault(...), ...enemiesFromLineup(spec, catalog).slice(1)]`
// style mixes, or let them re-skin the lead slot the tool ordered first.

import { classId, type Catalog } from '@engine/index.ts';
import type { LineupSpec } from '@content/battles/lineup-format.ts';
import { generatedEnemyUnit } from './enemy-kit.ts';
import type { CampaignUnit } from './types.ts';

export function enemiesFromLineup(
  spec: LineupSpec,
  catalog: Catalog,
): ReadonlyArray<CampaignUnit> {
  return spec.enemies.map((slot, i) => {
    const cls = classId(slot.classId);
    return generatedEnemyUnit({
      id: `${spec.key}-enemy-${i + 1}`,
      name: catalog.getClass(cls).name,
      classId: cls,
      level: slot.level,
      index: i,
      catalog,
    });
  });
}
