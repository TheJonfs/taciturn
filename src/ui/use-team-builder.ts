// useTeamBuilder — React wiring around the pure `team-builder-state`
// module. Holds the editable draft in component state, exposes bound
// mutations, and derives validity + per-unit effective stats.
//
// The state module is pure (decision 2A: flat editable record); this
// hook is the only stateful layer. No class exports — Fast Refresh safe.

import { useCallback, useMemo, useState } from 'react';
import type {
  AbilityId,
  BattleConfig,
  BucketId,
  Catalog,
  ClassId,
  CommandSetId,
  EquipmentSlotId,
  ItemId,
  RulesetId,
} from '@engine/index.ts';
import type { BuiltTeam } from '@content/teams/index.ts';
import {
  computeDraftUnitStats,
  computeTeamValidity,
  createEmptyTeamBuilderState,
  selectUnit as selectUnitMut,
  setBrave as setBraveMut,
  setClass as setClassMut,
  setEquipment as setEquipmentMut,
  setFaith as setFaithMut,
  teamBuilderStateFromBuiltTeam,
  teamBuilderStateToBuiltTeam,
  togglePassive as togglePassiveMut,
  toggleSecondaryCommandSet as toggleSecondaryCommandSetMut,
  type DraftUnit,
  type DraftUnitStats,
  type TeamBuilderState,
  type TeamValidity,
} from './team-builder-state.ts';

export interface UseTeamBuilderArgs {
  readonly mapTemplate: BattleConfig;
  readonly catalog: Catalog;
}

export interface TeamBuilder {
  readonly state: TeamBuilderState;
  readonly validity: TeamValidity;
  // The ruleset the team is built against — the ability picker reads it
  // for bucket-capacity computation.
  readonly rulesetId: RulesetId;
  readonly selectedIndex: number;
  readonly selectedUnit: DraftUnit;
  // Effective stats per unit slot — `null` for a classless unit or one
  // whose loadout is mid-edit-invalid (the UI falls back to baseline).
  readonly unitStats: ReadonlyArray<DraftUnitStats | null>;
  readonly selectUnit: (index: number) => void;
  readonly setClass: (index: number, classId: ClassId) => void;
  readonly setEquipment: (
    index: number,
    slot: EquipmentSlotId,
    itemId: ItemId | null,
  ) => void;
  readonly setBrave: (index: number, value: number) => void;
  readonly setFaith: (index: number, value: number) => void;
  readonly togglePassive: (
    index: number,
    bucketId: BucketId,
    abilityId: AbilityId,
  ) => void;
  readonly toggleSecondaryCommandSet: (
    index: number,
    commandSetId: CommandSetId,
  ) => void;
  readonly loadTemplate: (team: BuiltTeam) => void;
  // Build the output `BuiltTeam`. Throws if any unit is classless — the
  // caller gates on `validity.valid` first.
  readonly toBuiltTeam: () => BuiltTeam;
}

export function useTeamBuilder({
  mapTemplate,
  catalog,
}: UseTeamBuilderArgs): TeamBuilder {
  const [state, setState] = useState<TeamBuilderState>(
    createEmptyTeamBuilderState,
  );

  const validity = useMemo(
    () => computeTeamValidity(state, catalog, mapTemplate.rulesetId),
    [state, catalog, mapTemplate.rulesetId],
  );

  const unitStats = useMemo(
    () =>
      state.units.map((unit) => computeDraftUnitStats(unit, catalog, mapTemplate)),
    [state.units, catalog, mapTemplate],
  );

  const selectUnit = useCallback((index: number) => {
    setState((s) => selectUnitMut(s, index));
  }, []);

  const setClass = useCallback(
    (index: number, classId: ClassId) => {
      setState((s) => setClassMut(s, index, classId, catalog));
    },
    [catalog],
  );

  const setEquipment = useCallback(
    (index: number, slot: EquipmentSlotId, itemId: ItemId | null) => {
      setState((s) => setEquipmentMut(s, index, slot, itemId));
    },
    [],
  );

  const setBrave = useCallback((index: number, value: number) => {
    setState((s) => setBraveMut(s, index, value));
  }, []);

  const setFaith = useCallback((index: number, value: number) => {
    setState((s) => setFaithMut(s, index, value));
  }, []);

  const togglePassive = useCallback(
    (index: number, bucketId: BucketId, abilityId: AbilityId) => {
      setState((s) => togglePassiveMut(s, index, bucketId, abilityId));
    },
    [],
  );

  const toggleSecondaryCommandSet = useCallback(
    (index: number, commandSetId: CommandSetId) => {
      setState((s) => toggleSecondaryCommandSetMut(s, index, commandSetId));
    },
    [],
  );

  const loadTemplate = useCallback((team: BuiltTeam) => {
    setState(teamBuilderStateFromBuiltTeam(team));
  }, []);

  const toBuiltTeam = useCallback(
    () => teamBuilderStateToBuiltTeam(state, catalog),
    [state, catalog],
  );

  return {
    state,
    validity,
    rulesetId: mapTemplate.rulesetId,
    selectedIndex: state.selectedIndex,
    selectedUnit: state.units[state.selectedIndex]!,
    unitStats,
    selectUnit,
    setClass,
    setEquipment,
    setBrave,
    setFaith,
    togglePassive,
    toggleSecondaryCommandSet,
    loadTemplate,
    toBuiltTeam,
  };
}
