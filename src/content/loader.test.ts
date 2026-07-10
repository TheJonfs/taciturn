import { abilityId, classId, itemId, rulesetId, statusTypeId } from '@engine/index.ts';
import { loadDefaultCatalog, items } from './index.ts';

describe('loadDefaultCatalog', () => {
  const cat = loadDefaultCatalog();

  it('constructs without throwing — the stub content has no duplicate ids', () => {
    expect(() => loadDefaultCatalog()).not.toThrow();
  });

  it('exposes the stub StatusEffectType', () => {
    expect(cat.hasStatusType(statusTypeId('haste'))).toBe(true);
    expect(cat.getStatusType(statusTypeId('haste')).name).toBe('Haste');
  });

  it('exposes the stub Ability', () => {
    expect(cat.hasAbility(abilityId('cure'))).toBe(true);
    expect(cat.getAbility(abilityId('cure')).name).toBe('Cure');
  });

  it('exposes the stub Class', () => {
    expect(cat.hasClass(classId('knight'))).toBe(true);
    expect(cat.getClass(classId('knight')).name).toBe('Knight');
  });

  it('exposes the stub Item', () => {
    expect(cat.hasItem(itemId('long_sword'))).toBe(true);
    expect(cat.getItem(itemId('long_sword')).name).toBe('Long Sword');
  });

  // The team-builder equipment picker groups weapons by `weaponType`.
  // The field is optional at the type level (engine test fixtures skip
  // it), so this is the fail-loud guard for *real* content: every
  // available weapon must declare its class or it falls into the
  // picker's catch-all "Other" group. A new weapon that forgets the
  // field trips this, not a silent mis-group at runtime.
  it('every available weapon declares a weaponType', () => {
    const unclassified = items
      .filter(
        (i) =>
          i.kind === 'weapon' &&
          i.availability === 'available' &&
          i.weaponType === undefined,
      )
      .map((i) => String(i.id));
    expect(unclassified).toEqual([]);
  });

  it('exposes the default Ruleset', () => {
    expect(cat.hasRuleset(rulesetId('default'))).toBe(true);
    expect(cat.getRuleset(rulesetId('default')).name).toBe('Default');
  });

  it('contains the session-26 baseline content set', () => {
    // The default catalog is intentionally narrow — one demo per
    // mechanism. When real content lands, this assertion is expected
    // to change; failing it from new content additions is the correct
    // signal that the baseline expanded.
    //
    // Session 20 added Lightning Mage (5 actives + reaction + support +
    // hidden retaliation active + class + command set + 2 statuses):
    //   - statuses: 18 → 20 (vulnerable, crit_modifier)
    //   - abilities: 34 → 42 (8 new — 5 actives in lightning_spells +
    //     discharge passive + discharge_strike active emitted by the
    //     reaction + conductor support)
    //   - commandSets: 6 → 7 (lightning_spells)
    //   - classes: 4 → 5 (lightning_mage)
    //   - items: unchanged
    //
    // Session 26 added the four R/S/M-parity Movement passives
    // (bedrock_stride, hotfoot, tidewalker, quickstep):
    //   - abilities: 42 → 46
    //
    // Session 29 added Shell and Protect statuses (Auto-Shell from
    // Sorcerer's Robe is the v1 consumer; Auto-Protect substrate
    // staged for future Knight gear):
    //   - statuses: 20 → 22
    //
    // Session 29 Equipment Batch A: 28 new items authored (6 weapons,
    // 3 shields, 6 body, 6 head, 7 accessories):
    //   - items: 5 → 33
    //
    // Session 31 Cluster 5 content + tagged_resistance_shift substrate:
    //   - statuses: 22 → 24 (tagged_resistance_shift; regen_auto sibling
    //     authored to give Tintinibar an Auto-Regen with battle-long
    //     duration — the cast `regen` keeps `'per_unit_ct'` for Earth
    //     Blessing)
    //   - abilities: 46 → 49 (apply_burn_proc + the two wand apply_shift
    //     abilities; hidden, fired by attackProcs)
    //   - items: 33 → 35 (bolt_hammer + rasp_pendant; existing items
    //     extended in place)
    //   - items: 35 → 42 (Session 37 batch: travel_garb, lookouts_hood,
    //     crusaders_helm, light_robe, dark_robe, tricorn, spiked_mail)
    //   - items: 42 → 46 (Session 39a Alchemist consumables: potion,
    //     phoenix_down, remedy, ether)
    //   - statuses: 24 → 25 (Session 39b combat_focus)
    //   - abilities: 49 → 54 (Session 39b: compound, throw_item ability
    //     shells; combat_focus, field_recovery, field_kit passives)
    //   - commandSets: 7 → 8 (Session 39b alchemy)
    //   - classes: 5 → 6 (Session 39b alchemist)
    //   - abilities: 54 → 55 (Session 40 apply_silence_proc; hidden,
    //     fired by Magebane's attackProcs)
    //   - items: 46 → 49 (Session 40 knife weapon class: chefs_knife,
    //     magebane, sai — Speed-based dynamic variance)
    //   - abilities: 55 → 57 (Session 41 Knight R/S/M review: martial_expertise,
    //     bravestrider; replace move_plus_1+damage_reduction in Knight free kit
    //     — both retained as cross-class options)
    //
    // Session 42 Assassin + Two Weapons substrate + Lightning Stab swap:
    //   - statuses: 25 → 28 (brave_down, faith_down, speed_save)
    //   - abilities: 57 → 65 (two_weapons, speed_save, fleet_of_foot,
    //     shadow_stitch, blowdart, undermine, sow_doubt, lightning_stab;
    //     Lightning Stab replaces Stasis Sword in Battle Skill but Stasis
    //     Sword stays registered as a cross-class option, so net +8)
    //   - commandSets: 8 → 9 (Session 42 shadow_arts)
    //   - classes: 6 → 7 (Session 42 assassin)
    //   - items: 49 → 50 (Session 42 the_offering — swings-per-weapon accessory)
    //
    // Session 45 Hunter + bow weapon class:
    //   - statuses: 28 → 30 (slow, updraft)
    //   - abilities: 65 → 72 (pin_down, charged_attack, scramble, eagle_eye,
    //     high_jump, updraft reaction, undertow [hidden Riptide proc])
    //   - commandSets: 9 → 10 (marksmanship)
    //   - classes: 7 → 8 (hunter)
    //   - items: 50 → 52 (longbow, riptide_bow)
    //
    // Session 45 follow-up — Mantle of Protection, Wand of Lumen,
    // Ironfoot (+ wand_of_lumen_apply_shift hidden proc):
    //   - abilities: 72 → 73
    //   - items: 52 → 55
    //
    // Session 48 stray-ability cleanup — Bulwark Stance suppressed
    // (no class home; was the original `modifyEvasion` consumer but
    // never lived on a class's free kit):
    //   - abilities: 73 → 72
    //
    // Session 49 Calculator + Math Skill:
    //   - statuses: 30 → 32 (cornered_focus, engineered_defenses)
    //   - abilities: 72 → 80 (precision_fire, targeted_treatment,
    //     exact_rhythm, sculpted_enhancement, engineered_defenses ability,
    //     cornered_focus reaction, mathematician, thoughtful_pacing)
    //   - commandSets: 10 → 11 (math_skill)
    //   - classes: 8 → 9 (calculator)
    //
    // Session 50 universal armor + head expansion:
    //   - items: 55 → 60 (shimmer_cloak, golden_hairpin, soul_vest,
    //     parrying_sword, skullclamp)
    //
    // Session 50 batch 3 — Knight Sword weapon class debuts:
    //   - items: 60 → 61 (absolom)
    // (damage_reduction availability flipped to 'hidden' — still in
    // catalog, just hidden from the team-builder picker; abilities()
    // count unchanged.)
    //
    // Session 51 — universal off-hand expansion (six off-hand pieces):
    //   - items: 61 → 67 (buckler, talisman_of_warding, talisman_of_conviction,
    //     tome_of_power, livre_of_urgency, battle_dictionary)
    //
    // Session 53 — Terraformer substrate:
    //   - abilities: 80 → 81 (damage_split — Terraformer native Reaction,
    //     lands in the catalog ahead of the class wiring in S54)
    //
    // Session 54 — Worldcraft command set (Terraformer class content):
    //   - abilities: 81 → 88 (pillar, pit, hill, valley, barrier,
    //     ignore_height, expert_former)
    //   - commandSets: 11 → 12 (worldcraft)
    //   - classes: 9 → 10 (terraformer)
    //
    // Session 62 — Templar arc foundation + Step 3 innates:
    //   - abilities: 88 → 94 (faithstrider — Movement passive; raise — spell
    //     revival; monkeygrip — Support, relaxes the two-handed equip rule;
    //     emissary — Support, +25% outgoing healing; unified_calling —
    //     Reaction, +PA MP on receiving a one-time heal; jump — Dragoon Jump
    //     off-field leap)
    //   - items: 67 → 70 (defender — second Knight Sword, Auto-Protect;
    //     lance + imp_halberd — the Lance weapon class, pierces)
    //   - commandSets: 12 → 13 (templar_arts — Cure / Raise / Jump)
    //   - classes: 10 → 11 (templar — class assembly)
    //
    // Session 65 — Knight content + equipment expansion + MP rebaseline:
    //   - abilities: 94 → 95 (bull_rush — Knight Battle Skill weapon attack +
    //     knockback; replaced Taunt in the set, but Taunt stays registered)
    //   - statusTypes: 32 → 33 (mana_font — the Circlet's per-turn MP regen)
    //   - items: 70 → 73 (battlemages_chain, barbut, circlet)
    //   - commandSets / classes unchanged (battle_skill swapped a member)
    //
    // Session (Thief) — the 12th class, chunk 1:
    //   - abilities: 95 → 101 (steal_hp, steal_mp, steal_buffs, slip_free,
    //     momentum, move_plus_2)
    //   - commandSets: 13 → 14 (thief_arts — Steal HP / MP / Buffs)
    //   - classes: 11 → 12 (thief)
    // Session (Thief) — chunk 2 (Steal Heart + control-override):
    //   - abilities: 101 → 102 (steal_heart, added to thief_arts)
    //   - statusTypes: 33 → 35 (enthralled — the control-override charm;
    //     heartwarded — the post-charm re-charm immunity marker)
    // Session 68 — equipment expansion (4 pieces):
    //   - abilities: 102 → 103 (wand_of_potential_apply_shift — the hidden
    //     resonance proc; the three weapons + accessory add no abilities)
    //   - items: 73 → 77 (vicious_dagger, scimitar, wand_of_potential,
    //     gauntlet_of_might)
    // Session 68 (Vantage) — the Hunter's 2nd Support:
    //   - abilities: 103 → 104 (vantage — offensive elevation +2, ADR-0115)
    // Session 72 (Enchanter chunk 1 — Auramancy actives):
    //   - abilities: 104 → 108 (enchant_haste, enchant_protect, enchant_shell,
    //     esuna; the auramancy command set + enchanter class land in chunk 3)
    //   - statusTypes: 35 → 38 (quickening, protect_cast, shell_cast — the
    //     timed cast forms of Haste / Protect / Shell, sibling to the permanent
    //     equipment-grant statuses)
    // Session 72 (Enchanter chunk 2 — RSM):
    //   - abilities: 108 → 110 (resistance_save reaction, short_charge support;
    //     float was already registered — chunk 2 revives it from 'hidden' to
    //     'available' and bumps it 1 → 2 SP, no count change)
    //   - statusTypes: 38 → 39 (resistance_save — the accumulating elemental-
    //     resistance stat-Save)
    // Session 72 (Enchanter chunk 3 — class wiring):
    //   - classes: 12 → 13 (enchanter)
    //   - commandSets: 14 → 15 (auramancy)
    // Session 72 (Aura Mastery — 2nd Enchanter Support, ADR-0122):
    //   - abilities: 110 → 111 (aura_mastery)
    // Session 76 (Monk — 14th class, 6th physical):
    //   - statusTypes: 39 → 43 (fox/bear/falcon/serpent stances)
    //   - abilities: 111 → 120 (barehanded, vigilance, counterpunch +
    //     counterpunch_strike, chakra, foxfire, bears_heave, storm_stoop,
    //     serpents_coil)
    //   - commandSets: 15 → 16 (martial_arts)
    //   - classes: 13 → 14 (monk)
    // +1 TABA: Hamstrung (Sera's stacking Move/Jump permadebuff).
    // TABA M3 Stage 4: +2 (terra_attunement, scoured).
    expect(cat.statusTypes()).toHaveLength(46);
    // +3 TABA signatures (Ascendant Flame / Bulwark Oath / Tidal Cadence) + Hamstring.
    // TABA M3 Ch1 gear: +1 (apply_vulnerable_proc — the Dagger's rider).
    // TABA M3 Stage 4: +3 (apply_scoured_proc, void_vulnerable_proc,
    // palliative_pulse — hidden rider abilities).
    expect(cat.abilities()).toHaveLength(128);
    expect(cat.commandSets()).toHaveLength(16);
    expect(cat.classes()).toHaveLength(14);
    // Session 74 (caster-accessory batch): 77 → 81 (greaves_of_seraphis,
    // ring_of_caliora, glove_of_metria, pendant_of_lumara).
    // Session 75: 81 → 82 (twist_headband).
    // TABA M3 Ch1 gear (Stage 2a): 82 → 92 (iron_sword, cutlass,
    // woodmans_axe, short_bow, dagger, padded_vest, padded_jacket,
    // chain_shirt, linen_robe, arcane_robe — all 'hidden', TABA-scoped).
    // TABA M3 Ch2 second pass (Stage 2b): 92 → 99 (runic_staff,
    // wand_of_expanse, choir_staff, warmages_edge, runecrown,
    // meditants_cowl, keen_visor — all 'hidden', TABA-scoped).
    // TABA M3 Ch3 flat batch (Stage 2c): 99 → 117 (katana,
    // manaeater_blade, master_bow, sniper_bow, main_gauche, worldstave,
    // crystal_plate, masterwork_mail, mithril_chain, senseis_gi,
    // experts_tunic, stealth_suit, titans_helm, command_cap,
    // mirror_shield, abjurers_codex, talisman_of_endurance,
    // winged_boots — all 'hidden', TABA-scoped).
    // TABA M3 Ch3 engine-prerequisite items (Stage 3): 117 → 120
    // (healers_staff, battle_staff, channelers_hat).
    // TABA M3 Ch3 effect items (Stage 4): 120 → 132 (gaias_axe,
    // spiked_maul, estoc, trident, epee, palliative_pike, prism_wand,
    // scouring_wand, moon_robe, star_robe, terra_robe, void_robe).
    // TABA M3 breadth-enabler: 132 → 133 (freelancers_charm).
    expect(cat.items()).toHaveLength(133);
    expect(cat.rulesets()).toHaveLength(1);
  });
});
