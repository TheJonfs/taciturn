# Taunt audit (Session 63, Item A)

**Status:** Audit complete. Decision: **redesign deferred to its own session;
soft-lock guard added this session (ADR-0104).** Report-only per the S63 brief —
no Taunt mechanic was changed.

## Intended behavior

Per the code comments and the session-17c plaintext review, Taunt (Knight Battle
Skill) applies the `Taunted` status to one ranged enemy (range 4 / vertical 2,
line-of-sight, `applyAlways`, duration 4). While Taunted, the unit has a **40%
chance to fail an attack outright** when it targets anyone other than the Knight
who taunted it; attacks against the Knight land normally. AI-aware target
preference was explicitly deferred to "session 20's tier 1.5 work."

## Actual behavior — three problems

### 1. The "probabilistic" block is deterministic, target-blind, and never reflips

`taunted.ts` blocks an action when
`stableHash(\`${sourceUnitId}|${attackerId}|${abilityId}\`) < 0.4`. That hash is
**constant** for a given (taunt-source, attacker, ability-id) triple — the
**target is not in the key**, and there is no per-attempt seed. Consequences:

- For any one ability a Taunted unit owns, it is either **always** blocked or
  **never** blocked against *every* non-Knight target, for the whole Taunt
  duration (and across re-taunts from the same Knight).
- The intended "40% chance per attack" is actually "≈40% of a unit's *ability
  types* are 100% locked out, the rest 0%."

The file admits the root cause: per-action seeding only lands at commit time,
*after* `onActionAttempted` fires, so the handler had no seed to roll against.

(Basic Attack **is** a `use_ability` with `basicAttack: true`, so Taunt does at
least apply to auto-attackers — that part matches intent.)

### 2. The AI is completely Taunt-blind

There are **zero** references to `taunt`/`Taunted` anywhere in `src/ai/`. The
deferred "tier 1.5" AI integration never happened. Since you Taunt *enemies* (AI
units), the AI neither prefers the Knight nor avoids the abilities that will be
blocked — it keeps proposing them. `validateAction` is pure and never sees the
`onActionAttempted` block, so the AI cannot anticipate it.

### 3. Latent soft-lock (the serious one)

When a Taunted unit's chosen action is blocked, `commitAction` returns
`ok: false / hook_blocked` with **no state change**. The basic AI controller is a
stateless `decideBasicAi(state, catalog)` — pure and deterministic. Same state in
→ same blocked action out → blocked again → **the pump spins forever / the turn
hangs**. It only escapes if the AI's single best-scored action happens not to
hash-to-blocked. Given ≈40% of ability-types lock, a Taunted AI enemy whose top
action is a blocked attack will hang the battle. Taunt is "barely exercised," so
it's a rarely-tripped landmine — but it is a real correctness bug, not a flavor
miss.

## Recommendation (routed to Chris → accepted)

**Ground-up redesign, not a patch.** All three problems stem from the
block-the-action model, which the status file itself flagged as a v1 compromise
to revisit. The cleaner design the file gestures at — a `modifyHitChance` applied
**against the attacker** plus genuine AI target-preference integration (the AI
should *want* to hit the taunter, or at least know its other attacks are
penalized) — needs a new attacker-side hook runner and AI threat-model work.
That is an architectural decision for a dedicated session, not an in-place fix.

**Decided this session:** the redesign is deferred; the **soft-lock guard ships
now** (ADR-0104) so no blocking hook — Taunt or any future one — can hang a
battle, independent of the redesign timeline.

## Pointers for the future redesign session

- `src/content/abilities/taunt.ts`, `src/content/statuses/taunted.ts` — current
  mechanism.
- `onActionAttempted` runner (`src/engine/hooks/runners.ts`), `runPreHook` in
  `src/engine/actions/commit.ts` — where the block resolves.
- `src/engine/damage/handlers.ts` `evasionCheck` / `runModifyHitChance` — the
  hit-chance path a redesign would likely hook (note: today it fires against the
  *defender's* hooks; an attacker-side variant is the missing surface).
- `src/ai/basic.ts` + `src/ai/threat/` — where AI target preference would consult
  a taunt (ties into the threat/targeting model the brief flagged).
- Decide the intended effect precisely before building: hard pin? accuracy
  penalty (and is it visible in the hit-chance UI)? AI aggro pull only? The brief
  says **do not invent intent** — confirm with Chris.
