// Calculator — the instructor's hand-authored prose for the
// Specialization spread. The 9th discipline (Session 49), and the
// magical-knowledge specialist of the Academy's roster. Mechanical
// values flow in from ../src/content at build time; this file holds
// only the voice.
//
// The Calculator is unusual on the page because her First Action is a
// *system* rather than a single spell or a small list of them. Her
// Math Skill picker is the whole story: parameter (CT / Height / Level
// / current HP), divisor (3 / 4 / 5, or *prime* as a special test),
// and every cadet on the field whose chosen number matches receives
// the chosen effect. The five Math abilities below (Precision Fire,
// Targeted Treatment, Exact Rhythm, Sculpted Enhancement, Engineered
// Defenses) are the effects the picker dispatches.
//
// Per Chris's brief, the Attack ability is intentionally omitted from
// the spread — the Calculator's basic strike is a footnote at best,
// and dropping its entry frees the recto slot the Math Skill intro
// block sits in. The template skips actives without an authored note,
// so removing `attack` from `abilityNotes` is enough — no Calculator-
// only template branching.
//
// Ability-note keys: precision_fire, targeted_treatment, exact_rhythm,
// sculpted_enhancement, engineered_defenses (the five Math abilities);
// cornered_focus (reaction), mathematician (support), thoughtful_pacing
// (movement).

import type { ClassProse } from '../prose.ts';

export const calculatorProse: ClassProse = {
  tagline:
    'The field, read as arithmetic — the cadet who answers it by counting.',

  brief: `The Calculator is the Academy's ninth and most peculiar
discipline. She does not close on her foe; she does not roam the
field. She stands well behind the line and *reads* the engagement,
and at her turn she resolves a question of arithmetic that lands on
every cadet — friend or foe — to whom the answer is *yes*.

Her power is the field's whole *count*: a single Calculator turn may
catch four enemies, or none, or two of her own; the difference is
whether she chose her arithmetic well. She is slow, her health
modest, her back evade nothing at all — and unforgiving of the cadet
who casts without first reading the preview.`,

  commandSetIntro: {
    name: 'Math Skill',
    facts: 'First Action  ·  Parameter × divisor  ·  Field-wide; per-cadet MP',
    full: `The system that gives the Calculator her name. At each cast
she chooses a *parameter* (CT, Height, Level, or current HP) and a
*divisor* (3, 4, 5, or *prime*); the spell lands on every cadet whose
number matches. Base cost is small; the per-cadet term is real.
*Mathematician* cuts it sharply — and is, for that reason, not
optional.`,
  },

  abilityNotes: {
    precision_fire: {
      full: `Fire damage at full magical force, dispatched to every
matching cadet, with a real chance besides of setting each one
*Burning*. On a parameter that catches a clustered enemy line, the
engagement's most punishing single turn.`,
      compact: 'Multi-target fire damage with a Burn proc per target. The Calculator’s offensive heart.',
    },
    targeted_treatment: {
      full: `Magical mending to every matching cadet. Friendly fire
applies *in both directions* — and on this cast above all, an
inadvertent enemy heal is the cost. Read the preview.`,
      compact: 'Multi-target heal. Friendly fire applies — read the preview before committing.',
    },
    exact_rhythm: {
      full: `Every matching cadet's CT pushed backward — a
deterministic shove, magnitude scaled to the Calculator's Faith and
Magical Attack. Caught on three enemy clocks, an opponent loses a
turn she had counted on.`,
      compact: 'Pushes each matching cadet’s CT backward — Faith × MA scaled. The Calculator’s tempo cut.',
    },
    sculpted_enhancement: {
      full: `A half-chance per matching cadet to land *PA Up* + *MA
Up* together (linked roll). Twice on the parameter that catches her
own line, the team strikes measurably sharper on both arms.`,
      compact: 'Half chance to apply +PA + +MA (linked) per matching cadet. Pick a parameter that catches your team, not theirs.',
    },
    engineered_defenses: {
      full: `The defensive twin, and the Math the Calculator most
often opens with. Four-in-five per matching cadet to apply
*Engineered Defenses* — permanent +resist at every element, +evasion
at every facing. Stacks across casts.`,
      compact: 'Four-in-five chance per cadet to apply +elemental resists + +evade. Stacks across casts.',
    },
    cornered_focus: {
      full: `A blow on the Calculator sharpens her *Magical Attack* —
a permanent stack at a time, for the engagement. The analyst's edge
under pressure.`,
      compact: 'Reaction: a damaging hit grants +1 MA, permanent and accumulating. She sharpens under fire.',
    },
    mathematician: {
      full: `*Not* optional. Lifts every Math cast's spell-power, and
cuts the per-cadet MP term by two-thirds. The Calculator without it
runs dry in three turns; with it she carries the engagement.`,
      compact: 'Support: +1 SP on Math casts and a heavy per-target MP discount. Equip it first, before anything.',
    },
    thoughtful_pacing: {
      full: `Every tile the Calculator walks restores MP. The patient
walker turns a four-cast engagement into a six-cast one.`,
      compact: 'Movement: restores MP per tile moved on each Move. Walk to sustain.',
    },
  },

  strategy: `Mathematician in the Support slot before anything else.
Place her behind the line — her back evade is *zero*. Open with
*Engineered Defenses* or *Sculpted Enhancement* on a parameter that
catches your own team and skips the enemy's: the buffs compound, and
the opening turn is the cheapest place to invest.

Once the field settles, read it — and pick the arithmetic that
catches the most foes and the fewest friends. *Precision Fire* on a
three-enemy match is most engagements decided in one turn. The
Calculator does not race the engagement; she counts it.`,

  marginalia: [
    'Mathematician is not optional. Triple cost, no extra power — the cadet who skips it has not read the discipline.',
    'Friendly fire applies to every Math cast. The instructor has seen Targeted Treatment land on three enemies and one ally. Read the preview.',
    'Parameter first, divisor second. Otherwise you are answering the wrong question correctly.',
  ],
};
