// useTeamBuilder — React wiring around the pure `team-builder-state`
// module. Holds the editable draft in component state, exposes bound
// mutations, and derives validity + per-unit effective stats.
//
// The state module is pure (decision 2A: flat editable record); this
// hook is the only stateful layer. No class exports — Fast Refresh safe.

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { slotLevelFor, type BuiltTeam } from '@content/teams/index.ts';
import {
  computeDraftUnitStats,
  computeTeamValidity,
  createEmptyTeamBuilderState,
  selectUnit as selectUnitMut,
  setBrave as setBraveMut,
  setClass as setClassMut,
  setEquipment as setEquipmentMut,
  setFaith as setFaithMut,
  setUnitName as setUnitNameMut,
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
  // Optional initial draft (per S37). When provided, the builder hydrates
  // from this state on mount instead of an empty draft. Used by `App` to
  // preserve in-progress builds across screen back-navigation.
  readonly initialDraft?: TeamBuilderState | null | undefined;
  // Optional change notifier (per S37). Fires whenever the draft mutates,
  // so the parent can preserve the latest state across remounts.
  readonly onDraftChange?: ((draft: TeamBuilderState) => void) | undefined;
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
  readonly setUnitName: (index: number, name: string) => void;
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
  initialDraft,
  onDraftChange,
}: UseTeamBuilderArgs): TeamBuilder {
  const [state, setState] = useState<TeamBuilderState>(() =>
    initialDraft ?? createEmptyTeamBuilderState(),
  );

  // Forward every draft mutation to the parent (S37 back-navigation
  // preservation). The effect fires on initial mount as well — harmless;
  // the parent simply re-stores the same state it just handed in.
  useEffect(() => {
    if (onDraftChange === undefined) return;
    onDraftChange(state);
  }, [state, onDraftChange]);

  const validity = useMemo(
    () => computeTeamValidity(state, catalog, mapTemplate.rulesetId),
    [state, catalog, mapTemplate.rulesetId],
  );

  const unitStats = useMemo(
    () => {
      // S49: thread per-unit level (slot-derived from active-unit
      // position) into the stat computation so HP/MP/dominant-stat
      // shifts surface immediately when the player moves a unit between
      // slots. Empty slots get no stats anyway; level defaults to L25
      // but is unused on the null return.
      let activeCount = 0;
      return state.units.map((unit) => {
        const level = unit.classId !== null ? slotLevelFor(activeCount) : 25;
        if (unit.classId !== null) activeCount += 1;
        return computeDraftUnitStats(unit, catalog, mapTemplate, level);
      });
    },
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
      setState((s) => setEquipmentMut(s, index, slot, itemId, catalog));
    },
    [catalog],
  );

  const setBrave = useCallback((index: number, value: number) => {
    setState((s) => setBraveMut(s, index, value));
  }, []);

  const setFaith = useCallback((index: number, value: number) => {
    setState((s) => setFaithMut(s, index, value));
  }, []);

  const setUnitName = useCallback((index: number, name: string) => {
    setState((s) => setUnitNameMut(s, index, name));
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
    setUnitName,
    togglePassive,
    toggleSecondaryCommandSet,
    loadTemplate,
    toBuiltTeam,
  };
}
