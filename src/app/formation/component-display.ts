// Formation — component display data (TABA M2 UI).
//
// Short effect taglines + math-component display names for the Training rows,
// ported from the curated `formation-celestial-2.html` KIT (the current
// authored source of short-form component copy). NAMES for abilities/items come
// from the engine catalog (source of truth); this table supplies only the
// short EFFECT line + the two enabler-passive conditions + the display names for
// math parameters/values (which have no catalog entry).
//
// Keyed by the token id (ability/item id string, or the math parameter/value
// literal). New components without an entry degrade to name + cost (no tagline)
// rather than breaking — but every shipped component should carry one.

// tokenId → short effect. Abilities + items + math components.
export const COMPONENT_TAGLINE: Readonly<Record<string, string>> = {
  // Monk — physical:1
  bears_heave: 'Grapple-throw; ledge drops',
  serpents_coil: '×7 + Speed refund',
  foxfire: '×8 + Burn',
  storm_stoop: '×7 line AoE',
  chakra: 'Self-heal + MP + AoE',
  barehanded: 'Enables PA² fists',
  vigilance: '+½PA evasion',
  counterpunch: 'Counter PA×4',
  // Geosage — magical:1
  earth_strike: 'SP8 + slow',
  earth_blessing: 'Applies Regen',
  earth_curse: 'Blind + Silence',
  earth_quake: 'AoE + slow',
  earth_cataclysm: 'Ult · lockdown AoE',
  earth_resilience: '+Move on hit',
  bedrock_stride: '+1 Move / no fall',
  earth_communion: 'Status chance ×1.25',
  // Pyromancer — magical:1
  fire_strike: 'SP8 + PA/MA down',
  spark: '2 Burn stacks',
  fire_storm: 'AoE',
  fire_embrace: 'PA/MA up (ally)',
  flame_lance: 'Ult · line + Burn',
  aether_bloom: 'AoE expand +1',
  ignition: 'Burn on magic dmg',
  hotfoot: '+1 Move / +1 Speed',
  smolder: 'Burn on hit taken',
  // Hydrologist — magical:1
  water_strike: 'SP8 + push CT',
  brine: 'Speed down',
  tide_surge: 'Boost ally CT',
  tidal_wave: 'AoE + knockback',
  maelstrom: 'Ult · cone knockback',
  flow_state: '+CT after casting',
  tidal_pull: '+CT on hit taken',
  tidewalker: 'Water terrain −1',
  // Alchemist — physical:1
  potion: 'Heal (craft + throw)',
  phoenix_down: 'Revive (craft + throw)',
  remedy: 'Cleanse (craft + throw)',
  ether: 'Restore MP (craft + throw)',
  combat_focus: '+1 PA under fire',
  field_kit: 'Start with items',
  field_recovery: 'Heal on move',
  // Hunter — physical:1
  charged_attack: '×2 ranged shot',
  pin_down: 'Slow 50%',
  scramble: 'Climb / reposition',
  eagle_eye: 'Hit chance ×2',
  vantage: 'Attack as +2 elevation',
  high_jump: '+2 Jump',
  updraft: '+1 Jump on hit',
  // Aethurge — magical:2
  lightning_strike: 'SP12 bolt',
  magnetic_mark: 'Vulnerable',
  static_embrace: 'Crit up (ally)',
  chain_lightning: 'AoE',
  storm_caller: 'Ult · SP36 nuke',
  conductor: 'MA ×1.25',
  discharge: 'Retaliate lightning',
  quickstep: '+CT if moved',
  // Knight — physical:2
  power_attack: '×1.5 physical',
  bull_rush: 'Knockback',
  lightning_stab: 'Silence 50%',
  counter: 'Counter with Attack',
  bravestrider: '+1 Move / +10 Brave',
  martial_expertise: 'PA ×1.25',
  // Thief — physical:2
  steal_hp: 'Lifesteal strike',
  steal_mp: 'Drain + refuel',
  steal_buffs: 'Strip buffs to self',
  steal_heart: 'Charm 3 turns',
  slip_free: 'Shrug debuffs',
  momentum: '+CT after acting',
  move_plus_2: '+2 Move Range',
  // Enchanter — magical:2
  enchant_protect: 'Physical ward',
  enchant_shell: 'Magical ward',
  esuna: 'AoE cleanse',
  enchant_haste: 'Speed / CT buff',
  short_charge: 'Charges ×1.33 faster',
  aura_mastery: 'Cast buffs ×1.33',
  resistance_save: '+resist on hit',
  float: 'Water / no fall',
  // Templar — hybrid:2
  jump: 'Physical lance',
  cure: 'AoE heal',
  raise: 'Revive',
  emissary: 'Heals ×1.25',
  unified_calling: 'MP when healed',
  monkeygrip: '2H one-handed',
  faithstrider: '+1 Move / +10 Faith',
  // Terraformer — hybrid:2
  pillar: 'Raise a tile +4',
  pit: 'Lower a tile −4',
  hill: 'Raise 3×3 area',
  valley: 'Lower 3×3 area',
  barrier: 'Spawn walls',
  damage_split: 'Reflect half + heal',
  ignore_height: 'Step any elevation',
  expert_former: 'Worldcraft cap +2',
  // Assassin — physical:3
  blowdart: 'Poison DoT',
  undermine: 'Brave down',
  sow_doubt: 'Faith down',
  shadow_stitch: 'Stop 60% — full lockdown',
  speed_save: '+Speed on hit',
  two_weapons: 'Dual-wield (PA×0.75)',
  fleet_of_foot: '+1 Move / +1 Jump',
  // Calculator — magical:3 (payloads, enablers, passives)
  precision_fire: 'Field-wide fire + Burn',
  targeted_treatment: 'Field-wide heal',
  sculpted_enhancement: 'Field-wide PA/MA up',
  engineered_defenses: 'Field-wide def buff',
  exact_rhythm: 'Field-wide CT adjust',
  mathematician: 'Boost Math Skill',
  thoughtful_pacing: 'MP on move',
  cornered_focus: '+MA on hit',
  // Calculator — math parameters
  ct: 'Target by CT',
  level: 'Target by level',
  height: 'Target by elevation',
  current_hp: 'Target by HP',
  // Calculator — math values
  prime: 'Match primes',
  '3': 'Match multiples of 3',
  '4': 'Match multiples of 4',
  '5': 'Match multiples of 5',
};

// Display names for math parameters/values (no catalog entry to read a name
// from). Keyed by the literal token id.
export const MATH_DISPLAY_NAME: Readonly<Record<string, string>> = {
  ct: 'Current CT',
  level: 'Level',
  height: 'Height',
  current_hp: 'Current HP',
  xp: 'XP', // TABA: Thessaly-exclusive parameter
  prime: 'Prime',
  square: 'Square', // TABA: Thessaly-exclusive value
  '3': '3',
  '4': '4',
  '5': '5',
};

// The two enabler passives — exportable/equippable anywhere once unlocked, but
// INERT without their command set. tokenId → the command set they need. Drives
// the "works with X equipped" / "needs X" row note (never an equip block).
export const ENABLER_CONDITION: Readonly<Record<string, string>> = {
  expert_former: 'Worldcraft',
  mathematician: 'Math Skill',
};
