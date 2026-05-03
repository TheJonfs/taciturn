// Hook-source tier — the closed enumeration of where a hook handler
// originates. Lives in `types/` rather than `hooks/` because the ruleset
// references it (hookOrdering.sourceTiers); putting it in `hooks/` would
// force `types/` to depend on `hooks/`, reversing the dependency arrow.
//
// The default firing order is Equipment → Class → Passive → Status. The
// ruleset's `hookOrdering.sourceTiers` declares this as data so an
// alternate ruleset can re-order if a future game-feel calls for it.
//
// `engine/hooks/` re-exports both names from here for back-compat.

export type HookSourceTier = 'equipment' | 'class' | 'passive' | 'status';

// Default firing order. Lower index fires first.
export const DEFAULT_HOOK_SOURCE_TIER_ORDER: ReadonlyArray<HookSourceTier> = [
  'equipment',
  'class',
  'passive',
  'status',
];
