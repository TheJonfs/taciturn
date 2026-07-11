# Session Handoff

This is a transient note from one session to the next.

**Discipline:** This document is *overwritten* each session, not appended. When
starting a session, read this file and process every item — act on it, promote it
elsewhere (ADR, design-doc edit, GitHub issue), or explicitly drop it with a
reason. Items do not accumulate. If there are no notes to leave, replace the
contents with `_No handoff this session._` so the next session knows the file has
been processed.

---

## S87 — Ch3 uniques brief SHIPPED whole (2026-07-10)

Everything in `taba-ch3-uniques-and-fixes-brief.md` landed (ADR-0144): the
📈 Grant JP dev chip, the Moon Robe ×1.5 fix + display arm, the Katana
verification (all three checks PASS, no change), all 8 weapon uniques
(two engine seams: `attackAoe`, `castMpDump`), the Holy payoff, and the
5a/5b data checks (numbers below went to Chris in-session). Suite green
(**2623**), `tsc -b` clean. Commits: `07f841c` (JP chip) · `d07ec84`
(Moon Robe) · `9c3ef10` (Katana) · `d55ece0` (six composes + Holy) ·
`6584ba5` (Del's Stave) · `70984ea` (Volley Bow) + this docs commit.

### Flagged for Chris / the planner (from ADR-0144)

- **Signed `system_mp_restore`** (D3): Golden Rod's MP burn rides a negative
  `amount` on the existing action (no channel existed; `system_mp_drain` is a
  transfer — self-drain nets zero). Chosen to keep the ActionType surface
  closed. If a dedicated `system_mp_burn` discriminant is preferred, it's a
  contained refactor.
- **Tailored Outfit doesn't exist** — the brief cited it as the start-of-turn
  precedent. Real precedent used: `statusGrants` → per-turn-tick status
  (regen_auto pattern). Still on the M3 design slate.
- **Del's Stave × math_skill**: the prospective (AI/forecast) bonus reads the
  base cost, not per-target math scaling. No content pairs them today; noted
  in ADR-0144.
- **Aether Bloom does NOT expand Volley Bow's blast** (magical-tag gate) —
  same answer as the Palliative Pike question. If design ever wants a
  physical-AoE expander, that's a new passive, not a Bloom edit.

### Watch-fors (playtest, don't pre-nerf — brief's own list, now live)

- Cremation (2 guaranteed Burn stacks) × Pendant of Lumara (×2 tick).
- Shadowblade permanent bidirectional stacking vs HP-sponge bosses
  (lever = boss Speed-Down resistance; Remedy does NOT clear either side —
  speed_down is remedyImmune, speed_up is positive).
- Del's Stave cheapest-spell incentive (intended) + heal/buff casts also dump
  (a buff cast burns the tank for nothing — the weapon's contract; watch if
  it reads as a gotcha).
- Golden Rod ~10-turn clock: genuinely lethal (system_damage KOs); the MA
  ramp has no cap. Gilded Focus also composes with Terra Attunement.
- Volley Bow friendly fire + Acc 40 per-target rolls; The Offering doubles
  the volley (two blasts per Attack).
- Excalibur above-curve by intent (gate it behind the optional boss when the
  economy pass places it).

### Post-ship playtest fix (same session)

Chris's report: bought all four Alchemist "actives" via the JP chip, no
secondary command offered. Cause: the Alchemist's real actives (Compound /
Throw Item) are class-innate `freeAbilities` — never purchase tokens — so its
buyable kit is four ITEM tokens, and `equippableSecondaryCommands` only
counted active-ABILITY tokens. Same latent gap for the Calculator
(mathParameter/mathValue tokens). Fixed: any usable-command-content token
(active ability, item, mathParameter, mathValue) now lights up its native
class's command set as a secondary; passive-only spend still doesn't.
Verified end-to-end in the browser (Knight + potion token → Alchemy offered,
equips, persists).

### Notes for next session

- **Economy pass is the next M3 beat** (unchanged): shops/costs/currency +
  unique acquisition. All 8 uniques are pool `unique`/Ch3 already —
  placement flows just need to call `grantItems` (receipt stays the one
  door). Spiked Maul story-gating: see 5a numbers in the S87 conversation —
  short version: ~350 one-shots every non-Monk base-HP class through the
  whole Ch3 band; only Crystal-Plate tanks (L28+ Knight ~365 total) reliably
  survive one and two-shot territory starts ~L40s. Sequence the Maul mid-Ch3
  alongside Crystal Plate availability.
- **Keep effect weapons OFF authored enemy loadouts** (standing AI-valuation
  deferral; the projection resolves them safely but doesn't value them).
- The dev-server tab from this session ran on an auto-port (5173 busy);
  no product impact.

### Carried from earlier (still open, low-priority — unchanged from S86)

- JP spillover on over-threshold spend (M2 tail).
- Enemy progression tuning for Stonebridge / Marshmoor / Mountain Pass (data).
- Loadout 2nd-secondary UI (Magus Crown / Command Cap), "Level Up!" banner
  polish, rapid-dialogue-advance React setState-in-render warning.
- "99 cap" guide fiction (no code clamp) — guide-doc correction someday.
- S85 open-register playtest items (Epee CT-refund loops, Star Robe lifesteal,
  Expert's Tunic × Golden Hairpin, tempo-caster stack, Scouring × dual-wield,
  Manaeater-as-default, Terra Robe maybe weak) — watch, don't pre-nerf.
- FormationDevHarness (`?formation`) still shows 2 synthetic invalid units
  (Nova, Ptolemy) as a free showcase of warning states.
- reclassUnit frees now-illegal passives but keeps now-illegal gear (D2:
  surface, don't resolve).
