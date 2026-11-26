/**
 * SALLES SPÉCIALES DANS LE DONJON (Thomas, 2026-11-26 : « implémente tout ») : une par section, sur un étage tiré au
 * hasard (1 à 4 de la section), dans une salle ordinaire assez grande. Jamais deux fois la même dans une partie.
 * Le festin des Myconides n'a lieu qu'en section 2 (les Myconides y vivent) ; la crypte qu'en section 3 (l'Ossuaire).
 */
export type SalleSpeciale = "puits" | "autel" | "miroirs" | "festin" | "cartographe" | "crypte";

export const SALLES_SPECIALES_PAR_SECTION: readonly (readonly SalleSpeciale[])[] = [
  ["puits", "autel", "miroirs", "cartographe"],
  ["festin", "puits", "autel", "miroirs", "cartographe"],
  ["crypte", "puits", "miroirs", "cartographe"],
];

/**
 * L'affiche de la crypte : l'ordre des cierges (0 = gauche, 1 = milieu, 2 = droite) et sa phrase. Les six ordres
 * possibles, écrits en entier (pour la traduction).
 */
export const CRYPTE_ORDRES: readonly { order: readonly number[]; note: string }[] = [
  { order: [0, 1, 2], note: "« Pour réveiller le gardien de la crypte : d'abord le cierge de gauche, puis celui du milieu, celui de droite en dernier. »" },
  { order: [0, 2, 1], note: "« Pour réveiller le gardien de la crypte : d'abord le cierge de gauche, puis celui de droite, celui du milieu en dernier. »" },
  { order: [1, 0, 2], note: "« Pour réveiller le gardien de la crypte : d'abord le cierge du milieu, puis celui de gauche, celui de droite en dernier. »" },
  { order: [1, 2, 0], note: "« Pour réveiller le gardien de la crypte : d'abord le cierge du milieu, puis celui de droite, celui de gauche en dernier. »" },
  { order: [2, 0, 1], note: "« Pour réveiller le gardien de la crypte : d'abord le cierge de droite, puis celui de gauche, celui du milieu en dernier. »" },
  { order: [2, 1, 0], note: "« Pour réveiller le gardien de la crypte : d'abord le cierge de droite, puis celui du milieu, celui de gauche en dernier. »" },
];
