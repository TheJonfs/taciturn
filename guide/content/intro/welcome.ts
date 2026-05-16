// Welcome to Gariland — the instructor's welcome letter to the
// incoming cadet. The reader's first encounter with the voice; entirely
// hand-authored. Body accepts light markdown.

export interface WelcomeLetter {
  readonly salutation: string;
  readonly body: string;
  readonly signature: string;
}

export const welcomeLetter: WelcomeLetter = {
  salutation: 'To the incoming cadet —',

  body: `You hold the Cadet's Handbook to the Mage War Tradition. It is
not, despite its weight, a difficult document — but it is a serious
one, and this instructor would ask you to receive it as such.

Gariland Magic Academy has trained the disciplined for longer than its
oldest records reliably say. Cadets come to this institution as you
have come — uncertain of their footing, certain only that they mean to
learn — and they leave it knowing one of the five specializations as
well as a body can know a craft. The Mage War is how the Academy makes
certain of that knowing: a tradition of sanctioned engagements, cadets
of chosen disciplines set against one another on prepared ground,
under rules the Academy has refined across many years and many honest
mistakes. You will hear the engagements called duels, and exercises,
and once or twice things less polite. They are training. They are
also, make no mistake, real.

This handbook exists because the Academy holds that a cadet should walk
onto the training field already knowing what the field will ask of
her. The chapters ahead lay out the foundations every engagement runs
on — the rhythm of charge time, the structure of a turn, the closed
cycle of the four elements, the reading of terrain. After them come the
five specializations, each given its own brief; and after those, the
armory, catalogued and annotated. The mechanical particulars are drawn
from the Academy's own records and kept current with them. The
judgments — which tool for which moment, which mistake cadets make and
make again — are this instructor's own, offered for what long teaching
is worth.

A final word, before you turn the page. This handbook will tell you a
great deal. It will not tell you the one thing that matters most,
because no document can: that the cadets who do well here are not the
ones who memorise it, but the ones who come to understand *why* it
reads as it does. Read for the why. The rest will keep.

Welcome to Gariland, cadet. The field is waiting — and in time, so
will you be ready for it.`,

  signature: 'Professor Claude, on behalf of the Gariland Magic Academy',
};
