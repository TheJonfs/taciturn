# ADR-0143: TABA M3 — Formation gear UI, party inventory, and the one draft-legality resolver

**Status:** accepted (Session 86, 2026-07-10)
**Context:** `docs/TABADesign/formation-gear-ui-brief.md` (plaintext-reviewed this session), ADR-0142 (the M3 equipment expansion this UI makes playable), ADR-0140 (the M2 Formation UI it merges into).

## Context

M3 shipped 133 catalog items but no way to equip them between battles: TABA gear
was author-only, the Formation dossier had a dead "Equipment · soon" tab, and —
the structural warning promoted out of S85 — the M2 Loadout view assumed
equipment could only LIFT bucket capacity, which Spiked Maul's reaction −3
falsified while `createInitialState` **throws** on over-capacity loadouts.

The brief's framing held under audit: the Mage War Team Builder is the proven
reference (two-column equipment|abilities, surface-and-block invalid handling),
so this beat was a *port*, not a design. The audit sharpened one thing: the
brief suspected the UI and engine might not share a legality resolver — in fact
there were **three** independent copies of the capacity/equip-legality rules
(engine hook-based; Team Builder draft copy; Formation view-model copy, still
documenting the falsified lift-only assumption).

## Decisions

### 1. One state-free draft resolver, engine-owned (D3)

`src/engine/items/draft-legality.ts` is the single source of the pre-battle
legality rules: `draftBucketCapacity` / `draftAbilityCost` / `draftBucketUsed`
(the state-free twins of the hook-based `getCapacity`/`getCost`), per-slot
eligibility **with reasons** (`slotIneligibilityReason`), the 2H/Monkeygrip and
dual-wield loadout grants, item↔item `equipLegality` conflicts, and the
composite `validateDraftUnit` report.

- `createInitialState`'s `validateEquipmentPlacement` now **throws from these
  exact functions**; the Team Builder and the Formation gear UI surface the
  same functions' output as warnings. UI legality == engine legality by
  construction, not by parallel maintenance.
- Why state-free: the hook-based resolver needs a built `GameState`, and
  `createInitialState` throws on invalid loadouts — a draft mid-edit (which is
  *legitimately* invalid) can never be probed that way.
- **Scope asymmetries, documented in the module:** capacity at battle entry
  stays with the hook-based `validateLoadout` (authored placements may carry
  initial statuses the draft can't see); dual-wield-without-grant is UI-tier
  (the engine tolerates it — the swing loop simply never grants the off-hand
  swing). UI-stricter is the safe direction.
- **Drift alarms:** `draft-legality.test.ts` sweeps EVERY catalog item and
  ability, pinning draft === hook-based values on a real battle state — a
  future non-equipment `modifyBucketCapacity` contributor fails loud there.
  `campaign/node.test.ts` pins every authored battle template's `rulesetId` to
  the new `CAMPAIGN_RULESET_ID` (what the Formation UI computes capacity
  under); a per-node ruleset must make the UI node-aware before relaxing it.

### 2. Inventory stores OWNED totals; everything else derives (rule 5)

`CampaignState.inventory` is one record: owned count per item id, equipped
instances included. Equipped counts derive from roster equipment; free = owned
− equipped. Consequences:

- **Equip/unequip never mutate the inventory** — "decrement-on-equip /
  return-on-unequip" falls out of the derivation; there is no second counter
  to drift.
- **Receipt is the only door in** (`grantItems`): uniqueness stays
  receipt-gated, never inventory-capped (the deferred economy pass owns
  receipt; late-game "duplicate a unique" stays open).
- **Grandfathering** (Chris's ruling): day-one authored loadouts are owned.
  `bootstrapInventory` raises owned to cover equipped at campaign start AND at
  deserialize — so pre-inventory saves load without a schema bump (the
  lenient-omitted-field convention doubles as the migration), and unequipping
  day-one gear returns it to the pool instead of vanishing.
- **Lost units keep their kit** (FFT-canonical): equipped counts scan all
  fates. A future strip-the-fallen mechanic changes the scan filter, not the
  model.

### 3. The merged Loadout view (D1) and surface-don't-resolve (D2)

The "Equipment · soon" tab is dead; gear lives IN the Loadout tab as the Team
Builder's two-column body under the celestial skin. Density refactors: reclass
chips collapse behind a Change-class affordance; Secondary/R/S/M are
collapsible sections whose headers keep picks + used/capacity visible.
Equipment pickers are inventory-driven — the candidate pool is **what the
party owns** (Mage War's unique-per-team rule is replaced by instance counts;
the `availability` flag never enters), gated by the shared resolver's
`classCanEquip` + hand rules.

Invalid states are **held and surfaced, never resolved**: a warning banner
with specific causes (a capacity overage names the reducing item — "Spiked
Maul −3"), over-capacity bucket headers in warning colour, a roster-card ⚠
badge, header stats reading "—", and deploy-selection blocking invalid units
(unselectable, skipped by pre-selection). No eviction logic anywhere.

### 4. The dev gear seed writes the real save

`debugSeedInventory` tops every equipment item up to 10 through `grantItems`,
behind an `import.meta.env.DEV` chip on the manage screen (DebugBattleMenu
pattern — absent from production builds). It persists via the normal save
path (Chris's ruling): playtests keep gear across reloads and the
serialization path is exercised for real. Top-up semantics keep it
idempotent.

## Consequences

- The M3 catalog is now playable end-to-end between battles; the real gear
  playtest owed since S84/S85 is unblocked.
- Stage 3 polish (hover/inspect stat deltas — the Team Builder inspector
  pattern, which wants an equipment-aware stat probe for campaign units)
  deliberately trails; everything else in the brief's Stage 3 list landed
  incidentally (unequip = the — Empty — row; last-instance contention tested;
  reclass-stranded gear is a surfaced-invalid state per D2).
- The dossier header's stat row is still `buildBaseStats` (class/level/B/F) —
  NOT equipment-composed. Making it live-composed is part of the trailing
  inspector work.
- `vite.config.ts` honors an externally-assigned `PORT` (+ `autoPort` in
  `.claude/launch.json`) so a second session's preview can run beside an
  existing dev server. Tooling-only.
