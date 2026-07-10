// LoadoutInspector — the merged Loadout tab's hover-context panel (M3
// Stage 3): the Mage War Team Builder inspector, celestial-skinned.
//
// Tracks whatever the player hovers in either column — a gear candidate,
// an equipped slot, a passive, or a secondary command — and shows its
// full mechanical detail (the shared `formatItemDetail` /
// `formatAbilityDetail` / `formatCommandSetDetail`, same source the
// in-battle panel reads) plus the PROJECTED stat deltas: the unit's
// effective stats re-probed with the hovered choice applied (equip for
// gear, toggle for passives), diffed against its current stats. The
// probe runs the real fold + engine, so a Move+1 hover shows "+1 Move"
// and a Spiked Maul hover shows exactly what battle entry would produce.

import type { ReactElement } from 'react';
import type { Catalog } from '@engine/index.ts';
import type { CampaignUnit } from '@campaign/index.ts';
import {
  formatAbilityDetail,
  formatCommandSetDetail,
  formatItemDetail,
} from '@ui/index.ts';
import {
  SLOT_LABEL,
  effectiveUnitStats,
  projectGearStats,
  projectPassiveStats,
  statDeltaChips,
  type LoadoutFocus,
} from './gear-view-model.ts';

export interface LoadoutInspectorProps {
  readonly focus: LoadoutFocus | null;
  readonly unit: CampaignUnit;
  readonly catalog: Catalog;
}

export function LoadoutInspector({ focus, unit, catalog }: LoadoutInspectorProps): ReactElement {
  if (focus === null) {
    return (
      <div className="tf-inspect">
        <div className="tf-inspect-hint">
          Hover a piece of gear or an ability to inspect it — details and stat changes show here.
        </div>
      </div>
    );
  }

  const current = effectiveUnitStats(unit, catalog);

  if (focus.kind === 'gear') {
    const item = focus.itemId !== null && catalog.hasItem(focus.itemId) ? catalog.getItem(focus.itemId) : null;
    const detail = item !== null ? formatItemDetail(item, catalog) : null;
    const projected = projectGearStats(unit, focus.slot, focus.itemId, catalog);
    const equipped = unit.equipment[focus.slot] === focus.itemId;
    return (
      <div className="tf-inspect">
        <div className="tf-inspect-head">
          <span className="tf-inspect-title">{detail?.title ?? '— Empty —'}</span>
          {detail?.subtitle !== undefined && <span className="tf-inspect-kind">{detail.subtitle}</span>}
          <span className="tf-inspect-ctx">
            {equipped ? 'equipped' : 'considering'} · {SLOT_LABEL[focus.slot].toLowerCase()}
            {focus.free !== undefined && !equipped ? ` · ×${focus.free} in stores` : ''}
          </span>
        </div>
        {detail !== null && <Lines lines={detail.lines} />}
        <Deltas current={current} projected={projected} equipped={equipped} />
      </div>
    );
  }

  if (focus.kind === 'passive') {
    if (!catalog.hasAbility(focus.abilityId)) return <div className="tf-inspect" />;
    const detail = formatAbilityDetail(catalog.getAbility(focus.abilityId), catalog);
    const projected = projectPassiveStats(unit, focus.bucket, focus.abilityId, catalog);
    return (
      <div className="tf-inspect">
        <div className="tf-inspect-head">
          <span className="tf-inspect-title">{detail.title}</span>
          {detail.subtitle !== undefined && <span className="tf-inspect-kind">{detail.subtitle}</span>}
          <span className="tf-inspect-ctx">
            {focus.equipped ? 'equipped — hover shows removing it' : 'considering'} ·{' '}
            {focus.cost === 0 ? 'free (innate)' : `${focus.cost} slot${focus.cost === 1 ? '' : 's'}`}
          </span>
        </div>
        <Lines lines={detail.lines} />
        <Deltas current={current} projected={projected} equipped={false} />
      </div>
    );
  }

  if (!catalog.hasCommandSet(focus.commandSetId)) return <div className="tf-inspect" />;
  const detail = formatCommandSetDetail(catalog.getCommandSet(focus.commandSetId), catalog);
  return (
    <div className="tf-inspect">
      <div className="tf-inspect-head">
        <span className="tf-inspect-title">{detail.title}</span>
        {detail.subtitle !== undefined && <span className="tf-inspect-kind">{detail.subtitle}</span>}
        <span className="tf-inspect-ctx">secondary command</span>
      </div>
      <Lines lines={detail.lines} />
    </div>
  );
}

function Lines({ lines }: { readonly lines: ReadonlyArray<string> }): ReactElement {
  return (
    <div className="tf-inspect-lines">
      {lines.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}

// The projected stat diff. `equipped` gear (re-hovering the current
// item) projects to itself — no chips, say so instead of nothing.
function Deltas({
  current,
  projected,
  equipped,
}: {
  readonly current: ReturnType<typeof effectiveUnitStats>;
  readonly projected: ReturnType<typeof effectiveUnitStats>;
  readonly equipped: boolean;
}): ReactElement | null {
  if (current === null) {
    return <div className="tf-inspect-note">stats unavailable while the loadout is invalid</div>;
  }
  if (projected === null) {
    return <div className="tf-inspect-note">this pick would make the loadout invalid</div>;
  }
  if (equipped) return null;
  const chips = statDeltaChips(current, projected);
  if (chips.length === 0) {
    return <div className="tf-inspect-note">no stat change</div>;
  }
  return (
    <div className="tf-inspect-deltas">
      {chips.map((chip) => (
        <span key={chip.text} className={`tf-delta ${chip.tone}`}>
          {chip.text}
        </span>
      ))}
    </div>
  );
}
