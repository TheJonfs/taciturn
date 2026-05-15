// Minimal HTML helpers for the template-literal page system.
//
// Pages are plain functions returning HTML strings (see guide/CLAUDE.md —
// "Template literals" was the chosen composition approach). Any value
// derived from game content or hand-authored prose passes through `esc`
// before landing in markup.

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a string for safe interpolation into HTML text or attributes. */
export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}

/** Join a list of HTML fragments with newlines. */
export function join(fragments: ReadonlyArray<string>): string {
  return fragments.join('\n');
}
