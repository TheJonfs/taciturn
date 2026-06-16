# Handoff

*Outgoing notes from the planner-content-reference session — a new build
artifact: a terse, mechanical-only mirror of the catalog for the planner
thread. Not changelog-driven; a tooling addition Chris requested.
Overwritten each session — read every item, then act / promote / drop.*

## Changelog cursor

**Unchanged — still processed through the Thief session (2026-06-15).**
This session added no guide *content*; it built the planner-reference
generator. The next guide session still starts above the "Playtest fixes
(2026-06-15)" heading in `docs/guide-changelog.md`. The changelog had no
new entries at session start.

## What landed (this session)

A second build artifact rides the guide pipeline — the **Planner Content
Reference**, a stripped-down mechanical mirror (no prose) for the planner
Opus thread that designs content without code access. Decisions taken
with Chris up front: **hybrid §1** (auto-extract values + hand-mirror
formulas with pointers), and the output is a **gitignored artifact in
`output/`** (like the PDF), so the only committed change is build code +
docs.

- **`build/reference.ts`** (new) — the markdown emitter. tsx-safe:
  imports only `data.ts` + the two formatters (no `?raw` SVG). Emits
  §1–§8 of the schema. §2–§8 and the §1 ruleset table are auto-extracted
  via `describeItem` / `describeAbility` / the catalog. The §1 *formula*
  block, the §7 passive *effect* column (`PASSIVE_EFFECTS`), and a few §6
  active augments (`ACTIVE_EFFECTS`) are hand-mirrored from engine
  handler / hook source headers, with `src/engine/...` pointers. A
  passive/active with no curated line renders a loud `⚠ hand-maintain`
  marker (no silent blanks).
- **`build/render-reference.ts`** (new) — tsx entry; writes
  `output/planner-content-reference.md`. No Vite/Paged.js needed.
- **`package.json`** — `build:reference` (standalone) + appended to
  `build:guide`.
- **`.gitignore`** — ignore `output/planner-content-reference.md`.
- **`planner-content-reference.md`** (the planner's schema/contract,
  committed) — added a header pointer: this is the schema; the live
  document is generated to `output/`.
- **Docs:** `maintaining.md` §5a (the new maintenance playbook for the
  reference), `CLAUDE.md` tooling notes + quick reference.

All passive-effect and thin-active one-liners were distilled from the
ability source headers (not memory) and verified against ids. Reference
builds clean: 327 lines, all 8 sections, **zero** `⚠` / `[verify]` in
any row.

## Things surfaced for Chris (flag, don't fix)

- **Two distinct status types both named "Regen"** appear in §8 (one
  `per_unit_ct`, one `permanent_per_unit_ct`) — likely the cast Regen vs.
  an item/Tintinibar-granted Regen. Real catalog data, not a generator
  bug; possibly a content naming collision worth a look on the game side.
- **The §1 formula block & §7/§6 hand-maps are the only drift surface.**
  They're the planner-reference analogue of the stale-prose audit: when
  the changelog reports a formula/constant change or a new passive,
  update the matching line. New *data* (classes, items, abilities,
  statuses, stat lines) flows in free — no edit.

## Watch-for (carried)

- **PDF still ~85–91 MB** — art downsample remains the standing
  top-priority cleanup (unrelated to this session).
- **Guide build is not `tsc`-gated** (pre-existing): `tsc --noEmit`
  reports ~55 errors across `item-format.ts` / `spread-context.ts` /
  `preview-entry.ts` from accessing `@engine`'s discriminated-union props
  directly. `reference.ts` adds 2 of the identical idiom (it mirrors
  `item-format.ts`'s `item.classRestrictions` access). The build runs via
  tsx/Vite, which is the real path; not a regression.

## Considered and rejected

- **Committing the generated reference** (game-side `docs/` or guide
  root). Chris chose the gitignored-artifact route — keeps the
  guide/game commit boundary clean and treats it like the PDF.
- **Leaving §7 effects as `⚠` markers** to fill incrementally. Rejected
  as not deliverable-quality; filled all ~35 passives + thin actives now
  from source headers.

## Suggested next scope

- Hand the planner the generated file and let real use shake out which
  cells it leans on; tune terseness / add columns from feedback.
- Resume changelog-driven content maintenance when the feed advances.
- Art downsample (still overdue).
