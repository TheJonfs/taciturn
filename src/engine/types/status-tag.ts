// Status tags — open string union for category-based interactions.
// See docs/design/status-effects.md ("Tags").
//
// Tags drive abilities like "clear all negative statuses" and "dispel all
// time effects," and gate resistance/immunity. Specific tag values arrive
// with status content; the tag system itself doesn't enumerate them.

export type StatusTag = string;
