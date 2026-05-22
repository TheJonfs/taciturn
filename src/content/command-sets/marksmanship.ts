// Marksmanship — the Hunter's signature command set (Session 45). Three
// First Action members defining the archer's positional-control identity:
//   - Pin Down — Slow (Brave-and-Speed gated, 4 turns); ranged tempo cut
//   - Charged Attack — the aimed shot (charged, extra-damage bow strike)
//   - Scramble — a relaxed-jump repositioning hop (action-cost only)
// A Hunter with Marksmanship equipped picks any of the three from the
// action menu on its First Action.

import {
  abilityId,
  commandSetId,
  type CommandSetDefinition,
} from '@engine/index.ts';

export const marksmanship: CommandSetDefinition = {
  id: commandSetId('marksmanship'),
  name: 'Marksmanship',
  members: [
    abilityId('pin_down'),
    abilityId('charged_attack'),
    abilityId('scramble'),
  ],
  baseCost: 1,
  availability: 'available',
};
