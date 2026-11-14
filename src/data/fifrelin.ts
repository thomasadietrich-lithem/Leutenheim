/**
 * QUÊTE 04 : FIFRELIN, LE KOBOLD BOOKMAKER (Thomas, 2026-11-14 : le jeu des gobelets était « complètement naze » ;
 * choix de Thomas : « paris sur un combat »). Un Kobold en gilet rouge et chapeau haut de forme cabossé tient un petit
 * tripot de COMBATS : GROSSE-DENT, le champion, contre FIL-DE-FER, le petit nouveau. On parie, on truque, ou l'on
 * descend soi-même dans l'arène. Le combat se joue VRAIMENT, sous vos yeux (les deux se battent entre eux). Valeurs (C).
 */
export const FIFRELIN = {
  name: "Fifrelin",
  maxEncounters: 1,
  /** Parier sur le champion : mise et gain (la mise comprise). Il gagne environ 4 fois sur 5. */
  champStake: 15,
  champPayout: 22,
  /** Parier sur le petit : mise et gain (la mise comprise). */
  smallStake: 10,
  smallPayout: 40,
  /** Les deux combattants : points de vie. Truqué, le champion entre dans l'arène avec ceux-là seulement. */
  champHp: 11,
  smallHp: 8,
  riggedChampHp: 3,
  /** Battre soi-même le champion : la caisse du tripot. */
  duelPrize: 40,
};

export const FIFRELIN_OPENING = [
  "Un Kobold en gilet rouge et chapeau haut de forme cabossé grimpe sur une caisse. Derrière lui, deux Kobolds s'échauffent.",
  "« Mesdames et messieurs ! Ce soir : GROSSE-DENT, le champion, invaincu ! Contre FIL-DE-FER, le petit nouveau !",
  "Faites vos jeux ! Les paris sont ouverts ! »",
];
