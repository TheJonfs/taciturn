# Taciturn Player's Guide

The build project for **The Cadet's Handbook to the Mage War Tradition** —
a printable companion to the Taciturn engine and Mage War, presented as a
student handbook from the Gariland Magic Academy.

For project framing read [`vision.md`](vision.md); for working
conventions read [`CLAUDE.md`](CLAUDE.md). This file covers operation.

## Setup

```sh
pnpm install
```

The guide is a standalone project with its own `node_modules` — it does
not share the main game's dependency tree. It does read game content from
`../src/content/` at build time (see "How it works" below).

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server with live preview — edit templates, styles, or prose and the browser reloads. |
| `pnpm build:html` | Production build of the HTML/JS bundle into `dist/`. |
| `pnpm build:guide` | Full pipeline: build, then render `output/guide.pdf` via headless Chromium. |

## How it works

```
../src/content/*.ts ─┐
                     ├─► build/compose.ts ─► pages/*.ts ─► HTML string
guide/content/*.md ──┘                                        │
                                                              ▼
                                              build/preview-entry.ts
                                                  (Paged.js paginates)
                                                              │
                                  ┌───────────────────────────┴──────────┐
                                  ▼                                      ▼
                            pnpm dev (browser)              build/render-pdf.ts
                                                            (Chromium → PDF)
```

- **`build/data.ts`** — the one doorway to game content. Loads the
  catalog from `../src/content/`. Every mechanical value the handbook
  prints flows through here.
- **`build/compose.ts`** — pairs catalog data with hand-authored prose
  from `content/` and runs it through the page templates.
- **`pages/*.ts`** — template-literal functions; one per page type. They
  lay out data + prose, they do not author prose.
- **`content/*`** — the instructor's hand-authored prose, one markdown
  file per subject (e.g. `content/classes/knight.md`).
- **`styles/print.css`** — the print stylesheet (`@page` geometry,
  running headers, page types). Scaffold-level; the settled design
  system is Phase 3 work.
- **`build/preview-entry.ts`** — composes the body and hands it to
  Paged.js. The same pagination path runs in the browser and in the
  PDF renderer, so the preview matches the output.

When game content changes, re-run the build — mechanical data flows
through automatically. Hand-authored prose stays put. That is the
"living document" design from `vision.md`.

## Boundaries

This folder is **read-only** with respect to `../src/`. If a build
reveals incorrect or missing game content, surface it to Chris — do not
patch the game from here. See `CLAUDE.md`.
