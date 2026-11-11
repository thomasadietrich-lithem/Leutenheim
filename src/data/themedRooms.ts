import { ItemId } from "./items";

/**
 * Salles à thème. Les cinq premiers essais (garde-manger, ossuaire, bibliothèque, dortoir, forge, mobilier v1) ont été
 * retirés le 2026-11-11 (Thomas : « l'identité n'est pas assez forte ») ; on les refait une par une. D'abord le
 * DORTOIR des Schrats (planche art/dortoir_v3.png) : lits superposés contre le mur du haut, cheminée, table et chaises,
 * parfois une chaise renversée, un tapis usé posé de travers.
 */
export interface ThemedRoomDef {
  id: string;
  name: string;
  /** Butin de la cache : objet, quantité de min à max, poids. `or` : la quantité grandit avec l'étage. */
  loot: { item: ItemId; min: number; max: number; weight: number; minDepth?: number }[];
}

export const THEMED_ROOMS: ThemedRoomDef[] = [
  // Forge v1 et alchimiste v1 (planches validées le 2026-11-11 : « Ok ») ; butins des caches (C).
  {
    id: "forge",
    name: "Forge",
    loot: [
      { item: "or", min: 8, max: 16, weight: 3 },
      { item: "fleche", min: 3, max: 6, weight: 2 },
      { item: "couteau_boucher", min: 1, max: 1, weight: 1, minDepth: 2 },
    ],
  },
  {
    id: "alchimiste",
    name: "Alchimiste",
    loot: [
      { item: "or", min: 8, max: 16, weight: 2 },
      { item: "potion_poison", min: 1, max: 1, weight: 2 },
      { item: "potion_feu", min: 1, max: 1, weight: 2 },
      { item: "potion_vitesse", min: 1, max: 1, weight: 1 },
    ],
  },
  // Cuisine v2, salle de prière v1, salle de torture v1 (planches validées le 2026-11-11 : « Ok fonce ») ; butins (C).
  {
    id: "cuisine",
    name: "Cuisine",
    loot: [
      { item: "pomme", min: 2, max: 4, weight: 3 },
      { item: "or", min: 6, max: 12, weight: 2 },
      { item: "potion_vitesse", min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: "priere",
    name: "Salle de prière",
    loot: [
      { item: "or", min: 10, max: 18, weight: 3 },
      { item: "amethyste", min: 1, max: 1, weight: 2 },
      { item: "potion_jouvence", min: 1, max: 1, weight: 1, minDepth: 3 },
    ],
  },
  {
    id: "torture",
    name: "Salle de torture",
    loot: [
      { item: "or", min: 8, max: 16, weight: 3 },
      { item: "potion_poison", min: 1, max: 1, weight: 2 },
      { item: "fleche_poison", min: 2, max: 4, weight: 1 },
    ],
  },
  {
    id: "dortoir",
    name: "Dortoir",
    loot: [
      { item: "or", min: 8, max: 16, weight: 3 },
      { item: "pomme", min: 1, max: 2, weight: 2 },
      { item: "sac_cuir", min: 1, max: 1, weight: 1, minDepth: 5 }, // pas avant la fin de la section 1 (Thomas)
    ],
  },
];

/**
 * Meubles : ceux qui bloquent leur(s) case(s), leur taille en cases, s'ils brûlent. Les chaises debout, le tapis et les
 * cendres ne bloquent pas. Un meuble qui brûle met le feu à ses voisins (à une case) et laisse un tas de cendres.
 */
export const FURNITURE_KINDS: Record<string, { blocks: boolean; w: number; h: number; burns: boolean; flat?: boolean; wall?: boolean }> = {
  bunkA: { blocks: true, w: 2, h: 1, burns: true },
  bunkB: { blocks: true, w: 2, h: 1, burns: true },
  table: { blocks: true, w: 2, h: 1, burns: true },
  tableApple: { blocks: true, w: 2, h: 1, burns: true },
  chairR: { blocks: false, w: 1, h: 1, burns: true },
  chairL: { blocks: false, w: 1, h: 1, burns: true },
  chairFallen: { blocks: true, w: 1, h: 1, burns: true },
  rug: { blocks: false, w: 3, h: 2, burns: true, flat: true },
  rugB: { blocks: false, w: 3, h: 2, burns: true, flat: true },
  ashes1: { blocks: false, w: 1, h: 1, burns: false },
  ashes2: { blocks: false, w: 2, h: 1, burns: false },
  // Trainards (planche art/trainards_v3.png, validée) : tonneau, caisse, deux caisses empilées. On se cache derrière.
  barrel: { blocks: true, w: 1, h: 1, burns: true },
  crate: { blocks: true, w: 1, h: 1, burns: true },
  crateStack: { blocks: true, w: 1, h: 1, burns: true },
  // Toiles d'araignée (dès l'étage 3), dans un coin de salle sans torche : TL = coin en haut à gauche, etc. Elles collent.
  webTL: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  webTR: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  webBL: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  webBR: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  // CUISINE v2 : étagère de 2 cases et jambon au crochet (contre le mur du fond), plan de travail, barrique sur chevalet,
  // sac de céréales ; rigole et évacuation peintes dans le carrelage.
  shelf2: { blocks: true, w: 2, h: 1, burns: true },
  ham: { blocks: true, w: 1, h: 1, burns: false },
  counter: { blocks: true, w: 2, h: 1, burns: true },
  barrique: { blocks: true, w: 2, h: 1, burns: true },
  grainSack: { blocks: true, w: 1, h: 1, burns: true },
  // Panier à fruits (Thomas, 2026-11-11) : ne bloque pas ; ses 2 à 3 pommes se ramassent (le dessin suit leur nombre).
  basket: { blocks: false, w: 1, h: 1, burns: true },
  gutterH: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  drain: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  // SALLE DE PRIÈRE v1 : bancs (2 cases), autel (3 cases, le pupitre au milieu), candélabres (0 à 3 bougies), tapis de
  // velours sur l'allée (3 morceaux), vitraux dans le mur du fond (sur la case de mur).
  pew: { blocks: true, w: 2, h: 1, burns: true },
  pewBroken: { blocks: true, w: 2, h: 1, burns: true },
  altar: { blocks: true, w: 3, h: 1, burns: false },
  candelBare: { blocks: true, w: 1, h: 1, burns: false },
  candelA: { blocks: true, w: 1, h: 1, burns: false },
  candelB: { blocks: true, w: 1, h: 1, burns: false },
  candelC: { blocks: true, w: 1, h: 1, burns: false },
  runnerA: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  runnerB: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  runnerC: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  vitrail0: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  vitrail1: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  // SALLE DE TORTURE v1 : table à chaînes (2 cases), râtelier, planche au mur, corde à crochet (mur du fond),
  // sarcophage à pointes (fermé, puis ouvert) ; rigole de sang et grille. Les cordes pendent en grappe, immobiles (3 dessins).
  rackTable: { blocks: true, w: 2, h: 1, burns: true },
  toolRack: { blocks: true, w: 1, h: 1, burns: true },
  wallBoard: { blocks: true, w: 1, h: 1, burns: true },
  ropeA: { blocks: true, w: 1, h: 1, burns: true },
  ropeB: { blocks: true, w: 1, h: 1, burns: true },
  ropeC: { blocks: true, w: 1, h: 1, burns: true },
  maiden: { blocks: true, w: 1, h: 1, burns: false },
  maidenOpen: { blocks: true, w: 1, h: 1, burns: false },
  bloodGutterV: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  bloodDrain: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  // FORGE v1 : enclume, armure rouillée sur support (2 dessins), charbon (3 tailles), forge et soufflet (2 cases, braises
  // animées), épée rouillée au sol, râtelier d'armes, étagère murale à outils, établi (2 cases), meule à aiguiser.
  anvil: { blocks: true, w: 1, h: 1, burns: false },
  armorStand: { blocks: true, w: 1, h: 1, burns: true },
  armorStandB: { blocks: true, w: 1, h: 1, burns: true },
  coalS: { blocks: false, w: 1, h: 1, burns: true },
  coalM: { blocks: true, w: 1, h: 1, burns: true },
  coalL: { blocks: true, w: 1, h: 1, burns: true },
  forge: { blocks: true, w: 2, h: 1, burns: false },
  rustySword: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  weaponRack: { blocks: true, w: 1, h: 1, burns: true },
  toolShelf: { blocks: true, w: 1, h: 1, burns: true },
  workbench: { blocks: true, w: 2, h: 1, burns: true },
  grindstone: { blocks: true, w: 1, h: 1, burns: true },
  // ALCHIMISTE v1 : chaudron sur le feu (animé), étagère de verrerie, ours empaillé, herbes qui sèchent (mur du fond),
  // plante en pot, bibliothèque de face (2 cases, mur du fond) ou de profil (2 cases de haut, mur de gauche / de droite),
  // grimoire sur pied (lueur animée).
  cauldron: { blocks: true, w: 1, h: 1, burns: false },
  glassShelf: { blocks: true, w: 1, h: 1, burns: true },
  stuffedBear: { blocks: true, w: 1, h: 1, burns: true },
  herbs: { blocks: true, w: 1, h: 1, burns: true },
  pottedPlant: { blocks: true, w: 1, h: 1, burns: true },
  bookcase: { blocks: true, w: 2, h: 1, burns: true },
  bookcaseL: { blocks: true, w: 1, h: 2, burns: true },
  bookcaseR: { blocks: true, w: 1, h: 2, burns: true },
  grimoire: { blocks: true, w: 1, h: 1, burns: true },
};

/** Meuble peint avec le sol (tapis, toile, rigole) : il prend exactement la lumière de sa case. */
export function isFlat(kind: string): boolean {
  return !!FURNITURE_KINDS[kind]?.flat;
}
