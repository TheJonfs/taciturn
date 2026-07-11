# ADR-0145: TABA M3 economy infrastructure — currency, node lifecycle, navigable map, skirmish valve, shops, recruitment

**Status:** accepted (S88)
**Context:** `docs/TABADesign/taba-economy-infrastructure-brief.md` (design
source `taba-economy-framework.md`, planner-side; `D-econ-6` coefficients
pending — every economic number below is a marked placeholder). All four
stages shipped in one session. Chris's in-session rulings: the M1 graph IS the
sandbox (its content is placeholder anyway — retrofit, no separate dev graph);
farmable lights up on the real campaign now; return travel is free to any
visited node.

## What shipped

Commits `86ba0c0` (Stage 0) · `bb155a8` (Stage 1) · `8671c94` (Stage 2) ·
`5612ace` (Stage 3).

## Decisions

### 1. Gil rides the apply-back door (Stage 0)

One shared party wallet on `CampaignState` (`gil`, non-negative integer),
mutated only via `grantGil`/`spendGil` (`campaign/gil.ts`). The battle award
`GIL_PER_ENEMY_LEVEL × Σ(enemy levels)` is paid inside `applyBattleBeatWin` —
the same door XP (`system_xp_award` + apply-back rollover) and JP (post-hoc
log read) already ride, so **any** battle resolved through it (story beat or
skirmish) pays all three rewards with no per-flow wiring. Losses run no
apply-back, so they pay nothing by construction. The award reads the FINAL
state (a mid-battle-leveled enemy pays its leveled value) and counts dead/
removed enemies — it prices the opposition fought, not the survivors.

**Audit result (brief's prediction confirmed):** XP/JP already flowed; gil was
the only net-new reward. Stage 0 shrank to the wallet + award + config module.

### 2. One enemy-level lever, difficulty term reserved (D-econ-4)

`resolveEnemyLevel(partyAvg, nodeOffset, difficultyFactor = 0)` in
`campaign/enemy-level.ts` is the single source for scaled enemy level;
`partyAverageLevel` averages ACTIVE roster units (rounded) and doubles as the
recruitment cap. `difficultyFactor` exists, is hardwired 0, additive-only, and
has no UI — structure now, expose later.

### 3. Location capabilities are orthogonal fields; the cleared guard is per-BEAT

`CampaignNode` gains optional `isHub` / `farmable` / `offset` / `storyBeatId`
— independent flags, deliberately NOT a location-type enum, so a Dorter-style
location needs no refactor. The save gains `visited` (node ids) and
`clearedStoryBeats` (**beat ids**, defaulting to the node id via
`storyBeatIdOf` for today's single-engagement nodes). Because the save stores
beat ids, the future re-arm queue (a location hosting successive story beats)
is a content-model change, not a save migration. Lenient-load grandfather: an
old save seeds `visited=[current]`, and an `awaiting_route` save seeds its
current node's beat as cleared (it was, by definition — without the seed the
map would go empty and soft-lock). No schema bump (v5 stays; same convention
as inventory/gil).

### 4. The navigable map (`campaign/travel.ts`)

- **Forward** stays win-edge-gated: the frontier = win-edge targets of
  story-CLEARED nodes (availability is the hard wall).
- **Return** is free to any VISITED node still offering something (armed
  story / open valve / hub) — no travel friction; reload-risk is the farming
  governor.
- **Entry resolution** (driver `planEntry`) enforces the one hard rule: a
  cleared story beat NEVER replays. Re-entry opens the location menu (new
  `location-menu` interstitial beat). A hub whose story is still ARMED also
  gets the menu — the brief's "presented as options when several coexist"
  (proven in-browser on Stonebridge: March on the enemy / Shop / Recruit).
  A plain combat node still enters its battle directly.
- `routeToNode` validates against `travelChoices` and stamps `visited`;
  `resolveNode` marks the beat cleared. World map renders frontier blue /
  returnable gold with `skirmish`/`trade` badges.

### 5. The skirmish valve + the D3 stub (`campaign/skirmish.ts`)

`generateSkirmishParty(level, count, catalog)` **is the M4 seam** — the stub
spawns N Tier-1 generics (class rotation, standard `seedStartingKit` kits,
no gear — also keeps effect weapons off enemy loadouts per the standing AI
deferral). `buildSkirmishBattle` borrows the node's own battlefield and TRIMS
the template's enemy slots to the generated count (foldEnemyTeam keeps extra
slots as-authored, so the trim is what guarantees an all-generated
opposition). N = min(deployCap, authored enemy positions). The driver's
battle sub-flow became **encounter-based** (`story battleIndex | skirmish
NodeBattle`) — a skirmish loss retries the SAME generated band; a win pays
rewards, saves at `awaiting_route`, and never clears anything. The stub is
deterministic; repeat-farm variance belongs to M4's generator.

### 6. Shops (Stage 2): the pool is a field, the bundles are throwaway

`firstAvailableAt?: nodeId` landed on `TabaGearEntry` (the real mechanism the
future assignment enriches); today it is stamped from an explicitly-throwaway
`PLACEHOLDER_BUNDLES` table (three Ch1-band bundles on River Ridge /
Stonebridge / Marshmoor). `shopStock` = union over cleared nodes — monotonic
by construction (`clearedStoryBeats` only grows). Transactions compose
existing doors: BUY = `spendGil` + `grantItems` (receipt stays the one way
in; uniqueness gate untouched); SELL = new `removeItems` **exit door**
(FREE instances only — owned can never drop below equipped) + `grantGil` at
`SELL_RATE` (D1: 50%, floored). Unique-pool items are sell-BLOCKED, reason
surfaced on the row (`sellBlockReason`), not hidden.

### 7. Recruitment (Stage 3): the resolver picks the starter gear

Tier-1 classes only (from the tier map — a new Tier-1 class becomes hireable
by existing). Level hard-capped at `partyAverageLevel` (UI slider cannot
exceed it; `hireGeneric` re-validates loudly — the convenience-premium cap
has no bypass, pinned by test). Cost = linear config curve; Tier-1 JP signing
bonus by config steps, banked into the hire's own class pool. Starter gear is
chosen BY `slotIneligibilityReason` (first legal candidate per slot from a
Ch1 staples list) — legal by construction, no economy-side legality copy;
every hire passes `validateDraftUnit` (pinned). Gear enters through
`grantItems`; vitals heal to effective full via `probeEffectiveMaxes` against
the hub's own battlefield (same documented constraint as
`bootstrapRosterVitals` — a hub with no battle beat can't size a hire).
Ids mint off roster length (monotonic — lost units are retained); names from
a placeholder pool with collision suffixes. `RecruitScreen` previews the
exact `buildHire` unit through `probeUnitStats` before gil commits.

### 8. Config centralization

`campaign/economy-config.ts` holds every dial — `GIL_PER_ENEMY_LEVEL`,
`STARTING_GIL`, `SELL_RATE`, `DEFAULT_ITEM_PRICE` + override table,
`HIRE_COST_BASE/PER_LEVEL`, `HIRE_JP_TIER1_STEPS` — each marked placeholder
(D-econ-6). Balance retunes without touching logic.

## Authoring that landed with the machinery

M1 nodes: all combat nodes `farmable` (offsets −1/0/0/+2 placeholder);
**Stonebridge is the hub** (the coexistence proof); The Crossing stays bare;
The Return is terminal so its valve is left un-authored (clearing it ends the
campaign — a dead flag otherwise).

## Flagged / deferred

- **The real bundle→node assignment and prices** — next economy-content
  session replaces `PLACEHOLDER_BUNDLES` + fills the price table. Spiked Maul
  sequencing note (S87 handoff) applies then; the 8 Ch3 uniques still need
  their placement flows (`grantItems` receipts).
- **Hire vitals need the hub's battlefield** — fine for authored hubs
  (Stonebridge); a future battle-less hub needs an explicit template source
  (same constraint as the campaign-start bootstrap).
- **Skirmish stub is deterministic and gear-less** — intended; M4 replaces
  the generator at the seam, nothing else moves.
- **Watch-fors from the brief now live:** income-to-price ratio (flag if
  farming is absurdly fast/slow), XP rubber-band on high-offset skirmishes
  (Mountain Pass +2), and the re-entry guard (regression-tested at driver
  level, `CampaignApp.test.tsx`).
