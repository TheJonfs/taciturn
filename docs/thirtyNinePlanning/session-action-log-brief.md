# Session brief — Action log redesign

## Context

The action log has lost the battle's significance hierarchy. In the current flat-string log, a 181-damage kill renders at the same visual weight as `Thessaly CT +22` — the climax and the bookkeeping look identical. The root cause is that the log is a flat stream that **re-narrates state already shown elsewhere**: the turn queue shows CT, the unit cards show HP/MP, and the status badges show status counts and KO timers. Every line like `recovered 6 MP`, `Protect ticked`, or `KO, 2` is the log duplicating state that's persistently on screen.

The redesign reframes the log as the **event stream**, with state collapsed behind a per-turn expand. Chris has approved the concept via mockup. A standalone reference renders it: `action-log-concept.html` (placeholder colors/icons — it communicates structure and hierarchy, not production styling).

## Inputs

- `action-log-concept.html` — the approved concept (interactive: click a turn header or "Show ledger" to reveal the per-turn ledger).
- The events-vs-state mapping (below) — the authoritative classification.
- The existing action-log emitter/component and `battle-ui-architecture.md`.

## Goal

Rebuild the action log so that by default it shows **events only**, with an icon/weight/color visual language replacing the `[tick]/[end]/[ko]` text tags; multi-line mechanical sequences consolidated into single events; KO timers relocated out of the log onto units; and a per-turn expandable **ledger** holding the full mechanical detail, default-hidden but preserved for replay/audit completeness.

## Pre-implementation plan (audit — this determines scope)

The central question that decides whether this is a render-layer job or reaches into the engine:

1. **Is the action log structured event data, or pre-formatted strings?** If each entry is a baked string (`"[tick] Burn ticked on Tina"`), the events-vs-state cut, icons, and consolidation all require a structured event model first — that's substrate. If it's already structured and merely rendered flatly, it's a render-layer change. Report this before building.
2. What metadata does each entry carry today (type, actor, target, amount, source)? Enough to classify event-vs-state and select an icon?
3. Can sub-events be grouped under a triggering action (parent/child)? Consolidation (Burn tick + its damage + its expiry → one line) needs this.
4. Where does the log component live, how is it fed, and is this the same stream used for replay? (If so, the ledger must stay complete — see watch-fors.)
5. Can the unit badge/sprite host a KO-timer countdown, for the relocation?

If the event model needs to change, surface the reshaped scope before committing to it — standard audit-overturns-spec; the implementation work below is over-specified on purpose so the audit can prune it.

## Implementation work

1. **Event model** (only if the audit finds strings, not structure): each log event carries `{ turnId, type, category: 'event' | 'state', actor, target?, amount?, source?, parentId? }`. `parentId` enables consolidation grouping.
2. **Classification** — apply the events-vs-state mapping below to set `category`.
3. **Consolidation** — collapse mechanical sequences into one event: a status tick + its damage + its expiry → `Burn → Tina 9, expired`; a move + incidental regen → the move stays top-line, the regen goes to the ledger.
4. **Render** — icon gutter (mapping below); team-colored names; weight hierarchy with the kill line emphasized (large number + skull + danger tint, as in the concept); remove the `[tick]/[end]/[ko]` text prefixes entirely.
5. **Collapse/expand** — per-turn grouping; default = events only; clicking a turn reveals its ledger; a global toggle expands all. Default-collapsed.
6. **Relocate KO timers** — `KO, 1 / 2 / 3 — fading` leaves the log and renders as a countdown on the unit.

### Events-vs-state mapping (authoritative)

Top line (events): turn header; the action (move / attack / ability) with its damage or heal amount; a status **landing** and any damage it deals; KOs and fades; reactions that **fire**.

Ledger (state, default-hidden): status countdown ticks, CT changes, MP/HP regen, the KO timer, status expiries by countdown, and reactions that **don't** fire (e.g. `Speed Save rejected`).

Two cases promoted up to the top line despite being state-adjacent: a **status application** (Burn landing is a tactical event) and a **reaction that fires** (a Counter going off — the very thing that killed the Templar last session).

### Icon mapping

attack → sword · ability → sparkles · status → flame · status-stack → stack · move → arrow · KO/fade → skull · victory → trophy. Keep the set small; rare events stay textual rather than each earning an icon.

## Acceptance criteria

- The three sample turns (T0089–T0091) render as in the concept: events-only by default, the 181 kill visually dominant, ledgers collapsed.
- No `[tick]/[end]/[ko]` text prefixes remain anywhere in the log.
- KO timers no longer appear as log lines; the countdown shows on the unit instead.
- Expanding a turn (or the global toggle) reveals the complete mechanical ledger; nothing shown in today's log is lost — only default-hidden.
- If the stream is shared with replay, the replay/audit path still has the full detail.

## Out of scope

- The four companion items (Taunt audit, Calculator faith removal, Brine buff, end-of-battle KO undercount) — separate brief.
- Any non-log UI surface.
- New event *types* beyond what exists today, unless the audit shows the model genuinely needs them to classify what's already logged.

## Files

- Action-log component (UI layer) — primary.
- Action-log data model / emitter (engine or UI — the audit determines which).
- Unit badge / sprite overlay component — for the KO-timer relocation.
- `battle-ui-architecture.md` — reference.
- `action-log-concept.html` — visual reference (concept only; do not copy its palette).

## Workflow notes

- Plaintext-review gate before building.
- Audit-and-report on the structured-vs-strings question (item 1) before committing to any engine-side work; route a reshaped scope back to Chris.
- Mid-session design questions route to Chris.

## Watch-fors

- **Replay completeness.** If the log doubles as the human-readable replay/audit trace, the ledger must retain everything the current log shows. This is a default-hide, never a delete.
- **Concept palette is placeholder.** Implement with the game's existing log styling; the concept file's colors are illustrative.
- **Icon discipline.** Only the high-frequency event types earn an icon; over-iconing becomes its own noise.
- **Consolidation may surface substrate.** Grouping sub-events under a triggering action may reveal the engine doesn't currently parent them — the likely audit find.
- **KO relocation crosses layers.** It touches unit rendering, not just the log — coordinate with the badge component, and apply the content-integration sweep if it adds a new visual state.
- **Shared-resolver discipline.** If any forecast or replay view reads the same log stream, keep it on the shared path rather than forking a second formatter.

## Estimated size

**Large** if the audit finds formatted strings and the event model needs restructuring (substrate + render). **Medium** if the log is already structured and this is render-layer only. The audit decides which — report before proceeding.
