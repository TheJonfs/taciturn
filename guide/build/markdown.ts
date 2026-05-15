// Markdown helper — the instructor's prose uses light markdown for
// in-world inflection (italics for quoted phrases, paragraph breaks).
// This wraps `marked` so the templates get HTML without each one
// reaching for the library.

import { marked } from 'marked';

/** Render multi-paragraph prose (the brief, the strategy note) to HTML. */
export function renderProse(md: string): string {
  return marked.parse(md, { async: false });
}

/** Render a short single-line string to inline HTML (no <p> wrapper). */
export function renderInline(md: string): string {
  return marked.parseInline(md, { async: false });
}
