/**
 * QUÊTE 04 : FIFRELIN, LE KOBOLD AUX GOBELETS (Thomas, 2026-11-14 : « créé Monsieur Trèfle, trouve un autre nom » ; le
 * fifrelin, c'est la petite pièce de rien du tout). Un Kobold en gilet rouge et chapeau haut de forme cabossé, qui fait
 * le jeu des trois gobelets sur une caisse retournée. Il triche, évidemment. Une rencontre, quatre choix (C).
 */
export const FIFRELIN = {
  name: "Fifrelin",
  maxEncounters: 1,
  /** Le jeu des gobelets : la mise, et la chance de gagner (il triche : un sur quatre). */
  stake: 10,
  winChance: 0.25,
  /** Le complice démasqué : la mise rendue ×3. Le gobelet truqué rapporté : sa caisse. Les gardes chassés : sa caisse. */
  complicePrize: 30,
  gobeletPrize: 40,
  gardesPrize: 35,
};

export const FIFRELIN_OPENING = [
  "Un Kobold en gilet rouge, chapeau haut de forme cabossé, fait tourner trois gobelets sur une caisse.",
  "« Approchez, approchez ! Où est la bille ? Dix pièces la partie ! »",
  "« Personne ne gagne jamais. C'est ce qui rend le jeu si palpitant. »",
];
