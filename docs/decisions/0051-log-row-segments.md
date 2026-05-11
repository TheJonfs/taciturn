# ADR-0051: `LogRow` segment-based shape for team-colored action log

**Date:** 2026-05-11
**Session:** 25
**Status:** Accepted

## Context

Session 24/24.5 shipped the action-log panel with `LogRow.text: string`
as the renderable content. Session 25's UI fold-in set includes
team-coloring of unit-name references in log rows: a Blue Knight's
name should render in blue, a Red Fire Mage's in red. The renderer
needs structured input that names which span is a unit name and which
team that unit belongs to.

Two paths considered (per the session 25 plan):

- **Path A — segment-based shape.** `LogRow` carries an array of
  `LogSegment` objects, each with `text` and an optional `team`. The
  formatter builds segments; the renderer maps each segment to a span
  with team color when set.
- **Path B — post-hoc string parsing.** Keep `text: string`; have the
  renderer scan for unit names and apply colors. Avoids a shape
  change but couples the renderer to engine identity (unit names) and
  fails as soon as two units share a name.

Path A was settled in conversation before code landed.

## Decision

1. **`LogSegment` shape.** Defined in `src/ui/action-log-format.ts`:
   ```ts
   interface LogSegment {
     readonly text: string;
     readonly team?: TeamId;
   }
   ```
   Plain text segments omit `team`; unit-name segments include the
   subject unit's team.

2. **`LogRow` gets both `segments` and `text`.** The structured
   `segments` field is the primary content. A derived flat-string
   `text` field (segments joined with no separator) is kept for
   convenience — most existing tests assert on `.text.toContain(...)`,
   and ad-hoc string consumers (debug logging, future text-mode
   export) don't need to know about segments.

3. **Formatter helpers.** Internal to `action-log-format.ts`:
   - `unitSeg(state, id) → LogSegment` — returns the unit's name with
     its team tag. Falls back to `{ text: String(id) }` when the unit
     is no longer in state.
   - `plain(text) → LogSegment` — returns `{ text }`.
   - `joinSegments(segments) → string` — for the derived `text` field.

4. **Per-team text palette.** `action-log-panel.tsx` defines
   `TEAM_TEXT_COLORS` matching the existing
   `TEAM_BORDER_COLORS` palette in `queue-tower.tsx` (blue
   `#7eb6ec`, red `#e07866`, undefined for any other team — fallback
   to inherited color). A new `SegmentSpan` component wraps each
   segment.

5. **Charged-resolve target slot (session 25 Item 7).** Co-landed with
   the segment refactor since both touch `formatAction`'s
   `charged_action_resolve` branch. The resolve row now renders:
   `T#### <Caster>'s <Spell> resolves on <Target>: <outcomes>`. Target
   is a unit segment (carries team color) for unit-targeted abilities
   or a plain `(x, y)` segment for tile-targeted. Caster name and
   per-target unit names also pick up team coloring.

## Rejected alternatives

- **Replace `text` entirely.** Tested first; broke ~10 existing test
  assertions that expect `.text.toContain(...)`. The derived flat
  string is cheap to compute and keeps the test suite intact.
- **Mark the whole row with a team.** A row may reference multiple
  units (`Counter` reactions, AoE per-target summaries). Per-segment
  team tagging is the natural granularity.

## Consequences

- All `formatAction` branches that previously built strings via
  template literals now build segment arrays. The change is
  mechanical but touches every per-action-kind branch.
- Tests added in `action-log-format.test.ts` for:
  - Unit-name segments tagged with their team
  - Charged-resolve target rendered (unit name or `(x, y)`)
  - Plain segments untagged
- No external consumer of `LogRow` exists outside
  `action-log-panel.tsx`; migration was a single renderer update.

## References

- [`src/ui/action-log-format.ts`](../../src/ui/action-log-format.ts) (`LogSegment`, `LogRow`, helpers)
- [`src/ui/action-log-panel.tsx`](../../src/ui/action-log-panel.tsx) (`SegmentSpan`)
- [`src/ui/action-log-format.test.ts`](../../src/ui/action-log-format.test.ts) (segment + charged-resolve coverage)
