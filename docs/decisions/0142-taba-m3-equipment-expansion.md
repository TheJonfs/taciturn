# ADR-0142: TABA M3 equipment expansion — scoping substrate, engine seams, and rulings

**Status:** accepted (2026-07-09)
**Context:** `docs/TABADesign/taba-equipment-expansion-brief.md` + `taba-equipment-lineup.md` (content source of truth). One session shipped the full buyable roster (51 items across three gear generations), the five engine prerequisites, and the six lineup confirms.

## Decision 1 — TABA/Mage-War isolation via a campaign-owned pool manifest (Stage 0 / D1a)

The brief's hard constraint is that Mage War's shipped lineup is frozen. Chosen mechanism (over an `Availability` enum extension or a product tag on `ItemDefinition`):

- **New TABA items are authored `availability: 'hidden'`** — Mage War's single pool gate (`AVAILABLE_EQUIPMENT` in `src/ui/team-builder-state.ts`) never sees them, by construction.
- **`src/campaign/equipment-pool.ts`** is the campaign-owned manifest: every item that exists in TABA, its first-available chapter (demoted Ch2 items carry chapter 1), and its `shop`/`unique` acquisition per the lineup's settled calls. The engine catalog stays product-agnostic.
- **Two-sided regression enforcement:** `src/ui/mage-war-frozen-equipment.test.ts` pins Mage War's exact 75-item pool (do NOT update without an explicit Mage-War-change decision); `src/campaign/equipment-pool.test.ts` enforces that every TABA-new entry is `hidden` and that the manifest's Mage-War-shared sections reconstruct the frozen pool exactly (TABA's Ch2 anchor = Mage War, by identity).

The chapter field doubles as the brief's interim gating (Ch3 gear doesn't leak into Ch1 testing). The economy pass later enriches these entries (locations, costs, currency) rather than replacing them.

## Decision 2 — one new hook: `modifyOutgoingStatusDuration`

Choir Staff's "buffs you cast last +1 turn" needed a caster-side duration modifier. Added as the fourth quadrant of incoming/outgoing × magnitude/duration (siblings: `modifyIncomingStatusDuration` — Slip Free; `modifyOutgoingStatusMagnitude` — ADR-0128). Fires inside `applyStatus` against the SOURCE before the incoming shave; self-casts included (unlike the defensive incoming chain); no Brave roll; floor-clamped, 0 negates. Chris approved the surface growth explicitly.

## Decision 3 — everything else rode sanctioned rider paths (no other hook additions)

Per ADR-0056's contributor pattern, the expansion added rider fields + contributor arms, not hooks:
`aoeShapeEnlargeModifiers` (Wand of Expanse — reuses `modifyAoeShape` + `enlargeAoeShape`), `magicalReflectPercent` (Mirror Shield), `resistanceFromMaTags` (Abjurer's Codex), `incomingStatusStatShrugs` (Talisman of Endurance), `conditionalIncomingDamageMods` (Channeler's Hat — the item names its gating status, engine stays generic), `damageLifestealMods` (Star Robe), `spellProcs` (Void Robe — non-physical attackProcs sibling), `spellResolvedSelfStatuses` + `basicAttackCtRefundPaFactor` (Terra Robe / Epee, on a new equipment contributor for the existing `onActionResolved`), `sourceAbilityTagAny` (Prism Wand), `commandSetFilter` on action-speed mods (Trident), multiplicative `factor` on Spell Power mods (Moon Robe), `attackStat: 'ma'` (Battle Staff), `attackResolvesAsHeal` (Healer's Staff — pipeline-entry tag flip; `healing_base` gains a weapon-WP read: heal = MA × WP × coef × Faith), `equipLegality` (Freelancer's Charm — item↔item legality layer at setup validation; a future universal-equip item is instance two), and `AoeSpec.teamFilter: 'allies_only'` (Palliative Pike's pulse — the ally-discriminating AoE filter).

**Stat-scaled handlers** follow `modifyWeaponPower`'s pass-composed-stats precedent: `modifyResistance` args gain `ma`, `modifyIncomingStatusApplicationChance` args gain `pa`/`ma`, `onActionResolved` args gain `pa` — pre-composed by the runners only when handlers are registered.

## Decision 4 — audit-overturns-spec: the crit-magnitude "prerequisite" already existed

ADR-0032's `crit_multiplier` (base stat, default 1.5, `modifyStatQuery`-composable) was already the tunable crit-damage quantity. Katana is `statModsMultiplicative: { crit_multiplier: 2 }` — 1.5 → 3.0 per Chris's ruling ("double the whole critical hit").

## Decision 5 — magnitude/confirm rulings (Chris, this session)

- **Spiked Maul:** WP 20 stands; cost = reaction **bucket capacity −3** (3 → 0: the wielder equips NO reaction passives). Note: this is stronger than "only the class-innate reaction survives" — innate reactions occupy the bucket too. Revisit if innate-survives is wanted.
- **Scouring Wand:** unbounded stacking accepted (resistance has no floor; the deep-negative grind is a trap the player may walk into). Counterplay: negative-status cleansing; opportunity cost.
- **Prism Wand:** the +1 Burn stack applies on ANY elemental spell (`sourceAbilityTagAny`), not fire-only.
- **Livre bug fix (deliberate Mage War delta):** the action-speed rider's tag gate read only damage tags, so buff casts never matched `['magical']` — contradicting Livre of Urgency's documented "every magical cast." Fixed to the union of ability + damage tags (identical on damage spells → no damage-spell behavior change; Livre now speeds buffs as documented). Chris chose fix over absolute freeze; the frozen-pool pin is unaffected (no lineup change).
- **Proc self-target fix (latent since S30):** `attackProcs`/`spellProcs` emissions against SELF-targeting procced abilities now emit `{ kind: 'self' }` — `validateAction` rejects unit-target payloads there. Surfaced by the pike's pulse (first self-targeting proc consumer).

## Consequences / carried risks

- The M2 Formation UI's capacity assumption ("equipment only LIFTS capacity") is now false (Spiked Maul), and `createInitialState` throws on over-capacity loadouts — the M3 gear UI must enforce equipment-adjusted capacity before players can equip the maul.
- The AI does not understand the new effect gear (it would happily bonk enemies with a Healer's Staff). Enemy loadouts should avoid the exotic pieces until an AI-valuation beat covers them.
- Equipment-balance playtest is downstream of the economy pass (items are broadly available within their chapters until then).
