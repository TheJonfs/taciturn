# Handoff

*Outgoing notes from the Thief-session guide update — the twelfth class
spread (the Thief) plus the playtest-fix corrections to existing
spreads. Driven by the `docs/guide-changelog.md` feed
(implementer-writes / guide-reads). One uncommitted bundle in the tree
at time of writing; see below.*
*Overwritten each session — read every item, then act / promote / drop.*

## Changelog cursor

**Processed through the Thief session (2026-06-15)** — the topmost dated
entries: "Playtest fixes (2026-06-15)", "Thief session — follow-up
tweaks", "Thief session — chunk 2: Steal Heart", "Thief session — chunk
1", and "Session 66". S66 was AI-only (no-op). Next guide session starts
above the "Playtest fixes (2026-06-15)" heading.

## What landed (UNCOMMITTED)

`output/guide.pdf` rebuilt clean at **55 pages** (+2 over 53 for the
Thief spread). Build: `npm run build:guide`.

### Thief — twelfth Specialization spread

A resource-theft skirmisher. Wired exactly as the prior classes:

- `content/classes/thief.ts` — `thiefProse`, slotted alphabetically
  **last** in `SPREAD_ORDER`. Tagline + brief, a **Thievery**
  `commandSetIntro`, notes for the four steals (Steal HP / Steal MP /
  Steal Buffs / Steal Heart) and the three innate passives (Slip Free /
  Momentum / Move +2), strategy, four marginalia. Attack omitted (no
  note → template skips it — the basic strike is the steals' delivery
  vehicle).
- **Identity framing:** PA-is-everything (damage, drain, *and* the
  contest odds on every steal); resource-denial as the lane *distinct
  from the Assassin's action-denial* (called out in the brief and a
  marginalia so the two neighbours don't blur); Steal Heart as the
  bank-or-spend capstone (24 MP vs the 28-MP bar). The Thief's
  `defaultGender` is female — relevant because Steal Heart is
  gender-gated (charms opposite only); the note says so.
- Wiring: `content/classes/index.ts`, `build/spread-context.ts`
  (portrait `thief_1.png` + `CLASS_META` + `'thief'` ElementId +
  `SPREAD_ORDER`), `styles/variant-e.css` (new `.v-e--thief` — **dusty
  coral-rose** `#a14e5c`, from the heart motif of her vest / Steal
  Heart; Chris's call, a warm register no other spread occupies),
  `pages/layout.ts` (half-title brief + auto "twelve disciplines, twelve
  spreads").

**Fit cost:** the Thief recto is the densest in the book — four actives
(one more than any other class) plus the intro block and three passives.
The first draft spilled the strategy onto a third page; recovered by
tightening the brief, the four steal notes, the Thievery intro, and the
strategy (cut from two paragraphs to one). The triadic close I trimmed
("Bank the reserve, cut her Brave, then take her heart") survives nearly
verbatim in the marginalia, so the spread keeps the beat. Final: clean
two-page spread, all twelve spreads on even/verso, parity intact.

### Playtest-fix corrections to existing spreads (Chris: all four)

- **Alchemist marginalia** (`content/classes/alchemist.ts`) — the old
  "A Phoenix Down on a living ally is mercy, not waste" was **factually
  wrong** after the KO-only fix (Phoenix Down can no longer target the
  living). Rewritten to "only answers a cadet already down… keep a
  Potion for the wounded."
- **Templar Cure** (`content/classes/templar.ts`) — area changed cross →
  **diamond** (S65). The note said "one-square cross"; rewritten to
  "small diamond… widened to a full diamond under Aether Bloom."
- **Templar Raise** — added the **KO-only** emphasis (it answers only a
  cadet already down; use Cure for the living), matching the Phoenix
  Down rule.
- **Hunter Pin Down** (`content/classes/hunter.ts`) — now derives range
  from the equipped bow and gains the **high-ground range bonus**. Note
  now says it "takes its reach from the bow… reaches farther loosed from
  the high ground."

### Flowed in automatically / no-ops (verified)

- **S66** — AI-only, no player-facing change.
- **Steal forecast %, Jump-dodges-charged-action, Polearm vertical
  reach, Steal Heart default-gender targeting** — engine/UI fixes with
  no guide prose surface.
- **Steal MP using the equipped weapon's range** — captured in the new
  Steal MP note ("a bow lets her drain from range"); no separate edit.

## Watch-for / flag

- **PDF is ~85 MB** (twelve portraits + seal + two splashes). The art
  downsample is the standing top-priority cleanup — would roughly halve
  the file at no print-DPI loss.
- **The Thief recto is at capacity.** If a future tweak adds anything to
  the Thief's kit or notes, it *will* spill — budget a compensating trim
  in the same spread (the lesson from S65's Knight/Assassin spills, now
  repeated here). The four-active spreads (Thief) and the
  intro-block spreads (Calculator, Terraformer, Templar, Thief) have the
  least slack.
- **Worldcraft per-work data line** still absent (carried from prior
  passes) — not blocking.

## Considered and rejected

- **Worn-leather tan/umber Thief palette.** Offered as my recommendation
  (browner, more martial); Chris chose the **coral-rose** from the heart
  motif. It reads warmer/pinker than anything else in the book and ties
  to Steal Heart — distinctive, and it holds up against the Templar's
  violet beside it.
- **Minimal (two-correction) playtest scope.** Chris chose all four;
  the Pin Down and Raise touches aren't strictly wrong-fixes but keep
  every spread current.

## Suggested next scope

- **Art downsample** for distribution — now clearly overdue at ~85 MB.
- **Future classes / training fields / equipment** as the changelog
  feeds them; the class-wiring pipeline is proven (done six times).
- **Write-through** on the Thief spread and the corrections if the voice
  wants tuning.