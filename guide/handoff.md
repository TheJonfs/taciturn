# Handoff

*Outgoing notes from the Session-69 line-of-sight pass — terrain
elevation now occludes straight-line attacks, and a bow's lob is bounded
by a genuine mountain (ADR-0117). A small, surgical update to both
artifacts. Driven by `docs/guide-changelog.md`. Overwritten each session
— read every item, then act / promote / drop.*

## Changelog cursor

**Processed through the Session 69 follow-up (2026-06-17)** — the two
topmost entries: "Session 69 follow-up — terrain blocks sight; mountains
block lobs" (player-facing, reflected below) and "Session 69 — AI
self-state valuation" (`_No player-facing changes._`, AI scoring only,
skipped). Next guide session starts **above** the "Session 69 follow-up"
heading.

## What landed (this session)

A single player-facing change (ADR-0117), reflected as a *mechanics
change to existing content* — no new tables, just refined rules prose +
a §1 reference line:

- **PDF — Foundations** (`content/foundations/index.ts`): the line-of-
  sight / cover passage refined. It already noted that straight-line
  attacks need a clear line; now it states that **terrain rising above
  the sightline** blocks (not just walls/units/barriers), that **height
  raises the sightline** — high ground or a Hunter's *Vantage* sees over
  a ridge that blinds a caster on the flat — and that lobs/arcs clear a
  wall or low hump but are **turned aside by a genuine mountain** (>5
  above both cadets). Renders on p7; the chapter stayed within its pages
  (PDF still 57 pp).
- **Planner reference — §1** (`build/reference.ts`): a new line-of-sight
  formula line (hand-mirrored, ADR-0117) capturing the same three facts
  for the designer. Sits beside the evasion line.

No per-class spread needed editing: the mages' / Assassin's "Cover
blocks it" notes are still accurate (cover still blocks straight-line),
and the Hunter's Vantage note already framed shooting "over cover."

## Verification

- **Parity intact** — all 12 class spreads still open on even/verso (the
  Foundations growth is upstream of the Specializations half-title, which
  re-anchors via `break-before: right`, so the spreads were never at
  risk; checked anyway).
- Planner reference rebuilt clean (no `⚠`/`[verify]` rows); §1 LoS line
  present.

## Watch-for / flag

- **PDF still ~91 MB** — art downsample remains the standing top-priority
  cleanup.
- **Vantage may be re-tuned +2 → +1 game-side** (carried from S68; ADR-
  0115's "spicy first cut" note). If it changes, the "two tiles higher"
  wording needs a one-word edit in `hunter.ts`, the reference's
  `PASSIVE_EFFECTS`, *and now also* the Foundations LoS passage and the
  §1 LoS reference line (both name Vantage's +2). Four spots.

## Considered and rejected

- **Touching the mage / Assassin spreads.** Their cover notes remain
  correct under the new rule (terrain joining walls as cover only
  strengthens "cover blocks it"); no edit earns its parity risk.

## Suggested next scope

- Resume changelog-driven maintenance as S70+ lands.
- Art downsample (overdue).
