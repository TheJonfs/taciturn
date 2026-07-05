// FormationManager — the roster ⇄ dossier navigation shell (TABA M2 UI).
//
// The reusable core the brief calls for: a RosterView that opens a UnitDossier,
// with progression edits (reclass / JP-spend / loadout) flowing back up via
// `onRosterChange`. It owns ONLY the which-unit-is-open nav state; it holds no
// roster of its own — the parent owns the roster and persists edits (the
// campaign owner saves; the dev harness keeps it in React state). This is what
// lets the same core mount in the world-map management context, a future
// pre-battle context, and the dev harness unchanged.

import { useMemo, useState, type ReactElement } from 'react';
import type { Catalog, UnitId } from '@engine/index.ts';
import type { CampaignUnit } from '@campaign/index.ts';
import { RosterView } from './RosterView.tsx';
import { UnitDossier } from './UnitDossier.tsx';

export interface FormationManagerProps {
  readonly roster: ReadonlyArray<CampaignUnit>;
  readonly catalog: Catalog;
  // Persist a roster edit (a single unit replaced) up to the owner.
  readonly onRosterChange: (next: ReadonlyArray<CampaignUnit>) => void;
  // Optional "leave the formation screen" affordance (shown on the roster view).
  readonly onExit?: () => void;
  readonly exitLabel?: string;
  readonly title?: string;
  readonly subtitle?: string;
}

export function FormationManager({
  roster,
  catalog,
  onRosterChange,
  onExit,
  exitLabel,
  title,
  subtitle,
}: FormationManagerProps): ReactElement {
  const [openedId, setOpenedId] = useState<UnitId | null>(null);
  const opened = useMemo(
    () => (openedId === null ? null : (roster.find((u) => u.id === openedId) ?? null)),
    [roster, openedId],
  );

  function updateUnit(next: CampaignUnit): void {
    onRosterChange(roster.map((u) => (u.id === next.id ? next : u)));
  }

  if (opened !== null) {
    return (
      <UnitDossier unit={opened} catalog={catalog} onBack={() => setOpenedId(null)} onChange={updateUnit} />
    );
  }

  return (
    <RosterView
      roster={roster}
      catalog={catalog}
      onOpenUnit={setOpenedId}
      {...(onExit ? { onBack: onExit, backLabel: exitLabel ?? '← Back' } : {})}
      {...(title !== undefined ? { title } : {})}
      {...(subtitle !== undefined ? { subtitle } : {})}
    />
  );
}
